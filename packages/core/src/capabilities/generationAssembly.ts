/**
 * Assembles a real `GenerationPlan` (CAP-CONTRACT-025) from approved records,
 * ready for `applyGenerationPlan` (CAP-ERA-001 §7.2, §11.1, §12.3/§12.4, §13).
 *
 * This module is Node-only (reads the target repository for preimages and
 * ownership classification) and is therefore exported from
 * `capabilities/index.ts` only, never `browser.ts` — unlike `generation/*`,
 * which stays filesystem-independent so it can bundle into the renderer.
 *
 * `assembleGenerationPlan` is the thin, deterministic glue between the frozen
 * pure generators (`generation/contracts.ts`, `generation/composition.ts`,
 * `generation/inbound.ts`, `generation/python.ts`) and the frozen
 * transactional apply (`generationApply.ts`):
 *
 * 1. Run the pure generators for the deployable's `runtimeLanguage` into
 *    `virtualFiles` (types/operations or Pydantic models/protocols, an
 *    explicit composition root when a `CompositionManifest` is supplied, and
 *    one inbound-adapter file per binding).
 * 2. Compute each virtual file's deterministic `postimageHash`.
 * 3. Read the target repository (Node `fs`, traversal-safe under
 *    `targetRoot`) to classify each file as `create` (no existing file) or
 *    `update` (existing file, different content) with its `preimageHash`. A
 *    file whose freshly generated content is byte-identical to what is
 *    already on disk is dropped entirely from the plan — this is exactly
 *    CAP-ERA-001 §13 impact-scoped regeneration: only the files a change
 *    actually touches ever appear in `fileChanges`.
 * 4. Classify every included file `generated`-owned and assemble the
 *    `GenerationPlan` via the frozen `buildGenerationPlan` (canonical
 *    ordering, deterministic `planHash`).
 *
 * Deterministic: the caller supplies `planId`/`runId`/`now`; this module
 * never calls `Date.now()`/`Math.random()`. The only non-determinism source
 * is the target repository's on-disk state, which is read, never guessed.
 *
 * Known gap (documented, not silently worked around): `generation/*` has no
 * Python composition-root generator. For a `python` deployable this module
 * therefore does not emit a composition-root file; see the module-level
 * `PYTHON_COMPOSITION_GAP_NOTE` below. Running the generated app (actually
 * resolving a real registered implementation at process start) is WP8 scope
 * — `resolved.g.*` here is deterministic DI-wiring glue only.
 */

import fs from 'node:fs'
import path from 'node:path'

import { isRealPathWithinProjectRoot } from './filesystem.js'
import { canonicalRecordHash } from './hash.js'
import {
  buildGenerationPlan,
  compositionTokenName,
  DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME,
  DEFAULT_RUNTIME_PACKAGE_NAME,
  generatedContentHash,
  generatedFileHeader,
  generatedPythonFileHeader,
  operationTypeBaseName,
  planCompositionRootModule,
  planContractTypes,
  planInboundAdapter,
  planPythonInboundAdapter,
  planPythonCompositionRootModule,
  planOpenApiDocument,
  planPythonModels,
  planPythonProtocols,
  pythonModuleSpecifierFromPath,
  relativeModuleSpecifier,
  renderImportBlock,
  renderPythonImportBlock,
  renderVirtualFileBody,
  sortByKey,
  toCamelCase,
  toPascalCase,
  toPosixPath,
  toSnakeCase,
  uniqueSorted,
  type GeneratedSchemaDefinition,
  type GeneratedVirtualFile,
  type GenerationPlanInput,
} from './generation/index.js'
import type { GenerationApplyVirtualFile } from './generationApply.js'
import type {
  CompositionManifest,
  DeployableSpecification,
  FileChangeAction,
  GenerationFileChange,
  GenerationPlan,
  HttpInboundBinding,
  InboundBinding,
  ModuleImplementationSpecification,
  OperationContract,
} from './types.js'

