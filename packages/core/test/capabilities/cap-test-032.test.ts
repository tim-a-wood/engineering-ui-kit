/**
 * CAP-TEST-032 — Consequential actions require explicit UI approval.
 */
import { describe, expect, it } from 'vitest'
import { runConsequentialAction, simulateBindingMode } from '../../src/capabilities/binding.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

const binding: FrontendBinding = {
  schemaVersion: '1.0',
  bindingId: 'bind-1',
  version: '1.0.0',
  projectId: 'proj-1',
  selectionEvidence: {
    route: '/',
    documentTitle: 'App',
    selector: '#btn',
    visibleText: 'Go',
    elementTag: 'button',
    stableMarker: 'data-cap-id=submit',
    captureTime: '2026-07-12T12:00:00.000Z',
  },
  trigger: 'activate',
  operationId: 'op.1',
  operationVersion: '1.0.0',
  inputMappings: [],
  outputMappings: [],
  loadingBehavior: 'spinner',
  validationBehavior: 'inline',
  domainRejectionBehavior: 'toast',
  technicalFailureBehavior: 'banner',
  cancellationBehavior: 'idle',
  duplicateSubmissionBehavior: 'ignore',
  dataMode: 'connected',
}

describe('CAP-TEST-032 consequential explicit-action gate', () => {
  it('only explicit UI action with explicit:true executes side effects', () => {
    const kinds = [
      'filesystem-write',
      'matlab-eval',
      'snapshot-restore',
      'binding-connected-invoke',
    ] as const
    const blockedTriggers = ['background-refresh', 'imported-data', 'direct-request'] as const

    for (const kind of kinds) {
      for (const trigger of blockedTriggers) {
        let ran = false
        const result = runConsequentialAction({
          kind,
          trigger,
          explicit: trigger === 'direct-request',
          approvedOperation: true,
          sideEffect: () => {
            ran = true
            return 'mutated'
          },
        })
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.sideEffectRan).toBe(false)
          expect(result.diagnostics.some((d) => d.code === 'CAP-SEC-002')).toBe(true)
        }
        expect(ran).toBe(false)
      }

      let ran = false
      const allowed = runConsequentialAction({
        kind,
        trigger: 'explicit-ui-action',
        explicit: true,
        approvedOperation: true,
        sideEffect: () => {
          ran = true
          return `${kind}-ok`
        },
      })
      expect(allowed.ok).toBe(true)
      expect(ran).toBe(true)
      if (allowed.ok) expect(allowed.value).toBe(`${kind}-ok`)
    }
  })

  it('rejects consequential action without approved operation even when explicit', () => {
    let ran = false
    const result = runConsequentialAction({
      kind: 'filesystem-write',
      trigger: 'explicit-ui-action',
      explicit: true,
      approvedOperation: false,
      sideEffect: () => {
        ran = true
        return 1
      },
    })
    expect(result.ok).toBe(false)
    expect(ran).toBe(false)
  })

  it('blocks connected binding invoke without explicit:true and leaves no side effects', () => {
    let adapterHits = 0
    const denied = simulateBindingMode({
      binding,
      mode: 'connected',
      explicit: false,
      args: { write: true },
    })
    expect(denied.qualifiesForConnectedVerification).toBe(false)
    expect(denied.connectedInvokePlan).toBeUndefined()

    const gated = runConsequentialAction({
      kind: 'binding-connected-invoke',
      trigger: 'background-refresh',
      explicit: false,
      approvedOperation: true,
      sideEffect: () => {
        adapterHits += 1
        return 'written'
      },
    })
    expect(gated.ok).toBe(false)
    expect(adapterHits).toBe(0)
  })
})
