import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { productTrialSystems } from './systems.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const outputRoot = path.join(repoRoot, 'docs/design-system/2026-07-31-midnight-default/screenshots')
const reportPath = path.join(repoRoot, 'docs/design-system/2026-07-31-midnight-default/browser-validation.json')
const failures = []
const screenshots = []
const browserResults = []

fs.mkdirSync(outputRoot, { recursive: true })

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8'
  if (filePath.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const filePath = path.resolve(repoRoot, `.${requestPath}`)
  if (!filePath.startsWith(`${repoRoot}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404)
    response.end('Not found')
    return
  }
  response.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' })
  fs.createReadStream(filePath).pipe(response)
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const baseUrl = `http://127.0.0.1:${address.port}`

function appPath(system) {
  return `/e2e-samples/product-trials/${system.slug}/capabilities/modules/${system.architecture.uiModuleId}/ui/index.html`
}

function recordFailure(engine, system, check, error) {
  failures.push({
    engine,
    product: system.slug,
    check,
    message: error instanceof Error ? error.message : String(error),
  })
}

async function capture(page, system, name, fullPage = true) {
  const fileName = `${String(screenshots.length + 1).padStart(2, '0')}-${system.slug}-${name}.png`
  const destination = path.join(outputRoot, fileName)
  await page.screenshot({ path: destination, fullPage })
  screenshots.push(path.relative(repoRoot, destination))
}

async function waitForThemePaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
}

async function assertPaletteMode(page, system, mode) {
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      canvas: style.getPropertyValue('--eui-color-canvas').trim().toLowerCase(),
      surface: style.getPropertyValue('--eui-color-surface').trim().toLowerCase(),
      text: style.getPropertyValue('--eui-color-text').trim().toLowerCase(),
      accent: style.getPropertyValue('--eui-color-accent').trim().toLowerCase(),
    }
  })
  if (system.design.paletteId !== 'midnight') {
    throw new Error(`The default product palette is ${system.design.paletteId}.`)
  }
  if (mode === 'light' && (colors.surface !== '#ffffff' || colors.accent !== '#145ea8')) {
    throw new Error(`Light mode does not use the approved white and dark-blue theme: ${JSON.stringify(colors)}.`)
  }
  if (
    mode === 'dark'
    && (
      colors.canvas !== system.design.darkCanvas
      || colors.surface !== system.design.darkSurface
      || colors.text !== '#f7f9fc'
      || colors.accent !== '#78b7ff'
    )
  ) {
    throw new Error(`Dark mode does not use the approved Midnight palette: ${JSON.stringify(colors)}.`)
  }
  return colors
}

async function assertPageContract(page, engineName, system, testPointerTooltip = true) {
  const contract = await page.locator('html').getAttribute('data-design-contract')
  if (contract !== 'EUIT-FRONTEND-001') {
    throw new Error(`Design contract is ${contract ?? 'missing'}.`)
  }
  const iconFamilies = await page.locator('svg[data-icon-family]').evaluateAll((icons) =>
    [...new Set(icons.map((icon) => icon.getAttribute('data-icon-family')))])
  if (JSON.stringify(iconFamilies) !== '["lucide"]') {
    throw new Error(`Icon families are ${iconFamilies.join(', ') || 'missing'}.`)
  }
  const iconButtons = page.locator('button.icon-button')
  const iconButtonCount = await iconButtons.count()
  if (iconButtonCount === 0) throw new Error('No icon buttons are present.')
  for (let index = 0; index < iconButtonCount; index += 1) {
    const control = iconButtons.nth(index)
    if (!await control.getAttribute('aria-label')) throw new Error(`Icon button ${index + 1} has no label.`)
    if (!await control.getAttribute('aria-describedby')) throw new Error(`Icon button ${index + 1} has no tooltip link.`)
    if (await control.locator('[role="tooltip"]').count() !== 1) {
      throw new Error(`Icon button ${index + 1} has no tooltip.`)
    }
  }
  const help = page.locator('[data-help-trigger]')
  if (await help.count() !== 1) throw new Error('The help trigger is missing.')
  const theme = page.locator('[data-theme-toggle]')
  if (await theme.count() !== 1) throw new Error('The mode trigger is missing.')

  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  if (overflow.width > overflow.viewport + 2) {
    throw new Error(`The page width is ${overflow.width}px in a ${overflow.viewport}px viewport.`)
  }

  if (testPointerTooltip) {
    const tooltip = theme.locator('[role="tooltip"]')
    await theme.hover()
    await tooltip.waitFor({ state: 'visible' })
    await theme.focus()
    await page.keyboard.press('Escape')
    await page.waitForFunction((element) => getComputedStyle(element).opacity === '0', await tooltip.elementHandle())
  }

  await help.click()
  await page.locator('[data-help-popover]').waitFor({ state: 'visible' })
  if (await help.getAttribute('aria-expanded') !== 'true') throw new Error('Help did not announce its open state.')
  await page.keyboard.press('Escape')
  await page.locator('[data-help-popover]').waitFor({ state: 'hidden' })

  const firstAction = system.scenarios[0]
  await page.locator(`[data-scenario-action="${firstAction.actionId}"]`).click()
  await page.locator(`[data-scenario-result="${firstAction.actionId}"].is-visible`).waitFor({ state: 'visible' })

  browserResults.push({
    engine: engineName,
    product: system.slug,
    viewport: await page.viewportSize(),
    iconButtons: iconButtonCount,
    tooltipKeyboardDismissal: testPointerTooltip ? true : 'covered in Chromium',
    contextualHelp: true,
    scenarioAction: true,
    horizontalOverflow: 0,
  })
}

