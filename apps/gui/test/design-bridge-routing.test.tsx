// @vitest-environment jsdom
/**
 * §17, §22.1 'project' mode bridge-routing tests (review finding #1).
 *
 * Drives `DesignStore` / `DesignWorkspaceView` against a FAKE
 * `window.euik.designOperation` bridge — a recording stub that returns
 * canned `DesignOperationResult`-shaped values, not the real desktop IPC
 * channel or the real `DesignOperationsService` (that pair is owned by a
 * concurrently edited packet; `apps/desktop/src/capabilities/designBridge.ts`
 * documents the wire contract this stub mirrors: `{ operation, args }` in,
 * the named service method's own return value out).
 *
 * Asserts:
 *  - 'project' mode is entered only with a bridge AND a configured project;
 *  - every user action in 'project' mode issues exactly one bridge call for
 *    its operation, with a fresh idempotency key and a `user:`-prefixed
 *    actor;
 *  - no local state mutation happens before the bridge round trip resolves;
 *  - service rejection diagnostics render verbatim;
 *  - `getValidNextActions` — not local logic — drives whether `primaryAction`
 *    dispatches a bridge call at all;
 *  - the sample banner is present only in 'sample' mode, absent in 'project'
 *    mode.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import {
  buildApplyPlan,
  buildSampleAuditHub,
  computeModuleDesignProgress,
  simulateApply,
  type DeltaApplyResult,
  type DesignDiagnostic,
  type ModuleDesignSpecification,
  type ValidNextAction,
} from '@engineering-ui-kit/core/design-browser'
import { DesignStore } from '../src/views/design/designState'
import { DesignWorkspaceView } from '../src/views/design/DesignWorkspaceView'
import { detectDesignBridgeCaller, type DesignBridgeRequest } from '../src/views/design/designBridgeClient'

afterEach(cleanup)
beforeEach(() => {
  window.localStorage.clear()
  delete (window as unknown as { euik?: unknown }).euik
  delete (window as unknown as { euikMode?: unknown }).euikMode
})

describe('detectDesignBridgeCaller', () => {
  it('is undefined with no window.euik, with the mock bridge mode, and with an electron bridge missing designOperation', () => {
    expect(detectDesignBridgeCaller(window)).toBeUndefined()

    ;(window as unknown as { euikMode?: string }).euikMode = 'mock'
    ;(window as unknown as { euik?: unknown }).euik = { designOperation: vi.fn() }
    expect(detectDesignBridgeCaller(window)).toBeUndefined()

    ;(window as unknown as { euikMode?: string }).euikMode = 'electron'
    ;(window as unknown as { euik?: unknown }).euik = { someOtherMethod: vi.fn() }
    expect(detectDesignBridgeCaller(window)).toBeUndefined()
  })

  it('returns a callable bound to window.euik when window.euikMode is electron and designOperation is present', async () => {
    const designOperation = vi.fn(async (request: DesignBridgeRequest) => ({ received: request }))
    ;(window as unknown as { euikMode?: string }).euikMode = 'electron'
    ;(window as unknown as { euik?: unknown }).euik = { designOperation }

    const caller = detectDesignBridgeCaller(window)
    expect(caller).toBeTypeOf('function')
    const result = await caller!({ operation: 'getWorkflowStatus', args: ['p1'] })
    expect(designOperation).toHaveBeenCalledWith({ operation: 'getWorkflowStatus', args: ['p1'] })
    expect(result).toEqual({ received: { operation: 'getWorkflowStatus', args: ['p1'] } })
  })
})

const PROJECT_ID = 'proj.routing-test'
const sample = buildSampleAuditHub()
const architecture = { ...sample.architecture, projectId: PROJECT_ID }
const APPROVED_MODULE_ID = 'mod.evidence-store'
const NOT_STARTED_MODULE_ID = architecture.moduleIds.find((id) => id !== APPROVED_MODULE_ID)!
const approvedDesign: ModuleDesignSpecification = {
  ...sample.moduleDesigns.find((d) => d.module.moduleId === APPROVED_MODULE_ID && d.status === 'approved')!,
  projectId: PROJECT_ID,
}
const readyForReviewDesign: ModuleDesignSpecification = { ...approvedDesign, status: 'readyForReview', approval: undefined }
const nowApprovedDesign: ModuleDesignSpecification = { ...approvedDesign, status: 'approved' }
const implementationPacket = sample.packets.implementationPacket
const returnedDelta = sample.returnedDeltas[0]!
const deltaInspection = sample.inspections[0]!
const applyPlan = buildApplyPlan(deltaInspection, returnedDelta, { planId: 'plan.routing-test', backupRef: 'backup.routing-test' })
const applyOutcome = simulateApply(applyPlan, {}, '2026-07-25T00:00:00.000Z')
const deltaApplyResult: DeltaApplyResult = applyOutcome.result

type Handler = (args: unknown[]) => unknown

function okResult<T>(value: T, validNextActions: ValidNextAction[] = []) {
  return { ok: true, value, diagnostics: [] as DesignDiagnostic[], auditEventId: `audit.${Math.random()}`, validNextActions }
}
function rejectedResult(diagnostics: DesignDiagnostic[], validNextActions: ValidNextAction[] = []) {
  return { ok: false, diagnostics, auditEventId: `audit.${Math.random()}`, validNextActions }
}

/**
 * Builds a fresh fake bridge + `DesignStore` in `project` mode. The fake
 * bridge's `call` implementation never itself `await`s anything, so every
 * "round trip" actually resolves synchronously (a same-tick `Promise`) —
 * meaning the store's *very first* `getWorkflowStatus`/`getValidNextActions`
 * calls happen synchronously inside `new DesignStore(...)`, before this
 * function returns. `initialValidNextActions` configures that first
 * response; `setValidNextActions` (returned) reconfigures it for later
 * calls, which are safe to set up in the test body because they always run
 * after at least one `await` has already yielded back to this test.
 *
 * Tests override `responses[operation]` to script a change operation's
 * result; mutating handlers also update `designsById` so the automatic
 * post-change refresh (`DesignStore.runChangeOperation` always re-reads
 * `getModuleDesign`/`listModuleDesigns`/`getValidNextActions` — it never
 * trusts the change response alone) sees the persisted result, the same way
 * a real backend would.
 */
