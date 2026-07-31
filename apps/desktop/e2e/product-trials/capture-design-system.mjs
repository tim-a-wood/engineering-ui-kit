import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'
import { productTrialSystems } from './systems.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const evidenceRoot = path.join(repoRoot, 'docs/design-system/2026-07-31-modern-ai-system')
const outputRoot = path.join(evidenceRoot, 'screenshots')
const reportPath = path.join(evidenceRoot, 'browser-validation.json')
const webkitWorker = process.env.EUI_WEBKIT_WORKER === '1'
const webkitWorkerPrefix = 'EUI_WEBKIT_RESULT:'
const requestedWebkitProducts = new Set(
  (process.env.EUI_WEBKIT_PRODUCTS ?? '')
    .split(',')
    .map((product) => product.trim())
    .filter(Boolean),
)
const requestedWebkitWidths = new Set(
  (process.env.EUI_WEBKIT_WIDTHS ?? '1440,390')
    .split(',')
    .map((width) => Number.parseInt(width.trim(), 10))
    .filter(Number.isFinite),
)
const parsedWebkitRunTimeout = Number.parseInt(process.env.EUI_WEBKIT_RUN_TIMEOUT_MS ?? '20000', 10)
const webkitRunTimeout = Number.isFinite(parsedWebkitRunTimeout) && parsedWebkitRunTimeout >= 2_000
  ? parsedWebkitRunTimeout
  : 20_000
const parsedWebkitAttempts = Number.parseInt(process.env.EUI_WEBKIT_ATTEMPTS ?? '2', 10)
const webkitAttempts = Number.isFinite(parsedWebkitAttempts) && parsedWebkitAttempts >= 1
  ? Math.min(parsedWebkitAttempts, 3)
  : 2
const webkitLaunchTimeout = Math.min(7_000, Math.max(1_000, webkitRunTimeout - 1_000))
const requestedEngines = new Set(
  (process.env.EUI_BROWSER_ENGINES ?? 'chromium,webkit')
    .split(',')
    .map((engine) => engine.trim())
    .filter(Boolean),
)
const failures = []
const screenshots = []
const browserResults = []

fs.mkdirSync(outputRoot, { recursive: true })
if (!webkitWorker && requestedEngines.has('chromium')) {
  for (const entry of fs.readdirSync(outputRoot)) {
    if (entry.endsWith('.png')) fs.rmSync(path.join(outputRoot, entry))
  }
}

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

function recordFailure(engine, system, viewport, check, error) {
  const failure = {
    engine,
    product: system.slug,
    viewport,
    check,
    message: error instanceof Error ? error.message : String(error),
  }
  failures.push(failure)
  process.stderr.write(`${engine} ${system.slug} ${viewport.width}px: ${failure.message}\n`)
}

async function capture(page, system, name, fullPage = true) {
  const fileName = `${String(screenshots.length + 1).padStart(2, '0')}-${system.slug}-${name}.png`
  const destination = path.join(outputRoot, fileName)
  await page.screenshot({ path: destination, fullPage })
  screenshots.push(path.relative(repoRoot, destination))
}

async function waitForPaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
}

async function clearTransientFocus(page) {
  await page.mouse.move(1, 1)
  await page.evaluate(() => document.activeElement?.blur?.())
  await waitForPaint(page)
}

async function assertPaletteMode(page, system, modeName) {
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    const value = (name) => style.getPropertyValue(name).trim().toLowerCase()
    return {
      canvas: value('--eui-color-canvas'),
      surface: value('--eui-color-surface'),
      surfaceSubtle: value('--eui-color-surface-subtle'),
      surfaceRaised: value('--eui-color-surface-raised'),
      text: value('--eui-color-text'),
      accentForeground: value('--eui-color-accent-foreground'),
      action: value('--eui-color-action'),
      onAccent: value('--eui-color-on-accent'),
      selected: value('--eui-color-selected'),
    }
  })
  const expected = system.design.config.palette[modeName]
  for (const [role, actual] of Object.entries(colors)) {
    if (actual !== expected[role].toLowerCase()) {
      throw new Error(`${modeName} ${role} is ${actual}. Expected ${expected[role]}.`)
    }
  }
  return colors
}

async function assertPageContract(page, system) {
  const contract = await page.locator('html').getAttribute('data-design-contract')
  if (contract !== 'EUIT-FRONTEND-001') throw new Error(`Design contract is ${contract ?? 'missing'}.`)

  const bodyClasses = await page.locator('body').getAttribute('class')
  if (!bodyClasses?.includes('product-v5') || /\bproduct-v[234]\b/.test(bodyClasses)) {
    throw new Error(`The active design grammar is ${bodyClasses ?? 'missing'}.`)
  }

  const manifestText = await page.locator('#design-system-manifest').textContent()
  const manifest = JSON.parse(manifestText ?? '{}')
  const primaryView = await page.locator('body').getAttribute('data-primary-view')
  if (manifest.contractId !== 'EUIT-FRONTEND-001' || manifest.pagePlan?.primaryViewKind !== primaryView) {
    throw new Error('The rendered page does not match its design manifest.')
  }

  if (await page.locator('[data-region="primary-workspace"]').count() !== 1) {
    throw new Error('The page does not expose one primary workspace container.')
  }
  if (await page.locator('[data-region-role="primary"]').count() !== 1) {
    throw new Error('The page does not expose one primary task region.')
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
    if (await control.locator('[role="tooltip"]').count() !== 1) throw new Error(`Icon button ${index + 1} has no tooltip.`)
  }

  const help = page.locator('[data-help-trigger]')
  if (await help.count() !== 1) throw new Error('The help trigger is missing.')
  const helpCopy = await page.locator('[data-help-popover]').textContent()
  if (!helpCopy?.includes(system.shortName) || !helpCopy.includes(system.scenarios[0].name)) {
    throw new Error('The contextual help does not describe this product task.')
  }

  return { iconButtonCount, primaryView }
}

