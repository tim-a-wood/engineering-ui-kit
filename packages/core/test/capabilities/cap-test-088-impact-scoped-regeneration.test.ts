/**
 * CAP-TEST-088 — impact-scoped regeneration (CAP-ERA-001 §13, WP7-rest).
 *
 * After an initial generate -> apply, changing ONE inbound binding and
 * re-assembling must produce a `GenerationPlan` whose `fileChanges` include
 * ONLY the impacted generated file(s); every unaffected generated file must
 * be entirely absent from `fileChanges` (its postimage is byte-identical to
 * what is already on disk, so `assembleGenerationPlan` drops it). Applying
 * that scoped plan must leave every unaffected file byte-unchanged on disk.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-088-'))
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

const SCHEMAS: GeneratedSchemaDefinition[] = [
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

const OPERATIONS: OperationContract[] = [
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

const BINDING_COMMON = {
  schemaVersion: '1.0' as const,
  version: '1.0.0',
  projectId: 'proj-cap-test-088',
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

function httpBinding(overrides: Partial<HttpInboundBinding> = {}): HttpInboundBinding {
  return {
    ...BINDING_COMMON,
    bindingId: 'binding.orders.create.http',
    kind: 'http',
    operationId: 'orders.create',
    operationVersion: '1.0.0',
    method: 'POST',
    path: '/orders',
    ...overrides,
  }
}

const CLI_BINDING: CliInboundBinding = {
  ...BINDING_COMMON,
  bindingId: 'binding.orders.list.cli',
  kind: 'cli',
  operationId: 'orders.list',
  operationVersion: '1.0.0',
  command: 'orders:list',
  argumentMappings: [],
}

const COMPOSITION: CompositionManifest = {
  schemaVersion: '1.0',
  projectId: 'proj-cap-test-088',
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
  compositionHash: 'composition-hash-cap-test-088',
}

const DEPLOYABLE: DeployableSpecification = {
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

function assembleInput(
  targetRoot: string,
  overrides: { httpBindingOverrides?: Partial<HttpInboundBinding>; runId: string; planId: string },
): AssembleGenerationPlanInput {
  return {
    deployable: DEPLOYABLE,
    inboundBindings: [httpBinding(overrides.httpBindingOverrides), CLI_BINDING],
    schemas: SCHEMAS,
    operations: OPERATIONS,
    composition: COMPOSITION,
    targetRoot,
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    planId: overrides.planId,
    runId: overrides.runId,
  }
}

const ALL_GENERATED_PATHS = [
  'src/generated/http-api/types.g.ts',
  'src/generated/http-api/operations.g.ts',
  'src/composition/http-api.g.ts',
  'src/generated/http-api/resolved.g.ts',
  'src/generated/http-api/inbound/binding.orders.create.http.g.ts',
  'src/generated/http-api/inbound/binding.orders.list.cli.g.ts',
  'src/generated/http-api/openapi.g.json',
]

describe('CAP-TEST-088 impact-scoped regeneration', () => {
  it('changing one binding only regenerates that binding\'s own file; every other generated file is untouched', () => {
    const root = tempRepo()

    // Initial generate -> apply: every file is a fresh "create".
    const initial = assembleGenerationPlan(assembleInput(root, { runId: 'run-initial', planId: 'plan-initial' }))
    applyGenerationPlan({ plan: initial.plan, targetRoot: root, virtualFiles: initial.virtualFiles, runId: 'run-initial' })

    const beforeContents = new Map(ALL_GENERATED_PATHS.map((p) => [p, readFile(root, p)]))

    // Change ONE binding's own field (the HTTP route path). This affects only
    // that binding's inbound-adapter file and the OpenAPI description of that
    // route; it does not change any schema, operation contract, or composition
    // registration.
    const changed = assembleGenerationPlan(
      assembleInput(root, { httpBindingOverrides: { path: '/orders/v2' }, runId: 'run-changed', planId: 'plan-changed' }),
    )

    const changedPaths = changed.plan.fileChanges.map((c) => c.path).sort()
    expect(changedPaths).toEqual([
      'src/generated/http-api/inbound/binding.orders.create.http.g.ts',
      'src/generated/http-api/openapi.g.json',
    ])
    expect(changed.plan.fileChanges[0]!.action).toBe('update')
    expect(changed.plan.fileChanges[0]!.preimageHash).toBeDefined()
    expect(changed.virtualFiles.map((f) => f.path).sort()).toEqual(changedPaths)

    // Apply the scoped plan.
    const applyResult = applyGenerationPlan({
      plan: changed.plan,
      targetRoot: root,
      virtualFiles: changed.virtualFiles,
      runId: 'run-changed',
    })
    expect(applyResult.appliedFiles.map((f) => f.path).sort()).toEqual(changedPaths)

    // The impacted file changed on disk...
    const newAdapterContents = readFile(root, 'src/generated/http-api/inbound/binding.orders.create.http.g.ts')
    expect(newAdapterContents).toContain('path: "/orders/v2"')
    expect(newAdapterContents).not.toEqual(beforeContents.get('src/generated/http-api/inbound/binding.orders.create.http.g.ts'))

    // ...and every other generated file is byte-for-byte unchanged.
    for (const p of ALL_GENERATED_PATHS) {
      if (changedPaths.includes(p)) continue
      expect(readFile(root, p)).toBe(beforeContents.get(p))
    }
  })

  it('re-assembling with the unchanged inputs after the scoped apply yields an empty plan (fully converged)', () => {
    const root = tempRepo()
    const initial = assembleGenerationPlan(assembleInput(root, { runId: 'run-initial', planId: 'plan-initial' }))
    applyGenerationPlan({ plan: initial.plan, targetRoot: root, virtualFiles: initial.virtualFiles, runId: 'run-initial' })

    const changed = assembleGenerationPlan(
      assembleInput(root, { httpBindingOverrides: { path: '/orders/v2' }, runId: 'run-changed', planId: 'plan-changed' }),
    )
    applyGenerationPlan({ plan: changed.plan, targetRoot: root, virtualFiles: changed.virtualFiles, runId: 'run-changed' })

    const reconverged = assembleGenerationPlan(
      assembleInput(root, { httpBindingOverrides: { path: '/orders/v2' }, runId: 'run-reconverged', planId: 'plan-reconverged' }),
    )
    expect(reconverged.plan.fileChanges).toEqual([])
    expect(reconverged.virtualFiles).toEqual([])
  })
})
