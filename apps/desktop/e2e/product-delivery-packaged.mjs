/**
 * Packaged Product delivery acceptance journey.
 *
 * This drives rendered controls in the real packaged Electron application.
 * It does not call the preload bridge, dispatch IPC, or mutate workflow state
 * through page evaluation. The evidence therefore covers the renderer,
 * packaged preload, desktop design bridge, filesystem repository adapter, and
 * persisted workflow records as one user-visible path.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const EVIDENCE_DIR = path.join(REPO_ROOT, 'apps/desktop/validation-evidence/product-delivery-packaged')
const TIMEOUT = Number(process.env.EUIK_PACKAGED_TIMEOUT_MS ?? 60_000)
const JOURNEY_TIMEOUT = Number(process.env.EUIK_PACKAGED_JOURNEY_TIMEOUT_MS ?? 480_000)

function packagedExecutable() {
  const candidates = [
    path.join(REPO_ROOT, 'release/mac-arm64/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
    path.join(REPO_ROOT, 'release/mac/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
  ]
  const executable = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executable) throw new Error('No packaged macOS executable was found. Run the desktop package:dir script first.')
  return executable
}

async function visible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: TIMEOUT }).catch((error) => {
    throw new Error(`${description} was not visible: ${error.message}`)
  })
  return locator
}

async function click(locator, description) {
  await visible(locator, description)
  await locator.click({ timeout: TIMEOUT })
}

async function waitEnabled(locator, description) {
  await visible(locator, description)
  const deadline = Date.now() + TIMEOUT
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return locator
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`${description} did not become enabled`)
}

async function shot(page, name, evidence) {
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.waitForTimeout(220)
  await page.screenshot({ path: file })
  evidence.screenshots.push(path.relative(REPO_ROOT, file))
}

function observeRenderer(page, evidence) {
  page.setDefaultTimeout(TIMEOUT)
  page.on('pageerror', (error) => evidence.rendererErrors.push({ source: 'pageerror', message: error.message }))
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.rendererErrors.push({ source: 'console', message: message.text() })
  })
}

async function closePackagedApp(app) {
  if (!app) return
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 10_000)),
  ])
  try {
    if (!app.process().killed) app.process().kill('SIGKILL')
  } catch {
    // The normal close path already ended the process.
  }
}

async function answerPlanQuestions(page) {
  const questions = page.getByRole('region', { name: 'Material questions' })
  for (let attempt = 0; attempt < 12 && await questions.count(); attempt += 1) {
    const input = questions.locator('input').first()
    if (!await input.count()) break
    await input.fill('Use the repository-local command, preserve the last approved result, and record structured evidence.')
    await click(questions.getByRole('button', { name: 'Save answer' }).first(), 'Save Plan answer')
    await page.waitForTimeout(150)
  }
}

async function waitForSummaryCount(page, label, predicate, description) {
  const cell = page.locator('.design-verify-summary > div').filter({ hasText: label }).first()
  await visible(cell, description)
  const deadline = Date.now() + TIMEOUT * 3
  while (Date.now() < deadline) {
    const value = Number(await cell.locator('strong').textContent())
    if (Number.isFinite(value) && predicate(value)) return value
    await page.waitForTimeout(150)
  }
  throw new Error(`${description} did not reach the expected count`)
}

function prepareRepositoryFixture(repositoryRoot, scratch) {
  fs.writeFileSync(path.join(repositoryRoot, 'README.md'), '# Packaged product-delivery fixture\n')
  fs.writeFileSync(
    path.join(repositoryRoot, 'package.json'),
    `${JSON.stringify({
      name: 'packaged-product-delivery-fixture',
      private: true,
      type: 'module',
      scripts: { test: 'node ./test-runner.mjs' },
    }, null, 2)}\n`,
  )
  fs.writeFileSync(
    path.join(repositoryRoot, 'test-runner.mjs'),
    [
      "import fs from 'node:fs'",
      "import path from 'node:path'",
      "const screenshotPath = process.env.EUIK_SCREENSHOT_PATH",
      "const proof = path.resolve('scenario-proof.png')",
      "if (screenshotPath && fs.existsSync(proof)) {",
      "  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })",
      "  fs.copyFileSync(proof, screenshotPath)",
      "}",
      "process.stdout.write(JSON.stringify({ passed: true, module: process.argv[2] ?? 'all' }))",
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(repositoryRoot, 'cli.mjs'),
    "process.stdout.write(JSON.stringify({ ok: true, input: JSON.parse(process.argv.at(-1) || '{}') }))\n",
  )

  const overlayRoot = path.join(scratch, 'overlay')
  const overlayFile = path.join(overlayRoot, 'capabilities/modules/mod.focused-core/implementation.mjs')
  const overlayZip = path.join(scratch, 'ui-overlay.zip')
  fs.mkdirSync(path.dirname(overlayFile), { recursive: true })
  fs.writeFileSync(
    overlayFile,
    "export function validateDeliveryPackage(input) { return { status: 'passed', input } }\n",
  )
  execFileSync('zip', ['-q', '-r', overlayZip, 'capabilities'], { cwd: overlayRoot })
  return overlayZip
}

async function runJourney(electron) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  for (const staleName of ['failure.png', 'failure.json']) {
    const stalePath = path.join(EVIDENCE_DIR, staleName)
    if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath)
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-product-delivery-'))
  const repositoryRoot = path.join(scratch, 'repo')
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(repositoryRoot, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const overlayZip = prepareRepositoryFixture(repositoryRoot, scratch)

  const evidence = {
    journey: 'product-delivery',
    packaged: false,
    passed: false,
    screenshots: [],
    rendererErrors: [],
    startedAt: new Date().toISOString(),
  }
  const launchOptions = {
    executablePath: packagedExecutable(),
    env: {
      ...process.env,
      EUIK_DATA_DIR: dataDir,
      EUIK_TEST_MODE: '1',
      EUIK_TEST_PICK_DIR: repositoryRoot,
      EUIK_TEST_PICK_ZIP: overlayZip,
    },
    timeout: TIMEOUT,
  }
  let app = await electron.launch(launchOptions)
  let page

  try {
    page = await app.firstWindow({ timeout: TIMEOUT })
    observeRenderer(page, evidence)
    await page.waitForLoadState('domcontentloaded')
    evidence.packaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)
    if (!evidence.packaged) throw new Error('Electron reports app.isPackaged=false')

    await click(page.getByRole('button', { name: 'New Project' }).first(), 'New Project')
    await page.getByLabel('Project name').fill('Packaged Product Delivery')
    await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse')
    await click(page.getByRole('button', { name: 'Create Project' }), 'Create Project')
    await click(page.getByRole('button', { name: 'Capabilities', exact: true }), 'Capabilities navigation')

    const projectPicker = page.getByLabel('Capabilities workflow project')
    await visible(projectPicker, 'Product delivery project picker')
    await projectPicker.selectOption({ label: 'Packaged Product Delivery' })
    await click(page.getByRole('button', { name: 'Review project setup' }), 'Review project setup')
    await visible(page.getByRole('heading', { name: 'Project setup' }), 'Project setup')
    if (!await page.getByText(/Configured repository:/).count()) {
      await page.getByLabel('Configure repository root').fill(repositoryRoot)
      await click(page.getByRole('button', { name: 'Configure repository root' }), 'Configure repository root')
      await visible(page.getByText(/Configured repository:/), 'configured repository confirmation')
    }
    await visible(page.getByText(/Signed in as /), 'session principal')
    await click(
      page.getByRole('button', { name: 'Grant design authorities to this session user' }),
      'Grant design authorities',
    )
    await visible(page.getByText(/Granted \d+ authorities to /), 'design authority confirmation')
    await click(page.getByRole('button', { name: 'Guided', exact: true }), 'Guided workflow')
    await visible(page.getByRole('heading', { name: 'Describe the work users must complete' }), 'Plan describe screen')
    await shot(page, '01-plan-describe', evidence)

    await page.getByLabel('Work description').fill(
      'A release manager runs a repository-local command to validate a delivery package. '
      + 'The workflow must report a structured pass or failure result, preserve the last approved result on failure, '
      + 'and retain evidence that an independent reviewer can inspect.',
    )
    await page.getByLabel('Examples, one per line').fill('Validate the current delivery package\nReview the recorded result')
    await page.getByLabel('Prohibited results, one per line').fill('Never replace the last approved result after a failed validation')
    await click(page.getByRole('button', { name: 'Create use-case draft' }), 'Create use-case draft')
    await visible(page.getByRole('heading', { name: 'Check the use-case analysis' }), 'Plan review screen')
    await answerPlanQuestions(page)
    await waitEnabled(page.getByRole('button', { name: 'Approve this revision' }), 'Plan approval')
    await click(page.getByRole('button', { name: 'Approve this revision' }), 'Approve Plan revision')
    await visible(page.getByText(/Approved by /).first(), 'Plan approval identity')
    await shot(page, '02-plan-approved', evidence)

    await click(page.getByRole('button', { name: 'Continue to system design' }), 'Continue to system design')
    await visible(page.getByRole('heading', { name: 'Choose a starting structure' }), 'system design choices')
    await click(page.getByRole('button', { name: 'Create this design' }), 'Create system design')
    await visible(page.getByRole('heading', { name: 'Review and shape the system' }), 'system design review')
    await waitEnabled(page.getByRole('button', { name: 'Approve system structure' }), 'system structure approval')
    await click(page.getByRole('button', { name: 'Approve system structure' }), 'Approve system structure')
    await visible(page.getByRole('heading', { name: 'Approved system structure' }), 'approved system structure')
    await shot(page, '03-system-approved', evidence)

    await click(page.getByRole('button', { name: 'Create module draft' }), 'Create module draft')
    await visible(page.locator('.design-session > .design-session-header h2', { hasText: 'Core workflow' }), 'module design session')
    for (const actionName of [
      'Continue module design',
      'Continue module design',
      'Review contracts',
      'Continue module design',
    ]) {
      await click(page.getByRole('button', { name: actionName, exact: true }), actionName)
    }
    await visible(page.getByRole('heading', { name: 'Module-design checks' }), 'module checks step')
    await click(page.getByRole('button', { name: 'Run design checks', exact: true }), 'Run design checks')
    await visible(page.getByRole('heading', { name: 'Approve module' }), 'module approval step')
    const approveModule = page.locator('.design-step-panel').getByRole('button', { name: 'Approve module', exact: true })
    await waitEnabled(approveModule, 'module approval')
    await click(approveModule, 'Approve module')
    await visible(page.getByText(/Approved by /).last(), 'module approval identity')
    await shot(page, '04-module-approved', evidence)

    await click(page.locator('#design-workspace-tab-build'), 'Build stage')
    await visible(page.getByRole('heading', { name: 'Prepare one module for delivery' }), 'Build handoff')
    await click(page.getByRole('button', { name: 'Create Design baseline' }), 'Create Design baseline')
    await visible(page.getByRole('heading', { name: 'Approve the Design baseline' }), 'Design baseline approval gate')
    await waitEnabled(page.getByRole('button', { name: 'Approve Design baseline' }), 'Design baseline approval')
    await click(page.getByRole('button', { name: 'Approve Design baseline' }), 'Approve Design baseline')
    await visible(page.getByRole('heading', { name: 'Design baseline approved' }), 'approved Design baseline')
    await click(page.getByRole('button', { name: 'Create implementation handoff' }).last(), 'Create implementation handoff')
    await visible(page.getByText('Created an implementation handoff packet.'), 'implementation handoff result')
    await click(page.getByRole('button', { name: 'Continue to Build & Test' }), 'Continue to Build & Test')
    await visible(page.getByRole('heading', { name: 'Build', exact: true }), 'Build & Test workspace')
    await visible(page.locator('.build-origin-banner h2', { hasText: 'Core workflow' }), 'Capabilities packet origin')
    await click(page.getByRole('button', { name: 'Generate', exact: true }), 'Generate Build handoff')
    await visible(page.locator('.status-line').filter({ hasText: 'Handoff ready:' }).first(), 'generated Build handoff')
    await click(page.getByRole('button', { name: 'Select ui-overlay.zip…' }), 'Select returned overlay')
    await visible(page.getByRole('heading', { name: 'Inspection result' }), 'overlay inspection')
    await visible(page.getByText('Pass', { exact: true }), 'passing overlay inspection')
    await waitEnabled(page.getByRole('button', { name: 'Apply changes' }), 'Apply changes')
    await click(page.getByRole('button', { name: 'Apply changes' }), 'Apply changes')
    await visible(page.getByRole('heading', { name: 'Applied files' }), 'applied Build files')
    await shot(page, '05-build-applied', evidence)

    await click(page.getByRole('button', { name: 'Back to Capabilities' }), 'Back to Capabilities')
    await visible(page.getByRole('heading', { name: 'Product delivery' }), 'Product delivery workspace after Build')
    await click(page.locator('#design-workspace-tab-connect'), 'Connect stage')
    await visible(page.getByRole('heading', { name: 'Connect the approved capability to a real entry point' }), 'Connect workspace')
    await page.getByPlaceholder('node ./bin/app.mjs execute').fill('node ./cli.mjs')
    await waitEnabled(page.getByRole('button', { name: 'Save binding' }), 'Save binding')
    await click(page.getByRole('button', { name: 'Save binding' }), 'Save binding')
    await visible(page.getByText('Ready to verify'), 'configured binding')
    await waitEnabled(page.getByRole('button', { name: 'Verify connection' }), 'Verify connection')
    await click(page.getByRole('button', { name: 'Verify connection' }), 'Verify connection')
    await visible(page.getByText('Connection proved'), 'proved connection')
    await shot(page, '06-connect-verified', evidence)
    fs.copyFileSync(path.join(EVIDENCE_DIR, '06-connect-verified.png'), path.join(repositoryRoot, 'scenario-proof.png'))

    await click(page.locator('#design-workspace-tab-verify'), 'Verify stage')
    await visible(page.getByRole('heading', { name: 'Approved scenarios' }), 'Verify workspace')
    const scenarioCount = await waitForSummaryCount(page, 'Scenarios', (value) => value > 0, 'scenario count')
    await click(page.getByRole('button', { name: 'Run all current scenarios' }), 'Run all current scenarios')
    await waitEnabled(page.getByRole('button', { name: 'Run all current scenarios' }), 'completed scenario run')
    const passedCount = await waitForSummaryCount(page, 'Recorded passed', (value) => value === scenarioCount, 'passed scenario count')
    const failedCount = await waitForSummaryCount(page, 'Recorded failed', (value) => value === 0, 'failed scenario count')
    if (passedCount !== scenarioCount || failedCount !== 0) {
      throw new Error(`Scenario results were not all passing (${passedCount}/${scenarioCount} passed, ${failedCount} failed)`)
    }
    await waitEnabled(page.getByRole('button', { name: 'Approve this exact result' }), 'verification approval')
    await click(page.getByRole('button', { name: 'Approve this exact result' }), 'Approve exact verification result')
    await visible(page.getByText('Verification approved'), 'verification approval confirmation')
    await shot(page, '07-verify-passed', evidence)
    await click(page.getByRole('button', { name: 'Open immutable evidence' }), 'Open immutable evidence')
    await visible(page.getByRole('heading', { name: 'Follow the result from intent to original artifacts' }), 'Evidence workspace')
    await visible(page.getByText('current · passed').first(), 'current passing evidence')
    await shot(page, '08-evidence-trace', evidence)
    const originalScreenshot = page.getByRole('button', { name: 'Open Original screenshot at full resolution' }).first()
    await click(originalScreenshot, 'Open original scenario screenshot')
    await visible(page.getByRole('dialog', { name: 'Original screenshot' }), 'original screenshot viewer')
    await visible(page.getByText(/Original resolution/), 'original screenshot metadata')
    await shot(page, '09-evidence-original', evidence)

    const currentUrl = page.url()
    evidence.currentRoute = new URL(currentUrl).hash
    await page.reload({ waitUntil: 'domcontentloaded' })
    await visible(page.getByRole('dialog', { name: 'Original screenshot' }), 'routed artifact after renderer reload')
    await visible(page.getByText('current · passed').first(), 'current evidence after renderer reload')
    if (page.url() !== currentUrl) throw new Error(`Workflow deep link changed across reload: ${page.url()}`)
    evidence.routeRestored = true
    await shot(page, '10-route-restored', evidence)

    await closePackagedApp(app)
    app = await electron.launch(launchOptions)
    page = await app.firstWindow({ timeout: TIMEOUT })
    observeRenderer(page, evidence)
    await page.waitForLoadState('domcontentloaded')
    await click(page.getByRole('button', { name: 'Capabilities', exact: true }), 'Capabilities after restart')
    const restartedPicker = page.getByLabel('Capabilities workflow project')
    await visible(restartedPicker, 'project picker after restart')
    if (await restartedPicker.inputValue() === '') {
      await restartedPicker.selectOption({ label: 'Packaged Product Delivery' })
    }
    await visible(page.getByRole('heading', { name: 'Product delivery' }), 'Product delivery after restart')
    const restartedArtifactDialog = page.getByRole('dialog', { name: 'Original screenshot' })
    if (await restartedArtifactDialog.count()) {
      await visible(restartedArtifactDialog, 'artifact route restored after application restart')
      evidence.restartDeepLinkRestored = page.url() === currentUrl
      await click(restartedArtifactDialog.getByRole('button', { name: 'Done' }), 'Close restored artifact after restart')
    }
    await click(page.getByRole('button', { name: 'Guided', exact: true }), 'Guided workflow after restart')
    await waitEnabled(page.locator('#design-workspace-tab-evidence'), 'Evidence stage after restart')
    await click(page.locator('#design-workspace-tab-evidence'), 'Evidence stage after restart')
    await visible(page.getByRole('heading', { name: 'Follow the result from intent to original artifacts' }), 'Evidence after restart')
    await visible(page.getByText('current · passed').first(), 'current passing evidence after restart')
    await visible(page.getByText(/Verification approved/).first(), 'verification approval after restart')
    evidence.restartRestored = true
    await shot(page, '11-restart-restored', evidence)

    evidence.rendererErrors = evidence.rendererErrors.filter((entry) => !/favicon/i.test(entry.message))
    if (evidence.rendererErrors.length) {
      throw new Error(`Renderer emitted errors: ${JSON.stringify(evidence.rendererErrors)}`)
    }
    evidence.passed = true
    evidence.completedAt = new Date().toISOString()
    return evidence
  } catch (error) {
    evidence.error = error instanceof Error ? error.stack : String(error)
    try { await shot(page ?? (await app.windows())[0], 'failure', evidence) } catch { /* best-effort failure evidence */ }
    throw error
  } finally {
    await closePackagedApp(app)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'manifest.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  }
}

const watchdog = setTimeout(() => {
  console.error(`Packaged Product delivery journey exceeded ${JOURNEY_TIMEOUT}ms`)
  process.exit(1)
}, JOURNEY_TIMEOUT)
watchdog.unref()

try {
  const { _electron } = await import('playwright')
  const result = await runJourney(_electron)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
}