export type AssembleGenerationPlanInput = {
  readonly deployable: DeployableSpecification
  readonly modules?: readonly ModuleImplementationSpecification[]
  readonly inboundBindings: readonly InboundBinding[]
  /** Approved HTTP entry points on other deployables consumed by this deployable. */
  readonly remoteHttpBindings?: readonly HttpInboundBinding[]
  readonly schemas: readonly GeneratedSchemaDefinition[]
  readonly operations: readonly OperationContract[]
  readonly composition?: CompositionManifest
  /** Material prerequisites the desktop orchestration layer could not resolve. */
  readonly blockers?: readonly string[]
  /** Evidence-backed choices that require user resolution before apply. */
  readonly ambiguityQuestions?: readonly { id: string; question: string; choices: string[] }[]
  /** Previously applied ownership used to block regeneration over modified generated files. */
  readonly ownershipManifests?: readonly import('./types.js').GeneratedOwnershipManifest[]
  /** Current hashes for owned generated paths, paired with `ownershipManifests`. */
  readonly currentContentHashesByPath?: Readonly<Record<string, string>>
  /** Actual repository state determined by the privileged caller. */
  readonly targetCleanState?: import('./types.js').CleanState
  /** Privileged caller-supplied runtime/package infrastructure files. */
  readonly additionalFiles?: readonly {
    path: string
    contents: string
    ownership: import('./types.js').GeneratedClassification
    reason: string
  }[]
  readonly dependencyChanges?: readonly import('./types.js').GenerationDependencyChange[]
  readonly additionalCommands?: readonly string[]
  /** Absolute or process-relative path to the target repository root. */
  readonly targetRoot: string
  readonly runtimePackageName?: string
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  readonly planId: string
  /** Deterministic run identity, threaded through to `applyGenerationPlan` by the caller; not itself read here. */
  readonly runId: string
  /** Reserved for future audit metadata; assembly never calls this (kept clock-free per CAP-ERA-001 §11.1). */
  readonly now?: () => Date
}

export type AssembleGenerationPlanResult = {
  readonly plan: GenerationPlan
  readonly virtualFiles: GenerationApplyVirtualFile[]
}

/**
 * Known, documented gap: `generation/*` ships a TypeScript-only
 * `composition.ts` (`planCompositionRootModule`); there is no Python
 * composition-root generator (`python.ts` covers only Pydantic
 * models/protocols/inbound adapters/OpenAPI). For a `python` deployable this
 * module therefore never emits a composition-root file. See HANDOFF
 * "contract-change requests".
 */
export const PYTHON_COMPOSITION_GAP_NOTE =
  'legacy compatibility note: Python composition-root generation is now supported by planPythonCompositionRootModule'

function deployableBasePath(deployableId: string): string {
  return `src/generated/${toPosixPath(deployableId).replace(/\//g, '-')}`
}

function operationKey(ref: { operationId: string; version: string }): string {
  return `${ref.operationId} ${ref.version}`
}

/** Mirrors `generation/composition.ts`'s internal (unexported) composition-root builder function name exactly. */
function compositionBuilderName(compositionId: string): string {
  return `build${toPascalCase(compositionId)}Container`
}

type OperationRef = { operationId: string; version: string }

function distinctOperationRefs(bindings: readonly InboundBinding[]): OperationRef[] {
  const byKey = new Map<string, OperationRef>()
  for (const binding of bindings) {
    const ref = { operationId: binding.operationId, version: binding.operationVersion }
    byKey.set(operationKey(ref), ref)
  }
  return sortByKey([...byKey.values()], operationKey)
}

// ---------------------------------------------------------------------------
// TypeScript-target file planning
// ---------------------------------------------------------------------------

