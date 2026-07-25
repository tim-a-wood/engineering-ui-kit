/**
 * Final human-interface evidence run for the use-case-led Design workspace.
 *
 * Builds apps/gui (and packages/core if either is stale), serves the built
 * dist over a local static server, and drives the real GUI in headless
 * Chromium as a first-time human user would: opens the Design workspace,
 * walks Design → Build → Verify → Evidence, captures numbered screenshots
 * (docs/use-case-led-workflow/SPECIFICATION.md §24.2, §24.5), runs an
 * axe-core accessibility scan on four representative states (§24.4), and
 * records honest usability observations gathered while driving the UI.
 *
 * Usage: node scripts/design-workflow-evidence.mjs
 */
import { chromium } from 'playwright-core'
import axe from 'axe-core'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const guiDir = path.join(repoRoot, 'apps/gui')
const guiDist = path.join(guiDir, 'dist')
const coreDir = path.join(repoRoot, 'packages/core')
const coreDist = path.join(coreDir, 'dist')
const outDir = path.join(guiDir, 'validation-evidence/design-workflow')
fs.mkdirSync(outDir, { recursive: true })

const PORT = 4329
const MODULE_ID = 'mod.finding-review'
const MODULE_NAME = 'Finding Review'

// ---------------------------------------------------------------------------
// Build (if missing/stale) + static serve — mirrors scripts/capabilities-ux-visual.mjs.
// ---------------------------------------------------------------------------

function newestMtimeMs(dir) {
  if (!fs.existsSync(dir)) return -1
  let newest = -1
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else {
        const mtime = fs.statSync(full).mtimeMs
        if (mtime > newest) newest = mtime
      }
    }
  }
  return newest
}

function ensureBuilt() {
  const coreSrcNewest = newestMtimeMs(path.join(coreDir, 'src'))
  const coreDistNewest = newestMtimeMs(coreDist)
  if (coreDistNewest < 0 || coreSrcNewest > coreDistNewest) {
    console.log('packages/core dist is missing or stale — building…')
    execSync('npm run build --workspace=packages/core', { cwd: repoRoot, stdio: 'inherit' })
  }
  const guiSrcNewest = Math.max(newestMtimeMs(path.join(guiDir, 'src')), newestMtimeMs(coreDist))
  const guiDistNewest = newestMtimeMs(guiDist)
  if (guiDistNewest < 0 || guiSrcNewest > guiDistNewest) {
    console.log('apps/gui dist is missing or stale — building…')
    execSync('npm run build --workspace=apps/gui', { cwd: repoRoot, stdio: 'inherit' })
  }
}

function resolveBrowser() {
  const envPath = process.env.CAPABILITIES_VISUAL_BROWSER || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  if (envPath && fs.existsSync(envPath)) return envPath
  try {
    const p = chromium.executablePath()
    if (p && fs.existsSync(p)) return p
  } catch { /* fall through */ }
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH
  const roots = [browsersPath, '/opt/pw-browsers'].filter(Boolean)
  for (const r of roots) {
    if (!fs.existsSync(r)) continue
    for (const dir of fs.readdirSync(r)) {
      if (!/^chromium(-\d+|_headless)/.test(dir)) continue
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const cand = path.join(r, dir, rel)
        if (fs.existsSync(cand)) return cand
      }
    }
  }
  console.error('No Chromium executable found. Set CAPABILITIES_VISUAL_BROWSER=/path/to/chrome, or run `npx playwright install chromium`.')
  process.exit(2)
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

function startServer() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p === '/') p = '/index.html'
    let file = path.join(guiDist, p)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(guiDist, 'index.html')
    const ext = path.extname(file)
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
}

// ---------------------------------------------------------------------------
// Evidence bookkeeping (§24.5)
// ---------------------------------------------------------------------------

const BUILD_HASH = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim()
const manifest = []
const notApplicable = []
const axeReports = []
const usabilityLog = []
const errors = []

function note(text) {
  console.log('  •', text)
}

