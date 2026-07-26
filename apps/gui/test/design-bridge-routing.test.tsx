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
 *    its operation, with a fresh idempotency key and a present-but-
 *    `undefined` `actor` field (second-review P1 fix — the desktop IPC's
 *    own `stampPrincipalOnArgs` derives and stamps the real OS principal;
 *    this GUI never asserts one — see `designBridgeClient.ts` `change()`);
 *  - no local state mutation happens before the bridge round trip resolves;
 *  - service rejection diagnostics render verbatim;
 *  - `getValidNextActions` — not local logic — drives whether `primaryAction`
 *    dispatches a bridge call at all;
 *  - the sample banner is present only in 'sample' mode, absent in 'project'
 *    mode;
 *  - the diagram discussion flow (`Discuss with agent` / `Propose change` /
 *    `Approve change plan`) issues the real `proposeVisualChange` /
 *    `analyzeVisualChange` / `approveChangePlan` bridge operations;
 *  - the project setup panel's bridge calls (`adapter:getProjectRepository`,
 *    `adapter:configureProjectRepository`, `adapter:getPrincipal`,
 *    `adapter:configureProjectRoles`) and their `EUC16-UNKNOWN-OPERATION`
 *    graceful-fallback path;
 *  - a rejected approval carrying `EUC16-AUTHORITY-NOT-CONFIGURED` surfaces
 *    the "Go to project setup" link;
 *  - `project`-mode Verify renders `getScenarioCoverage`'s returned summary.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  buildApplyPlan,
  buildSampleAuditHub,
  computeModuleDesignProgress,
  simulateApply,
  type DeltaApplyResult,
  type DesignDiagnostic,
  type DesignImpactRecord,
  type DiagramDiscussionEntry,
  type ModuleDesignSpecification,
  type ValidNextAction,
} from '@engineering-ui-kit/core/design-browser'
import { ALL_DESIGN_AUTHORITIES, DesignStore } from '../src/views/design/designState'
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
      scenarioRuns: sample.scenarioRuns,
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

/**
 * Exactly one recorded call for `operation`; also checks the §17.3
 * idempotency key, and that `actor` is present as a key (so the desktop
 * IPC's `stampPrincipalOnArgs` recognizes this as a change-operation input
 * to stamp) but carries no client-asserted value (second-review P1 fix —
 * see `designBridgeClient.ts` `change()`).
 */
