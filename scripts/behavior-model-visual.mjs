/**
 * Production visual evidence for the three-level behavior model.
 *
 * Run the GUI first, then execute:
 *   npm run visual:behavior
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(
  root,
  'docs/use-case-led-workflow/screenshots/behavior-model-final',
)
const targetUrl = process.env.BEHAVIOR_VISUAL_URL ?? 'http://127.0.0.1:5300/'
fs.mkdirSync(outputDir, { recursive: true })

function browserExecutable() {
  const override = process.env.BEHAVIOR_VISUAL_BROWSER
  if (override && fs.existsSync(override)) return override
  const bundled = chromium.executablePath()
  if (bundled && fs.existsSync(bundled)) return bundled
  throw new Error('No Chromium executable is available for behavior-model visual checks.')
}

async function waitForDiagram(page, workspace) {
  // A tab change can leave the prior paper visible while the next layout
  // finishes. Let the deterministic layout settle before accepting the stage.
  await page.waitForTimeout(500)
  if (await workspace.locator('.uml-layout-error').count()) {
    throw new Error(await workspace.locator('.uml-layout-error').innerText())
  }
  await workspace.locator('.uml-joint-stage').waitFor({ state: 'visible' })
  await page.waitForTimeout(100)
  if (await workspace.locator('.uml-layout-error').count()) {
    throw new Error(await workspace.locator('.uml-layout-error').innerText())
  }
}

async function frameWorkspace(page, workspace) {
  await workspace.evaluate((element) => {
    element.scrollIntoView({ block: 'start', inline: 'nearest' })
    window.scrollBy(0, -132)
  })
  await page.waitForTimeout(200)
}

async function capture(page, name, workspace) {
  if (workspace) {
    await waitForDiagram(page, workspace)
    await frameWorkspace(page, workspace)
  }
  const file = path.join(outputDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`captured ${name}`)
}

async function captureView(page, name, view) {
  await view.waitFor({ state: 'visible' })
  await frameWorkspace(page, view)
  await capture(page, name)
}

async function captureModuleDiagram(page, name, workspace) {
  await workspace.locator('.design-diagram-svg').waitFor({ state: 'visible' })
  await page.waitForTimeout(300)
  await frameWorkspace(page, workspace)
  await capture(page, name)
}

async function openDo178Capabilities(page) {
  await page.goto(targetUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Capabilities', exact: true }).click()
  await page.getByRole('heading', { name: 'Product delivery', exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Use-case analysis', exact: true }).waitFor()
  await page.waitForTimeout(500)
}

const browser = await chromium.launch({
  executablePath: browserExecutable(),
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1800, height: 1600 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error)))

try {
  await openDo178Capabilities(page)

  await captureView(page, '01-plan-use-cases', page.locator('.design-plan'))

  await page.getByRole('tab', { name: 'Application workflows', exact: true }).click()
  await page.waitForTimeout(500)
  const applicationView = page.locator('.design-application-behavior')
  await applicationView.locator('.design-behavior-selector select').selectOption({ label: 'Review finding' })
  const applicationDiagram = applicationView.locator('.uml-workspace')
  await capture(page, '02-application-activity', applicationDiagram)
  await applicationDiagram.getByRole('tab', { name: 'Use case', exact: true }).click()
  await capture(page, '03-application-use-case', applicationDiagram)

  await page.getByRole('button', { name: /^Design / }).click()
  await page.waitForTimeout(700)
  const allocationView = page.locator('.design-workflow-allocation')
  await allocationView.locator('.design-behavior-selector select').selectOption({ label: 'Refresh evidence' })
  const allocationDiagram = allocationView.locator('.uml-workspace')
  await capture(page, '04-solution-allocation', allocationDiagram)
  await allocationDiagram.getByRole('tab', { name: /^Sequence/ }).click()
  await capture(page, '05-cross-module-sequence', allocationDiagram)
  const systemCanvas = page.locator('.design-canvas')
  await systemCanvas.getByRole('button', { name: 'Fit system', exact: true }).click()
  await page.waitForTimeout(500)
  await captureView(page, '06-system-structure', systemCanvas)

  await page.getByRole('button', { name: /^Build / }).click()
  await page.waitForTimeout(700)
  await page.locator('#design-handoff-module-select').selectOption('mod.finding-review')
  await page.waitForTimeout(700)
  const moduleDiagram = page.locator('.design-build-behavior .design-diagrams')
  await moduleDiagram.getByRole('tab', { name: 'Component', exact: true }).click()
  await captureModuleDiagram(page, '07-module-component', moduleDiagram)
  await moduleDiagram.getByRole('tab', { name: 'Activity', exact: true }).click()
  await captureModuleDiagram(page, '08-module-activity', moduleDiagram)
  await moduleDiagram.getByRole('tab', { name: 'State machine', exact: true }).click()
  await captureModuleDiagram(page, '09-module-state-machine', moduleDiagram)
  await moduleDiagram.getByRole('tab', { name: 'Sequence', exact: true }).click()
  await captureModuleDiagram(page, '10-module-sequence', moduleDiagram)

  await page.getByRole('button', { name: /^Verify / }).click()
  await page.waitForTimeout(500)
  await captureView(page, '11-scenario-testing', page.locator('.design-verify'))

  await page.getByRole('button', { name: /^Evidence / }).click()
  await page.waitForTimeout(500)
  await captureView(page, '12-evidence-trace', page.locator('.design-evidence-live'))

  if (pageErrors.length) {
    throw new Error(`The browser reported errors:\n${pageErrors.join('\n')}`)
  }
} finally {
  await browser.close()
}

console.log(`Behavior-model evidence is in ${outputDir}`)