async function inspectVisualGrammar(page, system) {
  return page.evaluate(async ({ expectedHeadline, summaryText, approvedMetricPurpose }) => {
    const visible = (element, requireHorizontalIntersection = false) => {
      if (!(element instanceof HTMLElement)) return false
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0 || box.width <= 0 || box.height <= 0) {
        return false
      }
      return !requireHorizontalIntersection || (box.right > 1 && box.left < window.innerWidth - 1)
    }
    const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
    const describe = (element, index = null) => {
      const identity = element.getAttribute('data-region')
        || element.getAttribute('aria-label')
        || element.id
        || [...element.classList].slice(0, 3).join('.')
        || element.tagName.toLowerCase()
      return `${element.tagName.toLowerCase()}${identity ? `.${identity}` : ''}${index === null ? '' : `[${index}]`}`
    }
    const fontSize = (element) => Number.parseFloat(getComputedStyle(element).fontSize)
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    const primary = document.querySelector('[data-region="primary-workspace"]')
      ?? document.querySelector('[data-region-role="primary"]')
    if (!(primary instanceof HTMLElement)) {
      return { fatal: 'The primary workspace is missing.' }
    }

    const h1Elements = [...document.querySelectorAll('h1')].filter((element) => visible(element))
    const h1 = h1Elements[0] ?? null
    const summaryCandidates = [...document.querySelectorAll('[data-page-summary], .task-subtitle, .page-summary, .page-subtitle, p')]
      .filter((element) => visible(element) && normalize(element.textContent) === normalize(summaryText))
    const h1FontSize = h1 ? fontSize(h1) : null
    const summaryFontSizes = summaryCandidates.map(fontSize)
    const summaryFontSize = summaryFontSizes.length ? Math.max(...summaryFontSizes) : null

    const panelHierarchy = []
    const panelHierarchyFailures = []
    for (const [index, panel] of [...primary.querySelectorAll('.panel')].filter((element) => visible(element)).entries()) {
      const titleId = panel.getAttribute('aria-labelledby')
      const subtitleId = panel.getAttribute('aria-describedby')
      const title = (titleId ? document.getElementById(titleId) : null)
        ?? panel.querySelector('.panel-title, .panel-header h2, .panel-header h3')
      const subtitle = (subtitleId ? document.getElementById(subtitleId) : null)
        ?? panel.querySelector('.panel-subtitle, .panel-header p')
      const entry = {
        panel: describe(panel, index),
        title: normalize(title?.textContent),
        subtitle: normalize(subtitle?.textContent),
        titleFontSize: title && visible(title) ? fontSize(title) : null,
        subtitleFontSize: subtitle && visible(subtitle) ? fontSize(subtitle) : null,
      }
      panelHierarchy.push(entry)
      if (entry.titleFontSize === null || entry.subtitleFontSize === null) {
        panelHierarchyFailures.push(`${entry.panel} is missing a visible title or subtitle`)
      } else if (entry.titleFontSize <= entry.subtitleFontSize) {
        panelHierarchyFailures.push(
          `${entry.title || entry.panel} is ${entry.titleFontSize}px and its subtitle is ${entry.subtitleFontSize}px`,
        )
      }
    }

    const pageHeaders = [...primary.children]
      .filter((element) => element.tagName === 'HEADER' || element.getAttribute('data-task-region') === 'heading')
    const headerMetricPurposes = pageHeaders
      .flatMap((header) => [...header.querySelectorAll('[data-metric-purpose]')])
      .filter((element) => visible(element))
      .map((element) => normalize(element.getAttribute('data-metric-purpose')))
    const unapprovedHeaderMetricPurposes = headerMetricPurposes.filter((purpose) =>
      !approvedMetricPurpose || purpose !== normalize(approvedMetricPurpose))

    const structuralChildren = [...primary.children]
      .filter((element) => visible(element, true))
      .filter((element) => !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(element.tagName))
    const contentChildren = structuralChildren.filter((element) =>
      element.tagName !== 'HEADER'
      && (
        element.hasAttribute('data-task-region')
        || element.hasAttribute('data-region-id')
        || ['SECTION', 'ASIDE', 'NAV', 'ARTICLE', 'MAIN'].includes(element.tagName)
      ))
    const isRoundedBorderedCard = (element) => {
      const style = getComputedStyle(element)
      const radius = Math.max(
        Number.parseFloat(style.borderTopLeftRadius),
        Number.parseFloat(style.borderTopRightRadius),
        Number.parseFloat(style.borderBottomRightRadius),
        Number.parseFloat(style.borderBottomLeftRadius),
      )
      const borderedSides = ['Top', 'Right', 'Bottom', 'Left'].filter((side) =>
        style[`border${side}Style`] !== 'none' && Number.parseFloat(style[`border${side}Width`]) >= 0.75)
      return radius >= 4 && borderedSides.length === 4
    }
    const roundedCardChildren = contentChildren.filter(isRoundedBorderedCard)
    const allStructuralChildrenAreCards = contentChildren.length >= 2
      && roundedCardChildren.length === contentChildren.length

    const structuralBackgroundSelector = 'header, section, aside, nav, article, [data-region], [data-task-region]'
    const excludedBackgroundSelector = [
      '.active', '.current', '.selected', '.is-selected', '[aria-selected="true"]',
      '[role="dialog"]', '[role="tooltip"]', '[data-help-popover]', '[data-command-dialog]',
      '.help-popover', '.command-dialog', '.control-tooltip', '.navigation-scrim',
      '.editor-sheet', '.panel-editor',
      '.panel-chart', '.panel-scatter', '.panel-graph', '.chart-body', '.scatter-body', '.graph-body',
      '.telemetry-plot', '.trade-plot', '.impact-graph', '[data-visualization]',
    ].join(', ')
    const parseColor = (value) => {
      const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i)
      if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) }
      const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i)
      if (srgb) return {
        r: Number(srgb[1]) * 255,
        g: Number(srgb[2]) * 255,
        b: Number(srgb[3]) * 255,
        a: srgb[4] === undefined ? 1 : Number(srgb[4]),
      }
      return null
    }
    const backgroundElements = [primary, ...primary.querySelectorAll(structuralBackgroundSelector)]
      .filter((element) => visible(element, true))
      .filter((element) => !element.matches(excludedBackgroundSelector) && !element.closest(excludedBackgroundSelector))
    const neutralBackgrounds = new Map()
    for (const element of backgroundElements) {
      const parsed = parseColor(getComputedStyle(element).backgroundColor)
      if (!parsed || parsed.a < 0.98 || Math.max(parsed.r, parsed.g, parsed.b) - Math.min(parsed.r, parsed.g, parsed.b) > 32) continue
      const color = `rgb(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)})`
      const examples = neutralBackgrounds.get(color) ?? []
      if (examples.length < 5) examples.push(describe(element))
      neutralBackgrounds.set(color, examples)
    }
    const neutralStructuralBackgrounds = [...neutralBackgrounds].map(([color, elements]) => ({ color, elements }))

    const surfaceKinds = new Set(['structural-pane', 'primary-work-surface', 'inset-object', 'overlay'])
    const flatSurfaceKinds = new Set(['structural-pane', 'primary-work-surface'])
    const surfaceStyle = (element) => {
      const style = getComputedStyle(element)
      const radius = Math.max(
        Number.parseFloat(style.borderTopLeftRadius) || 0,
        Number.parseFloat(style.borderTopRightRadius) || 0,
        Number.parseFloat(style.borderBottomRightRadius) || 0,
        Number.parseFloat(style.borderBottomLeftRadius) || 0,
      )
      const borderedSides = ['Top', 'Right', 'Bottom', 'Left'].filter((side) =>
        style[`border${side}Style`] !== 'none' && Number.parseFloat(style[`border${side}Width`]) >= 0.75)
      const shadow = style.boxShadow !== 'none' && !/rgba?\([^)]*[,/]\s*0\)\s/.test(style.boxShadow)
      const dropShadow = style.filter !== 'none' && style.filter.includes('drop-shadow')
      const raised = shadow || dropShadow
      const contained = radius >= 4 || raised || borderedSides.length >= 3
      return {
        radius,
        borderedSides,
        boxShadow: style.boxShadow,
        filter: style.filter,
        raised,
        contained,
        flat: radius <= 2 && !raised && borderedSides.length <= 2,
      }
    }
    const declaredSurfaces = [...primary.querySelectorAll('[data-surface-kind]')]
      .filter((element) => visible(element))
    const surfaceEntries = declaredSurfaces.map((element) => ({
      element: describe(element),
      kind: element.getAttribute('data-surface-kind'),
      ...surfaceStyle(element),
    }))
    const surfaceFailures = []
    const declaredTaskRegions = [...primary.querySelectorAll('[data-region-id]')].filter((element) => visible(element))
    for (const region of declaredTaskRegions) {
      const kind = region.getAttribute('data-surface-kind')
      if (!flatSurfaceKinds.has(kind)) {
        surfaceFailures.push(
          `${region.getAttribute('data-region-id') || describe(region)} must declare structural-pane or primary-work-surface`,
        )
      }
    }
    for (const entry of surfaceEntries) {
      if (!surfaceKinds.has(entry.kind)) {
        surfaceFailures.push(`${entry.element} declares unknown surface kind ${entry.kind || 'missing'}`)
      } else if (flatSurfaceKinds.has(entry.kind) && !entry.flat) {
        surfaceFailures.push(
          `${entry.element} (${entry.kind}) is contained or raised: radius ${entry.radius}px, ${entry.borderedSides.length} bordered sides, shadow ${entry.raised ? 'yes' : 'no'}`,
        )
      }
    }
    const containedCandidates = [...new Set([
      ...primary.querySelectorAll('[data-surface-kind], .panel, .kanban-card, .package-card'),
    ])].filter((element) => visible(element))
    for (const element of containedCandidates) {
      if (element.matches('.editor-sheet') || element.closest('.editor-sheet')) continue
      const styleAudit = surfaceStyle(element)
      if (!styleAudit.contained) continue
      const exception = element.closest('[data-surface-kind="inset-object"], [data-surface-kind="overlay"]')
      if (!exception) {
        surfaceFailures.push(
          `${describe(element)} uses contained or raised treatment without data-surface-kind="inset-object" or "overlay"`,
        )
      }
    }

    const sampleLayout = () => structuralChildren.map((element, index) => {
      const box = element.getBoundingClientRect()
      return {
        key: describe(element, index),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      }
    })
    const firstLayout = sampleLayout()
    await frame()
    await frame()
    const secondLayout = sampleLayout()
    const layoutInstability = []
    if (firstLayout.length !== secondLayout.length) {
      layoutInstability.push(`structural child count changed from ${firstLayout.length} to ${secondLayout.length}`)
    } else {
      for (let index = 0; index < firstLayout.length; index += 1) {
        const before = firstLayout[index]
        const after = secondLayout[index]
        const delta = Math.max(...['x', 'y', 'width', 'height'].map((property) => Math.abs(before[property] - after[property])))
        if (before.key !== after.key || delta > 0.75) {
          layoutInstability.push(`${before.key} changed by ${delta.toFixed(2)}px`)
        }
      }
    }
    const layoutOverlaps = []
    for (let leftIndex = 0; leftIndex < secondLayout.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < secondLayout.length; rightIndex += 1) {
        const left = secondLayout[leftIndex]
        const right = secondLayout[rightIndex]
        const overlapWidth = Math.min(left.right, right.right) - Math.max(left.x, right.x)
        const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y)
        if (overlapWidth > 1.5 && overlapHeight > 1.5) {
          layoutOverlaps.push(
            `${left.key} overlaps ${right.key} by ${overlapWidth.toFixed(1)}×${overlapHeight.toFixed(1)}px`,
          )
        }
      }
    }

    const widePlacementFailures = []
    const widePlacementRegions = [...primary.querySelectorAll('[data-region-id]')].map((element) => {
      const box = element.getBoundingClientRect()
      return {
        element,
        id: element.getAttribute('data-region-id') || describe(element),
        visible: visible(element, true),
        columnStart: Number.parseInt(element.getAttribute('data-wide-column-start') ?? '', 10),
        columnSpan: Number.parseInt(element.getAttribute('data-wide-column-span') ?? '', 10),
        rowStart: Number.parseInt(element.getAttribute('data-wide-row-start') ?? '', 10),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      }
    })
    if (window.innerWidth === 1440) {
      if (widePlacementRegions.length === 0) {
        widePlacementFailures.push('No data-region-id elements expose wide placement metadata')
      }
      for (const region of widePlacementRegions) {
        if (!region.visible) widePlacementFailures.push(`${region.id} is not visible at 1440px`)
        if (!Number.isInteger(region.columnStart) || region.columnStart < 1
          || !Number.isInteger(region.columnSpan) || region.columnSpan < 1
          || !Number.isInteger(region.rowStart) || region.rowStart < 1) {
          widePlacementFailures.push(`${region.id} has invalid wide grid metadata`)
        }
      }
      for (let leftIndex = 0; leftIndex < widePlacementRegions.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < widePlacementRegions.length; rightIndex += 1) {
          const left = widePlacementRegions[leftIndex]
          const right = widePlacementRegions[rightIndex]
          if (![left.columnStart, left.columnSpan, left.rowStart, right.columnStart, right.columnSpan, right.rowStart].every(Number.isInteger)) {
            continue
          }
          const leftColumnEnd = left.columnStart + left.columnSpan
          const rightColumnEnd = right.columnStart + right.columnSpan
          const declaredColumnsOverlap = Math.max(left.columnStart, right.columnStart) < Math.min(leftColumnEnd, rightColumnEnd)
          if (left.rowStart === right.rowStart) {
            if (Math.abs(left.y - right.y) > 4) {
              widePlacementFailures.push(
                `${left.id} and ${right.id} declare row ${left.rowStart} but their tops differ by ${Math.abs(left.y - right.y).toFixed(1)}px`,
              )
            }
            if (declaredColumnsOverlap) {
              widePlacementFailures.push(
                `${left.id} and ${right.id} declare overlapping column spans in row ${left.rowStart}`,
              )
            } else {
              const earlier = left.columnStart < right.columnStart ? left : right
              const later = earlier === left ? right : left
              if (earlier.x >= later.x - 2) {
                widePlacementFailures.push(
                  `${earlier.id} declares an earlier column than ${later.id}, but their computed x order is ${earlier.x.toFixed(1)}/${later.x.toFixed(1)}`,
                )
              }
              if (earlier.right > later.x + 1.5) {
                widePlacementFailures.push(
                  `${earlier.id} crosses into ${later.id} by ${(earlier.right - later.x).toFixed(1)}px`,
                )
              }
            }
          } else {
            const earlier = left.rowStart < right.rowStart ? left : right
            const later = earlier === left ? right : left
            if (earlier.y >= later.y - 2) {
              widePlacementFailures.push(
                `${earlier.id} declares an earlier row than ${later.id}, but their computed y order is ${earlier.y.toFixed(1)}/${later.y.toFixed(1)}`,
              )
            }
          }
          if (left.columnStart === right.columnStart && Math.abs(left.x - right.x) > 4) {
            widePlacementFailures.push(
              `${left.id} and ${right.id} share column ${left.columnStart} but their left edges differ by ${Math.abs(left.x - right.x).toFixed(1)}px`,
            )
          }
          if (left.columnStart === right.columnStart && left.columnSpan !== right.columnSpan) {
            const wider = left.columnSpan > right.columnSpan ? left : right
            const narrower = wider === left ? right : left
            if (wider.width < narrower.width - 4) {
              widePlacementFailures.push(
                `${wider.id} spans more columns than ${narrower.id} but is ${Math.abs(wider.width - narrower.width).toFixed(1)}px narrower`,
              )
            }
          }
        }
      }
    }

    const actionGroups = []
    const duplicateActionIcons = []
    let dataIconNameCount = 0
    let dataActionIconCount = 0
    let svgClassFallbackCount = 0
    let missingIconMetadataCount = 0
    const inconsistentIconMetadata = []
    for (const [groupIndex, group] of [...document.querySelectorAll('[data-action-group], [aria-label="Product actions"]')]
      .filter((element) => visible(element)).entries()) {
      const actions = [...group.querySelectorAll('button')].filter((element) => visible(element)).map((button) => {
        const svg = button.querySelector('svg')
        const classIcon = svg ? [...svg.classList].find((name) => name.startsWith('lucide-') && name !== 'lucide')?.slice(7) : null
        const dataIconName = button.getAttribute('data-icon-name') || svg?.getAttribute('data-icon-name') || null
        const actionIcon = button.getAttribute('data-action-icon')
        const iconName = dataIconName || actionIcon || classIcon || null
        const metadata = dataIconName ? 'data-icon-name' : actionIcon ? 'data-action-icon' : classIcon ? 'svg-class' : 'missing'
        if (metadata === 'data-icon-name') dataIconNameCount += 1
        else if (metadata === 'data-action-icon') dataActionIconCount += 1
        else if (metadata === 'svg-class') svgClassFallbackCount += 1
        else missingIconMetadataCount += 1
        if (dataIconName && actionIcon && dataIconName !== actionIcon) {
          inconsistentIconMetadata.push(
            `${normalize(button.getAttribute('aria-label') || button.textContent)} declares ${actionIcon} but renders ${dataIconName}`,
          )
        }
        return {
          label: normalize(button.getAttribute('aria-label') || button.textContent),
          semanticAction: button.getAttribute('data-semantic-action')
            || button.getAttribute('data-scenario-action')
            || button.getAttribute('data-action-id')
            || normalize(button.getAttribute('aria-label') || button.textContent).toLowerCase(),
          iconName,
          metadata,
        }
      })
      for (const iconName of [...new Set(actions.map((action) => action.iconName).filter(Boolean))]) {
        const uses = actions.filter((action) => action.iconName === iconName)
        if (new Set(uses.map((action) => action.label)).size > 1
          && new Set(uses.map((action) => action.semanticAction)).size > 1) {
          duplicateActionIcons.push(
            `group ${groupIndex + 1} uses ${iconName} for ${uses.map((action) => `${action.label} [${action.semanticAction}]`).join(', ')}`,
          )
        }
      }
      actionGroups.push({ group: groupIndex + 1, actions })
    }

    const visibleIconButtons = [...document.querySelectorAll('button')]
      .filter((button) => visible(button, true))
      .filter((button) => button.querySelector('svg'))
    const globalIconButtons = []
    const globalIconFailures = []
    for (const button of visibleIconButtons) {
      const label = normalize(button.getAttribute('aria-label') || button.textContent) || describe(button)
      const icons = [...button.querySelectorAll('svg')]
      const iconNames = icons.map((iconElement) => iconElement.getAttribute('data-icon-name')).filter(Boolean)
      const missingCount = icons.length - iconNames.length
      const declaredActionIcon = button.getAttribute('data-action-icon')
      if (missingCount > 0) {
        globalIconFailures.push(`${label} has ${missingCount} icon${missingCount === 1 ? '' : 's'} without data-icon-name`)
      }
      if (declaredActionIcon && !iconNames.includes(declaredActionIcon)) {
        globalIconFailures.push(
          `${label} declares ${declaredActionIcon} but renders ${iconNames.join(', ') || 'an unnamed icon'}`,
        )
      }
      globalIconButtons.push({ label, iconNames, declaredActionIcon: declaredActionIcon || null })
    }

    const interactiveSelector = 'button, input, select, textarea, summary, [role="button"], a[href]'
    const taskRegions = [...primary.querySelectorAll('[data-region-id]')].filter((element) => visible(element, true))
    const positionedControls = [...document.body.querySelectorAll('*')]
      .filter((element) => visible(element, true))
      .filter((element) => {
        const position = getComputedStyle(element).position
        return (position === 'fixed' || position === 'sticky')
          && (element.matches(interactiveSelector) || element.querySelector(interactiveSelector))
      })
      .filter((element) => !element.closest('[data-surface-kind="overlay"]'))
    const occlusions = []
    for (const control of positionedControls) {
      const controlBox = control.getBoundingClientRect()
      for (const region of taskRegions) {
        if (control === region || control.contains(region) || region.contains(control)) continue
        const regionBox = region.getBoundingClientRect()
        const overlapLeft = Math.max(controlBox.left, regionBox.left, 0)
        const overlapTop = Math.max(controlBox.top, regionBox.top, 0)
        const overlapRight = Math.min(controlBox.right, regionBox.right, window.innerWidth)
        const overlapBottom = Math.min(controlBox.bottom, regionBox.bottom, window.innerHeight)
        const overlapWidth = overlapRight - overlapLeft
        const overlapHeight = overlapBottom - overlapTop
        if (overlapWidth <= 4 || overlapHeight <= 4 || overlapWidth * overlapHeight <= 256) continue
        const sampleX = Math.min(window.innerWidth - 1, Math.max(0, overlapLeft + overlapWidth / 2))
        const sampleY = Math.min(window.innerHeight - 1, Math.max(0, overlapTop + overlapHeight / 2))
        const topElement = document.elementFromPoint(sampleX, sampleY)
        if (topElement && (topElement === control || control.contains(topElement))) {
          occlusions.push(
            `${describe(control)} occludes ${region.getAttribute('data-region-id')} by ${overlapWidth.toFixed(1)}×${overlapHeight.toFixed(1)}px`,
          )
        }
      }
    }

    return {
      fatal: null,
      heading: {
        visibleH1Count: h1Elements.length,
        text: normalize(h1?.textContent),
        expectedText: normalize(expectedHeadline),
        inPrimaryWorkspace: Boolean(h1 && primary.contains(h1)),
        h1FontSize,
        summary: summaryCandidates.length ? normalize(summaryCandidates[0].textContent) : null,
        summaryFontSize,
      },
      panels: { count: panelHierarchy.length, entries: panelHierarchy, failures: panelHierarchyFailures },
      headerMetrics: {
        count: headerMetricPurposes.length,
        purposes: headerMetricPurposes,
        approvedPurpose: approvedMetricPurpose || null,
        unapprovedPurposes: unapprovedHeaderMetricPurposes,
      },
      structuralSurfaces: {
        childCount: contentChildren.length,
        roundedBorderedCardCount: roundedCardChildren.length,
        allChildrenAreRoundedBorderedCards: allStructuralChildrenAreCards,
        neutralBackgroundCount: neutralStructuralBackgrounds.length,
        neutralBackgrounds: neutralStructuralBackgrounds,
        declared: surfaceEntries,
        failures: [...new Set(surfaceFailures)],
      },
      layout: {
        structuralChildren: secondLayout,
        instability: layoutInstability,
        overlaps: layoutOverlaps,
        widePlacement: {
          checked: window.innerWidth === 1440,
          regions: widePlacementRegions.map(({ element: _element, ...region }) => region),
          failures: [...new Set(widePlacementFailures)],
        },
        positionedControls: positionedControls.map((element) => ({
          element: describe(element),
          position: getComputedStyle(element).position,
        })),
        occlusions: [...new Set(occlusions)],
      },
      actionIcons: {
        groupCount: actionGroups.length,
        groups: actionGroups,
        duplicateUses: duplicateActionIcons,
        inconsistentMetadata: inconsistentIconMetadata,
        metadata: { dataIconNameCount, dataActionIconCount, svgClassFallbackCount, missingIconMetadataCount },
        allVisibleButtons: {
          count: globalIconButtons.length,
          buttons: globalIconButtons,
          failures: [...new Set(globalIconFailures)],
        },
      },
    }
  }, {
    expectedHeadline: system.headline,
    summaryText: system.subhead,
    approvedMetricPurpose: system.design.config.pagePlan.primaryLayout.workspace.measurement
      .approvedDecisionPurpose ?? '',
  })
}