async function runChromiumMatrix() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const system of productTrialSystems) {
      process.stdout.write(`Chromium: ${system.slug}\n`)
      const errors = []
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
      })
      await context.addInitScript(() => localStorage.setItem('eui-color-mode', 'light'))
      const page = await context.newPage()
      page.setDefaultTimeout(5_000)
      page.setDefaultNavigationTimeout(5_000)
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      try {
        await page.goto(`${baseUrl}${appPath(system)}`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('heading', { name: system.headline }).waitFor()
        await waitForThemePaint(page)
        await assertPaletteMode(page, system, 'light')
        await assertPageContract(page, 'chromium', system)
        await capture(page, system, 'light')

        const theme = page.locator('[data-theme-toggle]')
        await theme.click()
        if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
          throw new Error('The mode button did not select dark mode.')
        }
        const storedMode = await page.evaluate(() => localStorage.getItem('eui-color-mode'))
        if (storedMode !== 'dark') throw new Error(`The stored mode is ${storedMode ?? 'missing'}.`)
        await waitForThemePaint(page)
        await assertPaletteMode(page, system, 'dark')
        await capture(page, system, 'dark')

        await page.locator('[data-help-trigger]').click()
        await capture(page, system, 'help')
        await page.locator('[data-close-help]').click()

        if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(' | ')}`)
      } catch (error) {
        recordFailure('chromium', system, 'desktop contract', error)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

async function runPhoneMatrix() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const system of productTrialSystems) {
      process.stdout.write(`Phone: ${system.slug}\n`)
      const errors = []
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      page.setDefaultTimeout(5_000)
      page.setDefaultNavigationTimeout(5_000)
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      try {
        await page.goto(`${baseUrl}${appPath(system)}`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('heading', { name: system.headline }).waitFor()
        const explicitMode = await page.locator('html').getAttribute('data-theme')
        if (system.design.defaultMode === 'system' && explicitMode !== null) {
          throw new Error('System mode wrote an explicit theme.')
        }
        if (
          system.design.defaultMode !== 'system'
          && explicitMode !== system.design.defaultMode
        ) {
          throw new Error(`The start mode is ${explicitMode ?? 'missing'}.`)
        }
        await assertPageContract(page, 'chromium-mobile', system, false)
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
        await waitForThemePaint(page)
        await capture(page, system, 'phone', false)
        await page.getByRole('button', { name: 'Open menu' }).click()
        const productNavigation = page.locator('[data-product-nav]').first()
        await page.waitForFunction((element) => element.getBoundingClientRect().left >= -1, await productNavigation.elementHandle())
        await capture(page, system, 'phone-menu', false)
        if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(' | ')}`)
      } catch (error) {
        recordFailure('chromium-mobile', system, 'phone contract', error)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

try {
  await runChromiumMatrix()
  await runPhoneMatrix()
} finally {
  await new Promise((resolve) => server.close(resolve))
}

const report = {
  generatedAt: new Date().toISOString(),
  products: productTrialSystems.length,
  engines: ['chromium', 'chromium-mobile'],
  desktopStatesPerProduct: ['light', 'dark', 'help'],
  phoneStatesPerProduct: ['workspace', 'open navigation'],
  safariCheck: {
    staticFiles: true,
    runtimeDependencies: 0,
    status: 'Not executed. The interactive browser environment was not available.',
  },
  screenshots,
  checks: browserResults,
  failures,
  passed: failures.length === 0,
}
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
process.exitCode = report.passed ? 0 : 1
