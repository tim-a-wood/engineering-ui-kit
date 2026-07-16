/**
 * CAP-TEST-056 (WP3B-gen generator slice of the CAP-TEST-054..061 WP3B gate)
 * — `inbound.ts` adapter planning is deterministic under shuffled-equivalent
 * input and structurally correct for every CAP-CONTRACT-028 binding kind
 * (`ui`, `http`, `cli`, `schedule`, `embedded-library`).
 */
import { describe, expect, it } from 'vitest'
import { planInboundAdapter, type InboundAdapterGenerationInput } from '../../../src/capabilities/generation/inbound.js'
import type {
  CliInboundBinding,
  EmbeddedLibraryInboundBinding,
  HttpInboundBinding,
  ScheduleInboundBinding,
  UiInboundBinding,
} from '../../../src/capabilities/types.js'

const COMMON = {
  schemaVersion: '1.0' as const,
  version: '1.0.0',
  projectId: 'proj-1',
  deployableId: 'http-api',
  operationId: 'orders.create',
  operationVersion: '1.0.0',
  inputMappings: [],
  outputMappings: [],
  validationBehavior: 'reject-with-details',
  domainRejectionBehavior: 'return-typed',
  technicalFailureBehavior: 'safe-message-only',
  timeoutBehavior: 'return-timed-out',
  cancellationBehavior: 'propagate',
  retryBehavior: 'none',
  duplicateSubmissionBehavior: 'none',
  exposure: 'protected' as const,
  generatedTargets: [],
  approvalState: 'approved',
}

const HTTP_BINDING: HttpInboundBinding = {
  ...COMMON,
  bindingId: 'binding.orders.create.http',
  kind: 'http',
  method: 'POST',
  path: '/orders',
}

const CLI_BINDING: CliInboundBinding = {
  ...COMMON,
  bindingId: 'binding.orders.create.cli',
  kind: 'cli',
  command: 'orders:create',
  argumentMappings: [
    { from: 'arg0', to: 'sku' },
    { from: 'arg1', to: 'quantity' },
  ],
}

const SCHEDULE_BINDING: ScheduleInboundBinding = {
  ...COMMON,
  bindingId: 'binding.orders.reconcile.schedule',
  kind: 'schedule',
  cronExpression: '0 * * * *',
  timezone: 'UTC',
  overlapPolicy: 'queue',
  misfirePolicy: 'run-all',
}

const EMBEDDED_BINDING: EmbeddedLibraryInboundBinding = {
  ...COMMON,
  bindingId: 'binding.orders.create.lib',
  kind: 'embedded-library',
  exportedCallable: 'createOrder',
  reason: 'no executable inbound host applies for this deployable',
}

const UI_BINDING: UiInboundBinding = {
  ...COMMON,
  bindingId: 'binding.orders.create.ui',
  kind: 'ui',
  transport: 'browser-local',
  trigger: 'submit',
}

function baseInput(binding: InboundAdapterGenerationInput['binding']): InboundAdapterGenerationInput {
  return {
    binding,
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    filePath: 'src/generated/inbound/orders-create.g.ts',
    operationModulePath: 'src/composition/operations/orders-create.ts',
    operationTypes: {
      typesModulePath: 'src/generated/orders/types.g.ts',
      inputTypeName: 'CreateOrderInput',
      successTypeName: 'CreateOrderSuccess',
      domainRejectionTypeName: 'CreateOrderDomainRejectionCode',
      technicalFailureTypeName: 'CreateOrderTechnicalErrorCode',
    },
  }
}