async function inspectVisualQuality(page, mobile) {
  return page.evaluate(({ mobile }) => {
    const visible = (element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
    }
    const directText = (element) => [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .trim()
    const label = (element) => element.getAttribute('aria-label') || directText(element) || element.className || element.tagName
    const textTooSmall = []
    const clipped = []
    const targetTooSmall = []
    const localScrollClasses = ['table-scroll', 'intake-stepper', 'release-path', 'impact-graph', 'document-canvas']

    for (const element of document.body.querySelectorAll('*')) {
      if (!(element instanceof HTMLElement) || !visible(element)) continue
      const style = getComputedStyle(element)
      if (directText(element) && Number.parseFloat(style.fontSize) < 12) {
        textTooSmall.push(`${label(element)} (${style.fontSize})`)
      }
      if (element.scrollWidth > element.clientWidth + 3) {
        const allowsLocalScroll = localScrollClasses.some((name) => element.classList.contains(name))
          && ['auto', 'scroll'].includes(style.overflowX)
        if (!allowsLocalScroll) clipped.push(`${label(element)} (${element.clientWidth}/${element.scrollWidth})`)
      }
      if (mobile && element.matches('button, input, summary')) {
        const box = element.getBoundingClientRect()
        if (box.width < 44 || box.height < 44) targetTooSmall.push(`${label(element)} (${Math.round(box.width)}x${Math.round(box.height)})`)
      }
    }

    const rootOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
    const root = getComputedStyle(document.documentElement)
    const accent = root.getPropertyValue('--eui-color-action').trim()
    const navigation = document.querySelector('[data-product-nav]')
    const navigationColor = navigation ? getComputedStyle(navigation).backgroundColor : ''
    const test = document.createElement('span')
    test.style.color = accent
    document.body.append(test)
    const resolvedAccent = getComputedStyle(test).color
    test.remove()
    const visiblePrimaryActions = [...document.querySelectorAll('.primary-action')].filter(visible).length
    return {
      textTooSmall: textTooSmall.slice(0, 12),
      clipped: clipped.slice(0, 12),
      targetTooSmall: targetTooSmall.slice(0, 12),
      rootOverflow,
      accentNavigation: Boolean(navigation && navigationColor === resolvedAccent),
      visiblePrimaryActions,
    }
  }, { mobile })
}

async function assertVisualQuality(page, system, viewport) {
  const mobile = viewport.width <= 760
  const quality = await inspectVisualQuality(page, mobile)
  const visualGrammar = await inspectVisualGrammar(page, system)
  const violations = []
  if (quality.rootOverflow > 2) violations.push(`The page overflows by ${quality.rootOverflow}px.`)
  if (quality.textTooSmall.length) violations.push(`Visible text is below 12px: ${quality.textTooSmall.join(' | ')}.`)
  if (quality.clipped.length) violations.push(`Content is clipped without a local scroll model: ${quality.clipped.join(' | ')}.`)
  if (quality.targetTooSmall.length) violations.push(`Touch controls are below 44px: ${quality.targetTooSmall.join(' | ')}.`)
  if (quality.accentNavigation) violations.push('Navigation uses the primary action color as its background.')
  if (quality.visiblePrimaryActions > 1) violations.push(`The view shows ${quality.visiblePrimaryActions} primary actions.`)
  if (visualGrammar.fatal) {
    violations.push(visualGrammar.fatal)
  } else {
    if (visualGrammar.heading.visibleH1Count !== 1) {
      violations.push(`The page has ${visualGrammar.heading.visibleH1Count} visible h1 elements. Expected exactly one.`)
    }
    if (visualGrammar.heading.text !== visualGrammar.heading.expectedText || !visualGrammar.heading.inPrimaryWorkspace) {
      violations.push(
        `The visible page h1 must be the task title inside the primary workspace. Found “${visualGrammar.heading.text || 'missing'}”.`,
      )
    }
    if (
      visualGrammar.heading.summaryFontSize !== null
      && visualGrammar.heading.h1FontSize !== null
      && visualGrammar.heading.h1FontSize <= visualGrammar.heading.summaryFontSize
    ) {
      violations.push(
        `The page h1 is ${visualGrammar.heading.h1FontSize}px, but its summary is ${visualGrammar.heading.summaryFontSize}px. The h1 must be larger.`,
      )
    }
    if (visualGrammar.panels.failures.length) {
      violations.push(`Panel hierarchy failed: ${visualGrammar.panels.failures.join(' | ')}.`)
    }
    if (visualGrammar.headerMetrics.unapprovedPurposes.length) {
      violations.push(
        `A page-header metric strip lacks the approved task-decision purpose: ${visualGrammar.headerMetrics.unapprovedPurposes.join(' | ') || 'missing'}.`,
      )
    }
    if (visualGrammar.structuralSurfaces.allChildrenAreRoundedBorderedCards) {
      violations.push(
        `All ${visualGrammar.structuralSurfaces.childCount} primary content regions are rounded bordered cards. At least one region must use flat workspace structure.`,
      )
    }
    if (visualGrammar.structuralSurfaces.neutralBackgroundCount > 2) {
      const colors = visualGrammar.structuralSurfaces.neutralBackgrounds
        .map((background) => `${background.color} on ${background.elements.join(', ')}`)
        .join(' | ')
      violations.push(
        `The primary workspace uses ${visualGrammar.structuralSurfaces.neutralBackgroundCount} opaque neutral structural backgrounds. Maximum is 2: ${colors}.`,
      )
    }
    if (visualGrammar.structuralSurfaces.failures.length) {
      violations.push(`Surface semantics failed: ${visualGrammar.structuralSurfaces.failures.join(' | ')}.`)
    }
    if (visualGrammar.layout.instability.length) {
      violations.push(`The structural layout is not deterministic: ${visualGrammar.layout.instability.join(' | ')}.`)
    }
    if (visualGrammar.layout.overlaps.length) {
      violations.push(`Structural regions overlap: ${visualGrammar.layout.overlaps.join(' | ')}.`)
    }
    if (viewport.width === 1440 && visualGrammar.layout.widePlacement.failures.length) {
      violations.push(`Wide placement does not match its grid metadata: ${visualGrammar.layout.widePlacement.failures.join(' | ')}.`)
    }
    if (visualGrammar.layout.occlusions.length) {
      violations.push(`Fixed or sticky controls occlude task regions: ${visualGrammar.layout.occlusions.join(' | ')}.`)
    }
    const iconFallbackCount = visualGrammar.actionIcons.metadata.dataActionIconCount
      + visualGrammar.actionIcons.metadata.svgClassFallbackCount
      + visualGrammar.actionIcons.metadata.missingIconMetadataCount
    if (iconFallbackCount) {
      violations.push(
        `${iconFallbackCount} visible actions do not expose data-icon-name.`,
      )
    }
    if (visualGrammar.actionIcons.inconsistentMetadata.length) {
      violations.push(`Action icon metadata does not match the rendered icon: ${visualGrammar.actionIcons.inconsistentMetadata.join(' | ')}.`)
    }
    if (visualGrammar.actionIcons.duplicateUses.length) {
      violations.push(`Distinct actions reuse an icon in one visible group: ${visualGrammar.actionIcons.duplicateUses.join(' | ')}.`)
    }
    if (visualGrammar.actionIcons.allVisibleButtons.failures.length) {
      violations.push(
        `Visible icon-button metadata failed: ${visualGrammar.actionIcons.allVisibleButtons.failures.join(' | ')}.`,
      )
    }
  }

  if (viewport.width >= 768 && viewport.width <= 1100) {
    const requiredContext = {
      telemetry: '.channel-rail',
      hil: '.bench-tabs',
      impact: '.change-rail',
      review: '.artifact-browser',
      writing: '.document-outline',
      trade: '.parameter-drawer',
      fracas: '.case-list',
    }[system.layout]
    if (requiredContext && !await page.locator(requiredContext).isVisible()) {
      violations.push(`${requiredContext} is missing at tablet width.`)
    }
  }
  if (violations.length) throw new Error(violations.join(' '))
  return { ...quality, visualGrammar }
}

async function exerciseHelpAndTooltips(page) {
  const theme = page.locator('[data-theme-toggle]')
  const tooltip = theme.locator('[role="tooltip"]')
  await theme.hover()
  await tooltip.waitFor({ state: 'visible' })
  await theme.focus()
  await page.keyboard.press('Escape')
  await page.waitForFunction((element) => Number(getComputedStyle(element).opacity) === 0, await tooltip.elementHandle())

  const help = page.locator('[data-help-trigger]')
  await help.click()
  await page.locator('[data-help-popover]').waitFor({ state: 'visible' })
  if (await help.getAttribute('aria-expanded') !== 'true') throw new Error('Help did not announce its open state.')
  await page.keyboard.press('Escape')
  await page.locator('[data-help-popover]').waitFor({ state: 'hidden' })
}

async function exerciseNavigationDrawer(page) {
  const menu = page.locator('[data-mobile-menu]')
  await menu.click()
  if (await menu.getAttribute('aria-expanded') !== 'true') throw new Error('The navigation drawer did not announce its open state.')
  if (!await page.locator('[data-close-navigation]').isVisible()) throw new Error('The navigation drawer has no visible scrim.')
  const productNavigation = page.locator('[data-product-nav]').first()
  await page.waitForFunction((element) => element.getBoundingClientRect().left >= -1, await productNavigation.elementHandle())
}

function contextOptions(viewport, mode, mobile = false) {
  return {
    viewport,
    colorScheme: mode,
    reducedMotion: 'reduce',
    isMobile: mobile,
    hasTouch: mobile,
  }
}

async function loadProduct(browser, system, viewport, mode, mobile = false) {
  const progress = (stage) => {
    if (webkitWorker) process.stderr.write(`WebKit worker load: ${stage}\n`)
  }
  progress('context')
  const context = await browser.newContext(contextOptions(viewport, mode, mobile))
  progress('init script')
  await context.addInitScript((selectedMode) => localStorage.setItem('eui-color-mode', selectedMode), mode)
  progress('page')
  const page = await context.newPage()
  page.setDefaultTimeout(7_000)
  page.setDefaultNavigationTimeout(7_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  progress('navigation')
  await page.goto(`${baseUrl}${appPath(system)}`, { waitUntil: 'domcontentloaded' })
  progress('heading')
  await page.getByRole('heading', { name: system.headline }).waitFor()
  progress('paint')
  await waitForPaint(page)
  progress('ready')
  return { context, page, errors }
}

async function runChromiumMatrix() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const system of productTrialSystems) {
      process.stdout.write(`Chromium desktop: ${system.slug}\n`)
      const viewport = { width: 1440, height: 1000 }
      const { context, page, errors } = await loadProduct(browser, system, viewport, 'dark')
      try {
        const contract = await assertPageContract(page, system)
        await assertPaletteMode(page, system, 'dark')
        const quality = await assertVisualQuality(page, system, viewport)
        await clearTransientFocus(page)
        await capture(page, system, 'dark-initial')

        await exerciseHelpAndTooltips(page)
        const theme = page.locator('[data-theme-toggle]')
        await theme.click()
        await waitForPaint(page)
        await assertPaletteMode(page, system, 'light')
        await clearTransientFocus(page)
        await capture(page, system, 'light')

        await theme.click()
        await waitForPaint(page)
        const primaryAction = page.locator('.primary-action[data-scenario-action]').first()
        const primaryActionId = await primaryAction.getAttribute('data-scenario-action')
        if (!primaryActionId || !system.scenarios.some((scenario) => scenario.actionId === primaryActionId)) {
          throw new Error('The primary action does not map to a product scenario.')
        }
        await primaryAction.click()
        await page.locator(`[data-scenario-result="${primaryActionId}"].is-visible`).waitFor({ state: 'visible' })
        await clearTransientFocus(page)
        await capture(page, system, 'dark-action')

        await page.locator('[data-help-trigger]').click()
        await clearTransientFocus(page)
        await capture(page, system, 'dark-help')
        if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`)
        browserResults.push({ engine: 'chromium', product: system.slug, viewport, ...contract, ...quality, states: ['dark-initial', 'light', 'dark-action', 'dark-help'] })
      } catch (error) {
        recordFailure('chromium', system, viewport, 'desktop contract', error)
      } finally {
        await context.close()
      }

      for (const width of [1024, 768]) {
        const matrixViewport = { width, height: 900 }
        const run = await loadProduct(browser, system, matrixViewport, 'dark')
        try {
          await assertPageContract(run.page, system)
          const quality = await assertVisualQuality(run.page, system, matrixViewport)
          await clearTransientFocus(run.page)
          await capture(run.page, system, `${width}px`)
          if (run.errors.length) throw new Error(`Browser errors: ${run.errors.join(' | ')}`)
          browserResults.push({ engine: 'chromium', product: system.slug, viewport: matrixViewport, ...quality, states: ['initial'] })
        } catch (error) {
          recordFailure('chromium', system, matrixViewport, 'responsive contract', error)
        } finally {
          await run.context.close()
        }
      }

      const phoneViewport = { width: 390, height: 844 }
      const phone = await loadProduct(browser, system, phoneViewport, 'dark', true)
      try {
        await assertPageContract(phone.page, system)
        const quality = await assertVisualQuality(phone.page, system, phoneViewport)
        await clearTransientFocus(phone.page)
        await capture(phone.page, system, 'phone', false)
        const phoneStates = ['initial']
        if (await phone.page.locator('[data-mobile-menu]').isVisible()) {
          await exerciseNavigationDrawer(phone.page)
          await capture(phone.page, system, 'phone-navigation', false)
          phoneStates.push('navigation')
        }
        if (phone.errors.length) throw new Error(`Browser errors: ${phone.errors.join(' | ')}`)
        browserResults.push({ engine: 'chromium-mobile', product: system.slug, viewport: phoneViewport, ...quality, states: phoneStates })
      } catch (error) {
        recordFailure('chromium-mobile', system, phoneViewport, 'phone contract', error)
      } finally {
        await phone.context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

async function runWebkitMatrix() {
  const systems = requestedWebkitProducts.size
    ? productTrialSystems.filter((system) => requestedWebkitProducts.has(system.slug))
    : productTrialSystems
  const viewports = [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ].filter((viewport) => requestedWebkitWidths.has(viewport.width))
  for (const system of systems) {
    for (const viewport of viewports) {
      process.stdout.write(`WebKit ${viewport.width}px: ${system.slug}\n`)
      let payload
      for (let attempt = 1; attempt <= webkitAttempts; attempt += 1) {
        payload = await runWebkitWorker(system, viewport)
        const infrastructureFailure = payload.results.length === 0
          && payload.failures.length > 0
          && payload.failures.every((failure) => failure.check === 'isolated render contract')
        if (!infrastructureFailure || attempt === webkitAttempts) break
        const checkpointStart = failures.length
        failures.push(...payload.failures.map((failure) => ({
          ...failure,
          check: 'isolated worker retry',
          message: `Attempt ${attempt} failed. ${failure.message}`,
        })))
        writeReport()
        failures.splice(checkpointStart)
        process.stderr.write(`Restarting WebKit for ${system.slug} at ${viewport.width}px (attempt ${attempt + 1}/${webkitAttempts}).\n`)
      }
      browserResults.push(...payload.results)
      for (const failure of payload.failures) {
        failures.push(failure)
        process.stderr.write(`${failure.engine} ${failure.product} ${viewport.width}px: ${failure.message}\n`)
      }
      writeReport()
    }
  }
}

async function runWebkitCase(system, viewport) {
  const progress = (stage) => {
    if (webkitWorker) process.stderr.write(`WebKit worker stage: ${stage}\n`)
  }
  progress('launch')
  const browser = await webkit.launch({ headless: true, timeout: webkitLaunchTimeout })
  progress('load')
  try {
    const mobile = viewport.width <= 760
    const run = await loadProduct(browser, system, viewport, 'dark', mobile)
    progress('assert')
    try {
      await assertPageContract(run.page, system)
      const quality = await assertVisualQuality(run.page, system, viewport)
      if (mobile && await run.page.locator('[data-mobile-menu]').isVisible()) {
        await exerciseNavigationDrawer(run.page)
        await run.page.locator('[data-close-navigation]').click()
      }
      if (run.errors.length) throw new Error(`Browser errors: ${run.errors.join(' | ')}`)
      browserResults.push({ engine: mobile ? 'webkit-mobile' : 'webkit', product: system.slug, viewport, ...quality, states: ['initial'] })
      progress('passed')
    } catch (error) {
      recordFailure(mobile ? 'webkit-mobile' : 'webkit', system, viewport, 'render contract', error)
    } finally {
      await run.context.close()
    }
  } finally {
    await browser.close()
  }
}

function webkitWorkerFailure(system, viewport, message) {
  return {
    engine: viewport.width <= 760 ? 'webkit-mobile' : 'webkit',
    product: system.slug,
    viewport,
    check: 'isolated render contract',
    message,
  }
}

async function runWebkitWorker(system, viewport) {
  return new Promise((resolve) => {
    // A detached session prevents the WebKit inspector handshake on macOS.
    // Linux can use a process group; other platforms terminate the worker tree.
    const isolatedProcess = process.platform === 'linux'
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      cwd: repoRoot,
      detached: isolatedProcess,
      env: {
        ...process.env,
        EUI_BROWSER_ENGINES: 'webkit',
        EUI_WEBKIT_WORKER: '1',
        EUI_WEBKIT_PRODUCT: system.slug,
        EUI_WEBKIT_WIDTH: String(viewport.width),
        EUI_WEBKIT_HEIGHT: String(viewport.height),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })

    const finish = (payload) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(payload)
    }
    const timer = setTimeout(() => {
      timedOut = true
      try {
        if (isolatedProcess) process.kill(-child.pid, 'SIGKILL')
        else if (process.platform !== 'win32') {
          const processTable = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' })
          const children = new Map()
          for (const line of processTable.trim().split(/\r?\n/)) {
            const [pidText, parentText] = line.trim().split(/\s+/)
            const pid = Number.parseInt(pidText, 10)
            const parent = Number.parseInt(parentText, 10)
            if (!children.has(parent)) children.set(parent, [])
            children.get(parent).push(pid)
          }
          const descendants = []
          const queue = [...(children.get(child.pid) ?? [])]
          while (queue.length) {
            const pid = queue.shift()
            descendants.push(pid)
            queue.push(...(children.get(pid) ?? []))
          }
          for (const pid of descendants.reverse()) {
            try { process.kill(pid, 'SIGKILL') } catch { /* The process already exited. */ }
          }
          child.kill('SIGKILL')
        } else child.kill('SIGKILL')
      } catch {
        // The worker can exit between the timeout and the termination signal.
      }
    }, webkitRunTimeout)

    child.once('error', (error) => finish({
      results: [],
      failures: [webkitWorkerFailure(system, viewport, `WebKit worker could not start: ${error.message}`)],
    }))
    child.once('close', (code, signal) => {
      const resultLine = stdout
        .split(/\r?\n/)
        .findLast((line) => line.startsWith(webkitWorkerPrefix))
      if (resultLine) {
        try {
          finish(JSON.parse(resultLine.slice(webkitWorkerPrefix.length)))
          return
        } catch (error) {
          stderr += ` Invalid worker result: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      const reason = timedOut
        ? `WebKit exceeded the ${webkitRunTimeout}ms run limit and was restarted.`
        : `WebKit worker exited with code ${code ?? 'none'} and signal ${signal ?? 'none'}.`
      const detail = stderr.trim().split(/\r?\n/).slice(-3).join(' | ')
      finish({
        results: [],
        failures: [webkitWorkerFailure(system, viewport, detail ? `${reason} ${detail}` : reason)],
      })
    })
  })
}

function writeReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    products: productTrialSystems.length,
    requestedEngines: [...requestedEngines],
    engines: [...new Set(browserResults.map((result) => result.engine))],
    viewportWidths: [390, 768, 1024, 1440],
    desktopStatesPerProduct: ['dark-initial', 'light', 'dark-action', 'dark-help'],
    phoneStatesPerProduct: ['workspace', 'open navigation when the product has a drawer'],
    webkitCheck: {
      executed: requestedEngines.has('webkit'),
      runTimeoutMs: webkitRunTimeout,
      maxAttempts: webkitAttempts,
      note: 'WebKit provides Safari engine coverage. This run does not claim a test in the Safari application on iPhone.',
    },
    visualGrammarGates: {
      pageHeading: 'Exactly one visible h1. Its computed size must be greater than the product summary.',
      panelHierarchy: 'Each visible panel title must be larger than its subtitle.',
      headerMetrics: 'A visible page-header metric strip must match the product task-decision purpose.',
      structuralSurfaces: 'Structural panes and primary work surfaces must stay flat. Only inset objects and overlays can use contained or raised treatment.',
      neutralSurfaces: 'Primary content cannot be an all-card wall and can use at most two opaque neutral structural backgrounds.',
      deterministicLayout: 'Direct primary-workspace regions must be stable and non-overlapping at every matrix width.',
      widePlacement: 'At 1440px, region boxes must follow their declared wide rows, columns, and spans.',
      controlOcclusion: 'Visible fixed and sticky controls cannot cover another task region.',
      actionIcons: 'Distinct visible actions in one group cannot reuse one semantic icon.',
      iconMetadata: 'Every icon in every visible button must expose data-icon-name. Button metadata must match the rendered icon.',
    },
    screenshots,
    checks: browserResults,
    failures,
    passed: failures.length === 0,
  }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

