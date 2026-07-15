/**
 * REAL renderer -> main Electron IPC end-to-end test (§10.3, §19 —
 * CAP-TEST-060/061): drives the ACTUAL IPC message path this slice's
 * `src/renderer/client.ts` (browser-safe renderer transport),
 * `src/preload/bridge.ts` (contextBridge-exposed typed surface), and
 * `src/main/host.ts` (`ipcMain` wiring) are built from — a renderer request
 * object -> preload-exposed bridge -> `ipcMain.handle` main-handler ->
 * `dispatch` -> `createTaskOperation` -> a serialized outcome back to the
 * renderer — WITHOUT needing a real, running Electron process (deferred to
 * WP8, per the runtime's own `packages/capabilities-runtime-ts/src/electron/main.ts`
 * and `./preload.ts` doc comments).
 *
 * This test builds:
 *  - the SAME composition root `src/main/host.ts` uses (`../src/composition-root.js`);
 *  - the runtime's pure, Electron-free `createCapabilitiesIpcMainHandler`
 *    (`../../../../packages/capabilities-runtime-ts/src/electron/main-handler.js`)
 *    and `createCapabilitiesIpcBridge`
 *    (`../../../../packages/capabilities-runtime-ts/src/electron/preload-bridge.js`)
 *    — the exact modules `src/main/host.ts`/`src/preload/bridge.ts` wrap
 *    with the real `ipcMain`/`contextBridge`, imported directly here only
 *    because that pure logic has no public `@engineering-ui-kit/capabilities-runtime`
 *    subpath of its own (mirroring how the runtime's OWN
 *    `test/electron-ipc.test.ts` tests this same logic without a live
 *    Electron process);
 *  - a fake IPC "wire" that round-trips every payload through
 *    `JSON.stringify`/`JSON.parse` — the same serialization boundary a real
 *    `ipcRenderer.invoke`/`ipcMain.handle` structured-clone hop would impose
 *    — on the exact typed channel names
 *    (`CAPABILITIES_IPC_INVOKE_CHANNEL`/`CAPABILITIES_IPC_CANCEL_CHANNEL`)
 *    the real preload script and `ipcMain` listeners use;
 *  - this slice's OWN `createElectronRendererClient`
 *    (`../src/renderer/client.js`), driving every call through the REAL,
 *    frozen `ElectronRendererTransport` + `OperationClient`.
 */
import { describe, expect, it } from 'vitest'

import {
  CAPABILITIES_IPC_CANCEL_CHANNEL,
  CAPABILITIES_IPC_INVOKE_CHANNEL,
  type CapabilitiesIpcBridge,
} from '@engineering-ui-kit/capabilities-runtime/electron/renderer'
import type { Context, Operation } from '@engineering-ui-kit/capabilities-runtime'
import { Outcome } from '@engineering-ui-kit/capabilities-runtime'

import {
  createCapabilitiesIpcMainHandler,
  type CapabilitiesIpcMainHandler,
} from '../../../../packages/capabilities-runtime-ts/src/electron/main-handler.js'
import { createCapabilitiesIpcBridge } from '../../../../packages/capabilities-runtime-ts/src/electron/preload-bridge.js'

import {
  createCompositionRoot,
  CREATE_TASK_OPERATION_TOKEN,
  CONFIGURATION_TOKEN,
  SECRET_RESOLVER_TOKEN,
} from '../src/composition-root.js'
import { CREATE_TASK_OPERATION_CODE, BLANK_TITLE_REJECTED_CODE } from '../src/domain/create-task.js'
import { createElectronRendererClient } from '../src/renderer/client.js'

type IpcInvokeFn = (channel: string, ...args: unknown[]) => Promise<unknown>
type IpcSendFn = (channel: string, ...args: unknown[]) => void

/**
 * Builds the pure main-side handler exactly as `src/main/host.ts` builds
 * the real `ElectronMainIpcHost` — same composition root, same operation
 * registry — but via `createCapabilitiesIpcMainHandler` directly instead of
 * `registerCapabilitiesIpcHost`, so it can be driven without a real
 * `ipcMain`. Extra operations (e.g. a cancellation-observing test double)
 * may be layered on for a single test.
 */
function createTestMainHandler(extraOperations: ReadonlyArray<{ operationCode: string; operation: Operation<unknown, unknown, unknown, unknown> }> = []): CapabilitiesIpcMainHandler {
  const { rootScope } = createCompositionRoot()
  const operation = rootScope.resolve(CREATE_TASK_OPERATION_TOKEN) as Operation<unknown, unknown, unknown, unknown>
  const configuration = rootScope.resolve(CONFIGURATION_TOKEN)
  const secretResolver = rootScope.resolve(SECRET_RESOLVER_TOKEN)

  return createCapabilitiesIpcMainHandler({
    operations: [{ operationCode: CREATE_TASK_OPERATION_CODE, operation }, ...extraOperations],
    configuration,
    secretResolver,
  })
}

/**
 * Simulates the real `ipcRenderer.invoke`/`ipcMain.handle` and
 * `ipcRenderer.send`/`ipcMain.on` wire: every payload crosses through
 * `JSON.stringify`/`JSON.parse` (a real IPC structured-clone hop would
 * likewise only carry serializable data) before reaching `handler`, and the
 * handler's outcome is round-tripped the same way before returning to the
 * caller — on the exact channel names the real preload script and
 * `ipcMain` listeners use.
 */
