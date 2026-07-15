import { describe, expect, it } from 'vitest'

import { MapConfigurationReader } from '../src/configuration.js'
import type { Context } from '../src/context.js'
import type { Operation } from '../src/operation.js'
import { Outcome } from '../src/outcome.js'
import { TestSecretResolver } from '../src/testing.js'

import {
  CAPABILITIES_IPC_CANCEL_CHANNEL,
  CAPABILITIES_IPC_INVOKE_CHANNEL,
  validateIpcCancelRequest,
  validateIpcOperationRequest,
} from '../src/electron/channel.js'
import type { CapabilitiesIpcBridge } from '../src/electron/channel.js'
import { ElectronRendererTransport } from '../src/electron/renderer-transport.js'
import { createCapabilitiesIpcBridge } from '../src/electron/preload-bridge.js'
import {
  createCapabilitiesIpcMainHandler,
  IPC_BAD_REQUEST_CODE,
  IPC_UNHANDLED_EXCEPTION_CODE,
  IPC_UNKNOWN_OPERATION_CODE,
} from '../src/electron/main-handler.js'
import type { ElectronIpcOperation } from '../src/electron/main-handler.js'

const configuration = new MapConfigurationReader()
const secretResolver = new TestSecretResolver()

describe('electron IPC channel contract', () => {
  it('validates a well-formed operation request', () => {
    const result = validateIpcOperationRequest({ operationCode: 'greet', input: { name: 'Ada' }, correlationId: 'c-1' })
    expect(result.valid).toBe(true)
    expect(result.value).toEqual({ operationCode: 'greet', input: { name: 'Ada' }, correlationId: 'c-1' })
  })

  it('rejects a request missing required fields or with unknown fields', () => {
    expect(validateIpcOperationRequest({}).valid).toBe(false)
    expect(validateIpcOperationRequest({ operationCode: 'greet' }).valid).toBe(false)
    expect(validateIpcOperationRequest(null).valid).toBe(false)
    expect(
      validateIpcOperationRequest({
        operationCode: 'greet',
        input: {},
        correlationId: 'c-1',
        extra: 'not-allowed',
      }).valid,
    ).toBe(false)
    expect(validateIpcOperationRequest({ operationCode: '', input: {}, correlationId: 'c-1' }).valid).toBe(false)
  })

  it('validates a well-formed cancel request and rejects a malformed one', () => {
    expect(validateIpcCancelRequest({ correlationId: 'c-1' }).valid).toBe(true)
    expect(validateIpcCancelRequest({}).valid).toBe(false)
    expect(validateIpcCancelRequest({ correlationId: 1 }).valid).toBe(false)
  })
})

describe('ElectronRendererTransport', () => {
  it('sends the request over the bridge, propagating operationCode/input/correlationId', async () => {
    const seenInvocations: Array<{ operationCode: string; input: unknown; correlationId: string }> = []
    const bridge: CapabilitiesIpcBridge = {
      async invoke(request) {
        seenInvocations.push(request)
        return Outcome.success({ doubled: (request.input as { value: number }).value * 2 })
      },
      cancel() {
        // not exercised in this case
      },
    }

    const transport = new ElectronRendererTransport({ bridge })
    const outcome = await transport.send({
      operationCode: 'double',
      input: { value: 21 },
      correlationId: 'corr-1',
    })

    expect(Outcome.isSuccess(outcome)).toBe(true)
    expect(seenInvocations).toEqual([{ operationCode: 'double', input: { value: 21 }, correlationId: 'corr-1' }])
  })

  it('asks the bridge to cancel the correlated call when the AbortSignal fires', async () => {
    const cancelled: Array<{ correlationId: string }> = []
    const controller = new AbortController()
    const bridge: CapabilitiesIpcBridge = {
      invoke() {
        return new Promise(() => {
          // never resolves; the transport awaits the abort instead
        })
      },
      cancel(request) {
        cancelled.push(request)
      },
    }

    const transport = new ElectronRendererTransport({ bridge })
    void transport.send({ operationCode: 'long-running', input: undefined, correlationId: 'corr-2', signal: controller.signal })
    controller.abort()

    expect(cancelled).toEqual([{ correlationId: 'corr-2' }])
  })

  it('resolves immediately to cancelled if the signal is already aborted before send', async () => {
    const controller = new AbortController()
    controller.abort()
    const bridge: CapabilitiesIpcBridge = {
      invoke() {
        throw new Error('must not be called when already aborted')
      },
      cancel() {
        throw new Error('must not be called when already aborted')
      },
    }

    const transport = new ElectronRendererTransport({ bridge })
    const outcome = await transport.send({
      operationCode: 'double',
      input: undefined,
      correlationId: 'corr-3',
      signal: controller.signal,
    })

    expect(Outcome.isCancelled(outcome)).toBe(true)
  })
})