if (webkitWorker) {
  const system = productTrialSystems.find((candidate) => candidate.slug === process.env.EUI_WEBKIT_PRODUCT)
  const viewport = {
    width: Number.parseInt(process.env.EUI_WEBKIT_WIDTH ?? '', 10),
    height: Number.parseInt(process.env.EUI_WEBKIT_HEIGHT ?? '', 10),
  }
  if (!system || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    failures.push({
      engine: 'webkit',
      product: process.env.EUI_WEBKIT_PRODUCT ?? 'missing',
      viewport,
      check: 'worker input',
      message: 'The isolated WebKit worker input is invalid.',
    })
  } else {
    try {
      await runWebkitCase(system, viewport)
    } catch (error) {
      recordFailure(viewport.width <= 760 ? 'webkit-mobile' : 'webkit', system, viewport, 'worker execution', error)
    }
  }
  await new Promise((resolve) => server.close(resolve))
  process.stdout.write(`${webkitWorkerPrefix}${JSON.stringify({ results: browserResults, failures })}\n`)
  process.exitCode = failures.length === 0 ? 0 : 1
} else {
  let unexpectedError
  try {
    if (requestedEngines.has('chromium')) await runChromiumMatrix()
    writeReport()
    if (requestedEngines.has('webkit')) await runWebkitMatrix()
  } catch (error) {
    unexpectedError = error
    failures.push({
      engine: 'runner',
      product: 'matrix',
      viewport: null,
      check: 'matrix execution',
      message: error instanceof Error ? error.message : String(error),
    })
    writeReport()
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }

  const report = writeReport()
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (unexpectedError) process.stderr.write(`${unexpectedError instanceof Error ? unexpectedError.stack : String(unexpectedError)}\n`)
  process.exitCode = report.passed ? 0 : 1
}