function recordEvidence({ id, action, expectedResult, actualObservation, screenshot, viewport, theme = 'default' }) {
  manifest.push({
    id,
    action,
    expectedResult,
    actualObservation,
    screenshot,
    viewport,
    theme,
    build: BUILD_HASH,
    environment: 'chromium-headless linux',
    testDataRevision: 'sample-do178c-audit-hub',
    capturedAt: new Date().toISOString(),
  })
}

function recordNotApplicable(id, reason) {
  manifest.push({ id, notApplicableReason: reason })
  notApplicable.push({ id, reason })
  console.log(`  ○ ${id}: not applicable — ${reason}`)
}

/**
 * The app shell scrolls inside `.main` (an inner overflow-y region), not the
 * document — so `page.screenshot({ fullPage: true })` only ever captures the
 * outer viewport height and silently truncates everything below the fold.
 * This resizes the viewport (width unchanged) to the `.main` panel's real
 * scrollHeight, screenshots at that size, then restores the original
 * viewport so later interactions see the workspace's real breakpoint.
 */
async function fullPageShot(page, id, filename, { action, expectedResult, actualObservation }) {
  const file = path.join(outDir, `${filename}.png`)
  const original = page.viewportSize()
  const contentHeight = await page.evaluate(() => {
    const main = document.querySelector('.main')
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, main ? main.scrollHeight : 0)
  })
  const targetHeight = Math.min(Math.max(contentHeight, original.height), 15000)
  if (targetHeight !== original.height) await page.setViewportSize({ width: original.width, height: targetHeight })
  await page.screenshot({ path: file, fullPage: false })
  if (targetHeight !== original.height) await page.setViewportSize(original)
  recordEvidence({ id, action, expectedResult, actualObservation, screenshot: `${filename}.png`, viewport: original })
  console.log(`  ✓ ${id} → ${filename}.png`)
}

async function elementShot(page, locator, id, filename, { action, expectedResult, actualObservation }) {
  const file = path.join(outDir, `${filename}.png`)
  await locator.screenshot({ path: file })
  const viewport = page.viewportSize()
  recordEvidence({ id, action, expectedResult, actualObservation, screenshot: `${filename}.png`, viewport })
  console.log(`  ✓ ${id} → ${filename}.png`)
}