function buildResolvedOperationsFileTs(input: {
  filePath: string
  operationRefs: readonly OperationRef[]
  composition: CompositionManifest | undefined
  compositionRootPath: string | undefined
  runtimePackageName: string
  generatorVersion: string
  referenceProfileVersion: string
}): GeneratedVirtualFile {
  const header = generatedFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: input.operationRefs.map((ref) => `${ref.operationId}@${ref.version}`),
  })

  const registrationByContractId = new Map((input.composition?.registrations ?? []).map((r) => [r.contractId, r]))
  const importNames = new Set<string>()
  const sections: string[] = []
  let rootBuilderName: string | undefined

  for (const ref of input.operationRefs) {
    const exportName = toCamelCase(ref.operationId)
    const registration = registrationByContractId.get(ref.operationId)
    if (registration && input.composition && input.compositionRootPath) {
      const builderName = compositionBuilderName(input.composition.compositionId)
      const tokenName = compositionTokenName(ref.operationId)
      importNames.add(builderName)
      importNames.add(tokenName)
      rootBuilderName = builderName
      sections.push(
        [
          `// operation: ${ref.operationId}@${ref.version} (resolved via composition registration "${registration.contractId}")`,
          `export const ${exportName} = {`,
          `  code: ${JSON.stringify(ref.operationId)},`,
          '  async execute(input, context) {',
          '    const scope = compositionRoot.createChildScope()',
          '    try {',
          `      const operation = scope.resolve(${tokenName}) as Operation<unknown, unknown, unknown, unknown>`,
          '      return await operation.execute(input, context)',
          '    } finally {',
          '      await scope.dispose()',
          '    }',
          '  },',
          '} satisfies Operation<unknown, unknown, unknown, unknown>',
        ].join('\n'),
      )
    } else {
      sections.push(
        [
          `// operation: ${ref.operationId}@${ref.version}`,
          `// no composition registration resolves this operation directly (expects a registration whose contractId`,
          `// equals the operationId); deferred to full DI wiring — see WP8 runtime integration.`,
          `export const ${exportName}: unknown = undefined`,
        ].join('\n'),
      )
    }
  }

  const importBlock = renderImportBlock([
    ...(importNames.size > 0 ? [{ moduleSpecifier: input.runtimePackageName, namedImports: ['Operation'], typeOnly: true }] : []),
    ...(importNames.size > 0 && input.compositionRootPath
      ? [{ moduleSpecifier: relativeModuleSpecifier(input.filePath, input.compositionRootPath), namedImports: [...importNames].sort() }]
      : []),
  ])

  const rootLine = rootBuilderName ? `const compositionRoot = ${rootBuilderName}().createRootScope()` : ''
  return { path: input.filePath, contents: renderVirtualFileBody([header, importBlock, rootLine, ...sections]) }
}