function setup(initialValidNextActions: ValidNextAction[] = [{ operation: 'startModuleDesign', targetId: NOT_STARTED_MODULE_ID, label: `Design module: ${NOT_STARTED_MODULE_ID}`, enabled: true }]) {
  const calls: DesignBridgeRequest[] = []
  const designsById: Record<string, ModuleDesignSpecification> = { [APPROVED_MODULE_ID]: approvedDesign }
  let validNextActions: ValidNextAction[] = initialValidNextActions

  const responses: Record<string, Handler> = {
    getWorkflowStatus: () => ({
      projectId: PROJECT_ID,
      useCaseAnalysis: { approved: sample.useCaseAnalysis },
      systemStructure: { approved: architecture },
      baseline: { approved: sample.designBaseline },
      policy: sample.policy,
    }),
    listModuleDesigns: () => computeModuleDesignProgress(architecture, Object.values(designsById), []),
    getImplementationWaves: () => ({ projectId: PROJECT_ID, architectureRevision: architecture.revision, waves: [], autoDispatch: false }),
    getValidNextActions: () => validNextActions,
    getModuleDesign: (args) => designsById[args[1] as string],
  }

  const call = vi.fn(async (request: DesignBridgeRequest) => {
    calls.push(request)
    const handler = responses[request.operation]
    if (!handler) throw new Error(`fake bridge: no handler configured for ${request.operation}`)
    return handler(request.args)
  })

  const store = new DesignStore({ bridge: { projectId: PROJECT_ID, call } })

  return {
    store,
    calls,
    responses,
    setDesign: (moduleId: string, design: ModuleDesignSpecification) => {
      designsById[moduleId] = design
    },
    setValidNextActions: (next: ValidNextAction[]) => {
      validNextActions = next
    },
  }
}

/** Exactly one recorded call for `operation`; also checks the §17.3 idempotency key and `user:`-prefixed actor. */
function assertSingleChangeCall(calls: DesignBridgeRequest[], operation: string): Record<string, unknown> {
  const matches = calls.filter((c) => c.operation === operation)
  expect(matches.length, `expected exactly one ${operation} call, saw ${matches.length}`).toBe(1)
  const input = matches[0]!.args[0] as Record<string, unknown>
  expect(typeof input.idempotencyKey).toBe('string')
  expect((input.idempotencyKey as string).length).toBeGreaterThan(0)
  expect(typeof input.actor).toBe('string')
  expect((input.actor as string).startsWith('user:')).toBe(true)
  return input
}

