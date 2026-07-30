/**
 * Packaged UML visual acceptance capture.
 *
 * Opens the bundled showcase through rendered controls in the packaged
 * Electron application, captures the system canvas, then reviews every UML
 * projection for the Finding Review module in the real full-screen viewer.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const EVIDENCE_DIR = process.env.EUIK_UML_EVIDENCE_DIR
  ? path.resolve(REPO_ROOT, process.env.EUIK_UML_EVIDENCE_DIR)
  : path.join(REPO_ROOT, 'docs/use-case-led-workflow/e2e-evidence')
const TIMEOUT = Number(process.env.EUIK_PACKAGED_TIMEOUT_MS ?? 60_000)

function packagedExecutable() {
  const candidates = [
    path.join(REPO_ROOT, 'release/mac-arm64/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
    path.join(REPO_ROOT, 'release/mac/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
  ]
  const executable = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executable) throw new Error('No packaged macOS executable was found. Run the desktop package:dir script first.')
  return executable
}

async function capture(page, name, target) {
  const destination = path.join(EVIDENCE_DIR, name)
  await page.waitForTimeout(250)
  if (target) await target.screenshot({ path: destination })
  else await page.screenshot({ path: destination })
  return path.relative(REPO_ROOT, destination)
}

async function main() {
  const { _electron: electron } = await import('playwright')
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-uml-capture-'))
  const evidence = {
    journey: 'packaged-uml-visual-acceptance',
    packaged: false,
    passed: false,
    screenshots: [],
    rendererErrors: [],
    startedAt: new Date().toISOString(),
  }
  const app = await electron.launch({
    executablePath: packagedExecutable(),
    args: [`--user-data-dir=${path.join(dataDir, 'electron-profile')}`],
    env: {
      ...process.env,
      EUIK_DATA_DIR: dataDir,
      EUIK_TEST_MODE: '1',
    },
    timeout: TIMEOUT,
  })

  try {
    const page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    // Keep the full workspace in the rendered viewport. A normal 833 px test
    // window clipped the last actor or final node from tall UML workspaces,
    // which made valid layouts look incomplete in the evidence.
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(1470, 1120)
    })
    await page.setViewportSize({ width: 1470, height: 1120 })
    await page.waitForTimeout(200)
    page.on('pageerror', (error) => evidence.rendererErrors.push({ source: 'pageerror', message: error.message }))
    page.on('console', (message) => {
      if (message.type() === 'error') evidence.rendererErrors.push({ source: 'console', message: message.text() })
    })
    await page.waitForLoadState('domcontentloaded')
    evidence.packaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)
    if (!evidence.packaged) throw new Error('Electron reports app.isPackaged=false')

    await page.getByRole('button', { name: 'Capabilities', exact: true }).click()
    await page.getByText('Synthetic workflow showcase').waitFor({ state: 'visible' })

    await page.locator('#design-workspace-tab-plan').click()
    await page.getByRole('tab', { name: 'Application workflows', exact: true }).click()
    const applicationWorkspace = page.locator('.design-application-behavior .uml-workspace')
    await applicationWorkspace.waitFor({ state: 'visible' })
    evidence.screenshots.push(await capture(page, 'uml-application-activity.png', applicationWorkspace))
    await applicationWorkspace.getByRole('tab', { name: 'Use case', exact: true }).click()
    evidence.screenshots.push(await capture(page, 'uml-application-use-case.png', applicationWorkspace))

    await page.locator('#design-workspace-tab-design').click()
    const allocationWorkspace = page.locator('.design-workflow-allocation .uml-workspace')
    await allocationWorkspace.waitFor({ state: 'visible' })
    evidence.screenshots.push(await capture(page, 'uml-solution-allocation.png', allocationWorkspace))

    const systemCanvas = page.locator('.design-canvas')
    await systemCanvas.waitFor({ state: 'visible' })
    const allDependencies = page.getByRole('button', { name: 'Show all links' })
    if (await allDependencies.getAttribute('aria-pressed') !== 'true') await allDependencies.click()
    evidence.screenshots.push(await capture(page, 'uml-system-canvas.png', systemCanvas))

    const findingReview = page.locator('.design-queue-row-button').filter({ hasText: 'Finding Review' }).first()
    await findingReview.scrollIntoViewIfNeeded()
    await findingReview.click()
    await page.locator('.design-session').waitFor({ state: 'visible' })
    const reviewDiagrams = page.locator('.design-session-step button').filter({ hasText: 'Review diagrams' }).first()
    if (!await reviewDiagrams.count()) {
      const stepText = await page.locator('.design-session-step button').allTextContents()
      throw new Error(`Review diagrams step was not available. Visible session steps: ${JSON.stringify(stepText)}`)
    }
    await reviewDiagrams.scrollIntoViewIfNeeded()
    await reviewDiagrams.click()
    await page.getByRole('heading', { name: /Finding Review — component diagram/ }).waitFor({ state: 'visible' })

    await page.getByRole('button', { name: 'Full screen', exact: true }).click()
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).waitFor({ state: 'visible' })
    const diagrams = [
      ['Component', 'uml-component-fullscreen.png'],
      ['Activity', 'uml-activity-fullscreen.png'],
      ['State machine', 'uml-state-machine-fullscreen.png'],
      ['Sequence', 'uml-sequence-fullscreen.png'],
      ['Use case', 'uml-use-case-fullscreen.png'],
    ]
    for (const [tabName, screenshotName] of diagrams) {
      await page.getByRole('tab', { name: tabName, exact: true }).click()
      await page.locator('.design-diagram-svg').waitFor({ state: 'visible' })
      evidence.screenshots.push(await capture(page, screenshotName))
    }

    evidence.passed = evidence.rendererErrors.length === 0
    evidence.completedAt = new Date().toISOString()
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'uml-packaged-manifest.json'), `${JSON.stringify(evidence, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)
    if (!evidence.passed) process.exitCode = 1
  } finally {
    await app.close().catch(() => undefined)
  }
}

await main()
