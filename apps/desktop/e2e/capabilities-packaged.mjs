/**
 * CAP-TEST-040 — REAL packaged Electron capabilities journey harness.
 *
 * Unlike apps/desktop/e2e/capabilities-journeys.mjs (which records an honest
 * `not-run` for the packaged path and runs offline core journeys), this harness
 * launches the ACTUAL packaged desktop app through Playwright's Electron support
 * and drives CAP-JRN-001..008 across the REAL renderer → preload (contextBridge
 * `window.euik`) → IPC → CapabilityWorkspace → on-disk persistence path. It does
 * NOT call core helpers in-process.
 *
 * HONEST-FAILURE CONTRACT (do not soften):
 *   - If Playwright or Electron are unavailable, or Electron does not produce a
 *     usable window within the launch budget, the process prints
 *     "packaged execution unavailable: <reason>" and EXITS NONZERO.
 *   - A watchdog force-exits nonzero if the whole run exceeds its budget, so an
 *     Electron launch that hangs (as it does in a headless/sandboxed CI shell)
 *     can never masquerade as success or `not-run`.
 *   - Exit 0 ONLY when Electron actually launched, all eight journeys passed,
 *     supplementary UI invariants held, and approved records survived a full
 *     Electron restart.
 *
 * Usage:
 *   node apps/desktop/e2e/capabilities-packaged.mjs
 *
 * Env:
 *   EUIK_PACKAGED_LAUNCH_MS   per-launch budget (default 45000)
 *   EUIK_PACKAGED_WATCHDOG_MS whole-run budget  (default 180000)
 *   EUIK_PACKAGED_SKIP_BUILD  '1' to skip the workspace builds
 *   EUIK_PACKAGED_ALLOW_AZURE '1' to additionally exercise the opt-in Azure
 *                             discovery path (still a local fake boundary)
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { REPO_ROOT } from './config.mjs'
import {
  productDraft,
  architectureDraft,
  domainManifest,
  workflowManifest,
  approveBindingRecord,
} from './capabilities-fixtures.mjs'

const LAUNCH_MS = Number(process.env.EUIK_PACKAGED_LAUNCH_MS ?? 45_000)
const WATCHDOG_MS = Number(process.env.EUIK_PACKAGED_WATCHDOG_MS ?? 180_000)
const ALLOW_AZURE = process.env.EUIK_PACKAGED_ALLOW_AZURE === '1'

const EVIDENCE_DIR = path.join(
  REPO_ROOT,
  'apps',
  'desktop',
  'validation-evidence',
  'capabilities-journeys',
  'packaged',
)
fs.mkdirSync(EVIDENCE_DIR, { recursive: true })

const startedAt = new Date().toISOString()
const shots = []

function log(msg) {
  console.log(msg)
}

function writeEvidence(name, payload) {
  const file = path.join(EVIDENCE_DIR, name)
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n')
  log(`  [evidence] ${path.relative(REPO_ROOT, file)}`)
  return file
}

/**
 * Record an honest failure and exit nonzero. Never records `passed`/`not-run`
 * as if it succeeded.
 */
