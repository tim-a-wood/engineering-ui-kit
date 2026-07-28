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

async function openDo178Capabilities(page) {
  await page.goto(targetUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Capabilities', exact: true }).click()
  await page.locator('select[aria-label="Capabilities project"]').selectOption('do-178c-audit-hub')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'View design' }).click()
  await page.waitForTimeout(300)
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

  await page.getByRole('tab', { name: 'Application', exact: true }).click()
  await page.waitForTimeout(350)
  const applicationWorkspace = page.locator('.cap-behavior-workspace').last()
  const applicationDiagram = applicationWorkspace.locator('.uml-workspace')
  await capture(page, '01-use-case', applicationDiagram)
  await applicationWorkspace.locator('.cap-behavior-selector select').first()
    .selectOption('workflow:uc-package')
  await applicationDiagram.getByRole('tab', { name: 'Activity', exact: true }).click()
  await capture(page, '02-application-activity', applicationDiagram)

  await page.getByRole('tab', { name: 'Architecture', exact: true }).click()
  await page.waitForTimeout(350)
  const allocationWorkspace = page.locator('.cap-behavior-workspace').last()
  const allocationDiagram = allocationWorkspace.locator('.uml-workspace')
  await allocationWorkspace.locator('.cap-behavior-selector select').first()
    .selectOption('workflow:uc-package')
  await capture(page, '03-solution-allocation', allocationDiagram)
  await allocationDiagram.getByRole('tab', { name: 'Sequence', exact: true }).click()
  await capture(page, '04-cross-module-sequence', allocationDiagram)

  await page.getByRole('tab', { name: 'Modules', exact: true }).click()
  await page.waitForTimeout(350)
  await page.getByRole('button', { name: /mod\.assurance-workflow/ }).click()
  await page.waitForTimeout(500)
  const moduleWorkspace = page.locator('.cap-module-design-workspace')
  const moduleDiagram = moduleWorkspace.locator('.uml-workspace')
  await capture(page, '05-component', moduleDiagram)
  await moduleDiagram.getByRole('tab', { name: 'Manage audit finding', exact: true }).click()
  await capture(page, '06-module-activity', moduleDiagram)
  await moduleDiagram.getByRole('tab', { name: 'State machine', exact: true }).click()
  await capture(page, '07-state-machine', moduleDiagram)
  await moduleDiagram.getByRole('tab', { name: 'Sequence', exact: true }).click()
  await capture(page, '08-internal-sequence', moduleDiagram)

  await page.getByRole('tab', { name: 'Verification', exact: true }).click()
  await page.waitForTimeout(400)
  const observedScreenshot = await page.screenshot({ type: 'png' })
  await page.getByRole('button', { name: 'Prepare run' }).click()
  await page.waitForTimeout(300)
  const firstStep = page.locator('.cap-scenario-step').first()
  await firstStep.locator('textarea').fill(
    'The application shows the approved evidence identity and history.',
  )
  const evidenceInput = firstStep.locator('input[type="file"]')
  if (await evidenceInput.count()) {
    await evidenceInput.setInputFiles({
      name: 'observed-evidence.png',
      mimeType: 'image/png',
      buffer: observedScreenshot,
    })
    await page.waitForTimeout(250)
  }
  await firstStep.getByRole('button', { name: 'Record observed step' }).click()
  await page.waitForTimeout(300)
  await firstStep.getByRole('button', { name: 'Inspect trace' }).click()
  const traceDrawer = page.locator('.cap-scenario-trace-drawer')
  await traceDrawer.waitFor({ state: 'visible' })
  await frameWorkspace(page, traceDrawer)
  await capture(page, '09-verification-trace')

  if (pageErrors.length) {
    throw new Error(`The browser reported errors:\n${pageErrors.join('\n')}`)
  }
} finally {
  await browser.close()
}

console.log(`Behavior-model evidence is in ${outputDir}`)