function createFakeIpcWire(handler: CapabilitiesIpcMainHandler): { invoke: IpcInvokeFn; send: IpcSendFn } {
  return {
    async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
      if (channel !== CAPABILITIES_IPC_INVOKE_CHANNEL) {
        throw new Error(`unexpected invoke channel "${channel}"`)
      }
      const serializedRequest: unknown = JSON.parse(JSON.stringify(args[0]))
      const outcome = await handler.handleInvoke(serializedRequest)
      return JSON.parse(JSON.stringify(outcome)) as unknown
    },
    send(channel: string, ...args: unknown[]): void {
      if (channel !== CAPABILITIES_IPC_CANCEL_CHANNEL) {
        throw new Error(`unexpected send channel "${channel}"`)
      }
      const serializedRequest: unknown = JSON.parse(JSON.stringify(args[0]))
      handler.handleCancel(serializedRequest)
    },
  }
}

function createTestBridge(handler: CapabilitiesIpcMainHandler): CapabilitiesIpcBridge {
  const wire = createFakeIpcWire(handler)
  return createCapabilitiesIpcBridge(wire.invoke, wire.send)
}

describe('capabilities-react-reference Electron IPC slice (real end-to-end)', () => {
  it('drives a renderer request through the real IPC bridge -> main-handler -> dispatch -> operation, returning a serialized success outcome with correlation propagated', async () => {
    const handler = createTestMainHandler()
    const bridge = createTestBridge(handler)
    const client = createElectronRendererClient(bridge)

    const outcome = await client.call(CREATE_TASK_OPERATION_CODE, { title: 'Write IPC tests' }, {
      correlationId: 'renderer-corr-1',
    })

    expect(outcome).toEqual({
      kind: 'success',
      value: { taskId: 'task-renderer-corr-1', title: 'Write IPC tests' },
    })
    expect(handler.inFlightCount).toBe(0)
  })

  it('returns a serialized domain rejection for a blank title through the same real IPC path', async () => {
    const handler = createTestMainHandler()
    const bridge = createTestBridge(handler)
    const client = createElectronRendererClient(bridge)

    const outcome = await client.call(CREATE_TASK_OPERATION_CODE, { title: '   ' }, { correlationId: 'renderer-corr-2' })

    expect(outcome).toEqual({
      kind: 'rejected',
      code: BLANK_TITLE_REJECTED_CODE,
      details: { field: 'title' },
    })
  })

  it('propagates a distinct correlation id per concurrent call across the IPC boundary into the operation', async () => {
    const handler = createTestMainHandler()
    const bridge = createTestBridge(handler)
    const client = createElectronRendererClient(bridge)

    const [first, second] = await Promise.all([
      client.call(CREATE_TASK_OPERATION_CODE, { title: 'Task A' }, { correlationId: 'corr-a' }),
      client.call(CREATE_TASK_OPERATION_CODE, { title: 'Task B' }, { correlationId: 'corr-b' }),
    ])

    expect(first).toEqual({ kind: 'success', value: { taskId: 'task-corr-a', title: 'Task A' } })
    expect(second).toEqual({ kind: 'success', value: { taskId: 'task-corr-b', title: 'Task B' } })
  })

  it('forwards a renderer AbortSignal over the real cancel channel and resolves the in-flight call as cancelled', async () => {
    let sawCancelled = false
    const longRunningOperation: Operation<unknown, unknown, unknown, unknown> = {
      code: 'long-running',
      execute(_input: unknown, context: Context) {
        return new Promise((resolve) => {
          context.cancellation.onCancel((reason) => {
            sawCancelled = true
            resolve(Outcome.cancelled(reason))
          })
        })
      },
    }
    const handler = createTestMainHandler([{ operationCode: 'long-running', operation: longRunningOperation }])
    const bridge = createTestBridge(handler)
    const client = createElectronRendererClient(bridge)

    const controller = new AbortController()
    const callPromise = client.call('long-running', undefined, {
      correlationId: 'corr-cancel',
      signal: controller.signal,
    })
    // Let the fake IPC wire's microtasks register the call as in-flight
    // before the renderer aborts it.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handler.inFlightCount).toBe(1)

    controller.abort('renderer-cancelled')
    const outcome = await callPromise

    expect(sawCancelled).toBe(true)
    expect(Outcome.isCancelled(outcome)).toBe(true)
    expect(handler.inFlightCount).toBe(0)
  })

  it('exposes exactly invoke/cancel over the IPC bridge — no unrestricted Node/Electron capability leaks to the renderer', () => {
    const handler = createTestMainHandler()
    const bridge = createTestBridge(handler)

    expect(Object.keys(bridge).sort()).toEqual(['cancel', 'invoke'])
    expect(typeof bridge.invoke).toBe('function')
    expect(typeof bridge.cancel).toBe('function')
    const untyped = bridge as unknown as Record<string, unknown>
    expect(untyped.require).toBeUndefined()
    expect(untyped.process).toBeUndefined()
    expect(untyped.ipcRenderer).toBeUndefined()
    expect(untyped.on).toBeUndefined()
    expect(untyped.sendSync).toBeUndefined()
  })
})