function fail(reason, extra = {}) {
  const payload = {
    mode: 'packaged-electron-playwright',
    status: 'unavailable',
    launched: Boolean(extra.launched),
    reason,
    startedAt,
    finishedAt: new Date().toISOString(),
    screenshots: shots,
    ...extra,
  }
  writeEvidence('packaged-status.json', payload)
  console.error(`packaged execution unavailable: ${reason}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Watchdog: guarantees the process cannot hang forever on a stuck Electron.
// ---------------------------------------------------------------------------
const watchdog = setTimeout(() => {
  fail(`watchdog timeout after ${WATCHDOG_MS}ms — Electron launch/drive did not complete`, {
    launched: false,
  })
}, WATCHDOG_MS)
watchdog.unref()

// ---------------------------------------------------------------------------
// Preflight: Playwright + Electron must be resolvable.
// ---------------------------------------------------------------------------
let electronLaunch
let electronPath
try {
  const pw = await import('playwright')
  electronLaunch = pw._electron
  if (!electronLaunch) throw new Error('playwright._electron is undefined')
} catch (error) {
  fail(`Playwright Electron support is not available: ${error?.message ?? error}`)
}
try {
  electronPath = (await import('electron')).default
  if (!electronPath || !fs.existsSync(electronPath)) {
    throw new Error(`electron binary missing at ${electronPath}`)
  }
} catch (error) {
  fail(`Electron binary is not available: ${error?.message ?? error}`)
}

// ---------------------------------------------------------------------------
// Build the desktop main/preload + GUI renderer + core (real artifacts).
// ---------------------------------------------------------------------------
if (process.env.EUIK_PACKAGED_SKIP_BUILD !== '1') {
  for (const pkg of ['packages/core', 'apps/gui', 'apps/desktop']) {
    log(`[build] npm run build -w ${pkg}`)
    const built = spawnSync('npm', ['run', 'build', '-w', pkg], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (built.status !== 0) fail(`build failed for ${pkg} (exit ${built.status})`)
  }
}
for (const artifact of [
  ['apps/desktop/dist/main.js'],
  ['apps/desktop/dist/preload.cjs'],
  ['apps/gui/dist/index.html'],
]) {
  const p = path.join(REPO_ROOT, ...artifact)
  if (!fs.existsSync(p)) fail(`required build artifact missing: ${artifact.join('/')}`)
}

// ---------------------------------------------------------------------------
// Isolated userData + a domain-neutral fixture project repo. Network stays off;
// MATLAB/Azure use the app's deterministic in-process fake boundaries.
// ---------------------------------------------------------------------------
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-packaged-'))
const dataDir = path.join(scratch, 'userData')
const fixtureRepo = path.join(scratch, 'fixture-project')
fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(fixtureRepo, { recursive: true })
// Minimal, domain-neutral project so workspace.createProject + verification see a repo.
fs.writeFileSync(
  path.join(fixtureRepo, 'package.json'),
  JSON.stringify({ name: 'euik-cap-fixture', version: '0.0.0', private: true }, null, 2),
)
fs.mkdirSync(path.join(fixtureRepo, 'capabilities'), { recursive: true })

const launchEnv = {
  ...process.env,
  EUIK_TEST_MODE: '1',
  EUIK_DATA_DIR: dataDir,
  EUIK_TEST_PICK_DIR: fixtureRepo,
  // Force offline: no proxy, no external endpoints. The Azure/MATLAB adapters
  // are local fake boundaries, so nothing should dial out.
  HTTP_PROXY: '',
  HTTPS_PROXY: '',
  NO_PROXY: '*',
}

async function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function launch(label) {
  const app = await withTimeout(
    electronLaunch.launch({
      executablePath: electronPath,
      args: [path.join(REPO_ROOT, 'apps', 'desktop')],
      env: launchEnv,
      timeout: LAUNCH_MS,
    }),
    LAUNCH_MS,
    `${label}: electron.launch`,
  )
  const page = await withTimeout(app.firstWindow(), LAUNCH_MS, `${label}: firstWindow`)
  await withTimeout(
    page.waitForLoadState('domcontentloaded'),
    LAUNCH_MS,
    `${label}: domcontentloaded`,
  )
  await withTimeout(
    page.waitForFunction(() => typeof window.euik === 'object' && window.euik !== null, null, {
      timeout: LAUNCH_MS,
    }),
    LAUNCH_MS,
    `${label}: window.euik bridge`,
  )
  return { app, page }
}

async function shot(page, name) {
  const idx = String(shots.length + 1).padStart(2, '0')
  const file = path.join(EVIDENCE_DIR, `${idx}-${name}.png`)
  try {
    await withTimeout(page.screenshot({ path: file }), 15_000, `screenshot ${name}`)
    shots.push(path.basename(file))
    log(`  [shot] ${path.basename(file)}`)
  } catch (error) {
    log(`  [shot-skip] ${name}: ${error?.message ?? error}`)
  }
}

// Fixtures computed in Node, passed by value into the renderer context.
const fixtures = (() => {
  const product = productDraft('__pid__', '1')
  const arch = architectureDraft(product)
  return {
    product,
    arch,
    domain: domainManifest(),
    workflow: workflowManifest(),
    binding: approveBindingRecord('__pid__'),
  }
})()

/**
 * Runs entirely inside the renderer. Every call crosses the real contextBridge
 * and IPC boundary into the main process and CapabilityWorkspace. Returns
 * structured per-journey evidence; throws are caught per journey.
 */
async function driveJourneys(page, projectId) {
  const local = JSON.parse(JSON.stringify(fixtures))
  local.product.projectId = projectId
  local.arch.projectId = projectId
  local.binding.projectId = projectId
  return withTimeout(
    page.evaluate(
      async ({ pid, fx, allowAzure }) => {
        const euik = window.euik
        const results = []
        const record = async (journeyId, fn) => {
          try {
            const r = await fn()
            results.push({ journeyId, passed: Boolean(r.passed), evidence: r.evidence ?? {} })
          } catch (error) {
            results.push({
              journeyId,
              passed: false,
              evidence: { error: error?.message ?? String(error) },
            })
          }
        }

        await euik.capabilitiesEnsureInitialized(pid)

        // CAP-JRN-001 — define + approve application.
        await record('CAP-JRN-001', async () => {
          await euik.capabilitiesSaveApplicationDraft(pid, fx.product)
          const r = await euik.capabilitiesApproveApplication(pid, fx.product)
          return {
            passed: r.ok === true && r.approved?.status === 'approved' && r.approved?.revision === '1',
            evidence: { ok: r.ok, revision: r.approved?.revision, gatePassed: r.gate?.passed },
          }
        })

        // CAP-JRN-002 — define + approve architecture.
        await record('CAP-JRN-002', async () => {
          await euik.capabilitiesSaveArchitectureDraft(pid, fx.arch)
          const r = await euik.capabilitiesApproveArchitecture(pid, fx.arch)
          return {
            passed: r.ok === true && r.approved?.status === 'approved',
            evidence: { ok: r.ok, revision: r.approved?.revision, gatePassed: r.gate?.passed },
          }
        })

        // CAP-JRN-003 — approve a module, apply a generated artifact, verify it.
        await record('CAP-JRN-003', async () => {
          await euik.capabilitiesSaveModuleDraft(pid, fx.domain)
          const m = await euik.capabilitiesApproveModule(pid, fx.domain)
          const write = await euik.capabilitiesFilesystemWrite({
            projectId: pid,
            relativePath: 'capabilities/generated/mod.domain.txt',
            text: 'module: mod.domain\n',
            explicit: true,
          })
          const hashes = {
            specification: 'spec',
            implementation: 'impl',
            architecture: 'arch',
            dependencies: 'none',
            adapters: 'adapter.filesystem',
            bindings: 'none',
            verificationSuites: 'suite.domain',
          }
          const now = new Date().toISOString()
          const ver = await euik.capabilitiesRunModuleVerification({
            verificationId: 'ver-jrn-003',
            projectId: pid,
            moduleId: 'mod.domain',
            moduleType: 'domain',
            manifest: fx.domain,
            inputHashes: hashes,
            currentHashes: hashes,
            commands: [{ label: 'suite.domain', exitCode: 0, passed: true }],
            startedAt: now,
            completedAt: now,
          })
          return {
            passed:
              m.ok === true &&
              write.outcome === 'success' &&
              ver?.record?.outcome === 'passed',
            evidence: {
              moduleApproved: m.ok,
              writeOutcome: write.outcome,
              verificationOutcome: ver?.record?.outcome,
            },
          }
        })

        // CAP-JRN-004 — approve impact + ordered delta; exactly one actionable target.
        await record('CAP-JRN-004', async () => {
          await euik.capabilitiesSaveModuleDraft(pid, fx.workflow)
          await euik.capabilitiesApproveModule(pid, fx.workflow)
          // Bump architecture to include both modules + a real dependency edge.
          const arch2 = JSON.parse(JSON.stringify(fx.arch))
          arch2.revision = '2'
          arch2.moduleIds = ['mod.domain', 'mod.workflow']
          arch2.dependencyEdges = [
            { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'uses' },
          ]
          arch2.operationAllocations = [
            { operationId: 'op.count.approve', moduleId: 'mod.domain' },
            { operationId: 'op.flow', moduleId: 'mod.workflow' },
          ]
          arch2.workflowTraces = [{ useCaseId: 'u1', moduleIds: ['mod.workflow', 'mod.domain'] }]
          await euik.capabilitiesSaveArchitectureDraft(pid, arch2)
          await euik.capabilitiesApproveArchitecture(pid, arch2)

          const impact = await euik.capabilitiesCalculateImpact({
            projectId: pid,
            changedModuleIds: ['mod.domain'],
            classification: 'required-additive',
          })
          const approved = await euik.capabilitiesApproveImpact(pid, impact)
          const state = await euik.capabilitiesDeltaQueueState({
            projectId: pid,
            changeId: approved.changeId,
          })
          const targets = state.targets ?? state.queue ?? []
          const actionable = targets.filter(
            (t) => t.actionable === true || t.status === 'actionable' || t.state === 'actionable',
          )
          // Fallback: some shapes expose a single nextActionable field.
          const singleActionable =
            actionable.length === 1 ||
            (actionable.length === 0 && Boolean(state.nextActionable ?? state.nextActionableTarget))
          return {
            passed: Boolean(approved.userApproval?.approved) && singleActionable,
            evidence: {
              impactApproved: Boolean(approved.userApproval?.approved),
              proposedOrder: impact.proposedPacketOrder,
              nextActionable: state.nextActionable ?? state.nextActionableTarget,
              actionableCount: actionable.length,
            },
          }
        })

        // CAP-JRN-005 — filesystem behavior + escape blocked, no host-absolute leak.
        await record('CAP-JRN-005', async () => {
          const write = await euik.capabilitiesFilesystemWrite({
            projectId: pid,
            relativePath: 'artifacts/counts-result.json',
            text: '{"sku":1,"qty":3,"ok":true}',
            explicit: true,
          })
          const read = await euik.capabilitiesFilesystemRead({
            projectId: pid,
            relativePath: 'artifacts/counts-result.json',
            explicit: true,
          })
          let escapeBlocked = false
          try {
            const esc = await euik.capabilitiesFilesystemWrite({
              projectId: pid,
              relativePath: '../../etc/passwd',
              text: 'x',
              explicit: true,
            })
            escapeBlocked = esc.outcome !== 'success'
          } catch {
            escapeBlocked = true
          }
          const serialized = JSON.stringify({ write, read })
          const hostAbsoluteAbsent = !serialized.includes('/Users/') && !/[A-Za-z]:\\\\/.test(serialized)
          return {
            passed:
              write.outcome === 'success' &&
              read.outcome === 'success' &&
              escapeBlocked &&
              hostAbsoluteAbsent,
            evidence: {
              writeOutcome: write.outcome,
              readOutcome: read.outcome,
              escapeBlocked,
              hostAbsoluteAbsent,
            },
          }
        })

        // CAP-JRN-006 — MATLAB fake boundary + snapshot isolation + allowlist.
        await record('CAP-JRN-006', async () => {
          const start = await euik.capabilitiesMatlabInvoke({
            projectId: pid,
            operation: 'start',
            explicit: true,
          })
          const status = await euik.capabilitiesMatlabSessionStatus(pid)
          const save = await euik.capabilitiesMatlabInvoke({
            projectId: pid,
            operation: 'snapshot-save',
            variables: ['count'],
            explicit: true,
          })
          const restore = await euik.capabilitiesMatlabInvoke({
            projectId: pid,
            operation: 'snapshot-restore',
            explicit: true,
          })
          // Isolation: a different project must not see this project's snapshot.
          const crossProject = await euik.capabilitiesMatlabInvoke({
            projectId: 'proj-isolation-other',
            operation: 'snapshot-restore',
            explicit: true,
          })
          // Allowlist: a shell-injection expression must be rejected.
          const evalBad = await euik.capabilitiesMatlabInvoke({
            projectId: pid,
            operation: 'eval-allowlisted',
            expression: 'system("rm -rf /")',
            explicit: true,
          })
          return {
            passed:
              start.outcome === 'success' &&
              status.state === 'ready' &&
              save.outcome === 'success' &&
              restore.outcome === 'success' &&
              restore.value?.mode === 'fake-boundary' &&
              crossProject.outcome !== 'success' &&
              evalBad.outcome !== 'success',
            evidence: {
              startOutcome: start.outcome,
              sessionState: status.state,
              restoreMode: restore.value?.mode,
              crossProjectRejected: crossProject.outcome !== 'success',
              allowlistRejected: evalBad.outcome !== 'success',
            },
          }
        })

        // CAP-JRN-007 — approve binding + simulated modes visibly simulated.
        await record('CAP-JRN-007', async () => {
          await euik.capabilitiesSaveBindingDraft(pid, fx.binding)
          const appr = await euik.capabilitiesApproveBinding(pid, fx.binding)
          const simulated = await euik.capabilitiesInvokeOperation({
            projectId: pid,
            operationId: 'op.count.approve',
            args: { qty: 1 },
            dataMode: 'approved-example',
            explicit: true,
          })
          const visiblySimulated =
            simulated.outcome === 'success' &&
            (simulated.provenance?.source?.includes('simulat') === true ||
              simulated.value?.simulated === true)
          return {
            passed:
              appr.ok === true && appr.approved?.bindingId === 'bind-approve' && visiblySimulated,
            evidence: {
              bindingApproved: appr.ok,
              bindingId: appr.approved?.bindingId,
              simulatedSource: simulated.provenance?.source,
              simulatedFlag: simulated.value?.simulated,
            },
          }
        })

        // CAP-JRN-008 — Azure fake boundary: provenance recorded, approved spec untouched.
        await record('CAP-JRN-008', async () => {
          const before = await euik.capabilitiesGetApplication(pid)
          const imported = await euik.capabilitiesAzureImportWorkItem({
            projectId: pid,
            externalId: '42',
            revision: '3',
            content: { 'System.Title': 'Inventory acceptance', 'System.State': 'Active' },
            explicit: true,
          })
          const after = await euik.capabilitiesGetApplication(pid)
          let discoverOk = null
          if (allowAzure) {
            try {
              const disc = await euik.capabilitiesAzureDiscover({
                projectId: pid,
                opaqueSecretId: 'missing-secret',
                explicit: true,
              })
              // Without a stored secret this must be an authorization failure,
              // never a leak — either outcome is acceptable evidence of the boundary.
              discoverOk = disc.outcome !== 'success'
            } catch (error) {
              discoverOk = true
            }
          }
          return {
            passed:
              imported.outcome === 'success' &&
              imported.value?.provenance?.externalId === '42' &&
              imported.value?.provenance?.revision === '3' &&
              imported.value?.mutatesApprovedSpec === false &&
              before.approved?.revision === after.approved?.revision,
            evidence: {
              externalId: imported.value?.provenance?.externalId,
              mutatesApprovedSpec: imported.value?.mutatesApprovedSpec,
              approvedUnchanged: before.approved?.revision === after.approved?.revision,
              discoverBoundaryHeld: discoverOk,
            },
          }
        })

        // Supplementary shared-record + UI invariants observable from the renderer.
        const supplementary = {}
        // Guided/Design share one canonical record set (same approved ids in both projections).
        const appNow = await euik.capabilitiesGetApplication(pid)
        const archNow = await euik.capabilitiesGetArchitecture(pid)
        supplementary.sharedRecords = Boolean(appNow.approved?.id && archNow.approved?.id)
        // Sections chrome present in the real renderer.
        supplementary.sectionsNav = document.querySelectorAll(
          '.capabilities-sections button',
        ).length
        supplementary.projectionToggle = document.querySelectorAll(
          '.capabilities-toolbar button[aria-pressed]',
        ).length
        supplementary.statusRegions = document.querySelectorAll('[role="status"]').length

        return { results, supplementary }
      },
      { pid: projectId, fx: local, allowAzure: ALLOW_AZURE },
    ),
    WATCHDOG_MS,
    'driveJourneys',
  )
}

// ---------------------------------------------------------------------------
// Run 1: launch, create project, navigate Capabilities, drive journeys.
// ---------------------------------------------------------------------------
let run1
try {
  run1 = await launch('run-1')
} catch (error) {
  fail(`Electron did not produce a usable window: ${error?.message ?? error}`, { launched: false })
}
const { app, page } = run1
log('[packaged] Electron launched; real window.euik bridge present.')

let projectId
let driven
try {
  await shot(page, 'app-loaded')
  // Create the fixture project through the real IPC surface.
  const project = await withTimeout(
    page.evaluate(
      (repo) =>
        window.euik.createProject({ name: 'Capabilities Fixture', repoPath: repo }),
      fixtureRepo,
    ),
    30_000,
    'createProject',
  )
  projectId = project?.id
  if (!projectId) throw new Error('createProject returned no id')
  log(`[packaged] fixture project id=${projectId}`)

  // Drive the Capabilities destination in the real renderer for a UI screenshot.
  try {
    const capsNav = page.locator('nav [data-nav="capabilities"], button:has-text("Capabilities")').first()
    await capsNav.click({ timeout: 10_000 })
  } catch {
    /* navigation chrome is best-effort; journeys drive via the real bridge */
  }
  await shot(page, 'capabilities-view')

  driven = await driveJourneys(page, projectId)
  await shot(page, 'journeys-complete')
} catch (error) {
  try {
    await app.close()
  } catch {
    /* ignore */
  }
  fail(`journey driving failed: ${error?.message ?? error}`, { launched: true })
}

try {
  await withTimeout(app.close(), 20_000, 'run-1 close')
} catch {
  /* ignore */
}

// ---------------------------------------------------------------------------
// Run 2: restart Electron against the SAME userData; approved records survive.
// ---------------------------------------------------------------------------
let restart = { ok: false }
try {
  const run2 = await launch('run-2')
  restart = await withTimeout(
    run2.page.evaluate(async (pid) => {
      const euik = window.euik
      await euik.capabilitiesEnsureInitialized(pid)
      const app = await euik.capabilitiesGetApplication(pid)
      const arch = await euik.capabilitiesGetArchitecture(pid)
      const modules = await euik.capabilitiesListModules(pid)
      const bindings = await euik.capabilitiesListBindings(pid)
      const moduleSurvived = modules.some(
        (m) => (m.approved?.moduleId ?? m.moduleId) === 'mod.domain',
      )
      const bindingSurvived = bindings.some(
        (b) => (b.approved?.bindingId ?? b.draft?.bindingId ?? b.bindingId) === 'bind-approve',
      )
      return {
        ok:
          app.approved?.revision === '1' &&
          Boolean(arch.approved?.id) &&
          moduleSurvived &&
          bindingSurvived,
        appRevision: app.approved?.revision,
        archId: arch.approved?.id,
        moduleSurvived,
        bindingSurvived,
      }
    }, projectId),
    LAUNCH_MS,
    'restart readback',
  )
  await shot(run2.page, 'after-restart')
  await withTimeout(run2.app.close(), 20_000, 'run-2 close')
} catch (error) {
  fail(`Electron restart / persistence verification failed: ${error?.message ?? error}`, {
    launched: true,
  })
}

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
clearTimeout(watchdog)
const results = driven.results
const failed = results.filter((r) => !r.passed)
const supplementary = driven.supplementary
const supplementaryOk =
  supplementary.sharedRecords === true &&
  supplementary.sectionsNav > 0 &&
  supplementary.projectionToggle >= 2 &&
  supplementary.statusRegions > 0
const allPassed = failed.length === 0 && restart.ok === true && supplementaryOk

const report = {
  mode: 'packaged-electron-playwright',
  status: allPassed ? 'passed' : 'failed',
  launched: true,
  startedAt,
  finishedAt: new Date().toISOString(),
  hardware: {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    model: os.cpus()[0]?.model,
  },
  dataDir,
  fixtureRepo,
  journeys: results,
  restart,
  supplementary,
  supplementaryOk,
  screenshots: shots,
}
writeEvidence('packaged-status.json', report)
writeEvidence('packaged-journeys.json', report)

for (const r of results) {
  log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.journeyId}`)
}
log(`  [restart] ${restart.ok ? 'PASS' : 'FAIL'}`)
log(`  [supplementary] ${supplementaryOk ? 'PASS' : 'FAIL'}`)

if (!allPassed) {
  console.error('CAP-TEST-040 PACKAGED journeys FAILED')
  process.exit(1)
}
log('CAP-TEST-040 PACKAGED journeys PASSED (Electron launched; 8/8 + restart verified)')
process.exit(0)