function planTypescriptFiles(input: {
  deployable: DeployableSpecification
  bindings: readonly InboundBinding[]
  remoteHttpBindings: readonly HttpInboundBinding[]
  schemas: readonly GeneratedSchemaDefinition[]
  operations: readonly OperationContract[]
  composition: CompositionManifest | undefined
  runtimePackageName: string
  generatorVersion: string
  referenceProfileVersion: string
}): { files: GeneratedVirtualFile[]; diagnostics: string[] } {
  const diagnostics: string[] = []
  const basePath = deployableBasePath(input.deployable.deployableId)
  const typesFilePath = `${basePath}/types.g.ts`
  const operationsFilePath = `${basePath}/operations.g.ts`
  const resolvedOperationsFilePath = `${basePath}/resolved.g.ts`

  const contracts = planContractTypes({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    runtimePackageName: input.runtimePackageName,
    schemas: input.schemas,
    operations: input.operations,
    typesFilePath,
    operationsFilePath,
  })
  diagnostics.push(...contracts.diagnostics)

  const files: GeneratedVirtualFile[] = [contracts.typesFile, contracts.operationsFile]

  let compositionFile: GeneratedVirtualFile | undefined
  if (input.composition) {
    const compositionResult = planCompositionRootModule({
      manifest: input.composition,
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      filePath: input.deployable.compositionRootPath,
      runtimePackageName: input.runtimePackageName,
    })
    for (const issue of compositionResult.issues) diagnostics.push(`composition "${input.composition.compositionId}": ${issue.code}: ${issue.message}`)
    compositionFile = compositionResult.file
    files.push(compositionFile)
  }

  const operationRefs = distinctOperationRefs(input.bindings)
  const resolvedOperationsFile = buildResolvedOperationsFileTs({
    filePath: resolvedOperationsFilePath,
    operationRefs,
    composition: input.composition,
    compositionRootPath: compositionFile ? input.deployable.compositionRootPath : undefined,
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    runtimePackageName: input.runtimePackageName,
  })
  files.push(resolvedOperationsFile)

  const operationsById = new Map(input.operations.map((operation) => [operationKey(operation), operation]))

  for (const binding of input.bindings) {
    const operation = operationsById.get(operationKey({ operationId: binding.operationId, version: binding.operationVersion }))
    if (!operation) {
      diagnostics.push(
        `binding "${binding.bindingId}" references operation "${binding.operationId}@${binding.operationVersion}", which is not in the supplied operations list; generating its adapter without resolved type names`,
      )
    }
    const baseName = operation ? operationTypeBaseName(operation) : undefined
    const adapterResult = planInboundAdapter({
      binding,
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      filePath: `${basePath}/inbound/${binding.bindingId}.g.ts`,
      operationModulePath: resolvedOperationsFilePath,
      operationExportName: toCamelCase(binding.operationId),
      runtimePackageName: input.runtimePackageName,
      observedPath: {
        inboundAdapter: `${binding.kind}:${binding.bindingId}`,
        compositionRoot: input.deployable.compositionRootPath,
        operation: `${binding.operationId}@${binding.operationVersion}`,
        outboundAdapters: [...(input.composition?.outboundAdapterRefs ?? [])].sort(),
      },
      operationTypes: baseName
        ? {
            typesModulePath: operationsFilePath,
            inputTypeName: `${baseName}Input`,
            successTypeName: `${baseName}Success`,
            domainRejectionTypeName: `${baseName}DomainRejectionCode`,
            technicalFailureTypeName: `${baseName}TechnicalErrorCode`,
          }
        : undefined,
    })
    diagnostics.push(...adapterResult.diagnostics)
    files.push(adapterResult.file)
  }

  const httpBindings = input.bindings.filter((binding): binding is Extract<InboundBinding, { kind: 'http' }> => binding.kind === 'http')
  if (httpBindings.length) {
    const hostPath = `${basePath}/host.g.ts`
    const routeImports = httpBindings.map((binding) => ({
      moduleSpecifier: relativeModuleSpecifier(hostPath, `${basePath}/inbound/${binding.bindingId}.g.ts`),
      namedImports: [`${toCamelCase(binding.bindingId)}Route`],
    }))
    const routeNames = httpBindings.map((binding) => `${toCamelCase(binding.bindingId)}Route`)
    const header = generatedFileHeader({
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      sourceContractHashes: httpBindings.map((binding) => `${binding.bindingId}@${binding.version}`),
    })
    const imports = renderImportBlock([
      { moduleSpecifier: input.runtimePackageName, namedImports: ['MapConfigurationReader', 'ResolvedSecret'] },
      { moduleSpecifier: input.runtimePackageName, namedImports: ['SecretReference', 'SecretResolver'], typeOnly: true },
      { moduleSpecifier: `${input.runtimePackageName}/node`, namedImports: ['createNodeHttpHost'] },
      ...routeImports,
    ])
    const body = [
      'const configuration = new MapConfigurationReader(',
      '  Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")),',
      ')',
      'const secretResolver: SecretResolver = {',
      '  resolve(reference: SecretReference): ResolvedSecret {',
      '    const value = process.env[reference.ref]',
      '    if (value === undefined) throw new Error(`Missing secret environment reference: ${reference.ref}`)',
      '    return new ResolvedSecret(reference, value)',
      '  },',
      '}',
      `export const host = createNodeHttpHost({ routes: [${routeNames.join(', ')}], configuration, secretResolver })`,
      'const requestedPort = process.env.PORT ? Number(process.env.PORT) : 3000',
      'const { port } = await host.start(requestedPort)',
      `console.log(${JSON.stringify(`${input.deployable.deployableId} listening on http://127.0.0.1:`)} + port)`,
      "for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void host.stop().finally(() => process.exit(0)))",
    ]
    files.push({ path: hostPath, contents: renderVirtualFileBody([header, imports, body.join('\n')]) })
  }

  if (httpBindings.length) {
    const openApi = planOpenApiDocument({
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      title: input.deployable.name,
      apiVersion: '1.0.0',
      schemas: input.schemas,
      operations: input.operations,
      httpBindings,
      documentFilePath: `${basePath}/openapi.g.json`,
    })
    diagnostics.push(...openApi.diagnostics)
    files.push(openApi.file)
  }

  if (input.remoteHttpBindings.length) {
    const clientPath = `${basePath}/clients/remote-http.g.ts`
    const operationsByKey = new Map(input.operations.map((operation) => [operationKey(operation), operation]))
    const imports = new Set<string>(['Outcome'])
    const sections: string[] = []
    for (const binding of sortByKey([...input.remoteHttpBindings], (candidate) => candidate.bindingId)) {
      const operation = operationsByKey.get(operationKey({ operationId: binding.operationId, version: binding.operationVersion }))
      if (!operation) {
        diagnostics.push(`remote HTTP binding "${binding.bindingId}" has no matching operation contract`)
        continue
      }
      const baseName = operationTypeBaseName(operation)
      const inputType = `${baseName}Input`
      const successType = `${baseName}Success`
      const rejectionType = `${baseName}DomainRejectionCode`
      const technicalType = `${baseName}TechnicalErrorCode`
      for (const name of [inputType, successType, rejectionType, technicalType]) imports.add(name)
      const functionName = `${toCamelCase(binding.bindingId)}Client`
      sections.push([
        `/** ${binding.operationId}@${binding.operationVersion} via ${binding.method} ${binding.path} on ${binding.deployableId}. */`,
        `export async function ${functionName}(`,
        `  input: ${inputType},`,
        `  options: { baseUrl: string; signal?: AbortSignal; headers?: Readonly<Record<string, string>> },`,
        `): Promise<Outcome<${successType}, ${rejectionType}, ${technicalType}>> {`,
        '  const correlationId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`',
        `  const response = await fetch(new URL(${JSON.stringify(binding.path)}, options.baseUrl), {`,
        `    method: ${JSON.stringify(binding.method)},`,
        `    headers: { 'content-type': 'application/json', 'x-correlation-id': correlationId, ...(options.headers ?? {}) },`,
        "    body: input === undefined ? undefined : JSON.stringify(input),",
        '    signal: options.signal,',
        '  })',
        '  const body = await response.json() as Record<string, unknown>',
        "  if (body.kind === 'failed') return { ...body, safeMessage: body.safe_message, causeRef: body.cause_ref } as Outcome<" + `${successType}, ${rejectionType}, ${technicalType}>`,
        "  if (body.kind === 'timed_out') return { ...body, kind: 'timedOut' } as Outcome<" + `${successType}, ${rejectionType}, ${technicalType}>`,
        `  return body as Outcome<${successType}, ${rejectionType}, ${technicalType}>`,
        '}',
      ].join('\n'))
    }
    if (sections.length) {
      const header = generatedFileHeader({
        generatorVersion: input.generatorVersion,
        referenceProfileVersion: input.referenceProfileVersion,
        sourceContractHashes: input.remoteHttpBindings.map((binding) => `${binding.bindingId}@${binding.version}`),
      })
      const importBlock = renderImportBlock([
        { moduleSpecifier: input.runtimePackageName, namedImports: ['Outcome'], typeOnly: true },
        { moduleSpecifier: relativeModuleSpecifier(clientPath, operationsFilePath), namedImports: [...imports].filter((name) => name !== 'Outcome'), typeOnly: true },
      ])
      files.push({ path: clientPath, contents: renderVirtualFileBody([header, importBlock, ...sections]) })
    }
  }

  return { files, diagnostics }
}