function assertSingleChangeCall(calls: DesignBridgeRequest[], operation: string): Record<string, unknown> {
  const matches = calls.filter((c) => c.operation === operation)
  expect(matches.length, `expected exactly one ${operation} call, saw ${matches.length}`).toBe(1)
  const input = matches[0]!.args[0] as Record<string, unknown>
  expect(typeof input.idempotencyKey).toBe('string')
  expect((input.idempotencyKey as string).length).toBeGreaterThan(0)
  expect('actor' in input).toBe(true)
  expect(input.actor).toBeUndefined()
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

describe('diagram discussion (§17.2) — proposeVisualChange → analyzeVisualChange → approveChangePlan', () => {
  it('Propose change issues proposeVisualChange then analyzeVisualChange in order, caching the returned impact verbatim; Approve change plan then issues approveChangePlan reading approvedBy from the returned record', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    const design = store.getDesign(APPROVED_MODULE_ID)!
    const target = {
      diagramId: `${design.id}.diagram.component`,
      diagramKind: 'component' as const,
      elementId: `${design.id}.element.component.${APPROVED_MODULE_ID}`,
      elementLabel: design.module.name,
      isRenameable: false,
    }

    const proposedEntry: DiagramDiscussionEntry = {
      id: 'entry.propose.1',
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'user:remote-principal',
      kind: 'proposedChange',
      text: 'Please rename',
      at: '2026-07-25T00:00:00.000Z',
    }
    const impactRecord: DesignImpactRecord = {
      schemaVersion: '1.0',
      impactId: 'impact.remote.1',
      projectId: PROJECT_ID,
      initiatingRecordId: design.id,
      initiatingRevision: design.revision,
      changeKind: 'labelOnly',
      description: 'Please rename',
      items: [{ category: 'moduleDesign', targetId: APPROVED_MODULE_ID, reason: 'depends on this element', invalidation: 'reviewRequired' }],
      orderedChangePlan: [],
      createdAt: '2026-07-25T00:00:01.000Z',
      contentHash: 'hash.impact.1',
    }
    responses.proposeVisualChange = () => okResult(proposedEntry)
    responses.analyzeVisualChange = () => okResult(impactRecord)

    store.proposeDiagramChange(APPROVED_MODULE_ID, target, 'Please rename')
    await store.waitForPendingOperation()

    const proposeInput = assertSingleChangeCall(calls, 'proposeVisualChange')
    expect(proposeInput.diagramId).toBe(target.diagramId)
    expect(proposeInput.elementId).toBe(target.elementId)
    expect(proposeInput.description).toBe('Please rename')

    const analyzeInput = assertSingleChangeCall(calls, 'analyzeVisualChange')
    expect(analyzeInput.initiatingRecordId).toBe(design.id)
    expect(analyzeInput.initiatingRevision).toBe(design.revision)

    // §17.2 order: proposeVisualChange strictly before analyzeVisualChange.
    const proposeIndex = calls.findIndex((c) => c.operation === 'proposeVisualChange')
    const analyzeIndex = calls.findIndex((c) => c.operation === 'analyzeVisualChange')
    expect(proposeIndex).toBeGreaterThanOrEqual(0)
    expect(analyzeIndex).toBeGreaterThan(proposeIndex)

    // Returned records rendered/cached verbatim — not locally re-derived.
    expect(store.getState().diagramImpacts[impactRecord.impactId]).toBe(impactRecord)
    const discussionAfterPropose = store.getDiagramDiscussion(target.elementId)
    expect(discussionAfterPropose).toContain(proposedEntry)
    expect(discussionAfterPropose.some((entry) => entry.kind === 'impactAnalysis' && entry.impactRecordId === impactRecord.impactId)).toBe(true)

    const approvedImpact: DesignImpactRecord = {
      ...impactRecord,
      approval: {
        approvedBy: 'user:remote-principal',
        authority: 'module-owner',
        approvedAt: '2026-07-25T00:00:02.000Z',
        recordId: impactRecord.impactId,
        revision: impactRecord.impactId,
        contentHash: impactRecord.contentHash,
      },
    }
    responses.approveChangePlan = () => okResult(approvedImpact)

    store.approveDiagramChangePlan(APPROVED_MODULE_ID, target)
    await store.waitForPendingOperation()

    const approveInput = assertSingleChangeCall(calls, 'approveChangePlan')
    expect(approveInput.impactId).toBe(impactRecord.impactId)
    expect(approveInput.diagramId).toBe(target.diagramId)
    expect(approveInput.elementId).toBe(target.elementId)

    expect(store.getState().diagramImpacts[impactRecord.impactId]).toBe(approvedImpact)
    const approvalEntry = store.getDiagramDiscussion(target.elementId).find((entry) => entry.kind === 'approvedChangePlan')
    // §20.2 second-review P1 — the approver comes from the service's own
    // returned record, never a local 'you'/constant.
    expect(approvalEntry?.author).toBe('user:remote-principal')
  })

  it('Discuss with agent issues exactly one proposeVisualChange call and caches the returned entry verbatim', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    const design = store.getDesign(APPROVED_MODULE_ID)!
    const target = {
      diagramId: `${design.id}.diagram.component`,
      diagramKind: 'component' as const,
      elementId: `${design.id}.element.component.${APPROVED_MODULE_ID}`,
      elementLabel: design.module.name,
      isRenameable: false,
    }
    const discussEntry: DiagramDiscussionEntry = {
      id: 'entry.discuss.1',
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'user:remote-principal',
      kind: 'proposedChange',
      text: 'What does this component depend on?',
      at: '2026-07-25T00:00:00.000Z',
    }
    responses.proposeVisualChange = () => okResult(discussEntry)

    store.addDiagramDiscussion(APPROVED_MODULE_ID, target, 'What does this component depend on?')
    await store.waitForPendingOperation()

    const input = assertSingleChangeCall(calls, 'proposeVisualChange')
    expect(input.description).toBe('What does this component depend on?')
    expect(store.getDiagramDiscussion(target.elementId)).toContain(discussEntry)
  })
})

