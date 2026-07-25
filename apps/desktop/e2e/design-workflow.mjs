/**
 * Real-Electron end-to-end test for the `design:operation` IPC channel
 * (EUC-16 — apps/desktop/src/capabilities/designIpc.ts /
 * apps/desktop/src/capabilities/designBridge.ts).
 *
 * Launches the REAL desktop Electron app (real preload bridge — the same
 * `window.euik.designOperation` the renderer would call — real IPC, real
 * filesystem effects under a temp `EUIK_DATA_DIR`) and drives the channel
 * directly through `page.evaluate`, because the desktop renderer has no
 * design-workflow UI wired yet. Every call goes through the genuine preload
 * bridge → `ipcMain.handle('design:operation', ...)` →
 * `DesignOperationsService` (packages/core `capabilities/design/operations.ts`)
 * path — nothing here reimplements or bypasses that service.
 *
 * Covers, against the real channel:
 *   1. createUseCaseDraft → getWorkflowStatus → getValidNextActions
 *      (SPECIFICATION.md §17: structured result with ok/revision/
 *      auditEventId/validNextActions).
 *   2. No-agent-approval (§20.2): an `agent:` actor calling
 *      `approveUseCaseAnalysis` is rejected with the agent-approval
 *      diagnostic, through the same channel a real agent client would use.
 *   3. Restart recovery (§19 "Lost client session", §25.3 "a restart
 *      restores the module session"): quitting and relaunching Electron
 *      against the same `EUIK_DATA_DIR` still resolves the draft created
 *      before the restart, at the same revision.
 *   4. Idempotent replay across a restart: replaying `createUseCaseDraft`
 *      with the same idempotency key after the process (and its in-memory
 *      idempotency cache) was recycled returns the first committed result
 *      from the persisted audit trail, not a duplicate.
 *
 * Usage: `node apps/desktop/e2e/design-workflow.mjs`. In this container,
 * Electron has no display and must run under `xvfb-run -a` with
 * `ELECTRON_DISABLE_SANDBOX=1`; this script re-execs itself under
 * `xvfb-run` automatically when no `DISPLAY` is present, so the bare
 * command above is sufficient.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..', '..')

// ---------------------------------------------------------------------------
// Self-wrap under `xvfb-run -a env ELECTRON_DISABLE_SANDBOX=1` when there is
// no display to launch Electron against (the container environment this
// harness targets). If a display already exists (a developer's desktop,
// or a CI runner that wraps the command itself), run in-process as-is.
// ---------------------------------------------------------------------------
if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.EUIK_E2E_XVFB_WRAPPED) {
  const result = spawnSync(
    'xvfb-run',
    ['-a', 'env', 'ELECTRON_DISABLE_SANDBOX=1', process.execPath, HERE, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, EUIK_E2E_XVFB_WRAPPED: '1' } },
  )
  if (result.error) {
    console.error(`[design-workflow] failed to launch under xvfb-run: ${result.error.message}`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

const { _electron: electron } = await import('playwright')
const { default: electronPath } = await import('electron')

// ---------------------------------------------------------------------------
// Evidence + step bookkeeping
// ---------------------------------------------------------------------------

const startedAt = new Date().toISOString()
/** @type {{ name: string, ok: boolean, detail?: unknown, error?: string }[]} */
const steps = []