describe('createCapabilitiesIpcBridge (preload)', () => {
  it('exposes exactly invoke/cancel, never the raw invoke/send functions or any other capability', () => {
    const bridge = createCapabilitiesIpcBridge(
      async () => Outcome.success(undefined),
      () => {
        // no-op
      },
    )

    expect(Object.keys(bridge).sort()).toEqual(['cancel', 'invoke'])
    expect(typeof bridge.invoke).toBe('function')
    expect(typeof bridge.cancel).toBe('function')
    // No other ipcRenderer-shaped capability (on/once/removeListener/sendSync/...) is present.
    expect((bridge as unknown as Record<string, unknown>).on).toBeUndefined()
    expect((bridge as unknown as Record<string, unknown>).sendSync).toBeUndefined()
    expect((bridge as unknown as Record<string, unknown>).send).toBeUndefined()
  })

  it('forwards invoke() to the injected invoke function on the typed channel name', async () => {
    const seen: Array<[string, ...unknown[]]> = []
    const bridge = createCapabilitiesIpcBridge(
      async (channel, ...args) => {
        seen.push([channel, ...args])
        return Outcome.success('ok')
      },
      () => {
        throw new Error('send should not be called')
      },
    )

    const outcome = await bridge.invoke({ operationCode: 'greet', input: {}, correlationId: 'c-1' })
    expect(outcome).toEqual(Outcome.success('ok'))
    expect(seen).toEqual([[CAPABILITIES_IPC_INVOKE_CHANNEL, { operationCode: 'greet', input: {}, correlationId: 'c-1' }]])
  })

  it('forwards cancel() to the injected send function on the typed channel name', () => {
    const seen: Array<[string, ...unknown[]]> = []
    const bridge = createCapabilitiesIpcBridge(
      () => {
        throw new Error('invoke should not be called')
      },
      (channel, ...args) => {
        seen.push([channel, ...args])
      },
    )

    bridge.cancel({ correlationId: 'c-2' })
    expect(seen).toEqual([[CAPABILITIES_IPC_CANCEL_CHANNEL, { correlationId: 'c-2' }]])
  })
})