// ---------------------------------------------------------------------------
// Python-target file planning
// ---------------------------------------------------------------------------

function buildResolvedOperationsFilePy(input: {
  filePath: string
  operationRefs: readonly OperationRef[]
  generatorVersion: string
  referenceProfileVersion: string
  composition: CompositionManifest | undefined
  compositionRootPath: string | undefined
}): GeneratedVirtualFile {
  const header = generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: input.operationRefs.map((ref) => `${ref.operationId}@${ref.version}`),
  })
  const registrationByContractId = new Map((input.composition?.registrations ?? []).map((registration) => [registration.contractId, registration]))
  const compositionImports = new Set<string>()
  const sections = input.operationRefs.map((ref) => {
    const exportName = toSnakeCase(ref.operationId)
    const registration = registrationByContractId.get(ref.operationId)
    if (registration && input.composition && input.compositionRootPath) {
      const builderName = `build_${toSnakeCase(input.composition.compositionId)}_container`
      const keyName = `${toSnakeCase(ref.operationId).toUpperCase()}_KEY`
      compositionImports.add(builderName)
      compositionImports.add(keyName)
      const proxyName = `_${toPascalCase(ref.operationId)}ResolvedOperation`
      return [
        `# operation: ${ref.operationId}@${ref.version} (resolved through the approved composition root)`,
        `class ${proxyName}:`,
        '    def execute(self, input: Any, context: Any) -> Any:',
        '        with _container.create_scope() as scope:',
        `            return scope.resolve(${keyName}).execute(input, context)`,
        '',
        `${exportName} = ${proxyName}()`,
      ].join('\n')
    }
    return [
      `# operation: ${ref.operationId}@${ref.version}`,
      '# no approved composition registration resolves this operation',
      `${exportName}: Any = None`,
    ].join('\n')
  })
  const importBlock = renderPythonImportBlock([
    { moduleSpecifier: 'typing', names: ['Any'] },
    ...(compositionImports.size && input.compositionRootPath
      ? [{ moduleSpecifier: pythonModuleSpecifierFromPath(input.compositionRootPath), names: [...compositionImports] }]
      : []),
  ])
  const containerLine = compositionImports.size
    ? `_container = build_${toSnakeCase(input.composition!.compositionId)}_container()`
    : ''
  return { path: input.filePath, contents: renderVirtualFileBody([header, importBlock, containerLine, ...sections]) }
}