describe('project mode detection', () => {
  it('is entered with a bridge and a configured project, and is visible via mode/data-mode', async () => {
    const { store } = setup()
    await store.ready
    expect(store.getState().mode).toBe('project')

    render(<DesignWorkspaceView store={store} />)
    expect(document.querySelector('.design-workspace')?.getAttribute('data-mode')).toBe('project')
  })

  it('sample mode is the default when there is no bridge/project — data-mode is sample and the persistent sample banner is shown', () => {
    const sampleStore = new DesignStore()
    expect(sampleStore.getState().mode).toBe('sample')

    render(<DesignWorkspaceView store={sampleStore} />)
    expect(document.querySelector('.design-workspace')?.getAttribute('data-mode')).toBe('sample')
    expect(document.querySelector('.design-sample-mode-banner')?.textContent).toMatch(
      /Sample workspace — changes stay in this browser and do not affect any project/,
    )
  })

  it('the sample banner never appears in project mode', async () => {
    const { store } = setup()
    await store.ready
    render(<DesignWorkspaceView store={store} />)
    expect(document.querySelector('.design-sample-mode-banner')).toBeNull()
  })
})

describe('reads route through the bridge on load', () => {
  it('issues getWorkflowStatus, listModuleDesigns, getImplementationWaves, and getValidNextActions, and populates state from their results', async () => {
    const { store, calls } = setup()
    await store.ready

    for (const operation of ['getWorkflowStatus', 'listModuleDesigns', 'getImplementationWaves', 'getValidNextActions']) {
      expect(calls.some((c) => c.operation === operation), `expected a ${operation} call`).toBe(true)
    }

    const state = store.getState()
    expect(state.architecture.moduleIds).toEqual(architecture.moduleIds)
    expect(state.progress.modules.some((m) => m.moduleId === APPROVED_MODULE_ID && m.state === 'approved')).toBe(true)
    expect(state.validNextActions.some((a) => a.operation === 'startModuleDesign')).toBe(true)
  })
})

describe('change operations — exactly one bridge call, fresh idempotency key, user: actor, no local mutation before the round trip', () => {
  it('ensureDraft: getModuleDesign (none exists) then exactly one startModuleDesign call; no design appears until the round trip resolves', async () => {
    const { store, calls, responses } = setup()
    await store.ready

    const draft: ModuleDesignSpecification = { ...approvedDesign, module: { ...approvedDesign.module, moduleId: NOT_STARTED_MODULE_ID }, status: 'draft', approval: undefined }
    responses.startModuleDesign = () => okResult(draft)

    store.ensureDraft(NOT_STARTED_MODULE_ID)
    // No local mutation before the bridge round trip resolves.
    expect(store.getDesign(NOT_STARTED_MODULE_ID)).toBeUndefined()

    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'startModuleDesign')
    expect(store.getDesign(NOT_STARTED_MODULE_ID)?.module.moduleId).toBe(NOT_STARTED_MODULE_ID)
  })

  it('answerRequiredQuestion issues exactly one answerModuleDesignQuestion call with the question id and text', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    responses.answerModuleDesignQuestion = () => okResult(approvedDesign)
    store.answerRequiredQuestion(APPROVED_MODULE_ID, 'item.1', 'Use the tailored DAL.')
    await store.waitForPendingOperation()

    const input = assertSingleChangeCall(calls, 'answerModuleDesignQuestion')
    expect(input.questionId).toBe('item.1')
    expect(input.text).toBe('Use the tailored DAL.')
  })

  it('runChecks issues exactly one analyzeModuleDesign call', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    responses.analyzeModuleDesign = () => okResult(approvedDesign)
    store.runChecks(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    assertSingleChangeCall(calls, 'analyzeModuleDesign')
  })

  it('approveModule issues exactly one approveModuleDesign call and does not flip the design to approved until the round trip resolves', async () => {
    const { store, calls, responses, setDesign } = setup()
    setDesign(APPROVED_MODULE_ID, readyForReviewDesign)
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    expect(store.getDesign(APPROVED_MODULE_ID)?.status).toBe('readyForReview')

    responses.approveModuleDesign = () => {
      setDesign(APPROVED_MODULE_ID, nowApprovedDesign) // the service persists the change; the fake backend must too, so the automatic post-change refresh sees it
      return okResult(nowApprovedDesign)
    }
    const immediate = store.approveModule(APPROVED_MODULE_ID)
    expect(immediate.ok).toBe(false) // never a local approval decision (§17.3, §20.2)
    expect(store.getDesign(APPROVED_MODULE_ID)?.status).toBe('readyForReview') // unchanged before the round trip

    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'approveModuleDesign')
    expect(store.getDesign(APPROVED_MODULE_ID)?.status).toBe('approved')
  })

  it('createModuleHandoff (on an approved design) issues exactly one createModuleImplementationPacket call', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    responses.createModuleImplementationPacket = () => okResult(implementationPacket)
    store.createModuleHandoff(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    assertSingleChangeCall(calls, 'createModuleImplementationPacket')
    const handoff = store.getState().moduleHandoffs[APPROVED_MODULE_ID]
    expect(handoff?.ok).toBe(true)
    expect(handoff?.packet).toBe(implementationPacket)
  })

  it('the returned-delta flow (import, inspect, approve, apply) issues exactly one bridge call per step', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    responses.importAgentDelta = () => okResult(returnedDelta)
    const importResult = store.importReturnedDeltaText(APPROVED_MODULE_ID, JSON.stringify(returnedDelta))
    expect(importResult.ok).toBe(true)
    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'importAgentDelta')

    responses.inspectAgentDelta = () => okResult(deltaInspection)
    store.inspectReturnedDelta(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'inspectAgentDelta')
    expect(store.getState().deltaFlows[APPROVED_MODULE_ID]?.inspection).toBe(deltaInspection)

    responses.approveAgentDelta = () => okResult({ inspectionId: deltaInspection.inspectionId, deltaId: deltaInspection.deltaId })
    store.approveReturnedDelta(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'approveAgentDelta')
    expect(store.getState().deltaFlows[APPROVED_MODULE_ID]?.approved).toBe(true)

    responses.applyAgentDelta = () => okResult(deltaApplyResult)
    store.applyReturnedDelta(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'applyAgentDelta')
    expect(store.getState().deltaFlows[APPROVED_MODULE_ID]?.applyResult).toBe(deltaApplyResult)
  })
})