async function step(name, fn) {
  try {
    const detail = await fn()
    steps.push({ name, ok: true, ...(detail !== undefined ? { detail } : {}) })
    console.log(`  [PASS] ${name}`)
    return detail
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    steps.push({ name, ok: false, error: message })
    console.error(`  [FAIL] ${name}: ${message}`)
    throw err
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

// ---------------------------------------------------------------------------
// Build prerequisites (dist output is gitignored; build if missing or, for
// apps/desktop, if the built output predates the design-channel wiring).
// ---------------------------------------------------------------------------

const buildLog = []

function runBuild(workspace) {
  console.log(`  [build] npm run build --workspace=${workspace} (dist missing or stale)`)
  const result = spawnSync('npm', ['run', 'build', `--workspace=${workspace}`], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`npm run build --workspace=${workspace} exited ${result.status}`)
  }
  buildLog.push(workspace)
}

function ensurePrerequisitesBuilt() {
  const coreMarker = path.join(REPO_ROOT, 'packages/core/dist/capabilities/design/operations.js')
  const coreFresh = fs.existsSync(coreMarker) && fs.readFileSync(coreMarker, 'utf8').includes('createUseCaseDraft')
  if (!coreFresh) runBuild('packages/core')

  // apps/desktop/dist is checked for the actual design:operation channel
  // string, not just presence, because a pre-existing but stale dist
  // (built before EUC-16 wiring landed) would otherwise pass a bare
  // existence check while still lacking the channel this test exercises.
  const desktopMarker = path.join(REPO_ROOT, 'apps/desktop/dist/capabilities/designBridge.js')
  const desktopFresh = fs.existsSync(desktopMarker) && fs.readFileSync(desktopMarker, 'utf8').includes('design:operation')
  if (!desktopFresh) runBuild('apps/desktop')

  return { built: buildLog.slice() }
}

// ---------------------------------------------------------------------------
// Electron driver — no UI is exercised; every call goes straight through the
// real preload bridge (`window.euik.designOperation`) to the real channel.
// ---------------------------------------------------------------------------

async function launchApp(dataDir) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(REPO_ROOT, 'apps', 'desktop')],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: process.env.ELECTRON_DISABLE_SANDBOX ?? '1',
      EUIK_DATA_DIR: dataDir,
    },
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.euik?.designOperation === 'function')
  return { app, page }
}

function callDesign(page, operation, args) {
  return page.evaluate(
    ({ operation, args }) => window.euik.designOperation({ operation, args }),
    { operation, args },
  )
}

// ---------------------------------------------------------------------------
// Test run
// ---------------------------------------------------------------------------

const PROJECT_ID = 'design-e2e-project'
const CREATE_IDEMPOTENCY_KEY = `design-e2e-create-${process.pid}-${Date.now()}`
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-design-e2e-'))

let outcome = 'unknown'
let firstCreateResult
let firstApp

