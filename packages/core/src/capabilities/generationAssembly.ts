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
  InboundBinding,
  ModuleImplementationSpecification,
  OperationContract,
} from './types.js'

export type AssembleGenerationPlanInput = {
  readonly deployable: DeployableSpecification
  readonly modules?: readonly ModuleImplementationSpecification[]
  readonly inboundBindings: readonly InboundBinding[]
  readonly schemas: readonly GeneratedSchemaDefinition[]
  readonly operations: readonly OperationContract[]
  readonly composition?: CompositionManifest
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
  'composition-root generation for "python" deployables is deferred: generation/* has no Python composition-root generator (only generation/composition.ts, which emits TypeScript)'

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

  for (const ref of input.operationRefs) {
    const exportName = toCamelCase(ref.operationId)
    const registration = registrationByContractId.get(ref.operationId)
    if (registration && input.composition && input.compositionRootPath) {
      const builderName = compositionBuilderName(input.composition.compositionId)
      const tokenName = compositionTokenName(ref.operationId)
      importNames.add(builderName)
      importNames.add(tokenName)
      sections.push(
        [
          `// operation: ${ref.operationId}@${ref.version} (resolved via composition registration "${registration.contractId}")`,
          `export const ${exportName} = ${builderName}().resolve(${tokenName})`,
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

  const importBlock =
    importNames.size > 0 && input.compositionRootPath
      ? renderImportBlock([{ moduleSpecifier: relativeModuleSpecifier(input.filePath, input.compositionRootPath), namedImports: [...importNames].sort() }])
      : ''

  return { path: input.filePath, contents: renderVirtualFileBody([header, importBlock, ...sections]) }
}

function planTypescriptFiles(input: {
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
  const basePath = deployableBasePath(input.deployable.deployableId)
  const typesFilePath = `${basePath}/types.g.ts`
  const operationsFilePath = `${basePath}/operations.g.ts`
  const resolvedOperationsFilePath = `${basePath}/resolved.g.ts`

  const contracts = planContractTypes({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    schemas: input.schemas,
    operations: input.operations,
    typesFilePath,
    operationsFilePath,
    runtimePackageName: input.runtimePackageName,
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
}): GeneratedVirtualFile {
  const header = generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: input.operationRefs.map((ref) => `${ref.operationId}@${ref.version}`),
  })
  const importBlock = renderPythonImportBlock([{ moduleSpecifier: 'typing', names: ['Any'] }])
  const sections = input.operationRefs.map((ref) => {
    const exportName = toSnakeCase(ref.operationId)
    return [
      `# operation: ${ref.operationId}@${ref.version}`,
      `# ${PYTHON_COMPOSITION_GAP_NOTE}; deferred to full DI wiring — see WP8 runtime integration.`,
      `${exportName}: Any = None`,
    ].join('\n')
  })
  return { path: input.filePath, contents: renderVirtualFileBody([header, importBlock, ...sections]) }
}

function planPythonFiles(input: {
  deployable: DeployableSpecification
  bindings: readonly InboundBinding[]
  schemas: readonly GeneratedSchemaDefinition[]
  operations: readonly OperationContract[]
  runtimePackageName: string
  generatorVersion: string
  referenceProfileVersion: string
}): { files: GeneratedVirtualFile[]; diagnostics: string[] } {
  const diagnostics: string[] = [PYTHON_COMPOSITION_GAP_NOTE]
  const basePath = deployableBasePath(input.deployable.deployableId)
  const modelsFilePath = `${basePath}/models.g.py`
  const protocolsFilePath = `${basePath}/protocols.g.py`
  const resolvedOperationsFilePath = `${basePath}/resolved.g.py`

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

  const operationRefs = distinctOperationRefs(input.bindings)
  const resolvedOperationsFile = buildResolvedOperationsFilePy({
    filePath: resolvedOperationsFilePath,
    operationRefs,
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
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
      filePath: `${basePath}/inbound/${binding.bindingId}.g.py`,
      operationModulePath: resolvedOperationsFilePath,
      operationExportName: toSnakeCase(binding.operationId),
      runtimePackageName: input.runtimePackageName,
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
      runtimePackageName: input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME,
      generatorVersion,
      referenceProfileVersion,
    })
  }

  const targetRootAbs = path.resolve(input.targetRoot)
  const fileChanges: GenerationFileChange[] = []
  const virtualFiles: GenerationApplyVirtualFile[] = []

  for (const file of sortByKey([...generated.files], (f) => f.path)) {
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
      ownership: 'generated',
      reason: `generated for deployable "${input.deployable.deployableId}" (${input.deployable.runtimeLanguage})`,
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
    targetRepository: { root: input.targetRoot, cleanState: 'clean' },
    dependencyChanges: [],
    fileChanges,
    commands,
    warnings: uniqueSorted(generated.diagnostics),
    rollbackStrategy: 'staged-rename-with-journal',
  }

  const plan = buildGenerationPlan(planInput)

  return { plan, virtualFiles: sortByKey(virtualFiles, (f) => f.path) }
}