describe('CAP-TEST-056 inbound.ts adapter planning', () => {
  it.each([
    ['http', HTTP_BINDING],
    ['cli', CLI_BINDING],
    ['schedule', SCHEDULE_BINDING],
    ['embedded-library', EMBEDDED_BINDING],
    ['ui', UI_BINDING],
  ] as const)('%s: is deterministic under a shuffled inputMappings array', (_kind, binding) => {
    const forward = planInboundAdapter(baseInput(binding))
    const shuffledBinding = { ...binding, inputMappings: [...binding.inputMappings].reverse() }
    const reversed = planInboundAdapter(baseInput(shuffledBinding))
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it.each([
    ['http', HTTP_BINDING],
    ['cli', CLI_BINDING],
    ['schedule', SCHEDULE_BINDING],
    ['embedded-library', EMBEDDED_BINDING],
    ['ui', UI_BINDING],
  ] as const)('%s: carries the do-not-edit header and references the frozen operation id/version', (_kind, binding) => {
    const result = planInboundAdapter(baseInput(binding))
    expect(result.file.contents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(result.file.contents).toContain('orders.create@1.0.0')
  })

  it('http: emits an HttpRoute wired to the imported operation, with method and path', () => {
    const result = planInboundAdapter(baseInput(HTTP_BINDING))
    const contents = result.file.contents
    expect(contents).toContain("import type { HttpRoute } from '@engineering-ui-kit/capabilities-runtime/node'")
    expect(contents).toContain("import { operation } from '../../composition/operations/orders-create.js'")
    expect(contents).toContain('export const bindingOrdersCreateHttpRoute: HttpRoute = {')
    expect(contents).toContain('method: "POST"')
    expect(contents).toContain('path: "/orders"')
    expect(result.diagnostics).toEqual([])
  })

  it('cli: preserves argumentMappings positional order verbatim in parseArgs', () => {
    const result = planInboundAdapter(baseInput(CLI_BINDING))
    const contents = result.file.contents
    expect(contents).toContain('name: "orders:create"')
    expect(contents).toContain('sku: args[0], // from argv position 0 ("arg0")')
    expect(contents).toContain('quantity: args[1], // from argv position 1 ("arg1")')
  })

  it('schedule: emits CAP-CONTRACT-028 overlap/misfire values directly (SCHED-ENUM reconciled, no remapping)', () => {
    const result = planInboundAdapter(baseInput(SCHEDULE_BINDING))
    const contents = result.file.contents
    expect(contents).toContain('cronExpression: "0 * * * *"')
    expect(contents).toContain('timeZone: "UTC"')
    expect(contents).toContain('overlapPolicy: "queue"')
    expect(contents).toContain('misfirePolicy: "run-all"')
    expect(result.diagnostics).toEqual([])
  })

  it('schedule: an exact policy match (skip/run-once) produces no diagnostic', () => {
    const binding: ScheduleInboundBinding = { ...SCHEDULE_BINDING, overlapPolicy: 'skip', misfirePolicy: 'run-once' }
    const result = planInboundAdapter(baseInput(binding))
    expect(result.diagnostics).toEqual([])
    expect(result.file.contents).toContain('overlapPolicy: "skip"')
    expect(result.file.contents).toContain('misfirePolicy: "run-once"')
  })

  it('embedded-library: emits an async exported callable named from exportedCallable, dispatching the operation', () => {
    const result = planInboundAdapter(baseInput(EMBEDDED_BINDING))
    const contents = result.file.contents
    expect(contents).toContain("import { dispatch } from '@engineering-ui-kit/capabilities-runtime'")
    expect(contents).toContain('export async function createOrder(input: CreateOrderInput, context: Context) {')
    expect(contents).toContain('return dispatch(operation, input, context)')
  })

  it('ui: emits a browser-local transport wired to the resolved operation', () => {
    const result = planInboundAdapter(baseInput(UI_BINDING))
    const contents = result.file.contents
    expect(contents).toContain("import { BrowserLocalTransport, OperationClient, createCorrelationId } from '@engineering-ui-kit/capabilities-runtime/browser'")
    expect(contents).toContain('BrowserLocalTransport')
    expect(contents).toContain('export function createBindingOrdersCreateUiClient() {')
    expect(contents).toContain('call<CreateOrderSuccess, CreateOrderDomainRejectionCode, CreateOrderTechnicalErrorCode>("orders.create", input, callOptions)')
  })

  it('ui: an electron-ipc transport emits a typed renderer bridge client without a deferred diagnostic', () => {
    const binding: UiInboundBinding = { ...UI_BINDING, transport: 'electron-ipc' }
    const result = planInboundAdapter(baseInput(binding))
    expect(result.diagnostics).toEqual([])
    expect(result.file.contents).toContain('transport: electron-ipc')
    expect(result.file.contents).toContain('ElectronRendererTransport')
    expect(result.file.contents).toContain('bridge: CapabilitiesIpcBridge')
  })

  it('falls back to "unknown"/"never" operation types when operationTypes is not supplied', () => {
    const input = baseInput(EMBEDDED_BINDING)
    const result = planInboundAdapter({ ...input, operationTypes: undefined })
    expect(result.file.contents).toContain('export async function createOrder(input: unknown, context: Context) {')
  })
})