try {
  await step('build prerequisites (packages/core, apps/desktop)', () => ensurePrerequisitesBuilt())

  // ---- 1. Launch #1, create a draft through the real channel ------------
  let page1
  await step('launch Electron app (fresh EUIK_DATA_DIR)', async () => {
    const launched = await launchApp(dataDir)
    firstApp = launched.app
    page1 = launched.page
    return { launched: true }
  })

  firstCreateResult = await step('createUseCaseDraft (actor user:e2e, idempotencyKey)', async () => {
    const result = await callDesign(page1, 'createUseCaseDraft', [{
      projectId: PROJECT_ID,
      actor: 'user:e2e',
      idempotencyKey: CREATE_IDEMPOTENCY_KEY,
      workDescription: 'Design E2E: verify the design:operation IPC channel end to end.',
    }])
    assert(result && result.ok === true, `expected ok:true, got ${JSON.stringify(result)}`)
    assert(typeof result.revision === 'string' && result.revision.length > 0, 'expected a revision string')
    assert(typeof result.auditEventId === 'string' && result.auditEventId.length > 0, 'expected an auditEventId string')
    assert(Array.isArray(result.validNextActions), 'expected validNextActions to be an array')
    return { ok: result.ok, revision: result.revision, auditEventId: result.auditEventId, validNextActionCount: result.validNextActions.length }
  })

  await step('getWorkflowStatus reflects the created draft', async () => {
    const status = await callDesign(page1, 'getWorkflowStatus', [PROJECT_ID])
    assert(status && status.projectId === PROJECT_ID, 'expected projectId to echo back')
    assert(status.useCaseAnalysis?.draft?.revision === firstCreateResult.revision, 'expected draft revision to match createUseCaseDraft result')
    return { draftRevision: status.useCaseAnalysis.draft.revision }
  })

  await step('getValidNextActions lists approveUseCaseAnalysis', async () => {
    const actions = await callDesign(page1, 'getValidNextActions', [PROJECT_ID])
    assert(Array.isArray(actions), 'expected an array of valid next actions')
    const names = actions.map((a) => a.operation)
    assert(names.includes('approveUseCaseAnalysis'), `expected approveUseCaseAnalysis among ${JSON.stringify(names)}`)
    return { validNextActions: names }
  })

  // ---- 2. §20.2 — no approval shortcut for agents, through the real channel
  await step('approveUseCaseAnalysis rejects an agent actor (no agent-approval shortcut)', async () => {
    const result = await callDesign(page1, 'approveUseCaseAnalysis', [{
      projectId: PROJECT_ID,
      actor: 'agent:e2e',
      idempotencyKey: `design-e2e-approve-${Date.now()}`,
      authority: 'product-lead',
    }])
    assert(result && result.ok === false, `expected ok:false for an agent actor, got ${JSON.stringify(result)}`)
    const codes = (result.diagnostics ?? []).map((d) => d.code)
    assert(codes.includes('EUC16-AGENT-APPROVAL-FORBIDDEN'), `expected EUC16-AGENT-APPROVAL-FORBIDDEN among ${JSON.stringify(codes)}`)
    return { diagnosticCodes: codes }
  })

  await step('close app #1', async () => {
    await firstApp.close()
    firstApp = undefined
  })

  // ---- 3. §19 / §25.3 — restart recovery ---------------------------------
  let app2
  let page2
  await step('relaunch Electron app (same EUIK_DATA_DIR)', async () => {
    const launched = await launchApp(dataDir)
    app2 = launched.app
    page2 = launched.page
    return { launched: true }
  })

  try {
    await step('getWorkflowStatus after restart still resolves the draft (same revision)', async () => {
      const status = await callDesign(page2, 'getWorkflowStatus', [PROJECT_ID])
      assert(status?.useCaseAnalysis?.draft, 'expected the draft to survive a restart')
      assert(
        status.useCaseAnalysis.draft.revision === firstCreateResult.revision,
        `expected revision ${firstCreateResult.revision}, got ${status.useCaseAnalysis.draft.revision}`,
      )
      return { draftRevision: status.useCaseAnalysis.draft.revision }
    })

    // ---- 4. Idempotent replay across a restart ---------------------------
    await step('createUseCaseDraft replay (same idempotencyKey, after restart) returns the first committed result', async () => {
      const replay = await callDesign(page2, 'createUseCaseDraft', [{
        projectId: PROJECT_ID,
        actor: 'user:e2e',
        idempotencyKey: CREATE_IDEMPOTENCY_KEY,
        workDescription: 'Design E2E: verify the design:operation IPC channel end to end.',
      }])
      assert(replay && replay.ok === true, `expected ok:true on replay, got ${JSON.stringify(replay)}`)
      assert(replay.revision === firstCreateResult.revision, `expected replayed revision ${firstCreateResult.revision}, got ${replay.revision}`)
      assert(replay.auditEventId === firstCreateResult.auditEventId, `expected replayed auditEventId ${firstCreateResult.auditEventId}, got ${replay.auditEventId}`)
      assert(replay.idempotentReplay === true, `expected idempotentReplay:true, got ${JSON.stringify(replay)}`)
      return { revision: replay.revision, auditEventId: replay.auditEventId, idempotentReplay: replay.idempotentReplay }
    })
  } finally {
    await step('close app #2', async () => {
      await app2.close()
    })
  }

  outcome = 'pass'
} catch (err) {
  outcome = 'fail'
  if (firstApp) {
    await firstApp.close().catch(() => undefined)
  }
} finally {
  const endedAt = new Date().toISOString()
  const evidence = {
    test: 'design-workflow',
    channel: 'design:operation',
    outcome,
    steps,
    environment: {
      platform: process.platform,
      node: process.version,
      electron: electronPath,
      xvfbWrapped: process.env.EUIK_E2E_XVFB_WRAPPED === '1',
      electronDisableSandbox: process.env.ELECTRON_DISABLE_SANDBOX ?? null,
      euikDataDir: dataDir,
      builtWorkspaces: buildLog,
    },
    startedAt,
    endedAt,
  }
  const evidenceDir = path.join(REPO_ROOT, 'apps/desktop/e2e/__evidence__')
  fs.mkdirSync(evidenceDir, { recursive: true })
  const evidencePath = path.join(evidenceDir, 'design-workflow.json')
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2))
  console.log(`\n  evidence: ${evidencePath}`)

  const passCount = steps.filter((s) => s.ok).length
  console.log(`\ndesign-workflow: ${passCount}/${steps.length} steps passed — ${outcome.toUpperCase()}`)

  if (outcome !== 'pass') process.exitCode = 1
}
