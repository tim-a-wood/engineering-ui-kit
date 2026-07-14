/**
 * Real visual validation for the Capabilities UX pass.
 * Serves the built GUI (mock bridge), drives each state via the real window.euik
 * bridge API, and screenshots the running app with the pre-provisioned Chromium.
 *
 * Usage: node scripts/capabilities-ux-visual.mjs
 */
import { chromium } from 'playwright-core'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(root, '../apps/gui/dist')
const outDir = path.resolve(root, '../apps/gui/validation-evidence/capabilities-ux')
fs.mkdirSync(outDir, { recursive: true })

const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0])
  if (p === '/') p = '/index.html'
  let file = path.join(distDir, p)
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html') // SPA fallback
  const ext = path.extname(file)
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

// ---- in-page fixture builders + seeding (run in browser context) -----------
const SEED = `
window.__mkApp = (status) => ({ schemaVersion:'1.0', id:'app.plantops', revision:'3', name:'PlantOps work orders', purpose:'Coordinate plant maintenance work orders', outcomes:[{id:'o1',name:'Faster dispatch'},{id:'o2',name:'Fewer missed SLAs'}], userRoles:[{id:'r1',name:'Dispatcher'}], domainTerms:[], constraints:[], successMeasures:[], useCases:[{id:'uc1',name:'Create work order'}], contentHash:'a1b2c3d4e5f67890', status });
window.__mkArch = (ids) => ({ schemaVersion:'1.0', id:'arch.1', revision:'1', status:'approved', applicationSpecId:'app.plantops', applicationSpecRevision:'3', applicationSpecHash:'a1b2c3', capabilityProjections:[], moduleIds:ids, dependencyEdges:[], operationAllocations:[], adapterAllocations:[], workflowTraces:[], proposals:[], unresolvedQuestions:[], gateResult:{gateId:'CAP-GATE-002',passed:true,diagnostics:[]}, contentHash:'archhash1234' });
window.__mkMod = (id, type, ops) => ({ schemaVersion:'1.0', architectureVersion:'1.0', moduleId:id, moduleVersion:'1.0.0', moduleType:type, name:id.replace('mod.',''), responsibility:'', ownedConcerns:[], excludedConcerns:[], providedOperations:(ops||[]).map(o=>({operationId:o,contractVersion:'2.0'})), requiredOperations:[], verificationSuiteIds:['suite.unit'], runtimeAllocation:'local-embedded', events:[], ownedPaths:[] });
window.__pid = async () => (await window.euik.listProjects())[0].id;
window.__seed = async (scenario) => {
  const b = window.euik; const pid = await window.__pid(); await b.capabilitiesEnsureInitialized(pid);
  if (scenario === 'define-draft') { await b.capabilitiesSaveApplicationDraft(pid, window.__mkApp('draft')); }
  if (scenario === 'architect-draft') { await b.capabilitiesApproveApplication(pid, window.__mkApp('approved')); await b.capabilitiesSaveArchitectureDraft(pid, {...window.__mkArch(['mod.orders','mod.scheduling']), status:'draft'}); }
  if (scenario === 'partial-modules' || scenario === 'build') {
    await b.capabilitiesApproveApplication(pid, window.__mkApp('approved'));
    await b.capabilitiesApproveArchitecture(pid, window.__mkArch(['mod.orders','mod.scheduling','mod.reporting']));
    await b.capabilitiesApproveModule(pid, window.__mkMod('mod.orders','domain',['op.placeOrder']));
  }
  if (scenario === 'connect-active') {
    await b.capabilitiesApproveApplication(pid, window.__mkApp('approved'));
    await b.capabilitiesApproveArchitecture(pid, window.__mkArch(['mod.orders']));
    await b.capabilitiesApproveModule(pid, window.__mkMod('mod.orders','experience',['op.placeOrder','op.cancelOrder']));
  }
  if (scenario === 'complete') {
    await b.capabilitiesApproveApplication(pid, window.__mkApp('approved'));
    await b.capabilitiesApproveArchitecture(pid, window.__mkArch(['mod.orders','mod.scheduling']));
    for (const id of ['mod.orders','mod.scheduling']) { await b.capabilitiesApproveModule(pid, window.__mkMod(id,'domain',['op.'+id.slice(4)])); await b.capabilitiesVerifyApprovedModule({ projectId: pid, moduleId: id, explicit: true }); }
  }
  return pid;
};
`

async function gotoCapabilities(page) {
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.euik, { timeout: 5000 })
  // Click the Capabilities nav item.
  await page.getByRole('button', { name: 'Capabilities' }).first().click()
  await page.waitForTimeout(150)
}

async function selectFirstProject(page) {
  const pid = await page.evaluate(() => window.__pid())
  await page.selectOption('select[aria-label="Capabilities project"]', pid)
  await page.waitForTimeout(250)
}