describe('project setup — repository root, session principal, project roles (§4, §17.3, §20.2, §25.3)', () => {
  it('loadProjectSetup reads adapter:getProjectRepository and adapter:getPrincipal; configureRepositoryRoot then calls adapter:configureProjectRepository with a fresh idempotency key and no client-asserted actor', async () => {
    const { store, calls, responses } = setup()
    await store.ready

    responses['adapter:getProjectRepository'] = () => ({
      ok: false,
      diagnostics: [{ id: 'r1', code: 'EUC16-ADAPTER-REPOSITORY-NOT-CONFIGURED', severity: 'blocker', message: `no repository is configured for project "${PROJECT_ID}"` }],
    })
    responses['adapter:getPrincipal'] = () => ({ ok: true, principal: 'user:remote-principal' })

    await store.loadProjectSetup()

    expect(store.getState().repositoryConfig.status).toBe('not-configured')
    expect(store.getState().principal).toEqual({ status: 'ready', principal: 'user:remote-principal' })

    responses['adapter:configureProjectRepository'] = () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/srv/repo', auditEventId: 'audit.repo.1' })
    const response = await store.configureRepositoryRoot('/srv/repo')
    expect(response.ok).toBe(true)

    const matches = calls.filter((c) => c.operation === 'adapter:configureProjectRepository')
    expect(matches.length).toBe(1)
    const input = matches[0]!.args[0] as Record<string, unknown>
    expect(typeof input.idempotencyKey).toBe('string')
    expect('actor' in input).toBe(true)
    expect(input.actor).toBeUndefined()
    expect(input.repositoryRoot).toBe('/srv/repo')
    expect(input.projectId).toBe(PROJECT_ID)

    expect(store.getState().repositoryConfig).toEqual({ status: 'configured', repositoryRoot: '/srv/repo' })
  })

  it('grantDesignAuthoritiesToSessionUser loads the principal first, then calls adapter:configureProjectRoles with the full §4 authority list for that principal', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    responses['adapter:getPrincipal'] = () => ({ ok: true, principal: 'user:remote-principal' })
    responses['adapter:configureProjectRoles'] = () => ({ ok: true, auditEventId: 'audit.roles.1' })

    const result = await store.grantDesignAuthoritiesToSessionUser()

    expect(calls.some((c) => c.operation === 'adapter:getPrincipal')).toBe(true)
    const rolesCall = calls.find((c) => c.operation === 'adapter:configureProjectRoles')!
    const input = rolesCall.args[0] as Record<string, unknown>
    expect(input.grantee).toBe('user:remote-principal')
    expect(input.authorities).toEqual([...ALL_DESIGN_AUTHORITIES])
    expect('actor' in input).toBe(true)
    expect(input.actor).toBeUndefined()
    expect(typeof input.idempotencyKey).toBe('string')

    expect(result).toEqual({ status: 'granted', principal: 'user:remote-principal', authorities: [...ALL_DESIGN_AUTHORITIES] })
  })

  it('gracefully reports "unavailable" (never an error or a crash) when adapter:getPrincipal / adapter:configureProjectRoles return EUC16-UNKNOWN-OPERATION', async () => {
    const { store, responses } = setup()
    await store.ready
    const unknownOperation = (operation: string) => ({
      ok: false,
      diagnostics: [{ id: `unknown.${operation}`, code: 'EUC16-UNKNOWN-OPERATION', severity: 'blocker', message: `unknown operation: ${operation}` }],
      validNextActions: [],
    })
    responses['adapter:getPrincipal'] = () => unknownOperation('adapter:getPrincipal')

    await store.loadProjectSetup()
    expect(store.getState().principal).toEqual({ status: 'unavailable', message: 'Principal display requires a newer desktop build.' })

    const grantResult = await store.grantDesignAuthoritiesToSessionUser()
    expect(grantResult).toEqual({ status: 'error', message: 'The session principal is not available yet; cannot grant authorities to an unknown user.' })
  })

  it('reports "unavailable" for adapter:configureProjectRoles specifically when the principal is known but the roles operation itself is unknown', async () => {
    const { store, responses } = setup()
    await store.ready
    responses['adapter:getPrincipal'] = () => ({ ok: true, principal: 'user:remote-principal' })
    responses['adapter:configureProjectRoles'] = () => ({
      ok: false,
      diagnostics: [{ id: 'unknown.roles', code: 'EUC16-UNKNOWN-OPERATION', severity: 'blocker', message: 'unknown operation: adapter:configureProjectRoles' }],
      validNextActions: [],
    })

    const grantResult = await store.grantDesignAuthoritiesToSessionUser()
    expect(grantResult).toEqual({ status: 'unavailable', message: 'Granting authorities requires a newer desktop build.' })
  })
})