function planPythonFiles(input: {
  deployable: DeployableSpecification
  bindings: readonly InboundBinding[]
  schemas: readonly GeneratedSchemaDefinition[]
  operations: readonly OperationContract[]
  composition: CompositionManifest | undefined
  runtimePackageName: string
  generatorVersion: string
  referenceProfileVersion: string
}): { files: GeneratedVirtualFile[]; diagnostics: string[] } {
  const diagnostics: string[] = []
  const basePath = `src/generated/${toSnakeCase(input.deployable.deployableId)}`
  const modelsFilePath = `${basePath}/models_g.py`
  const protocolsFilePath = `${basePath}/protocols_g.py`
  const resolvedOperationsFilePath = `${basePath}/resolved_g.py`

  const models = planPythonModels({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    schemas: input.schemas,
    modelsFilePath,
  })
  diagnostics.push(...models.diagnostics)

  const protocols = planPythonProtocols({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    schemas: input.schemas,
    operations: input.operations,
    protocolsFilePath,
    modelsFilePath,
    runtimePackageName: input.runtimePackageName,
  })
  diagnostics.push(...protocols.diagnostics)

  const files: GeneratedVirtualFile[] = [models.file, protocols.file]

  let compositionFile: GeneratedVirtualFile | undefined
  if (input.composition) {
    const compositionResult = planPythonCompositionRootModule({
      manifest: input.composition,
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      filePath: input.deployable.compositionRootPath,
      runtimePackageName: input.runtimePackageName,
    })
    diagnostics.push(...compositionResult.diagnostics)
    diagnostics.push(...compositionResult.issues.map((issue) => `composition "${input.composition!.compositionId}": ${issue.code}: ${issue.message}`))
    compositionFile = compositionResult.file
    files.push(compositionFile)
  }

  const operationRefs = distinctOperationRefs(input.bindings)
  const resolvedOperationsFile = buildResolvedOperationsFilePy({
    filePath: resolvedOperationsFilePath,
    operationRefs,
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    composition: input.composition,
    compositionRootPath: compositionFile ? input.deployable.compositionRootPath : undefined,
  })
  files.push(resolvedOperationsFile)

  const operationsById = new Map(input.operations.map((operation) => [operationKey(operation), operation]))

  for (const binding of input.bindings) {
    const operation = operationsById.get(operationKey({ operationId: binding.operationId, version: binding.operationVersion }))
    if (!operation) {
      diagnostics.push(
        `binding "${binding.bindingId}" references operation "${binding.operationId}@${binding.operationVersion}", which is not in the supplied operations list; generating its adapter without resolved type names`,
      )
    }
    const baseName = operation ? operationTypeBaseName(operation) : undefined
    const adapterResult = planPythonInboundAdapter({
      binding,
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      filePath: `${basePath}/inbound/${toSnakeCase(binding.bindingId)}_g.py`,
      operationModulePath: resolvedOperationsFilePath,
      operationExportName: toSnakeCase(binding.operationId),
      runtimePackageName: input.runtimePackageName,
      observedPath: {
        inboundAdapter: `${binding.kind}:${binding.bindingId}`,
        compositionRoot: input.deployable.compositionRootPath,
        operation: `${binding.operationId}@${binding.operationVersion}`,
        outboundAdapters: [...(input.composition?.outboundAdapterRefs ?? [])].sort(),
      },
      // Functional note (contract-change request candidate): despite this field's name/doc comment
      // ("planPythonModels's modelsFilePath"), all four resolved type names below are only ever
      // exported together from the PROTOCOLS file (`planPythonProtocols`'s TypeAlias exports); the
      // raw Pydantic `models.g.py` never defines `${baseName}DomainRejectionCode`/`TechnicalErrorCode`.
      // Pointing at `protocolsFilePath` is what actually keeps the emitted `from ... import ...` valid.
      operationTypes: baseName
        ? {
            modelsFilePath: protocolsFilePath,
            inputTypeName: `${baseName}Input`,
            successTypeName: `${baseName}Success`,
            domainRejectionTypeName: `${baseName}DomainRejectionCode`,
            technicalFailureTypeName: `${baseName}TechnicalErrorCode`,
          }
        : undefined,
    })
    diagnostics.push(...adapterResult.diagnostics)
    files.push(adapterResult.file)
  }

  const httpBindings = input.bindings.filter((binding): binding is Extract<InboundBinding, { kind: 'http' }> => binding.kind === 'http')
  if (httpBindings.length) {
    const hostPath = `${basePath}/host_g.py`
    const adapterImports = httpBindings.map((binding) => ({
      moduleSpecifier: pythonModuleSpecifierFromPath(`${basePath}/inbound/${toSnakeCase(binding.bindingId)}_g.py`),
      names: [`register_${toSnakeCase(binding.bindingId)}_route`],
    }))
    const header = generatedPythonFileHeader({
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      sourceContractHashes: httpBindings.map((binding) => `${binding.bindingId}@${binding.version}`),
    })
    const imports = renderPythonImportBlock([
      { moduleSpecifier: `${input.runtimePackageName}.http`, names: ['HttpOperationHost'] },
      ...adapterImports,
    ])
    const body = [
      `host = HttpOperationHost(title=${JSON.stringify(input.deployable.name)})`,
      ...httpBindings.map((binding) => `register_${toSnakeCase(binding.bindingId)}_route(host)`),
      'host.assert_openapi_consistent()',
      'app = host.app',
      '',
      'if __name__ == "__main__":',
      '    import os',
      '    import uvicorn',
      '    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "3000")))',
    ]
    files.push({ path: hostPath, contents: renderVirtualFileBody([header, imports, body.join('\n')]) })
  }

  if (httpBindings.length) {
    const openApi = planOpenApiDocument({
      generatorVersion: input.generatorVersion,
      referenceProfileVersion: input.referenceProfileVersion,
      title: input.deployable.name,
      apiVersion: '1.0.0',
      schemas: input.schemas,
      operations: input.operations,
      httpBindings,
      documentFilePath: `${basePath}/openapi.g.json`,
    })
    diagnostics.push(...openApi.diagnostics)
    files.push(openApi.file)
  }

  return { files, diagnostics }
}