const PORT = 4318
const shots = []
async function shot(page, name) {
  const file = path.join(outDir, name + '.png')
  await page.screenshot({ path: file, fullPage: true })
  shots.push(name)
  console.log('  ✓', name)
}

const run = async () => {
  await new Promise((r) => server.listen(PORT, r))
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(SEED)
  const page = await ctx.newPage()

  // 1. No project selected
  await gotoCapabilities(page)
  await shot(page, '01-no-project')

  // 2. Empty Define (select project, no seed)
  await selectFirstProject(page)
  await shot(page, '02-empty-define')

  // 3. Exported handoff (click Create interview handoff)
  await page.getByRole('button', { name: /Create interview handoff/i }).click()
  await page.waitForTimeout(250)
  await shot(page, '03-handoff-ready')

  // Helper to re-seed a fresh page for a scenario.
  const scenario = async (name, seed, after) => {
    const p = await ctx.newPage()
    await p.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' })
    await p.waitForFunction(() => !!window.euik, { timeout: 5000 })
    if (seed) await p.evaluate((s) => window.__seed(s), seed)
    await p.getByRole('button', { name: 'Capabilities' }).first().click()
    await p.waitForTimeout(120)
    const pid = await p.evaluate(() => window.__pid())
    await p.selectOption('select[aria-label="Capabilities project"]', pid)
    await p.waitForTimeout(300)
    if (after) await after(p)
    await shot(p, name)
    await p.close()
  }

  await scenario('04-define-draft', 'define-draft')
  await scenario('05-architecture-draft', 'architect-draft')
  await scenario('06-build-two-region', 'build')
  await scenario('07-connect-active', 'connect-active')
  await scenario('08-completed-journey', 'complete')

  // Design areas (seed complete so areas have data)
  const designAreas = ['Application', 'Architecture', 'Needs attention', 'Modules', 'Connections', 'Verification']
  const dp = await ctx.newPage()
  await dp.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' })
  await dp.waitForFunction(() => !!window.euik)
  await dp.evaluate(() => window.__seed('complete'))
  await dp.getByRole('button', { name: 'Capabilities' }).first().click()
  await dp.waitForTimeout(120)
  const dpid = await dp.evaluate(() => window.__pid())
  await dp.selectOption('select[aria-label="Capabilities project"]', dpid)
  await dp.getByRole('button', { name: 'Design' }).click()
  await dp.waitForTimeout(200)
  for (let i = 0; i < designAreas.length; i++) {
    await dp.getByRole('tab', { name: designAreas[i] }).click()
    await dp.waitForTimeout(150)
    await shot(dp, '09-design-' + (i + 1) + '-' + designAreas[i].toLowerCase().replace(/\\s+/g, '-'))
  }
  await dp.close()

  // Help — Capabilities overview (titlebar, context-aware) + a stage-specific topic
  const hp = await ctx.newPage()
  await hp.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' })
  await hp.waitForFunction(() => !!window.euik)
  await hp.getByRole('button', { name: 'Capabilities' }).first().click()
  await hp.waitForTimeout(120)
  await hp.locator('.titlebar button[aria-label="Help"]').click()
  await hp.waitForTimeout(200)
  await shot(hp, '10-help-overview')
  await hp.keyboard.press('Escape')
  await hp.waitForTimeout(150)
  // Stage-specific help: select project, open the stage "How this works" link.
  const hpid = await hp.evaluate(() => window.__pid())
  await hp.selectOption('select[aria-label="Capabilities project"]', hpid)
  await hp.waitForTimeout(200)
  await hp.getByRole('button', { name: /How this works/i }).click()
  await hp.waitForTimeout(200)
  await shot(hp, '10b-help-stage-define')
  await hp.close()

  // Narrow viewport — build + journey
  const nctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
  await nctx.addInitScript(SEED)
  const np = await nctx.newPage()
  await np.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' })
  await np.waitForFunction(() => !!window.euik)
  await np.evaluate(() => window.__seed('build'))
  await np.getByRole('button', { name: 'Capabilities' }).first().click()
  await np.waitForTimeout(120)
  const npid = await np.evaluate(() => window.__pid())
  await np.selectOption('select[aria-label="Capabilities project"]', npid)
  await np.waitForTimeout(300)
  await shot(np, '11-narrow-build')
  await nctx.close()

  await browser.close()
  server.close()
  console.log('\\nCaptured ' + shots.length + ' screenshots to ' + outDir)
}

async function gotoCapabilitiesOn(page) {
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.euik, { timeout: 5000 })
  await page.getByRole('button', { name: 'Capabilities' }).first().click()
  await page.waitForTimeout(150)
}

run().catch((e) => { console.error(e); process.exit(1) })