describe('blocked-state guidance (§17.3, §4) — EUC16-AUTHORITY-NOT-CONFIGURED links to the Setup tab', () => {
  it('shows a "Go to project setup" button when the last operation was rejected for a missing authority, and clicking it opens the Setup tab', async () => {
    const { store, responses, setDesign } = setup()
    setDesign(APPROVED_MODULE_ID, readyForReviewDesign)
    await store.ready
    store.selectModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    responses.approveModuleDesign = () =>
      rejectedResult([
        {
          id: 'a1',
          code: 'EUC16-AUTHORITY-NOT-CONFIGURED',
          severity: 'blocker',
          message: 'no project role is configured for actor user:remote-principal; an approval requires a configured authority, not a caller-asserted one',
        },
      ])
    store.approveModule(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()

    render(<DesignWorkspaceView store={store} />)
    const link = screen.getByRole('button', { name: 'Go to project setup' })
    expect(document.querySelector('.design-authority-blocked')?.textContent).toContain('no project role is configured for actor')

    expect(document.getElementById('design-workspace-panel-setup')).toBeNull()
    fireEvent.click(link)
    expect(document.getElementById('design-workspace-panel-setup')).toBeTruthy()
  })

  it('never shows the link when there is no authority-not-configured diagnostic', async () => {
    const { store } = setup()
    await store.ready
    render(<DesignWorkspaceView store={store} />)
    expect(screen.queryByRole('button', { name: 'Go to project setup' })).toBeNull()
  })
})

describe('project-mode Verify (§14.4, §17.1) — renders getScenarioCoverage / getVerificationEvidence verbatim', () => {
  it('renders the returned summary counts, first failed step, and design links, then evidence for that first failed step', async () => {
    const { store, calls, responses } = setup()
    await store.ready

    responses.getScenarioCoverage = () => ({
      useCaseCount: 2,
      scenarioCount: 3,
      passedCount: 1,
      failedCount: 1,
      skippedCount: 1,
      cancelledCount: 0,
      stepCount: 5,
      screenshotCount: 2,
      structuredEvidenceCount: 1,
      currentCount: 2,
      oldCount: 1,
      firstFailedStep: { runId: 'run.remote.1', scenarioId: 'scenario.remote.1', stepId: 'step.remote.1', action: 'Click submit' },
      designLinks: [APPROVED_MODULE_ID],
    })
    responses.getVerificationEvidence = () => ({
      schemaVersion: '1.0',
      runId: 'run.remote.1',
      projectId: PROJECT_ID,
      scenarioId: 'scenario.remote.1',
      useCaseId: 'uc.remote.1',
      identity: {
        useCaseAnalysisRevision: 'r1',
        applicationRevision: 'r1',
        systemStructureRevision: 'r1',
        moduleDesignRevisions: {},
        implementationRevisions: {},
        connectionRevision: 'r1',
        build: 'b1',
        sourceRevision: 's1',
        environment: 'e1',
        testDataRevision: 't1',
        runner: 'runner1',
      },
      steps: [{ stepId: 'step.remote.1', action: 'Click submit', expectedResult: 'ok', actualResult: 'error', startedAt: '2026-07-25T00:00:00.000Z', endedAt: '2026-07-25T00:00:01.000Z', outcome: 'failed' }],
      outcome: 'failed',
      startedAt: '2026-07-25T00:00:00.000Z',
      completedAt: '2026-07-25T00:00:01.000Z',
      evidenceHashes: [],
      contentHash: 'hash.run.1',
    })

    render(<DesignWorkspaceView store={store} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Verify' }))

    await waitFor(() => expect(calls.some((c) => c.operation === 'getScenarioCoverage')).toBe(true))
    await waitFor(() => expect(calls.some((c) => c.operation === 'getVerificationEvidence')).toBe(true))
    await waitFor(() => expect(screen.queryByText('First failed step')).toBeTruthy())
    expect(screen.getByText(/Run run\.remote\.1, scenario scenario\.remote\.1, step step\.remote\.1: Click submit/)).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(/Evidence for run\.remote\.1/)).toBeTruthy())

    const evidenceCall = calls.find((c) => c.operation === 'getVerificationEvidence')!
    expect(evidenceCall.args).toEqual([PROJECT_ID, 'run.remote.1'])
  })

  it('shows an honest empty state when there are no scenario runs recorded yet', async () => {
    const { store, responses } = setup()
    await store.ready
    responses.getScenarioCoverage = () => undefined

    render(<DesignWorkspaceView store={store} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Verify' }))

    await waitFor(() => expect(screen.queryByText('No scenario runs recorded yet.')).toBeTruthy())
  })
})

describe('complete Capabilities workflow routing — Plan, System, Connect, Verify, Evidence', () => {
  it('routes Plan and system-design actions through canonical bridge operations', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    responses.createUseCaseDraft = () => okResult(sample.useCaseAnalysis)
    responses.approveUseCaseAnalysis = () => okResult({ analysis: sample.useCaseAnalysis })
    responses.createSystemDesignDraft = () => okResult(architecture)
    responses.approveSystemStructure = () => okResult(architecture)

    store.createUseCaseAnalysis({ workDescription: 'Review controlled evidence.' })
    await store.waitForPendingOperation()
    store.approveUseCaseAnalysis()
    await store.waitForPendingOperation()
    store.createSystemStructure()
    await store.waitForPendingOperation()
    store.approveSystemStructure()
    await store.waitForPendingOperation()

    for (const operation of ['createUseCaseDraft', 'approveUseCaseAnalysis', 'createSystemDesignDraft', 'approveSystemStructure']) {
      assertSingleChangeCall(calls, operation)
    }
  })

  it('routes Connect and scenario execution through real executor-backed operation names', async () => {
    const { store, calls, responses } = setup()
    await store.ready
    const binding = { bindingId: 'binding.remote' }
    responses.configureBinding = () => okResult({ bindingId: 'binding.remote', storedAt: '2026-07-25T00:00:00.000Z' })
    responses.verifyConnection = () => okResult({ verificationId: 'verification.remote', verificationStatus: 'verified' })
    responses.runScenario = () => okResult(sample.scenarioRuns[0])

    store.configureConnection(APPROVED_MODULE_ID, binding)
    await store.waitForPendingOperation()
    store.verifyConnection(APPROVED_MODULE_ID)
    await store.waitForPendingOperation()
    store.runScenario(sample.scenarioRuns[0]!.scenarioId)
    await store.waitForPendingOperation()

    expect(assertSingleChangeCall(calls, 'configureBinding').bindingConfig).toEqual(binding)
    assertSingleChangeCall(calls, 'verifyConnection')
    assertSingleChangeCall(calls, 'runScenario')
  })

  it('renders live project evidence from canonical scenario runs instead of a placeholder note', async () => {
    const { store } = setup()
    await store.ready
    render(<DesignWorkspaceView store={store} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Evidence' }))

    expect(screen.queryByText(/not available for a live project/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Trace scenario results to exact design revisions' })).toBeTruthy()
    expect(screen.getAllByText(sample.scenarioRuns[0]!.scenarioId).length).toBeGreaterThan(0)
  })
})