describe('createCapabilitiesIpcMainHandler', () => {
  function doubleOperation(): ElectronIpcOperation {
    return {
      operationCode: 'double',
      operation: {
        code: 'double',
        execute(input: unknown) {
          return Outcome.success((input as { value: number }).value * 2)
        },
      } as Operation<unknown, unknown, unknown, unknown>,
    }
  }

  it('validates the request, dispatches it, and returns the operation outcome', async () => {
    const handler = createCapabilitiesIpcMainHandler({
      operations: [doubleOperation()],
      configuration,
      secretResolver,
    })

    const outcome = await handler.handleInvoke({ operationCode: 'double', input: { value: 21 }, correlationId: 'c-1' })
    expect(outcome).toEqual(Outcome.success(42))
    expect(handler.inFlightCount).toBe(0)
  })

  it('maps a malformed request to a safe bad-request failure without dispatching', async () => {
    const handler = createCapabilitiesIpcMainHandler({
      operations: [doubleOperation()],
      configuration,
      secretResolver,
    })

    const outcome = await handler.handleInvoke({ operationCode: 'double' })
    expect(Outcome.isFailed(outcome)).toBe(true)
    if (Outcome.isFailed(outcome)) {
      expect(outcome.code).toBe(IPC_BAD_REQUEST_CODE)
    }
  })

  it('maps an unregistered operation code to a safe failure', async () => {
    const handler = createCapabilitiesIpcMainHandler({
      operations: [doubleOperation()],
      configuration,
      secretResolver,
    })

    const outcome = await handler.handleInvoke({ operationCode: 'triple', input: {}, correlationId: 'c-2' })
    expect(Outcome.isFailed(outcome)).toBe(true)
    if (Outcome.isFailed(outcome)) {
      expect(outcome.code).toBe(IPC_UNKNOWN_OPERATION_CODE)
    }
  })

  it('maps an unhandled exception to a safe failure, never leaking the raw error', async () => {
    const boomOperation: ElectronIpcOperation = {
      operationCode: 'boom',
      operation: {
        code: 'boom',
        execute() {
          throw new Error('leaking a raw stack trace and secret-value-should-never-appear-xyz789')
        },
      } as Operation<unknown, unknown, unknown, unknown>,
    }
    const handler = createCapabilitiesIpcMainHandler({
      operations: [boomOperation],
      configuration,
      secretResolver,
    })

    const outcome = await handler.handleInvoke({ operationCode: 'boom', input: undefined, correlationId: 'c-3' })
    expect(Outcome.isFailed(outcome)).toBe(true)
    if (Outcome.isFailed(outcome)) {
      // `dispatch` itself (see ../src/dispatch.ts) catches the operation's
      // throw before it reaches this handler's own catch block, and maps it
      // to the same 'unhandled-exception' code our handler uses for its own
      // (rarer) catch path — either way, the raw message never reaches the
      // IPC response.
      expect(outcome.code).toBe(IPC_UNHANDLED_EXCEPTION_CODE)
      expect(JSON.stringify(outcome)).not.toContain('secret-value-should-never-appear-xyz789')
    }
  })

  it('propagates the correlation id into the dispatch Context', async () => {
    let seenCorrelationId: string | undefined
    const echoOperation: ElectronIpcOperation = {
      operationCode: 'echo-correlation',
      operation: {
        code: 'echo-correlation',
        execute(_input: unknown, context: Context) {
          seenCorrelationId = context.correlationId
          return Outcome.success(context.correlationId)
        },
      } as Operation<unknown, unknown, unknown, unknown>,
    }
    const handler = createCapabilitiesIpcMainHandler({
      operations: [echoOperation],
      configuration,
      secretResolver,
    })

    await handler.handleInvoke({ operationCode: 'echo-correlation', input: undefined, correlationId: 'caller-supplied-id' })
    expect(seenCorrelationId).toBe('caller-supplied-id')
  })

  it('cancels the in-flight call identified by correlationId when handleCancel is called', async () => {
    let sawCancelled = false
    const longRunningOperation: ElectronIpcOperation = {
      operationCode: 'long-running',
      operation: {
        code: 'long-running',
        execute(_input: unknown, context: Context) {
          return new Promise((resolve) => {
            context.cancellation.onCancel((reason) => {
              sawCancelled = true
              resolve(Outcome.cancelled(reason))
            })
          })
        },
      } as Operation<unknown, unknown, unknown, unknown>,
    }
    const handler = createCapabilitiesIpcMainHandler({
      operations: [longRunningOperation],
      configuration,
      secretResolver,
    })

    const invokePromise = handler.handleInvoke({
      operationCode: 'long-running',
      input: undefined,
      correlationId: 'cancel-me',
    })
    // Let handleInvoke register the in-flight controller before cancelling.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handler.inFlightCount).toBe(1)

    handler.handleCancel({ correlationId: 'cancel-me' })
    const outcome = await invokePromise

    expect(sawCancelled).toBe(true)
    expect(Outcome.isCancelled(outcome)).toBe(true)
    expect(handler.inFlightCount).toBe(0)
  })

  it('a malformed cancel request is ignored rather than throwing', () => {
    const handler = createCapabilitiesIpcMainHandler({
      operations: [doubleOperation()],
      configuration,
      secretResolver,
    })
    expect(() => handler.handleCancel({})).not.toThrow()
    expect(() => handler.handleCancel(null)).not.toThrow()
  })

  it('cancelAll() cancels every in-flight call', async () => {
    const longRunningOperation: ElectronIpcOperation = {
      operationCode: 'long-running',
      operation: {
        code: 'long-running',
        execute(_input: unknown, context: Context) {
          return new Promise((resolve) => {
            context.cancellation.onCancel((reason) => resolve(Outcome.cancelled(reason)))
          })
        },
      } as Operation<unknown, unknown, unknown, unknown>,
    }
    const handler = createCapabilitiesIpcMainHandler({
      operations: [longRunningOperation],
      configuration,
      secretResolver,
    })

    const first = handler.handleInvoke({ operationCode: 'long-running', input: undefined, correlationId: 'a' })
    const second = handler.handleInvoke({ operationCode: 'long-running', input: undefined, correlationId: 'b' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handler.inFlightCount).toBe(2)

    handler.cancelAll('host-shutting-down')
    const [firstOutcome, secondOutcome] = await Promise.all([first, second])

    expect(Outcome.isCancelled(firstOutcome)).toBe(true)
    expect(Outcome.isCancelled(secondOutcome)).toBe(true)
    expect(handler.inFlightCount).toBe(0)
  })
})
