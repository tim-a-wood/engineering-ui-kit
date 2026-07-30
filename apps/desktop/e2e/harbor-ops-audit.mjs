/**
 * End-to-end product audit for a medium, UI-led sample.
 *
 * This script uses only rendered controls in the packaged app. It records
 * timings, screenshots, user-visible blockers, and the generated UI.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SAMPLE_TEMPLATE_ROOT = path.join(REPO_ROOT, 'e2e-samples/harbor-ops-console')
const OVERLAY_ROOT = path.join(REPO_ROOT, 'apps/desktop/e2e/fixtures/harbor-ops-overlay')
const OUTPUT_DIR = path.join(
  REPO_ROOT,
  'docs/use-case-led-workflow/screenshots/triage-remediation-2026-07-30',
)
const APP_RELATIVE_PATH = 'capabilities/modules/mod.experience-first/ui/index.html'
const TIMEOUT = Number(process.env.EUIK_AUDIT_TIMEOUT_MS ?? 70_000)
const JOURNEY_TIMEOUT = Number(process.env.EUIK_AUDIT_JOURNEY_TIMEOUT_MS ?? 600_000)

function packagedExecutable() {
  const candidates = [
    path.join(REPO_ROOT, 'release/mac-arm64/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
    path.join(REPO_ROOT, 'release/mac/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
  ]
  const executable = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executable) throw new Error('Run the desktop package:dir script before this audit.')
  return executable
}

function prepareOverlay(scratchRoot) {
  const overlayZip = path.join(scratchRoot, 'harbor-ops-overlay.zip')
  execFileSync('zip', ['-q', '-r', overlayZip, 'capabilities'], { cwd: OVERLAY_ROOT })
  return overlayZip
}

function prepareSample(scratchRoot) {
  const sampleRoot = path.join(scratchRoot, 'harbor-ops-console')
  fs.mkdirSync(sampleRoot, { recursive: true })
  for (const fileName of ['README.md', 'package.json', 'test-runner.mjs']) {
    fs.copyFileSync(path.join(SAMPLE_TEMPLATE_ROOT, fileName), path.join(sampleRoot, fileName))
  }
  return sampleRoot
}

async function visible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: TIMEOUT }).catch((error) => {
    throw new Error(`${description} was not visible: ${error.message}`)
  })
  return locator
}

async function waitEnabled(locator, description, timeout = TIMEOUT) {
  await visible(locator, description)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return locator
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  throw new Error(`${description} did not become enabled`)
}

async function click(locator, description, audit) {
  await visible(locator, description)
  await locator.click({ timeout: TIMEOUT })
  audit.clicks += 1
}

async function shot(page, name, audit, options = {}) {
  const outputPath = path.join(OUTPUT_DIR, `${name}.png`)
  await page.waitForTimeout(options.delay ?? 260)
  await page.screenshot({
    path: outputPath,
    fullPage: options.fullPage ?? false,
  })
  audit.screenshots.push(path.relative(REPO_ROOT, outputPath))
  return outputPath
}

async function runPhase(audit, name, task) {
  const startedAt = Date.now()
  const firstClick = audit.clicks
  console.log(`[audit] ${name}`)
  try {
    const result = await task()
    audit.phases.push({
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      clicks: audit.clicks - firstClick,
    })
    console.log(`[audit] ${name} passed in ${Date.now() - startedAt}ms`)
    return result
  } catch (error) {
    audit.phases.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      clicks: audit.clicks - firstClick,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function addFinding(audit, finding) {
  audit.findings.push(finding)
}

function observeRenderer(page, audit) {
  page.setDefaultTimeout(TIMEOUT)
  page.on('pageerror', (error) => {
    audit.rendererErrors.push({ source: 'pageerror', message: error.message })
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      audit.rendererErrors.push({ source: 'console', message: message.text() })
    }
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

async function correctFailureAction(page, audit) {
  const pathCard = page.locator('.design-plan-path-card').first()
  await visible(pathCard, 'generated failure path')
  const action = pathCard.locator('.design-reviewable-content', {
    has: page.locator('.design-reviewable-label', { hasText: /^Action$/ }),
  }).first()
  const originalAction = (await action.locator('.design-reviewable-copy p').textContent())?.trim() ?? ''
  addFinding(audit, {
    id: 'PLAN-STE-SELF-CONFLICT',
    severity: 'high',
    area: 'Plan',
    title: 'The draft generator violates its own label gate',
    evidence: `Generated action: ${originalAction}`,
  })
  await click(action.locator('summary'), 'failure action edit', audit)
  await action.locator('textarea').fill('Reject closed berth')
  await click(action.getByRole('button', { name: 'Save correction' }), 'Save failure correction', audit)
}

async function completeModuleDesign(page, audit, moduleName) {
  const moduleSlug = moduleName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await click(page.getByRole('button', { name: 'Create module draft' }), 'Create module draft', audit)
  await visible(
    page.locator('.design-session > .design-session-header h2', { hasText: moduleName }),
    'module design session',
  )

  for (let guard = 0; guard < 12; guard += 1) {
    const session = page.locator('.design-session')
    const currentStep = session.locator('.design-session-step.current')
    const currentText = (await currentStep.textContent())?.trim() ?? ''

    if (/Review diagrams/i.test(currentText)) {
      for (const diagramName of ['Component', 'Activity', 'State machine', 'Sequence', 'Use case']) {
        const tab = page.getByRole('tab', { name: diagramName })
        if (!await tab.count()) continue
        await click(tab, `Review ${moduleName} ${diagramName}`, audit)
        await shot(page, `06-${moduleSlug}-${diagramName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, audit)
      }
    }

    if (/Approve module/i.test(currentText)) break

    const questions = session.locator('.design-required-question')
    if (await questions.count()) {
      const count = await questions.count()
      for (let index = 0; index < count; index += 1) {
        const question = questions.nth(index)
        await question.locator('textarea').fill(
          'Use the repository path. Show a clear result. Keep the approved state after a failure.',
        )
        await click(question.getByRole('button', { name: 'Save answer' }), 'Save module answer', audit)
      }
      continue
    }

    const primary = session.locator('.design-session-primary-action').getByRole('button').first()
    const label = (await primary.textContent())?.trim() ?? ''
    if (!label) throw new Error(`No module action was available at ${currentText}`)
    if (/Fix \d+ design error/i.test(label)) {
      throw new Error(`The module design reported an unrecoverable action: ${label}`)
    }
    await click(primary, label, audit)
    await page.waitForTimeout(170)
  }

  const approve = page.locator('.design-step-panel').getByRole('button', { name: 'Approve module', exact: true })
  await waitEnabled(approve, 'module approval')
  await click(approve, 'Approve module', audit)
  await visible(page.getByText(/Approved by /).last(), 'module approval identity')
  await shot(page, `07-${moduleSlug}-approved`, audit)
}

async function captureProductUi(chromium, audit, sampleRoot) {
  const appPath = path.join(sampleRoot, APP_RELATIVE_PATH)
  if (!fs.existsSync(appPath)) {
    throw new Error(`The applied app is missing: ${appPath}`)
  }

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    audit.productErrors.push({ source: 'pageerror', message: error.message })
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && !/fonts\.googleapis/i.test(message.text())) {
      audit.productErrors.push({ source: 'console', message: message.text() })
    }
  })

  try {
    await page.goto(pathToFileURL(appPath).href, { waitUntil: 'domcontentloaded' })
    await visible(page.getByRole('heading', { name: 'Harbor status' }), 'Harbor dashboard')
    const dashboard = await shot(page, '10-app-dashboard', audit)
    fs.copyFileSync(dashboard, path.join(sampleRoot, 'scenario-proof.png'))

    await click(page.getByRole('button', { name: 'Assign berth' }).first(), 'Assign berth in product', audit)
    await visible(page.getByRole('dialog', { name: 'Assign berth' }), 'berth assignment dialog')
    await shot(page, '11-app-assign-berth', audit)
    await click(page.getByRole('button', { name: 'Confirm berth' }), 'Confirm berth in product', audit)
    await visible(page.getByText('Ocean Crown will use B2.'), 'assignment success')

    await click(page.locator('.sidebar').getByRole('button', { name: 'View vessels' }), 'View product vessels', audit)
    await click(page.locator('[data-detail="ocean-crown"]'), 'Review Ocean Crown', audit)
    await shot(page, '12-app-vessel-plan', audit)

    await click(page.locator('.sidebar').getByRole('button', { name: 'View handoff' }), 'View product handoff', audit)
    await visible(page.getByRole('heading', { name: 'Shift handoff' }).last(), 'product handoff')
    await shot(page, '13-app-shift-handoff', audit)
    await click(page.locator('.check-item.pending .check-toggle'), 'Complete handoff check', audit)
    await click(page.getByRole('button', { name: 'Approve handoff' }), 'Approve product handoff', audit)
    await visible(page.getByText('The night team can start.'), 'handoff success')
    await shot(page, '14-app-handoff-approved', audit)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.setViewportSize({ width: 390, height: 844 })
    await click(page.getByRole('button', { name: 'Open menu' }), 'Open mobile menu', audit)
    await click(page.locator('.sidebar').getByRole('button', { name: 'View board' }), 'View mobile board', audit)
    await shot(page, '15-app-mobile-dashboard', audit)
  } finally {
    await browser.close()
  }
}

async function waitForSummaryCount(page, label, predicate, description) {
  const cell = page.locator('.design-verify-summary > div').filter({ hasText: label }).first()
  await visible(cell, description)
  const deadline = Date.now() + TIMEOUT * 3
  while (Date.now() < deadline) {
    const value = Number(await cell.locator('strong').textContent())
    if (Number.isFinite(value) && predicate(value)) return value
    await page.waitForTimeout(160)
  }
  throw new Error(`${description} did not reach the expected count`)
}

async function runJourney(electron, chromium) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-harbor-audit-'))
  const sampleRoot = prepareSample(scratch)
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const overlayZip = prepareOverlay(scratch)
  const audit = {
    journey: 'harbor-ops-medium-sample',
    passed: false,
    packaged: false,
    clicks: 0,
    screenshots: [],
    phases: [],
    findings: [],
    warningReview: undefined,
    rendererErrors: [],
    productErrors: [],
    startedAt: new Date().toISOString(),
    repositoryRoot: sampleRoot,
    sampleTemplateRoot: SAMPLE_TEMPLATE_ROOT,
  }
  const launchOptions = {
    executablePath: packagedExecutable(),
    args: ['--window-size=1440,1000'],
    env: {
      ...process.env,
      EUIK_DATA_DIR: dataDir,
      EUIK_TEST_MODE: '1',
      EUIK_TEST_PICK_DIR: sampleRoot,
      EUIK_TEST_PICK_ZIP: overlayZip,
    },
    timeout: TIMEOUT,
  }
  let app = await electron.launch(launchOptions)
  let page

  try {
    page = await app.firstWindow({ timeout: TIMEOUT })
    observeRenderer(page, audit)
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.waitForLoadState('domcontentloaded')
    audit.packaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)
    if (!audit.packaged) throw new Error('Electron did not launch the packaged app.')

    await runPhase(audit, 'Create project', async () => {
      await click(page.getByRole('button', { name: 'New project' }).first(), 'New project entry', audit)
      await page.getByLabel('Project name').fill('Harbor Ops Console')
      await page.getByLabel('Description (optional)').fill(
        'Manage vessel arrivals, berth assignments, maintenance holds, incidents, and shift handoffs.',
      )
      await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse', audit)
      await click(
        page.getByRole('dialog', { name: 'Create project' }).getByRole('button', { name: 'Create project' }),
        'Create project',
        audit,
      )
      await visible(page.getByText('Harbor Ops Console').first(), 'new project dashboard')
      await shot(page, '02-project-dashboard', audit)
    })

    await runPhase(audit, 'Configure workflow', async () => {
      await click(page.getByRole('button', { name: 'Capabilities', exact: true }), 'Capabilities navigation', audit)
      const projectPicker = page.getByLabel('Capabilities workflow project')
      await visible(projectPicker, 'workflow project picker')
      await projectPicker.selectOption({ label: 'Harbor Ops Console' })
      await click(page.getByRole('button', { name: 'Review project setup' }), 'Review project setup', audit)
      await visible(page.getByRole('heading', { name: /Complete project setup|Setup complete/ }), 'Project setup')
      const setupAction = page.getByRole('button', { name: 'Complete setup' })
      if (await setupAction.count()) {
        await waitEnabled(setupAction, 'Complete project setup')
        await click(setupAction, 'Complete project setup', audit)
      }
      await visible(page.getByRole('heading', { name: 'Setup complete' }), 'completed project setup')
      await click(page.getByRole('button', { name: 'Guided', exact: true }), 'Guided workflow', audit)
      await visible(page.getByRole('heading', { name: 'Describe user work' }), 'Plan input')
      await shot(page, '03-plan-input', audit)
    })

    await runPhase(audit, 'Define use case', async () => {
      await page.getByLabel('Work description').fill('A harbor dispatcher manages vessel arrivals.')
      await page.getByLabel('Examples').fill(
        'Review vessel queue\nAssign vessel berth\nRecord maintenance hold\nReview harbor incident\nPrepare shift handoff',
      )
      await page.getByRole('radio', { name: /Separate user tasks/ }).check()
      await page.getByLabel('Prohibited results').fill('Never assign closed berth')
      await click(page.getByRole('button', { name: 'Add repository reference' }), 'Add project source', audit)
      const source = page.locator('.design-plan-source-drafts li').first()
      await source.getByLabel('Name').fill('Product brief')
      await source.getByLabel('Repository-relative reference').fill('README.md')
      await source.getByLabel('Required').check()
      await click(source.getByRole('button', { name: 'Check source' }), 'Check project source', audit)
      await visible(source.getByText('✓ Available'), 'available project source')
      await click(page.getByRole('button', { name: 'Create use-case draft' }), 'Create use-case draft', audit)
      await visible(page.getByRole('heading', { name: 'Check use cases' }), 'Plan review')
      await shot(page, '04-plan-decomposed', audit)

      const approval = page.getByRole('button', { name: 'Approve this revision' })
      await waitEnabled(approval, 'Plan approval')
      await click(approval, 'Approve Plan revision', audit)
      await visible(page.getByText(/Approved by /).first(), 'Plan approval identity')
      await shot(page, '05-plan-approved', audit)
    })

    await runPhase(audit, 'Review application workflow', async () => {
      await click(
        page.getByRole('button', { name: 'Continue to application workflows' }),
        'Continue to application workflows',
        audit,
      )
      await visible(page.getByRole('heading', { name: 'Check application behavior' }), 'application workflow')
      await visible(page.getByText('Workflow checks pass'), 'application workflow result')
      await shot(page, '05a-application-workflow', audit)
    })

    await runPhase(audit, 'Approve system design', async () => {
      await click(page.locator('#design-workspace-tab-design'), 'Design stage', audit)
      await visible(page.getByRole('heading', { name: 'Choose system structure' }), 'system structure choices')
      await page.getByRole('radio', { name: /Experience-first/ }).check()
      await click(page.getByRole('button', { name: 'Create this design' }), 'Create system design', audit)
      await visible(page.getByRole('heading', { name: 'Review system structure' }), 'system structure review')
      await shot(page, '05b-system-structure', audit)
      const approval = page.getByRole('button', { name: 'Approve system structure' })
      await waitEnabled(approval, 'system structure approval')
      await click(approval, 'Approve system structure', audit)
      await visible(page.getByRole('heading', { name: 'System structure' }), 'approved system structure')
    })

    await runPhase(audit, 'Design module', async () => {
      for (const moduleName of ['Application workflow', 'User workspace']) {
        await click(
          page.locator('.design-queue-row-button').filter({ hasText: moduleName }),
          `Select ${moduleName}`,
          audit,
        )
        await completeModuleDesign(page, audit, moduleName)
      }
    })

    await runPhase(audit, 'Build sample', async () => {
      await click(page.locator('#design-workspace-tab-build'), 'Build stage', audit)
      await visible(page.getByRole('heading', { name: 'Prepare module delivery' }), 'Build handoff')

      for (const label of ['Create Design baseline', 'Approve Design baseline']) {
        const action = page.getByRole('button', { name: label })
        await waitEnabled(action, label)
        await click(action, label, audit)
      }
      await visible(page.getByRole('heading', { name: 'Baseline approved' }), 'approved design baseline')

      await click(
        page.getByRole('button', { name: 'Create implementation handoff' }).last(),
        'Create implementation handoff',
        audit,
      )
      await visible(page.getByText('Created an implementation handoff packet.'), 'implementation handoff')
      await click(page.getByRole('button', { name: 'Open build' }), 'Open build', audit)
      await visible(page.getByRole('heading', { name: 'Build', exact: true }), 'Build workspace')
      await click(page.getByRole('button', { name: 'Generate', exact: true }), 'Generate handoff', audit)
      await visible(page.locator('.status-line').filter({ hasText: 'Handoff ready:' }).first(), 'Build handoff result')
      await click(page.getByRole('button', { name: /Select .*zip/i }).first(), 'Select returned overlay', audit)
      await visible(page.getByRole('heading', { name: 'Inspection result' }), 'overlay inspection')

      const blockers = page.getByText('Apply blockers', { exact: true })
      if (await blockers.count()) {
        await shot(page, '08-build-ste-blocked', audit)
        const blockerText = (await page.locator('.validation-summary').textContent())?.trim() ?? ''
        addFinding(audit, {
          id: 'BUILD-STE-FRICTION',
          severity: 'high',
          area: 'Build',
          title: 'The generated UI fails the overlay writing gate',
          evidence: blockerText.slice(0, 1200),
        })
        throw new Error(`Overlay inspection blocked the sample UI: ${blockerText}`)
      }

      const warningBox = page.getByText('Overlay warnings', { exact: true })
      const hasWarnings = (await warningBox.count()) > 0
      if (hasWarnings) {
        const warningPanel = warningBox.locator('..')
        const warningText = (await warningPanel.textContent())?.trim() ?? ''
        audit.warningReview = {
          status: 'accepted-for-sample',
          evidence: warningText.slice(0, 1200),
        }
        await warningPanel.getByLabel('Accept all warnings').check()
      }

      if (!hasWarnings) {
        await visible(page.getByText('Pass', { exact: true }), 'passing overlay')
      }
      const apply = page.getByRole('button', { name: 'Apply changes' })
      await waitEnabled(apply, 'Apply changes')
      await click(apply, 'Apply changes', audit)
      await visible(page.getByRole('heading', { name: 'Build ready' }), 'build-ready result')
      await shot(page, '08-build-applied', audit)
    })

    await runPhase(audit, 'Exercise sample UI', async () => {
      await captureProductUi(chromium, audit, sampleRoot)
    })

    await runPhase(audit, 'Connect entry point', async () => {
      await click(page.getByRole('button', { name: 'Back to Capabilities' }), 'Back to Capabilities', audit)
      await visible(page.getByRole('heading', { name: 'Product delivery' }), 'Product delivery')
      await click(page.locator('#design-workspace-tab-connect'), 'Connect stage', audit)
      await visible(
        page.getByRole('heading', { name: 'Connect entry points' }),
        'Connect workspace',
      )
      await page.getByRole('radio', { name: /User interface/ }).check()
      await page.getByLabel('Local UI').fill(APP_RELATIVE_PATH)
      await page.getByLabel('Ready selector').fill('.app-shell')
      await page.getByLabel('Capture target').fill('main')
      const scenarioMappings = [
        { scenario: 'Review vessel queue', action: '[data-view-target="board"]', result: '[data-view="board"].active .arrivals-panel', text: 'Vessel queue' },
        { scenario: 'Assign vessel berth', action: '.primary-button[data-open-assign]', result: '.modal-backdrop:not([hidden]) #assign-title', text: 'Assign berth' },
        { scenario: 'Reject closed berth', action: '[data-attempt-closed]', result: '[data-assign-note].error', text: 'C2 is closed' },
        { scenario: 'Record maintenance hold', action: '[data-review-maintenance]', result: '[data-info-dialog="maintenance"]:not([hidden])', text: 'Berth C2 closed' },
        { scenario: 'Review harbor incident', action: '[data-review-incidents]', result: '[data-info-dialog="incidents"]:not([hidden])', text: 'No safety action' },
        { scenario: 'Prepare shift handoff', action: '[data-view-target="handoff"]', result: '[data-view="handoff"].active', text: 'Shift handoff' },
      ]
      const scenarioFields = page.locator('.design-connect-ui-steps > fieldset')
      if (await scenarioFields.count() !== scenarioMappings.length) {
        throw new Error(`Expected ${scenarioMappings.length} UI scenario mappings, found ${await scenarioFields.count()}.`)
      }
      for (const mapping of scenarioMappings) {
        const fields = scenarioFields.filter({ has: page.locator(`legend:text-is("${mapping.scenario}")`) })
        if (await fields.count() !== 1) throw new Error(`Expected one mapping row for ${mapping.scenario}.`)
        await fields.getByLabel(/^Action selector for step /).fill(mapping.action)
        await fields.getByLabel(/^Result selector for step /).fill(mapping.result)
        await fields.getByLabel(/^Expected text for step /).fill(mapping.text)
      }
      const save = page.getByRole('button', { name: 'Save binding' })
      await waitEnabled(save, 'Save binding')
      await click(save, 'Save binding', audit)
      await visible(page.getByText('Ready to verify'), 'saved binding')
      const verify = page.getByRole('button', { name: 'Verify connection' })
      await waitEnabled(verify, 'Verify connection')
      await click(verify, 'Verify connection', audit)
      await visible(page.getByText('Connection proved'), 'proved connection')
      await page.locator('.main').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
      await shot(page, '16-connect-verified', audit)
    })

    await runPhase(audit, 'Verify scenarios', async () => {
      await click(page.locator('#design-workspace-tab-verify'), 'Verify stage', audit)
      await visible(page.getByRole('heading', { name: 'Approved scenarios' }), 'Verify workspace')
      const scenarioCount = await waitForSummaryCount(page, 'Scenarios', (value) => value > 0, 'scenario count')
      await click(page.getByRole('button', { name: 'Run all current scenarios' }), 'Run all scenarios', audit)
      await waitEnabled(
        page.getByRole('button', { name: 'Run all current scenarios' }),
        'completed scenario run',
        TIMEOUT * 2,
      )
      const passedCount = await waitForSummaryCount(
        page,
        'Recorded passed',
        (value) => value === scenarioCount,
        'passed scenario count',
      )
      const failedCount = await waitForSummaryCount(
        page,
        'Recorded failed',
        (value) => value === 0,
        'failed scenario count',
      )
      audit.scenarioSummary = { scenarioCount, passedCount, failedCount }
      const approve = page.getByRole('button', { name: 'Approve this exact result' })
      await waitEnabled(approve, 'verification approval')
      await click(approve, 'Approve verification result', audit)
      await visible(page.getByText('Verification approved'), 'verification approval')
      await shot(page, '17-verify-passed', audit)
    })

    await runPhase(audit, 'Review evidence', async () => {
      await click(page.getByRole('button', { name: 'Open immutable evidence' }), 'Open immutable evidence', audit)
      await visible(
        page.getByRole('heading', { name: 'Trace result evidence' }),
        'Evidence workspace',
      )
      await visible(page.getByText('current · passed').first(), 'current evidence')
      await click(
        page.locator('[aria-label="Recorded runs"] button').filter({ hasText: 'Reject closed berth' }).first(),
        'Select closed berth evidence',
        audit,
      )
      await visible(page.locator('.design-evidence-run-heading h3', { hasText: 'Reject closed berth' }), 'closed berth evidence')
      await shot(page, '18-evidence-trace', audit)
      await click(
        page.getByRole('button', { name: 'Open Original screenshot at full resolution' }).first(),
        'Open original screenshot',
        audit,
      )
      await visible(page.getByRole('dialog', { name: 'Original screenshot' }), 'original screenshot dialog')
      await shot(page, '19-evidence-original', audit)
    })

    audit.rendererErrors = audit.rendererErrors.filter((entry) => !/favicon/i.test(entry.message))
    audit.passed = true
    audit.completedAt = new Date().toISOString()
    audit.durationMs = Date.parse(audit.completedAt) - Date.parse(audit.startedAt)
    return audit
  } catch (error) {
    audit.error = error instanceof Error ? error.stack : String(error)
    audit.completedAt = new Date().toISOString()
    audit.durationMs = Date.parse(audit.completedAt) - Date.parse(audit.startedAt)
    try {
      await shot(page ?? (await app.windows())[0], 'failure', audit, { fullPage: true })
    } catch {
      // Failure evidence is best effort.
    }
    throw error
  } finally {
    await closePackagedApp(app)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'audit-manifest.json'),
      `${JSON.stringify(audit, null, 2)}\n`,
    )
  }
}

const watchdog = setTimeout(() => {
  console.error(`Harbor Ops audit exceeded ${JOURNEY_TIMEOUT}ms`)
  process.exit(1)
}, JOURNEY_TIMEOUT)
watchdog.unref()

try {
  const { _electron, chromium } = await import('playwright')
  const result = await runJourney(_electron, chromium)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
}
