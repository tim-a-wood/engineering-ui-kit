/**
 * EUC-16 — desktop IPC adapter for the use-case-led Capabilities design
 * workflow.
 * Acceptance (SPECIFICATION.md §17 all, §25.3 EUC-13..17): IPC, CLI, and
 * machine API return the same structured result for the same operation; no
 * machine operation bypasses approval.
 *
 * Exercises `createDesignIpcDispatch` directly (no `ipcMain`/`BrowserWindow`
 * needed — see `designIpc.ts`), and compares its result to a direct
 * `DesignOperationsService` call built the same way `packages/core`'s
 * `designCli.ts`/`designMachineApi.ts` build one, over the same `dataDir`.
 *
 * Run: npx vitest run apps/desktop/test/design-ipc.test.ts
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignWorkspace, createDesignOperations, canonicalize, type DesignOperationsService } from '@engineering-ui-kit/core'
import { createDesignIpcDispatch } from '../src/capabilities/designIpc.js'
import { DESIGN_OPERATIONS } from '../src/capabilities/designBridge.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-design-ipc-'))
}

function directService(dataDir: string): DesignOperationsService {
  return createDesignOperations({ workspace: new DesignWorkspace(dataDir) })
}

describe('EUC-16 design IPC dispatch', () => {
  it('DESIGN_OPERATIONS matches exactly what the committed service exports (drift guard)', () => {
    const service = directService(tmpDir())
    expect([...DESIGN_OPERATIONS].sort()).toEqual(Object.keys(service).sort())
  })

  it('rejects an unrecognized operation with a structured error, never a throw', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const result = dispatch({ operation: 'deleteEverything', args: [] }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-UNKNOWN-OPERATION')
  })

  it('rejects an operation name that merely looks like a property on the service object (e.g. "toString")', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const result = dispatch({ operation: 'toString', args: [] }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-UNKNOWN-OPERATION')
  })

  it('happy path: createUseCaseDraft through dispatch matches a direct service call on an identical fresh workspace', () => {
    const args = [{ projectId: 'proj-ipc-1', actor: 'user:tim', idempotencyKey: 'k1', workDescription: '' }]

    const dispatch = createDesignIpcDispatch(tmpDir())
    const viaDispatch = dispatch({ operation: 'createUseCaseDraft', args }) as { ok: boolean; auditEventId: string }

    const direct = directService(tmpDir()).createUseCaseDraft(args[0] as Parameters<DesignOperationsService['createUseCaseDraft']>[0])

    expect(viaDispatch.ok).toBe(true)
    expect(direct.ok).toBe(true)
    expect(typeof viaDispatch.auditEventId).toBe('string')
    expect(viaDispatch.auditEventId.length).toBeGreaterThan(0)

    const { auditEventId: _dispatchId, ...dispatchRest } = viaDispatch as unknown as Record<string, unknown>
    const { auditEventId: _directId, ...directRest } = direct as unknown as Record<string, unknown>
    expect(canonicalize(dispatchRest)).toEqual(canonicalize(directRest))
  })

  it('read operations (§17.1) round-trip identically through dispatch and a direct call', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir)
    const viaDispatch = dispatch({ operation: 'getWorkflowStatus', args: ['proj-ipc-2'] })
    const direct = directService(dataDir).getWorkflowStatus('proj-ipc-2')
    expect(canonicalize(viaDispatch)).toEqual(canonicalize(direct))
  })

  it('a hostile agent actor cannot approve a module design through dispatch — same diagnostics as a direct call (no approval bypass)', () => {
    const args = [
      { projectId: 'proj-ipc-3', actor: 'agent:copilot', idempotencyKey: 'k1', moduleId: 'mod-x', authority: 'module-owner' },
    ]

    const dispatch = createDesignIpcDispatch(tmpDir())
    const viaDispatch = dispatch({ operation: 'approveModuleDesign', args }) as { ok: boolean; diagnostics: { code: string }[] }

    const direct = directService(tmpDir()).approveModuleDesign(
      { ...args[0], idempotencyKey: 'k2' } as Parameters<DesignOperationsService['approveModuleDesign']>[0],
    )

    expect(viaDispatch.ok).toBe(false)
    expect(direct.ok).toBe(false)
    expect(viaDispatch.diagnostics.map((d) => d.code)).toEqual(direct.diagnostics.map((d) => d.code))
    expect(viaDispatch.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
  })

  it('a hostile agent actor cannot approve via any approve* operation reachable on the channel', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const approveOps = DESIGN_OPERATIONS.filter((op) => op.startsWith('approve'))
    expect(approveOps.length).toBeGreaterThan(0)
    for (const operation of approveOps) {
      const result = dispatch({
        operation,
        args: [{ projectId: 'proj-ipc-4', actor: 'agent:copilot', idempotencyKey: `k-${operation}`, authority: 'module-owner' }],
      }) as { ok: boolean; diagnostics: { code: string }[] }
      expect(result.ok).toBe(false)
      expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
    }
  })
})