describe('service rejection diagnostics render verbatim', () => {
  it('a rejected analyzeModuleDesign call surfaces its exact message', async () => {
    const { store, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    responses.analyzeModuleDesign = () => rejectedResult([{ id: 'd1', code: 'EUC16-CUSTOM', severity: 'blocker', message: 'Custom rejection message from the service.' }])
    store.runChecks(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    const state = store.getState()
    expect(state.lastOperationDiagnostics[0]?.message).toBe('Custom rejection message from the service.')
    expect(state.announcement).toContain('Custom rejection message from the service.')

    render(<DesignWorkspaceView store={store} />)
    expect(document.querySelector('.sr-only[role="status"]')?.textContent).toContain('Custom rejection message from the service.')
  })
})

describe('getValidNextActions drives button enablement — never local approval logic', () => {
  it('primaryAction does not call the bridge when the matching action is disabled, and calls it once the service reports it enabled', async () => {
    const { store, calls, responses, setDesign, setValidNextActions } = setup([
      { operation: 'approveModuleDesign', targetId: APPROVED_MODULE_ID, label: 'Approve module design', enabled: false, blockedReason: 'Fix required issues first.' },
    ])
    setDesign(APPROVED_MODULE_ID, readyForReviewDesign)
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    expect(store.primaryActionLabel(APPROVED_MODULE_ID)).toBe('Approve module design')
    store.primaryAction(APPROVED_MODULE_ID)
    expect(calls.some((c) => c.operation === 'approveModuleDesign')).toBe(false)
    expect(store.getState().announcement).toBe('Fix required issues first.')

    // `state.validNextActions` only ever comes from the service's own
    // response to `getValidNextActions` (never computed locally) — the
    // store re-fetches it after every change operation, so a disabled
    // action becomes enabled only once the service reports that (here,
    // simulated by a distinct successful `analyzeModuleDesign` round trip),
    // never by this test poking the store's cached state directly.
    setValidNextActions([{ operation: 'approveModuleDesign', targetId: APPROVED_MODULE_ID, label: 'Approve module design', enabled: true }])
    responses.analyzeModuleDesign = () => okResult(readyForReviewDesign)
    store.runChecks(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    assertSingleChangeCall(calls, 'analyzeModuleDesign')

    responses.approveModuleDesign = () => {
      setDesign(APPROVED_MODULE_ID, nowApprovedDesign)
      return okResult(nowApprovedDesign)
    }
    store.primaryAction(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    expect(calls.some((c) => c.operation === 'approveModuleDesign')).toBe(true)
  })
})
