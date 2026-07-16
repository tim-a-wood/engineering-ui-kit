/**
 * CAP-TEST-087 — real integration generation and transactional apply
 * (CAP-ERA-001 §7.2, §11.1, §12.3/§12.4 WP7-rest).
 *
 * Assembles a real `GenerationPlan` (`assembleGenerationPlan`) from approved
 * records for a small headless TypeScript deployable (an `http` and a `cli`
 * inbound binding) and a small Python deployable (an `http` inbound
 * binding), then feeds each plan to the frozen `applyGenerationPlan` to
 * materialize a real generated app on disk in a temp target repository.
 * Asserts the generated files exist with the expected structure, that
 * assembly is deterministic (same inputs -> same `planHash`), and that a
 * second assemble -> apply against the now-populated target is idempotent
 * (no spurious file changes).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assembleGenerationPlan, type AssembleGenerationPlanInput } from '../../src/capabilities/generationAssembly.js'
import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import type { GeneratedSchemaDefinition } from '../../src/capabilities/generation/contracts.js'
import type {
  CliInboundBinding,
  CompositionManifest,
  DeployableSpecification,
  HttpInboundBinding,
  OperationContract,
} from '../../src/capabilities/types.js'

let tempRoots: string[] = []
function tempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-087-'))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true })
  tempRoots = []
})

function readFile(root: string, relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

// ---------------------------------------------------------------------------
// TypeScript deployable fixture
// ---------------------------------------------------------------------------

const TS_SCHEMAS: GeneratedSchemaDefinition[] = [
  {
    schemaId: 'orders.create.input',
    typeName: 'CreateOrderInput',
    schema: {
      kind: 'object',
      properties: [
        { name: 'sku', schema: { kind: 'string' }, required: true },
        { name: 'quantity', schema: { kind: 'integer' }, required: true },
      ],
    },
  },
  {
    schemaId: 'orders.create.output',
    typeName: 'CreateOrderSuccess',
    schema: { kind: 'object', properties: [{ name: 'orderId', schema: { kind: 'string' }, required: true }] },
  },
  { schemaId: 'orders.list.input', typeName: 'ListOrdersInput', schema: { kind: 'object', properties: [] } },
  {
    schemaId: 'orders.list.output',
    typeName: 'ListOrdersSuccess',
    schema: { kind: 'array', items: { kind: 'string' } },
  },
]

const TS_OPERATIONS: OperationContract[] = [
  {
    schemaVersion: '1.0',
    operationId: 'orders.create',
    version: '1.0.0',
    behavior: 'command',
    inputSchemaRef: 'orders.create.input',
    outputSchemaRef: 'orders.create.output',
    preconditions: [],
    postconditions: [],
    domainRejections: ['sku-not-found'],
    technicalErrors: ['unexpected'],
    sideEffects: ['creates-order'],
    idempotency: 'non-idempotent',
    timeoutClass: 'short',
    cancellable: false,
    artifactTypes: [],
    provenanceFields: [],
  },
  {
    schemaVersion: '1.0',
    operationId: 'orders.list',
    version: '1.0.0',
    behavior: 'query',
    inputSchemaRef: 'orders.list.input',
    outputSchemaRef: 'orders.list.output',
    preconditions: [],
    postconditions: [],
    domainRejections: [],
    technicalErrors: ['unexpected'],
    sideEffects: [],
    idempotency: 'idempotent',
    timeoutClass: 'short',
    cancellable: false,
    artifactTypes: [],
    provenanceFields: [],
  },
]

const TS_BINDING_COMMON = {
  schemaVersion: '1.0' as const,
  version: '1.0.0',
  projectId: 'proj-cap-test-087',
  deployableId: 'http-api',
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

function tsHttpBinding(overrides: Partial<HttpInboundBinding> = {}): HttpInboundBinding {
  return {
    ...TS_BINDING_COMMON,
    bindingId: 'binding.orders.create.http',
    kind: 'http',
    operationId: 'orders.create',
    operationVersion: '1.0.0',
    method: 'POST',
    path: '/orders',
    ...overrides,
  }
}

const TS_CLI_BINDING: CliInboundBinding = {
  ...TS_BINDING_COMMON,
  bindingId: 'binding.orders.list.cli',
  kind: 'cli',
  operationId: 'orders.list',
  operationVersion: '1.0.0',
  command: 'orders:list',
  argumentMappings: [],
}

const TS_COMPOSITION: CompositionManifest = {
  schemaVersion: '1.0',
  projectId: 'proj-cap-test-087',
  compositionId: 'http-api',
  applicationRevision: '1',
  architectureRevision: '1',
  deployableIds: ['http-api'],
  registrations: [
    {
      contractId: 'orders.create',
      implementationTarget: 'src/domain/orders/create.ts#createOrdersCreate',
      lifecycle: 'transient',
      providerModuleId: 'mod.orders',
      dependencies: [],
    },
    {
      contractId: 'orders.list',
      implementationTarget: 'src/domain/orders/list.ts#createOrdersList',
      lifecycle: 'transient',
      providerModuleId: 'mod.orders',
      dependencies: [],
    },
  ],
  operationRoutes: [
    { operationId: 'orders.create', operationVersion: '1.0.0', inboundBindingId: 'binding.orders.create.http' },
    { operationId: 'orders.list', operationVersion: '1.0.0', inboundBindingId: 'binding.orders.list.cli' },
  ],
  inboundAdapterRefs: ['binding.orders.create.http', 'binding.orders.list.cli'],
  outboundAdapterRefs: [],
  configurationRefs: [],
  secretReferenceIds: [],
  telemetryHookRefs: [],
  healthHookRefs: [],
  authorizationHookRefs: [],
  compositionHash: 'composition-hash-cap-test-087',
}

const TS_DEPLOYABLE: DeployableSpecification = {
  schemaVersion: '1.0',
  deployableId: 'http-api',
  name: 'Http Api',
  kind: 'http-api',
  runtimeLanguage: 'typescript',
  runtimeVersionRange: '>=22',
  moduleIds: ['mod.orders'],
  inboundBindingIds: ['binding.orders.create.http', 'binding.orders.list.cli'],
  compositionRootPath: 'src/composition/http-api.g.ts',
  commands: { build: 'npm run build', test: 'npm test', launch: 'npm start' },
  configurationRefs: [],
  secretReferenceIds: [],
  proposedLocations: [],
}

function tsAssembleInput(targetRoot: string, overrides: Partial<AssembleGenerationPlanInput> = {}): AssembleGenerationPlanInput {
  return {
    deployable: TS_DEPLOYABLE,
    inboundBindings: [tsHttpBinding(), TS_CLI_BINDING],
    schemas: TS_SCHEMAS,
    operations: TS_OPERATIONS,
    composition: TS_COMPOSITION,
    targetRoot,
    targetCleanState: 'clean',
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    planId: 'plan-cap-test-087-ts',
    runId: 'run-cap-test-087-ts',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Python deployable fixture
// ---------------------------------------------------------------------------

const PY_SCHEMAS: GeneratedSchemaDefinition[] = [
  {
    schemaId: 'orders.create.input',
    typeName: 'CreateOrderInput',
    schema: {
      kind: 'object',
      properties: [
        { name: 'sku', schema: { kind: 'string' }, required: true },
        { name: 'quantity', schema: { kind: 'integer' }, required: true },
      ],
    },
  },
  {
    schemaId: 'orders.create.output',
    typeName: 'CreateOrderSuccess',
    schema: { kind: 'object', properties: [{ name: 'orderId', schema: { kind: 'string' }, required: true }] },
  },
]

const PY_OPERATIONS: OperationContract[] = [
  {
    schemaVersion: '1.0',
    operationId: 'orders.create',
    version: '1.0.0',
    behavior: 'command',
    inputSchemaRef: 'orders.create.input',
    outputSchemaRef: 'orders.create.output',
    preconditions: [],
    postconditions: [],
    domainRejections: ['sku-not-found'],
    technicalErrors: ['unexpected'],
    sideEffects: ['creates-order'],
    idempotency: 'non-idempotent',
    timeoutClass: 'short',
    cancellable: false,
    artifactTypes: [],
    provenanceFields: [],
  },
]

const PY_HTTP_BINDING: HttpInboundBinding = {
  schemaVersion: '1.0',
  version: '1.0.0',
  projectId: 'proj-cap-test-087',
  deployableId: 'py-api',
  bindingId: 'binding.orders.create.http.py',
  kind: 'http',
  operationId: 'orders.create',
  operationVersion: '1.0.0',
  method: 'POST',
  path: '/orders',
  inputMappings: [],
  outputMappings: [],
  validationBehavior: 'reject-with-details',
  domainRejectionBehavior: 'return-typed',
  technicalFailureBehavior: 'safe-message-only',
  timeoutBehavior: 'return-timed-out',
  cancellationBehavior: 'propagate',
  retryBehavior: 'none',
  duplicateSubmissionBehavior: 'none',
  exposure: 'protected',
  generatedTargets: [],
  approvalState: 'approved',
}

const PY_DEPLOYABLE: DeployableSpecification = {
  schemaVersion: '1.0',
  deployableId: 'py-api',
  name: 'Py Api',
  kind: 'http-api',
  runtimeLanguage: 'python',
  runtimeVersionRange: '>=3.11',
  moduleIds: ['mod.orders.py'],
  inboundBindingIds: ['binding.orders.create.http.py'],
  compositionRootPath: 'src/composition/py_api_g.py',
  commands: { build: 'true', test: 'pytest', launch: 'uvicorn app:app' },
  configurationRefs: [],
  secretReferenceIds: [],
  proposedLocations: [],
}

function pyAssembleInput(targetRoot: string): AssembleGenerationPlanInput {
  return {
    deployable: PY_DEPLOYABLE,
    inboundBindings: [PY_HTTP_BINDING],
    schemas: PY_SCHEMAS,
    operations: PY_OPERATIONS,
    targetRoot,
    targetCleanState: 'clean',
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    planId: 'plan-cap-test-087-py',
    runId: 'run-cap-test-087-py',
  }
}

describe('CAP-TEST-087 generate -> apply: headless TypeScript deployable', () => {
  it('materializes the composition root, inbound adapters, and types file on disk with the expected structure', () => {
    const root = tempRepo()
    const input = tsAssembleInput(root)
    const { plan, virtualFiles } = assembleGenerationPlan(input)

    expect(plan.blockers).toEqual([])
    expect(plan.fileChanges.length).toBeGreaterThan(0)
    expect(plan.fileChanges.every((change) => change.action === 'create')).toBe(true)
    expect(plan.fileChanges.every((change) => change.ownership === 'generated')).toBe(true)

    const result = applyGenerationPlan({ plan, targetRoot: root, virtualFiles, runId: input.runId })
    expect(result.appliedFiles.length).toBe(plan.fileChanges.length)

    const typesContents = readFile(root, 'src/generated/http-api/types.g.ts')
    expect(typesContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(typesContents).toContain('export interface CreateOrderInput {')
    expect(typesContents).toContain('sku: string')

    const operationsContents = readFile(root, 'src/generated/http-api/operations.g.ts')
    expect(operationsContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(operationsContents).toContain('export interface OrdersCreateV1_0_0Operation')
    expect(operationsContents).toContain('export interface OrdersListV1_0_0Operation')

    const compositionContents = readFile(root, 'src/composition/http-api.g.ts')
    expect(compositionContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(compositionContents).toContain("import { LifecycleContainer, createToken } from '@engineering-ui-kit/capabilities-runtime'")
    expect(compositionContents).toContain('export const ordersCreateToken: ServiceToken = createToken("orders.create")')
    expect(compositionContents).toContain('export const ordersListToken: ServiceToken = createToken("orders.list")')
    expect(compositionContents).toContain('export function buildHttpApiContainer(): LifecycleContainer {')

    const resolvedContents = readFile(root, 'src/generated/http-api/resolved.g.ts')
    expect(resolvedContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(resolvedContents).toContain('const compositionRoot = buildHttpApiContainer().createRootScope()')
    expect(resolvedContents).toContain('const operation = scope.resolve(ordersCreateToken)')
    expect(resolvedContents).toContain('const operation = scope.resolve(ordersListToken)')

    const httpAdapterContents = readFile(root, 'src/generated/http-api/inbound/binding.orders.create.http.g.ts')
    expect(httpAdapterContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(httpAdapterContents).toContain('method: "POST"')
    expect(httpAdapterContents).toContain('path: "/orders"')
    expect(httpAdapterContents).toContain('operation,')
    expect(httpAdapterContents).toContain("import { ordersCreate as operation }")

    const cliAdapterContents = readFile(root, 'src/generated/http-api/inbound/binding.orders.list.cli.g.ts')
    expect(cliAdapterContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(cliAdapterContents).toContain('name: "orders:list"')
    expect(cliAdapterContents).toContain("import { ordersList as operation }")
  })

  it('is deterministic: assembling the same inputs (same target state) twice yields the same planHash', () => {
    const root = tempRepo()
    const planA = assembleGenerationPlan(tsAssembleInput(root)).plan
    const planB = assembleGenerationPlan(tsAssembleInput(root)).plan
    expect(planB.planHash).toBe(planA.planHash)
  })

  it('a second assemble -> apply against the already-generated target is idempotent (no spurious file changes)', () => {
    const root = tempRepo()
    const input = tsAssembleInput(root)
    const first = assembleGenerationPlan(input)
    applyGenerationPlan({ plan: first.plan, targetRoot: root, virtualFiles: first.virtualFiles, runId: 'run-first' })

    const second = assembleGenerationPlan(tsAssembleInput(root, { runId: 'run-second' }))
    expect(second.plan.fileChanges).toEqual([])
    expect(second.virtualFiles).toEqual([])

    const result = applyGenerationPlan({ plan: second.plan, targetRoot: root, virtualFiles: second.virtualFiles, runId: 'run-second' })
    expect(result.appliedFiles).toEqual([])
  })
})

describe('CAP-TEST-087 generate -> apply: headless Python deployable', () => {
  it('materializes Pydantic models, an operation Protocol, and a FastAPI-style inbound adapter on disk with the expected structure', () => {
    const root = tempRepo()
    const input = pyAssembleInput(root)
    const { plan, virtualFiles } = assembleGenerationPlan(input)

    expect(plan.blockers).toEqual([])
    expect(plan.fileChanges.every((change) => change.action === 'create')).toBe(true)

    const result = applyGenerationPlan({ plan, targetRoot: root, virtualFiles, runId: input.runId })
    expect(result.appliedFiles.length).toBe(plan.fileChanges.length)

    const modelsContents = readFile(root, 'src/generated/py_api/models_g.py')
    expect(modelsContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(modelsContents).toContain('class CreateOrderInput(BaseModel):')
    expect(modelsContents).toContain('class CreateOrderSuccess(BaseModel):')

    const protocolsContents = readFile(root, 'src/generated/py_api/protocols_g.py')
    expect(protocolsContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(protocolsContents).toContain('class OrdersCreateV1_0_0Operation(Protocol):')

    const adapterContents = readFile(root, 'src/generated/py_api/inbound/binding_orders_create_http_py_g.py')
    expect(adapterContents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(adapterContents).toContain('def register_binding_orders_create_http_py_route(host: HttpOperationHost) -> None:')
    expect(adapterContents).toContain('method="POST"')
    expect(adapterContents).toContain('path="/orders"')
    expect(adapterContents).toContain('operation=operation,')
  })

  it('is deterministic: assembling the same Python inputs (same target state) twice yields the same planHash', () => {
    const root = tempRepo()
    const planA = assembleGenerationPlan(pyAssembleInput(root)).plan
    const planB = assembleGenerationPlan(pyAssembleInput(root)).plan
    expect(planB.planHash).toBe(planA.planHash)
  })
})
