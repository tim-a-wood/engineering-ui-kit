/**
 * CAP-TEST-063 (WP4B-gen generator slice) — `python.ts`'s
 * `planPythonInboundAdapter` planning is deterministic under
 * shuffled-equivalent input and structurally correct for every
 * CAP-CONTRACT-028 binding kind (`http`, `cli`, `schedule`,
 * `embedded-library`, `ui`), targeting FastAPI/argparse/the Python worker
 * scheduler.
 */
import { describe, expect, it } from 'vitest'
import { planPythonInboundAdapter, type PythonInboundAdapterGenerationInput } from '../../../src/capabilities/generation/python.js'
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
  deployableId: 'python-api',
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

function baseInput(binding: PythonInboundAdapterGenerationInput['binding']): PythonInboundAdapterGenerationInput {
  return {
    binding,
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    filePath: 'src/generated/inbound/orders_create.py',
    operationModulePath: 'src/composition/operations/orders_create.py',
    operationTypes: {
      modelsFilePath: 'src/generated/orders/models_generated.py',
      inputTypeName: 'CreateOrderInput',
      successTypeName: 'CreateOrderSuccess',
      domainRejectionTypeName: 'CreateOrderDomainRejectionCode',
      technicalFailureTypeName: 'CreateOrderTechnicalErrorCode',
    },
  }
}

describe('CAP-TEST-063 python.ts inbound adapter planning', () => {
  it.each([
    ['http', HTTP_BINDING],
    ['cli', CLI_BINDING],
    ['schedule', SCHEDULE_BINDING],
    ['embedded-library', EMBEDDED_BINDING],
    ['ui', UI_BINDING],
  ] as const)('%s: is deterministic under a shuffled inputMappings array', (_kind, binding) => {
    const forward = planPythonInboundAdapter(baseInput(binding))
    const shuffledBinding = { ...binding, inputMappings: [...binding.inputMappings].reverse() }
    const reversed = planPythonInboundAdapter(baseInput(shuffledBinding))
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it.each([
    ['http', HTTP_BINDING],
    ['cli', CLI_BINDING],
    ['schedule', SCHEDULE_BINDING],
    ['embedded-library', EMBEDDED_BINDING],
    ['ui', UI_BINDING],
  ] as const)('%s: carries the do-not-edit header', (_kind, binding) => {
    const result = planPythonInboundAdapter(baseInput(binding))
    expect(result.file.contents).toContain('# GENERATED FILE — DO NOT EDIT.')
  })

  it('http: emits a register_*_route function wiring HttpOperationHost.add_operation to the imported operation', () => {
    const result = planPythonInboundAdapter(baseInput(HTTP_BINDING))
    const contents = result.file.contents
    expect(contents).toContain('from engineering_ui_capabilities_runtime.http.host import HttpOperationHost')
    expect(contents).toContain('from src.composition.operations.orders_create import operation')
    expect(contents).toContain('from src.generated.orders.models_generated import CreateOrderInput')
    expect(contents).toContain('def register_binding_orders_create_http_route(host: HttpOperationHost) -> None:')
    expect(contents).toContain('path="/orders"')
    expect(contents).toContain('operation=operation')
    expect(contents).toContain('input_schema=CreateOrderInput.model_json_schema()')
    expect(contents).toContain('method="POST"')
    expect(result.diagnostics).toEqual([])
  })

  it('cli: preserves argumentMappings positional order verbatim across add_argument/build_input', () => {
    const result = planPythonInboundAdapter(baseInput(CLI_BINDING))
    const contents = result.file.contents
    expect(contents).toContain('from engineering_ui_capabilities_runtime.cli.host import CliCommand')
    expect(contents).toContain('name="orders:create"')
    expect(contents).toContain('parser.add_argument("sku")  # from argv position 0 ("arg0")')
    expect(contents).toContain('parser.add_argument("quantity")  # from argv position 1 ("arg1")')
    expect(contents).toContain('"sku": getattr(args, "sku"),')
    expect(contents).toContain('"quantity": getattr(args, "quantity"),')
  })

  it('cli: falls back to a single JSON-encoded positional argument when argumentMappings is empty', () => {
    const binding: CliInboundBinding = { ...CLI_BINDING, argumentMappings: [] }
    const result = planPythonInboundAdapter(baseInput(binding))
    const contents = result.file.contents
    expect(contents).toContain('import json')
    expect(contents).toContain('parser.add_argument("input_json")')
    expect(contents).toContain('return json.loads(args.input_json)')
  })

  it('schedule: maps CAP-CONTRACT-028 overlap/misfire policy values to the Python worker enum with a diagnostic when approximated', () => {
    const result = planPythonInboundAdapter(baseInput(SCHEDULE_BINDING))
    const contents = result.file.contents
    expect(contents).toContain('from engineering_ui_capabilities_runtime.worker.cron import CronSchedule')
    expect(contents).toContain('from engineering_ui_capabilities_runtime.worker.scheduler import CronJob, MisfirePolicy, OverlapPolicy')
    expect(contents).toContain('CronSchedule.parse("0 * * * *", "UTC")')
    expect(contents).toContain('overlap_policy=OverlapPolicy.ALLOW')
    expect(contents).toContain('misfire_policy=MisfirePolicy.FIRE_NOW')
    expect(result.diagnostics.some((message) => message.includes('overlapPolicy') && message.includes('contract-change requested'))).toBe(true)
    expect(result.diagnostics.some((message) => message.includes('misfirePolicy') && message.includes('contract-change requested'))).toBe(true)
  })

  it('schedule: an exact policy match (skip/run-once) produces no diagnostic', () => {
    const binding: ScheduleInboundBinding = { ...SCHEDULE_BINDING, overlapPolicy: 'skip', misfirePolicy: 'run-once' }
    const result = planPythonInboundAdapter(baseInput(binding))
    expect(result.diagnostics).toEqual([])
    expect(result.file.contents).toContain('overlap_policy=OverlapPolicy.SKIP')
    expect(result.file.contents).toContain('misfire_policy=MisfirePolicy.FIRE_NOW')
  })

  it('embedded-library: emits a snake_case sync function named from exportedCallable, dispatching the operation', () => {
    const result = planPythonInboundAdapter(baseInput(EMBEDDED_BINDING))
    const contents = result.file.contents
    expect(contents).toContain('from engineering_ui_capabilities_runtime.core import AnyOutcome, Context, dispatch')
    expect(contents).toContain('def create_order(input: CreateOrderInput, context: Context) -> AnyOutcome:')
    expect(contents).toContain('return dispatch(operation, input, context, input_schema=CreateOrderInput.model_json_schema())')
  })

  it('ui: emits a documentation-only module noting Python has no UI target, with a diagnostic explaining the deferral', () => {
    const result = planPythonInboundAdapter(baseInput(UI_BINDING))
    expect(result.file.contents).toContain('Python has no UI target for inbound binding "binding.orders.create.ui"')
    expect(result.diagnostics.some((message) => message.includes('no UI target'))).toBe(true)
  })

  it('falls back to "Any" and an empty input_schema placeholder when operationTypes is not supplied', () => {
    const input = baseInput(EMBEDDED_BINDING)
    const result = planPythonInboundAdapter({ ...input, operationTypes: undefined })
    expect(result.file.contents).toContain('def create_order(input: Any, context: Context) -> AnyOutcome:')
    expect(result.file.contents).toContain('input_schema={}')
    expect(result.diagnostics.some((message) => message.includes('input_schema placeholder'))).toBe(true)
  })
})