// ---------------------------------------------------------------------------
// Target-repository read (traversal-safe under targetRoot; Node fs)
// ---------------------------------------------------------------------------

function resolveReadableAbsPath(targetRootAbs: string, relPath: string): string | undefined {
  const normalized = toPosixPath(relPath)
  if (normalized === '.' || normalized === '') return undefined
  if (normalized.split('/').some((segment) => segment === '..')) return undefined
  const absPath = path.resolve(targetRootAbs, normalized)
  const rootResolved = path.resolve(targetRootAbs)
  if (absPath !== rootResolved && !absPath.startsWith(rootResolved + path.sep)) return undefined
  if (!isRealPathWithinProjectRoot(targetRootAbs, absPath)) return undefined
  return absPath
}

function readExistingContentHash(targetRootAbs: string, relPath: string): string | undefined {
  const absPath = resolveReadableAbsPath(targetRootAbs, relPath)
  if (!absPath) return undefined
  try {
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return undefined
    return generatedContentHash(fs.readFileSync(absPath, 'utf8'))
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Assembly entry point
// ---------------------------------------------------------------------------

function firstDefinedProjectId(input: AssembleGenerationPlanInput): string | undefined {
  if (input.composition) return input.composition.projectId
  for (const binding of input.inboundBindings) {
    if (binding.deployableId === input.deployable.deployableId) return binding.projectId
  }
  for (const module of input.modules ?? []) return module.projectId
  return undefined
}

/**
 * Assembles a deterministic `GenerationPlan` plus the `virtualFiles` needed
 * to `applyGenerationPlan` it, from one deployable's approved records. See
 * the module doc comment for the full algorithm.
 */
export function assembleGenerationPlan(input: AssembleGenerationPlanInput): AssembleGenerationPlanResult {
  const projectId = firstDefinedProjectId(input)
  if (!projectId) {
    throw new Error(
      'assembleGenerationPlan: could not derive a projectId; supply at least one of composition, an inboundBindings entry for this deployable, or a module',
    )
  }

  const bindings = sortByKey(
    input.inboundBindings.filter((binding) => binding.deployableId === input.deployable.deployableId),
    (binding) => binding.bindingId,
  )

  const generatorVersion = input.generatorVersion
  const referenceProfileVersion = input.referenceProfileVersion

  let generated: { files: GeneratedVirtualFile[]; diagnostics: string[] }
  if (input.deployable.runtimeLanguage === 'typescript') {
    generated = planTypescriptFiles({
      deployable: input.deployable,
      bindings,
      remoteHttpBindings: sortByKey([...(input.remoteHttpBindings ?? [])], (binding) => binding.bindingId),
      schemas: input.schemas,
      operations: input.operations,
      composition: input.composition,
      runtimePackageName: input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME,
      generatorVersion,
      referenceProfileVersion,
    })
  } else {
    generated = planPythonFiles({
      deployable: input.deployable,
      bindings,
      schemas: input.schemas,
      operations: input.operations,
      composition: input.composition,
      runtimePackageName: input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME,
      generatorVersion,
      referenceProfileVersion,
    })
  }

  const targetRootAbs = path.resolve(input.targetRoot)
  const fileChanges: GenerationFileChange[] = []
  const virtualFiles: GenerationApplyVirtualFile[] = []

  const plannedFiles = [
    ...generated.files.map((file) => ({ ...file, ownership: 'generated' as const, reason: `generated for deployable "${input.deployable.deployableId}" (${input.deployable.runtimeLanguage})` })),
    ...(input.additionalFiles ?? []),
  ]
  for (const file of sortByKey(plannedFiles, (f) => f.path)) {
    const postimageHash = generatedContentHash(file.contents)
    const existingHash = readExistingContentHash(targetRootAbs, file.path)
    if (existingHash === postimageHash) {
      // Byte-identical to what is already applied: not impacted by this
      // assemble, so it is dropped entirely (CAP-ERA-001 §13 impact scoping).
      continue
    }
    const action: FileChangeAction = existingHash === undefined ? 'create' : 'update'
    fileChanges.push({
      path: file.path,
      action,
      ownership: file.ownership,
      reason: file.reason,
      ...(action === 'update' ? { preimageHash: existingHash } : {}),
      postimageHash,
    })
    virtualFiles.push({ path: file.path, contents: file.contents })
  }

  const inputRecords: GenerationPlanInput['inputRecords'] = []
  inputRecords.push({
    recordId: `deployable:${input.deployable.deployableId}`,
    revision: canonicalRecordHash(input.deployable),
    hash: canonicalRecordHash(input.deployable),
  })
  for (const operation of input.operations) {
    inputRecords.push({
      recordId: `operation:${operation.operationId}`,
      revision: operation.version,
      hash: canonicalRecordHash(operation),
    })
  }
  for (const schema of input.schemas) {
    inputRecords.push({
      recordId: `schema:${schema.schemaId}`,
      revision: canonicalRecordHash(schema),
      hash: canonicalRecordHash(schema),
    })
  }
  for (const binding of bindings) {
    inputRecords.push({
      recordId: `binding:${binding.bindingId}`,
      revision: binding.version,
      hash: canonicalRecordHash(binding),
    })
  }
  if (input.composition) {
    inputRecords.push({
      recordId: `composition:${input.composition.compositionId}`,
      revision: input.composition.compositionHash,
      hash: canonicalRecordHash(input.composition),
    })
  }
  for (const module of input.modules ?? []) {
    inputRecords.push({
      recordId: `module:${module.moduleId}`,
      revision: module.moduleVersion,
      hash: canonicalRecordHash(module),
    })
  }

  const commands = [
    ...(input.additionalCommands ?? []),
    input.deployable.commands.build,
    input.deployable.commands.test,
    input.deployable.commands.launch,
    input.deployable.commands.health,
    input.deployable.commands.shutdown,
  ].filter((command): command is string => Boolean(command))

  const planInput: GenerationPlanInput = {
    planId: input.planId,
    projectId,
    inputRecords,
    generatorVersion,
    referenceProfileVersion,
    // Compatibility default for pure/library callers. Production desktop
    // orchestration always supplies the actual git state and never relies on
    // this default.
    targetRepository: { root: input.targetRoot, cleanState: input.targetCleanState ?? 'clean' },
    dependencyChanges: [...(input.dependencyChanges ?? [])],
    fileChanges,
    commands,
    warnings: uniqueSorted(generated.diagnostics),
    ambiguityQuestions: input.ambiguityQuestions ? [...input.ambiguityQuestions] : undefined,
    rollbackStrategy: 'staged-rename-with-journal',
    ownershipManifests: input.ownershipManifests,
    currentContentHashesByPath: input.currentContentHashesByPath,
  }

  const assembled = buildGenerationPlan(planInput)
  const extraBlockers = uniqueSorted(input.blockers ?? [])
  const { planHash: _assembledHash, ...assembledBody } = assembled
  void _assembledHash
  const planWithoutHash = { ...assembledBody, blockers: uniqueSorted([...assembled.blockers, ...extraBlockers]) }
  const plan = extraBlockers.length === 0
    ? assembled
    : { ...planWithoutHash, planHash: canonicalRecordHash(planWithoutHash) }

  return { plan, virtualFiles: sortByKey(virtualFiles, (f) => f.path) }
}