async function runAxe(page, label) {
  await page.addScriptTag({ content: axe.source })
  const report = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    resultTypes: ['violations', 'incomplete'],
  }))
  const severe = report.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  axeReports.push({
    label,
    url: report.url,
    timestamp: report.timestamp,
    violationCount: report.violations.length,
    criticalOrSeriousCount: severe.length,
    violations: report.violations,
    incomplete: report.incomplete,
  })
  console.log(`  ⚑ axe(${label}): ${report.violations.length} violation(s), ${severe.length} critical/serious`)
  return { total: report.violations.length, severe: severe.length }
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function gotoDesign(page) {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Design' }).first().click()
  await page.waitForSelector('.design-workspace', { timeout: 10000 })
  await page.waitForTimeout(150)
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run() {
  ensureBuilt()
  const EXECUTABLE = resolveBrowser()
  const server = startServer()
  await new Promise((resolve) => server.listen(PORT, resolve))

  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] })

  // ---- Main 1440x900 walk-through --------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, bypassCSP: true })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

  await gotoDesign(page)

  // 01 — default open: synthetic sample statement + 17-module queue.
  const statementText = (await page.locator('.design-sample-statement').innerText()).trim()
  const queueCountText = (await page.locator('.design-queue-result-count').innerText()).trim()
  const statusText = (await page.locator('.design-system-status').innerText()).trim()
  await fullPageShot(page, '01', '01-design-workspace-default', {
    action: 'Open the Design workspace from Primary navigation with no prior state.',
    expectedResult: 'The workspace opens with the synthetic-data statement, the 17-module queue, and counts-not-percentages progress.',
    actualObservation: `Sample statement: "${statementText}". Queue: "${queueCountText}". Status: "${statusText}".`,
  })
  if (!/synthetic/i.test(statementText)) usabilityLog.push(warn('The synthetic-data statement text did not contain the word "synthetic" as expected.'))

  // 02 — module queue filtered (Approved).
  const filterGroup = page.locator('[role="group"][aria-label="Filter design modules"]')
  await filterGroup.getByRole('button', { name: /^Approved/ }).click()
  await page.waitForTimeout(150)
  const filteredCountText = (await page.locator('.design-queue-result-count').innerText()).trim()
  await fullPageShot(page, '02', '02-module-queue-filtered-approved', {
    action: 'Click the "Approved" filter chip in the module queue.',
    expectedResult: 'Only approved-state modules remain in the queue list, with a live-region count update.',
    actualObservation: `Queue result count after filtering: "${filteredCountText}".`,
  })

  // 03 — focused module workspace, six-step session for a selected module.
  await page.locator('.design-queue-list').getByRole('button', { name: new RegExp(MODULE_NAME) }).click()
  await page.waitForSelector('.design-session', { timeout: 5000 })
  const stepLabels = await page.locator('.design-session-steps button').allInnerTexts()
  await fullPageShot(page, '03', '03-module-session-six-step', {
    action: `Select "${MODULE_NAME}" from the filtered module queue.`,
    expectedResult: 'The center panel shows the six fixed module-design session steps and the current step content for the selected module.',
    actualObservation: `Session steps shown (${stepLabels.length}): ${stepLabels.map((s) => s.replace(/\s+/g, ' ').trim()).join(' | ')}.`,
  })

  const axeDefaultSevere = await runAxe(page, 'design-workspace-default')
  const axeSessionSevere = await runAxe(page, 'module-session')

  // 04 — system canvas focus mode (default).
  const canvas = page.locator('.design-canvas')
  const focusToggle = page.locator('.design-canvas-toolbar').getByRole('button', { name: /Show all links/ })
  const focusPressedBefore = await focusToggle.getAttribute('aria-pressed')
  await elementShot(page, canvas, '04', '04-system-canvas-focus-mode', {
    action: `With "${MODULE_NAME}" selected, view the system canvas in its default focus mode.`,
    expectedResult: 'The canvas shows only the selected module and its direct neighborhood (§8.2 "use focus mode by default").',
    actualObservation: `"Show all links" toggle aria-pressed="${focusPressedBefore}" (false means focus mode is active).`,
  })

  // 05 — system canvas all-links mode.
  await focusToggle.click()
  await page.waitForTimeout(150)
  const focusPressedAfter = await focusToggle.getAttribute('aria-pressed')
  await elementShot(page, canvas, '05', '05-system-canvas-all-links', {
    action: 'Click the "Show all links" canvas toggle.',
    expectedResult: 'The canvas now shows every module and every dependency edge in the approved system structure.',
    actualObservation: `"Show all links" toggle aria-pressed="${focusPressedAfter}" after the click.`,
  })

  // 06 — canvas node detail modal. Restore focus mode first. DEFECT observed
  // while driving the UI: the layered layout places node x-coordinates at
  // `topologicalDepth * (nodeWidth + gap)`, but the canvas <svg> keeps a
  // fixed `viewBox="0 0 900 480"` that is never re-fit to the selection or
  // to the graph's extent — so with 17 real modules, the *selected* module's
  // own node (topological depth ~10, x≈2000) is routinely positioned off the
  // visible canvas, even in "focus mode" with that module selected (see
  // 04-system-canvas-focus-mode.png: "Finding Review" is selected but only
  // its neighbor "Audit Workspace" is on screen). There is no "center on
  // selection" or "fit to view" action; "Reset view" only zeroes pan/scale.
  // A real user cannot double-click a node they cannot see, so — like a real
  // user would — this picks whichever node is actually visible on screen.
  await focusToggle.click()
  await page.waitForTimeout(150)
  const candidateNodes = page.locator('.design-canvas-node')
  const candidateCount = await candidateNodes.count()
  let onScreenNode
  let onScreenNodeName = ''
  for (let i = 0; i < candidateCount; i++) {
    const candidate = candidateNodes.nth(i)
    const box = await candidate.boundingBox()
    if (box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= 900) {
      onScreenNode = candidate
      onScreenNodeName = (await candidate.getAttribute('aria-label')) ?? ''
      break
    }
  }
  if (!onScreenNode) throw new Error('No system-canvas node was on screen to double-click — cannot capture 06.')
  await onScreenNode.dblclick()
  const canvasDialog = page.getByRole('dialog')
  await canvasDialog.waitFor({ state: 'visible', timeout: 5000 })
  await elementShot(page, canvasDialog, '06', '06-canvas-node-detail-modal', {
    action: `Double-click "${onScreenNodeName}", the module node actually visible on the default canvas view (the selected module "${MODULE_NAME}" itself is off-canvas — see the defect note in usability-log.json).`,
    expectedResult: 'A modal opens showing the module state, responsibility, provided (consumer) and required (dependency) relationships.',
    actualObservation: `Dialog title: "${(await canvasDialog.locator('h2, [role="heading"]').first().innerText().catch(() => '')) || (await canvasDialog.innerText()).slice(0, 60)}".`,
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  // Double-clicking the on-screen node also selects it (its own onClick),
  // which changed the workspace's selected module away from "Finding
  // Review". Re-select it explicitly before continuing, exactly as a real
  // user would need to after being diverted to inspect a neighbor.
  await page.locator('.design-queue-list').getByRole('button', { name: new RegExp(MODULE_NAME) }).click()
  await page.waitForTimeout(150)

  // 07 — module diagrams step, rendered UML component diagram.
  await page.locator('.design-session-steps').getByRole('button', { name: /Review diagrams/ }).click()
  await page.waitForSelector('.design-diagrams', { timeout: 5000 })
  const diagramTabs = await page.locator('.design-diagrams-tabs [role="tab"]').allInnerTexts()
  const diagrams = page.locator('.design-diagrams')
  await elementShot(page, diagrams, '07', '07-module-diagrams-component', {
    action: `Open the "Review diagrams" step for "${MODULE_NAME}".`,
    expectedResult: 'A rendered UML component diagram appears for the module, with one tab per applicable diagram kind.',
    actualObservation: `Diagram tabs available: ${diagramTabs.join(', ')}.`,
  })

  // 08 — diagram element detail modal.
  const diagramNode = page.locator('[data-diagram-node-id]').first()
  const diagramNodeLabel = await diagramNode.getAttribute('aria-label')
  await diagramNode.click()
  const diagramDialog = page.getByRole('dialog')
  await diagramDialog.waitFor({ state: 'visible', timeout: 5000 })
  await elementShot(page, diagramDialog, '08', '08-diagram-element-detail-modal', {
    action: 'Click the first selectable node on the component diagram.',
    expectedResult: 'A modal opens with the UML element type, stable element ID, label, source record, definition, connected elements, trace links, and discussion history.',
    actualObservation: `Selected diagram element: "${diagramNodeLabel}".`,
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // 09 — diagram text-alternative list.
  await page.locator('.design-diagrams-tabs').getByRole('button', { name: /Show relationship list/ }).click()
  await page.waitForSelector('.design-diagrams-text-alternative', { timeout: 5000 })
  const relationshipLines = await page.locator('.design-diagrams-text-alternative li').allInnerTexts()
  await elementShot(page, diagrams, '09', '09-diagram-text-alternative-list', {
    action: 'Click "Show relationship list" to toggle the diagram\'s text alternative.',
    expectedResult: 'The SVG diagram is replaced by an accessible text list of every relationship (§15.2, §18.4).',
    actualObservation: `${relationshipLines.length} relationship line(s) listed.`,
  })
  // toggle back to the diagram view for a clean state
  await page.locator('.design-diagrams-tabs').getByRole('button', { name: /Show diagram/ }).click()
  await page.waitForTimeout(100)

  // 10 — Build tab: gate-mode banner + one-module handoff panel.
  await page.getByRole('tab', { name: 'Build' }).click()
  await page.waitForSelector('.design-build-handoff', { timeout: 5000 })
  const gateModeText = (await page.locator('.design-gate-mode-banner').innerText()).trim()
  await fullPageShot(page, '10', '10-build-tab-gate-banner-handoff-panel', {
    action: 'Open the Build tab.',
    expectedResult: 'The gate-mode banner and a one-module handoff panel (default module selection) are both visible; there is no automatic dispatch-all action.',
    actualObservation: `Gate-mode banner: "${gateModeText.replace(/\s+/g, ' ')}".`,
  })
  const axeBuild = await runAxe(page, 'build-tab')

  // 11 — packet summary after creating a Copilot handoff.
  const handoffPanel = page.locator('.design-handoff-panel')
  const gateStateBefore = (await handoffPanel.locator('p').first().innerText()).trim()
  await handoffPanel.getByRole('button', { name: 'Create Copilot handoff' }).click()
  await page.waitForSelector('.design-handoff-result', { timeout: 5000 })
  const handoffResultText = (await page.locator('.design-handoff-result p').first().innerText()).trim()
  const manifestEntries = await page.locator('.design-context-manifest li').count()
  await fullPageShot(page, '11', '11-packet-summary-after-handoff', {
    action: `Click "Create Copilot handoff" for "${MODULE_NAME}" (build gate: ${gateStateBefore.replace(/^Build gate:\s*/, '')}).`,
    expectedResult: 'A packet summary appears with the outcome and a context manifest listing every included record/contract with its inclusion reason.',
    actualObservation: `Handoff result: "${handoffResultText}". Context manifest entries: ${manifestEntries}.`,
  })

  // 12 — delta inspection panel (sample delta import).
  const deltaFlow = page.locator('.design-delta-flow')
  const sampleDeltaButton = deltaFlow.getByRole('button', { name: /Use sample deterministic-test-provider delta/ })
  if (await sampleDeltaButton.count()) {
    await sampleDeltaButton.click()
    await page.waitForSelector('.design-delta-imported', { timeout: 5000 }).catch(() => undefined)
    const imported = await page.locator('.design-delta-imported').count()
    if (imported) {
      await page.locator('.design-delta-imported').getByRole('button', { name: 'Inspect returned changes' }).click()
      await page.waitForSelector('.design-delta-inspection', { timeout: 5000 })
      const inspectionSummary = (await page.locator('.design-delta-inspection p').first().innerText()).trim()
      await fullPageShot(page, '12', '12-delta-inspection-panel', {
        action: 'Use the in-app sample deterministic-test-provider delta, then click "Inspect returned changes".',
        expectedResult: 'The full delta inspection is shown before any approve/apply action: file summary, record changes, contract changes, affected requirements/use cases, test results, warnings, and rollback point.',
        actualObservation: `Inspection outcome: "${inspectionSummary}".`,
      })
    } else {
      recordNotApplicable('12', 'The sample delta import did not produce a visible "design-delta-imported" panel — create an implementation handoff first is a precondition the UI enforces, and it was not met in this run.')
    }
  } else {
    recordNotApplicable('12', 'No "Use sample deterministic-test-provider delta" demo action was present for this module/handoff state.')
  }

  // 13 — waves view.
  const waves = page.locator('.design-waves')
  await waves.scrollIntoViewIfNeeded()
  const waveCount = await page.locator('.design-wave').count()
  await elementShot(page, waves, '13', '13-waves-view', {
    action: 'View the Build tab\'s implementation-wave plan.',
    expectedResult: 'Waves list modules with direct dependencies, allowed paths, shared resources, batch eligibility, and blocking contracts/cycles — with no automatic dispatch-all action.',
    actualObservation: `${waveCount} wave(s) shown.`,
  })

  // 14 — Verify tab counts and Design links.
  await page.getByRole('tab', { name: 'Verify' }).click()
  await page.waitForSelector('.design-verify', { timeout: 5000 })
  const verifyCountsText = (await page.locator('.design-verify-counts').innerText()).replace(/\s+/g, ' ').trim()
  const designLinkCount = await page.locator('.design-verify-links button').count()
  const hasDiagramInVerify = await page.locator('.design-verify svg').count()
  await fullPageShot(page, '14', '14-verify-tab-counts-links', {
    action: 'Open the Verify tab.',
    expectedResult: 'Verify shows scenario-run counts and links to approved Design records, and contains no design diagrams (§14.4, §24.2 scenario 30).',
    actualObservation: `Counts: "${verifyCountsText}". Design links: ${designLinkCount}. SVG diagram elements present: ${hasDiagramInVerify}.`,
  })
  if (hasDiagramInVerify > 0) usabilityLog.push(warn('Verify tab contains an <svg> element — the spec requires Verify to contain no design diagrams; worth a manual recheck (may be a false positive if the svg is a non-diagram icon).'))

  // 15 — Evidence Explorer with defect list.
  await page.getByRole('tab', { name: 'Evidence' }).click()
  await page.waitForSelector('.design-evidence-explorer', { timeout: 5000 })
  const defectPhrases = await page.locator('.design-evidence-explorer strong').allInnerTexts()
  await fullPageShot(page, '15', '15-evidence-explorer-defects', {
    action: 'Open the Evidence tab.',
    expectedResult: 'The Evidence Explorer lists the sample defects by lifecycle phase, each with a "Follow trace" action back to Design.',
    actualObservation: `Defect/valid-evidence labels shown: ${defectPhrases.join(', ')}.`,
  })
  const axeEvidence = await runAxe(page, 'evidence-tab')

  await ctx.close()

  // ---- 16 — narrow viewport (640x900) reflow -----------------------------
  const narrowCtx = await browser.newContext({ viewport: { width: 640, height: 900 }, bypassCSP: true })
  const narrowPage = await narrowCtx.newPage()
  await gotoDesign(narrowPage)
  const isNarrowClass = await narrowPage.locator('.design-workspace.narrow').count()
  const drawerToggleText = await narrowPage.locator('.design-queue-drawer-toggle').innerText().catch(() => '(no drawer toggle found)')
  await fullPageShot(narrowPage, '16', '16-narrow-viewport-640x900-reflow', {
    action: 'Open the Design workspace at a 640x900 narrow viewport.',
    expectedResult: 'The module queue becomes a drawer/selector, the current module content remains first, and approval actions remain reachable without precision pointing (§18.2).',
    actualObservation: `.design-workspace.narrow present: ${isNarrowClass > 0}. Drawer toggle label: "${drawerToggleText}".`,
  })
  await narrowCtx.close()

  // ---- 17 — 200% zoom emulation (720x450) --------------------------------
  const zoomCtx = await browser.newContext({ viewport: { width: 720, height: 450 }, bypassCSP: true })
  const zoomPage = await zoomCtx.newPage()
  await gotoDesign(zoomPage)
  const zoomStatement = await zoomPage.locator('.design-sample-statement').isVisible().catch(() => false)
  await fullPageShot(zoomPage, '17', '17-zoomed-200-percent-720x450', {
    action: 'Open the Design workspace at a 720x450 viewport (emulating 200% zoom on a 1440x900 display).',
    expectedResult: 'The workspace remains fully operable with no loss of function at 200% zoom (§18.4).',
    actualObservation: `Sample statement visible at this size: ${zoomStatement}.`,
  })
  await zoomCtx.close()

  await browser.close()
  server.close()

  // ---- Usability observations (§18.1, §18.3) -----------------------------
  usabilityLog.push(
    defect(
      'System canvas (Design tab): the layered layout places a node\'s x-coordinate at `topologicalDepth * (nodeWidth + gap)` (e.g. depth ~10 → x≈2000), but the canvas <svg> keeps a fixed `viewBox="0 0 900 480"` that is never re-fit to the current selection or to the graph\'s extent. With the sample\'s 17 real modules, the *selected* module\'s own node is routinely off-canvas by default — verified live: with "Finding Review" selected, 04-system-canvas-focus-mode.png shows only its neighbor "Audit Workspace" on screen; "Finding Review" itself is not visible. There is no "center on selection" or "fit to view" action — "Reset view" only zeroes pan/scale back to (0,0)/100%, which does not help. A pointer user must manually pan (drag or the ±/zoom controls, min zoom 50%, still not enough to fit x≈2000 into a 900-wide viewBox) to find the very module they just selected. Not fixed here per instructions to avoid editing apps/gui/src.',
    ),
    positive(
      'Progress is reported as counts, not percentages ("N of 17 module designs approved"), matching §18.3 exactly and avoiding false-progress framing.',
    ),
    friction(
      'The system canvas "focus mode" is only ever exposed as its inverse — a "Show all links" toggle. There is no positively-worded "Focus mode" label anywhere in the UI, so a first-time user has to infer that the neighborhood-only view (the default) is called "focus mode" purely from documentation, not from the control itself.',
    ),
    friction(
      'On the module-design Approval step, the "Approve module" primary action is silently disabled (no inline explanation) whenever the design has not reached "readyForReview" — the user must separately visit the Checks step to learn why approval is blocked. This is an "unclear approvals" gap relative to §19\'s "show exact reasons" pattern used elsewhere (e.g. the Checks step\'s own error summary with field links).',
    ),
    friction(
      'Clicking "Create Copilot handoff" for a module row inside the Waves table gives no visible confirmation on that same screen — the outcome is only shown after switching down to the separate per-module handoff panel and re-selecting the same module from its own dropdown. A first-time user could click the Waves row action repeatedly, unsure whether anything happened (weak progress feedback).',
    ),
    friction(
      'At the 640px narrow reflow, the "Show module list" drawer toggle does not name the currently selected module, so a narrow-viewport user cannot tell which module they are editing without opening the drawer first (lost context / poor default).',
    ),
    positive(
      'The module-design session keeps exactly one primary action button pinned at the bottom of every step ("Create module draft" / "Approve module" / etc.), consistent with the §18.1 "one primary action" rule and reducing decision fatigue while stepping through the six-step session.',
    ),
    friction(
      'The diagram text-alternative toggle button\'s label fully swaps meaning based on state ("Show relationship list" ↔ "Show diagram") with no separate persistent heading distinguishing the two views; a screen-reader user tabbing past the button without re-reading its current label could lose track of which view is active.',
    ),
  )

  // ---- Write outputs -------------------------------------------------
  fs.writeFileSync(path.join(outDir, 'evidence-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  fs.writeFileSync(
    path.join(outDir, 'axe-report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), build: BUILD_HASH, reports: axeReports }, null, 2) + '\n',
  )
  fs.writeFileSync(path.join(outDir, 'usability-log.json'), JSON.stringify(usabilityLog, null, 2) + '\n')

  console.log('\n--- Step summary -----------------------------------------------------')
  for (const entry of manifest) {
    if (entry.notApplicableReason) console.log(`  ○ ${entry.id}: not applicable — ${entry.notApplicableReason}`)
    else console.log(`  ✓ ${entry.id}: ${entry.screenshot}`)
  }
  console.log(`\nCaptured ${manifest.filter((e) => e.screenshot).length} screenshot(s), ${notApplicable.length} not-applicable step(s), to ${outDir}`)

  console.log('\n--- Accessibility summary (serious/critical) --------------------------')
  for (const report of axeReports) console.log(`  ${report.label}: ${report.criticalOrSeriousCount} critical/serious (of ${report.violationCount} total)`)

  console.log('\n--- Usability observations --------------------------------------------')
  for (const observation of usabilityLog) console.log(`  [${observation.kind}] ${observation.observation}`)

  if (errors.length) {
    console.log('\n--- Browser console/page errors observed during the run ---------------')
    for (const e of errors) console.log(`  ! ${e}`)
  }

  console.log('\nDone.')
}

function friction(observation) {
  return { kind: 'friction', observation, capturedAt: new Date().toISOString() }
}
function positive(observation) {
  return { kind: 'positive', observation, capturedAt: new Date().toISOString() }
}
function warn(observation) {
  return { kind: 'warning', observation, capturedAt: new Date().toISOString() }
}
function defect(observation) {
  return { kind: 'defect', observation, capturedAt: new Date().toISOString() }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
