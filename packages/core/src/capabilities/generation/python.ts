/**
 * Deterministic Python code generation (CAP-ERA-001 §5.3, §7.2, §11.1
 * `python.ts`), the Python-target counterpart of `contracts.ts`/`inbound.ts`
 * targeting the `engineering_ui_capabilities_runtime` Python package
 * (Pydantic v2 models, FastAPI/argparse/cron inbound adapters, and OpenAPI
 * 3.1 emitted from the same frozen `OperationContract`s so a browser/TS
 * client and the Python FastAPI host share one boundary).
 *
 * Pure: given frozen `OperationContract`/`InboundBinding` records and the
 * canonical `GeneratedSchemaNode`-shaped type descriptions their
 * `inputSchemaRef`/`outputSchemaRef` resolve to (the same intermediate
 * schema shape `contracts.ts` consumes), plans deterministic generated
 * Python source and a deterministic OpenAPI 3.1 document. Given identical
 * inputs, output is byte-identical regardless of input array ordering.
 * Never imports `node:*`; never calls `Date.now()`/`Math.random()`/`crypto`.
 *
 * Runnable Python example slices (an actual FastAPI/CLI/worker app wired
 * against these generated files) are a separate, later packet (WP4B-slices);
 * this module only plans virtual file *contents*, never writes to disk.
 */

import type { GeneratedSchemaDefinition, GeneratedSchemaNode } from './contracts.js'
import { operationTypeBaseName } from './contracts.js'
import { ordinalCompare, sortByKey, uniqueSorted } from './paths.js'
import { renderVirtualFileBody, type GeneratedVirtualFile } from './typescript.js'
import {
  DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME,
  generatedPythonFileHeader,
  isValidPythonIdentifier,
  pythonModuleSpecifierFromPath,
  renderPythonImportBlock,
  sanitizePythonIdentifier,
  toSnakeCase,
  type PythonImportDeclarationInput,
} from './python-emit.js'
import type { CompositionManifest, HttpInboundBinding, InboundBinding, OperationContract } from '../types.js'
import { validateComposition, type CompositionValidationIssue } from './composition.js'

export { DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME, pythonModuleSpecifierFromPath }

// ---------------------------------------------------------------------------
// Python composition root
// ---------------------------------------------------------------------------

export type PythonCompositionRootInput = {
  readonly manifest: CompositionManifest
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  readonly filePath: string
  readonly runtimePackageName?: string
}

export type PythonCompositionRootResult = {
  readonly file: GeneratedVirtualFile
  readonly issues: CompositionValidationIssue[]
  readonly diagnostics: string[]
}

function pythonImplementationTarget(target: string, contractId: string): { moduleSpecifier: string; exportName: string } {
  const hash = target.indexOf('#')
  const modulePath = hash === -1 ? target : target.slice(0, hash)
  const exportName = hash === -1 ? `create_${toSnakeCase(contractId)}` : target.slice(hash + 1)
  return { moduleSpecifier: pythonModuleSpecifierFromPath(modulePath), exportName: sanitizePythonIdentifier(exportName) }
}

/** Deterministic Python counterpart to `planCompositionRootModule`. */
export function planPythonCompositionRootModule(input: PythonCompositionRootInput): PythonCompositionRootResult {
  const validation = validateComposition(input.manifest)
  const registrations = sortByKey([...input.manifest.registrations], (registration) => registration.contractId)
  const targets = new Map(registrations.map((registration) => [
    registration.contractId,
    pythonImplementationTarget(registration.implementationTarget, registration.contractId),
  ]))
  const imports: PythonImportDeclarationInput[] = [
    { moduleSpecifier: `${input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME}.core`, names: ['Container'] },
  ]
  for (const target of targets.values()) imports.push({ moduleSpecifier: target.moduleSpecifier, names: [target.exportName] })

  const keyNames = new Map(registrations.map((registration) => [
    registration.contractId,
    `${toSnakeCase(registration.contractId).toUpperCase()}_KEY`,
  ]))
  const keyLines = registrations.map((registration) =>
    `${keyNames.get(registration.contractId)} = ${JSON.stringify(registration.contractId)}`)
  const registrationLines = registrations.flatMap((registration) => {
    const target = targets.get(registration.contractId)!
    const dependencies = uniqueSorted([...registration.dependencies])
      .map((dependency) => `resolver.resolve(${keyNames.get(dependency) ?? JSON.stringify(dependency)})`)
      .join(', ')
    const method = registration.lifecycle === 'singleton'
      ? 'register_singleton'
      : registration.lifecycle === 'transient'
        ? 'register_transient'
        : 'register_request_job'
    return [
      `    # provider module: ${registration.providerModuleId}`,
      `    container.${method}(`,
      `        ${keyNames.get(registration.contractId)},`,
      `        lambda resolver: ${target.exportName}(${dependencies}),`,
      '    )',
    ]
  })
  const routes = sortByKey([...input.manifest.operationRoutes], (route) =>
    `${route.inboundBindingId} ${route.operationId} ${route.operationVersion}`)
  const routeLines = [
    'OPERATION_ROUTES = (',
    ...routes.map((route) => `    (${JSON.stringify(route.inboundBindingId)}, ${JSON.stringify(route.operationId)}, ${JSON.stringify(route.operationVersion)}),`),
    ')',
  ]
  const functionName = `build_${toSnakeCase(input.manifest.compositionId)}_container`
  const body = [
    ...keyLines,
    '',
    ...routeLines,
    '',
    `def ${functionName}() -> Container:`,
    '    container = Container()',
    ...registrationLines,
    '    return container',
  ]
  const header = generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: [input.manifest.compositionHash],
  })
  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([header, renderPythonImportBlock(imports), body.join('\n')]) },
    issues: validation.issues,
    diagnostics: [],
  }
}

// ---------------------------------------------------------------------------
// Shared schema-node planning
// ---------------------------------------------------------------------------

function dedupeAndSortProperties(
  properties: readonly { readonly name: string; readonly schema: GeneratedSchemaNode; readonly required?: boolean }[],
): { name: string; schema: GeneratedSchemaNode; required: boolean }[] {
  const byName = new Map<string, { name: string; schema: GeneratedSchemaNode; required: boolean }>()
  for (const property of properties) {
    byName.set(property.name, { name: property.name, schema: property.schema, required: property.required ?? false })
  }
  return sortByKey([...byName.values()], (entry) => entry.name)
}

/** Renders a `GeneratedSchemaNode` as a Python type expression, recording every `typing` import it needs. */
function renderPythonType(
  node: GeneratedSchemaNode,
  schemasById: ReadonlyMap<string, GeneratedSchemaDefinition>,
  diagnostics: string[],
  typingImports: Set<string>,
): string {
  switch (node.kind) {
    case 'string': {
      const values = uniqueSorted([...(node.enumValues ?? [])])
      if (values.length === 0) return 'str'
      typingImports.add('Literal')
      return `Literal[${values.map((value) => JSON.stringify(value)).join(', ')}]`
    }
    case 'integer':
      return 'int'
    case 'number':
      return 'float'
    case 'boolean':
      return 'bool'
    case 'null':
      return 'None'
    case 'unknown':
      typingImports.add('Any')
      return 'Any'
    case 'array':
      typingImports.add('List')
      return `List[${renderPythonType(node.items, schemasById, diagnostics, typingImports)}]`
    case 'object': {
      const properties = dedupeAndSortProperties(node.properties)
      if (properties.length > 0) {
        diagnostics.push(
          'inline (unnamed) object schema encountered; represented as "Dict[str, Any]" — nested Pydantic model generation for inline object schemas is not supported, only top-level named schemas become BaseModel classes',
        )
      }
      typingImports.add('Dict')
      typingImports.add('Any')
      return 'Dict[str, Any]'
    }
    case 'ref': {
      const resolved = schemasById.get(node.schemaId)
      if (!resolved) {
        diagnostics.push(`unresolved schema reference "${node.schemaId}"; substituting "Any"`)
        typingImports.add('Any')
        return 'Any'
      }
      return resolved.typeName
    }
    case 'union': {
      const rendered = node.options.map((option) => renderPythonType(option, schemasById, diagnostics, typingImports))
      const unique = uniqueSorted(rendered)
      if (unique.length === 0) {
        typingImports.add('Any')
        return 'Any'
      }
      if (unique.length === 1) return unique[0]!
      typingImports.add('Union')
      return `Union[${unique.join(', ')}]`
    }
  }
}

// ---------------------------------------------------------------------------
// Group A — Pydantic v2 model emission
// ---------------------------------------------------------------------------

export type PythonModelsGenerationInput = {
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  readonly schemas: readonly GeneratedSchemaDefinition[]
  /** Repo-relative path for the generated Pydantic models module (e.g. `src/generated/orders/models.g.py`). */
  readonly modelsFilePath: string
}

export type PythonModelsGenerationResult = {
  readonly file: GeneratedVirtualFile
  /** Non-fatal planning notes, e.g. an inline object schema falling back to `Dict[str, Any]`. */
  readonly diagnostics: readonly string[]
}

/** Deterministic Python field name for one schema property; `Field(alias=...)` is required whenever this differs from the canonical property name. */
function pythonFieldName(propertyName: string): string {
  return toSnakeCase(propertyName)
}

function renderModelClass(
  definition: GeneratedSchemaDefinition,
  schemasById: ReadonlyMap<string, GeneratedSchemaDefinition>,
  diagnostics: string[],
  typingImports: Set<string>,
): { code: string; usesField: boolean } {
  if (definition.schema.kind !== 'object') {
    typingImports.add('TypeAlias')
    const rendered = renderPythonType(definition.schema, schemasById, diagnostics, typingImports)
    return { code: `${definition.typeName}: TypeAlias = ${rendered}`, usesField: false }
  }

  const properties = dedupeAndSortProperties(definition.schema.properties)
  if (properties.length === 0) {
    return { code: `class ${definition.typeName}(BaseModel):\n    pass`, usesField: false }
  }

  let usesField = false
  const fieldLines = properties.map((property) => {
    const fieldName = pythonFieldName(property.name)
    const needsAlias = fieldName !== property.name
    const rendered = renderPythonType(property.schema, schemasById, diagnostics, typingImports)
    if (!property.required) typingImports.add('Optional')
    const typeExpr = property.required ? rendered : `Optional[${rendered}]`
    if (needsAlias) {
      usesField = true
      const defaultPart = property.required ? '' : 'default=None, '
      return `    ${fieldName}: ${typeExpr} = Field(${defaultPart}alias=${JSON.stringify(property.name)})`
    }
    if (!property.required) {
      return `    ${fieldName}: ${typeExpr} = None`
    }
    return `    ${fieldName}: ${typeExpr}`
  })

  const bodyLines = usesField ? ['    model_config = ConfigDict(populate_by_name=True)', '', ...fieldLines] : fieldLines
  return { code: [`class ${definition.typeName}(BaseModel):`, ...bodyLines].join('\n'), usesField }
}

/**
 * Plans the generated Pydantic v2 models module from canonical schemas
 * (the same `GeneratedSchemaDefinition[]` shape `contracts.ts` consumes).
 * Every top-level object schema becomes an exported `BaseModel` subclass
 * (PascalCase class name, snake_case fields, `Literal[...]` string enums,
 * `Optional[...]` for non-required fields, `Field(alias=...)` whenever a
 * canonical field name is not already a snake_case Python identifier);
 * every other top-level schema becomes a `TypeAlias`. Pure and
 * order-independent.
 */
export function planPythonModels(input: PythonModelsGenerationInput): PythonModelsGenerationResult {
  const diagnostics: string[] = []
  const schemas = sortByKey([...input.schemas], (schema) => schema.schemaId)
  const schemasById = new Map(schemas.map((schema) => [schema.schemaId, schema]))
  const typingImports = new Set<string>()
  let usesField = false
  let usesConfigDict = false

  const classDeclarations = schemas.map((schema) => {
    const { code, usesField: classUsesField } = renderModelClass(schema, schemasById, diagnostics, typingImports)
    if (classUsesField) {
      usesField = true
      usesConfigDict = true
    }
    return code
  })

  const header = generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: schemas.map((schema) => schema.schemaId),
  })

  const pydanticNames = ['BaseModel', ...(usesConfigDict ? ['ConfigDict'] : []), ...(usesField ? ['Field'] : [])]
  const importBlock = renderPythonImportBlock([
    { moduleSpecifier: 'pydantic', names: pydanticNames },
    ...(typingImports.size > 0 ? [{ moduleSpecifier: 'typing', names: [...typingImports].sort(ordinalCompare) }] : []),
  ])

  const file: GeneratedVirtualFile = {
    path: input.modelsFilePath,
    contents: renderVirtualFileBody([header, importBlock, ...classDeclarations]),
  }

  return { file, diagnostics: uniqueSorted(diagnostics) }
}

// ---------------------------------------------------------------------------
// Group A — operation Protocol + typed-outcome alias emission
// ---------------------------------------------------------------------------

export type PythonProtocolsGenerationInput = {
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  readonly schemas: readonly GeneratedSchemaDefinition[]
  readonly operations: readonly OperationContract[]
  /** Repo-relative path for the generated operation-protocols module. */
  readonly protocolsFilePath: string
  /** Repo-relative path for the generated Pydantic models module (`planPythonModels`'s `modelsFilePath`). */
  readonly modelsFilePath: string
  readonly runtimePackageName?: string
}

export type PythonProtocolsGenerationResult = {
  readonly file: GeneratedVirtualFile
  readonly diagnostics: readonly string[]
}

function operationSortKey(operation: OperationContract): string {
  return `${operation.operationId} ${operation.version}`
}

function resolveSchemaTypeName(
  ref: string,
  schemasById: ReadonlyMap<string, GeneratedSchemaDefinition>,
  diagnostics: string[],
  role: 'input' | 'output',
  operationId: string,
  typingImports: Set<string>,
): string {
  const resolved = schemasById.get(ref)
  if (!resolved) {
    diagnostics.push(`operation "${operationId}" ${role}SchemaRef "${ref}" does not resolve to a known schema; using "Any"`)
    typingImports.add('Any')
    return 'Any'
  }
  return resolved.typeName
}

function renderCodeLiteralType(codes: readonly string[], typingImports: Set<string>): string {
  const unique = uniqueSorted([...codes])
  if (unique.length === 0) {
    typingImports.add('Never')
    return 'Never'
  }
  typingImports.add('Literal')
  return `Literal[${unique.map((code) => JSON.stringify(code)).join(', ')}]`
}

/**
 * Plans the generated Python operation-protocols module: one `Protocol`
 * class plus a typed-outcome `TypeAlias` per frozen `OperationContract`,
 * mirroring `contracts.ts`'s TypeScript operation-interface planning but
 * against the actual `engineering_ui_capabilities_runtime.core.Operation`
 * shape (`execute(self, input, context) -> Outcome`). Pure and
 * order-independent.
 */
export function planPythonProtocols(input: PythonProtocolsGenerationInput): PythonProtocolsGenerationResult {
  const diagnostics: string[] = []
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME
  const schemas = sortByKey([...input.schemas], (schema) => schema.schemaId)
  const schemasById = new Map(schemas.map((schema) => [schema.schemaId, schema]))
  const operations = sortByKey([...input.operations], operationSortKey)

  const typingImports = new Set<string>(['Protocol', 'TypeAlias', 'Union'])
  const modelNames = new Set<string>()

  const operationSections = operations.map((operation) => {
    const baseName = operationTypeBaseName(operation)
    const inputTypeName = resolveSchemaTypeName(operation.inputSchemaRef, schemasById, diagnostics, 'input', operation.operationId, typingImports)
    const successTypeName = resolveSchemaTypeName(operation.outputSchemaRef, schemasById, diagnostics, 'output', operation.operationId, typingImports)
    if (schemasById.has(operation.inputSchemaRef)) modelNames.add(inputTypeName)
    if (schemasById.has(operation.outputSchemaRef)) modelNames.add(successTypeName)
    const domainRejectionType = renderCodeLiteralType(operation.domainRejections, typingImports)
    const technicalErrorType = renderCodeLiteralType(operation.technicalErrors, typingImports)
    typingImports.add('Literal')
    typingImports.add('Any')
    const codeLiteral = JSON.stringify(operation.operationId)

    return [
      `# ${operation.operationId} v${operation.version} (${operation.behavior})`,
      `${baseName}Input: TypeAlias = ${inputTypeName}`,
      `${baseName}Success: TypeAlias = ${successTypeName}`,
      `${baseName}DomainRejectionCode: TypeAlias = ${domainRejectionType}`,
      `${baseName}TechnicalErrorCode: TypeAlias = ${technicalErrorType}`,
      `${baseName}Outcome: TypeAlias = Union[Success[${baseName}Success], Rejected[Any], Failed, Cancelled, TimedOut]`,
      `class ${baseName}Operation(Protocol):`,
      `    code: Literal[${codeLiteral}]`,
      '',
      `    def execute(self, input: ${baseName}Input, context: Context) -> ${baseName}Outcome: ...`,
    ].join('\n')
  })

  const modelsModuleSpecifier = pythonModuleSpecifierFromPath(input.modelsFilePath)
  const importDecls: PythonImportDeclarationInput[] = [
    { moduleSpecifier: `${runtimePackageName}.core`, names: ['Cancelled', 'Context', 'Failed', 'Rejected', 'Success', 'TimedOut'] },
    { moduleSpecifier: 'typing', names: [...typingImports].sort(ordinalCompare) },
    ...(modelNames.size > 0 ? [{ moduleSpecifier: modelsModuleSpecifier, names: [...modelNames].sort(ordinalCompare) }] : []),
  ]
  const importBlock = renderPythonImportBlock(importDecls)

  const header = generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: operations.map((operation) => `${operation.operationId}@${operation.version}`),
  })

  const file: GeneratedVirtualFile = {
    path: input.protocolsFilePath,
    contents: renderVirtualFileBody([header, importBlock, ...operationSections]),
  }

  return { file, diagnostics: uniqueSorted(diagnostics) }
}

// ---------------------------------------------------------------------------
// Group B — Python inbound adapters (CAP-CONTRACT-028)
// ---------------------------------------------------------------------------

export type PythonInboundOperationTypeNames = {
  /** Repo-relative `.py` path exporting the named Pydantic models below (`planPythonModels`'s `modelsFilePath`). */
  readonly modelsFilePath?: string
  readonly inputTypeName?: string
  readonly successTypeName?: string
  readonly domainRejectionTypeName?: string
  readonly technicalFailureTypeName?: string
}

export type PythonInboundAdapterGenerationInput = {
  readonly binding: InboundBinding
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  /** Repo-relative `.py` path for the generated inbound-adapter module. */
  readonly filePath: string
  /** Repo-relative `.py` path exporting the composition-root-resolved `Operation` instance this binding dispatches to. */
  readonly operationModulePath: string
  /** Named export of the resolved `Operation` instance in `operationModulePath`. Defaults to `"operation"`. */
  readonly operationExportName?: string
  readonly runtimePackageName?: string
  readonly operationTypes?: PythonInboundOperationTypeNames
  /** Runtime evidence metadata emitted only after this generated route dispatches. */
  readonly observedPath?: {
    readonly inboundAdapter: string
    readonly compositionRoot: string
    readonly operation: string
    readonly outboundAdapters: readonly string[]
    readonly workflow?: string
  }
}

export type PythonInboundAdapterGenerationResult = {
  readonly file: GeneratedVirtualFile
  readonly diagnostics: readonly string[]
}

const DEFAULT_OPERATION_EXPORT_NAME = 'operation'

function resolveOperationImport(input: PythonInboundAdapterGenerationInput): PythonImportDeclarationInput {
  const exportName = input.operationExportName ?? DEFAULT_OPERATION_EXPORT_NAME
  const moduleSpecifier = pythonModuleSpecifierFromPath(input.operationModulePath)
  const name = exportName === DEFAULT_OPERATION_EXPORT_NAME ? 'operation' : `${exportName} as operation`
  return { moduleSpecifier, names: [name] }
}

type ResolvedPythonOperationTypes = {
  inputType: string
  hasInputModel: boolean
  typeImports: string[]
  typeImportSpecifier?: string
}

function resolveOperationTypes(operationTypes: PythonInboundOperationTypeNames | undefined): ResolvedPythonOperationTypes {
  const inputType = operationTypes?.inputTypeName ?? 'Any'
  const typeImports = uniqueSorted(
    [
      operationTypes?.inputTypeName,
      operationTypes?.successTypeName,
      operationTypes?.domainRejectionTypeName,
      operationTypes?.technicalFailureTypeName,
    ].filter((name): name is string => Boolean(name)),
  )
  const typeImportSpecifier =
    typeImports.length > 0 && operationTypes?.modelsFilePath ? pythonModuleSpecifierFromPath(operationTypes.modelsFilePath) : undefined
  return { inputType, hasInputModel: Boolean(operationTypes?.inputTypeName), typeImports, typeImportSpecifier }
}

function buildHeader(input: PythonInboundAdapterGenerationInput): string {
  return generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: [
      `${input.binding.bindingId}@${input.binding.version}`,
      `${input.binding.operationId}@${input.binding.operationVersion}`,
    ],
  })
}

function pythonInputSchemaExpression(types: ResolvedPythonOperationTypes, diagnostics: string[]): string {
  if (types.hasInputModel) return `${types.inputType}.model_json_schema()`
  diagnostics.push('operationTypes.inputTypeName was not supplied; using an empty "{}" input_schema placeholder (no business-logic schema is invented here)')
  return '{}'
}

function planHttpAdapter(input: PythonInboundAdapterGenerationInput, binding: Extract<InboundBinding, { kind: 'http' }>): PythonInboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME
  const operationImport = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes)
  const diagnostics: string[] = []
  const inputSchemaExpr = pythonInputSchemaExpression(types, diagnostics)
  const functionName = `register_${toSnakeCase(binding.bindingId)}_route`

  // Only the input type is actually referenced (for `.model_json_schema()`),
  // so — unlike `resolveOperationTypes`'s all-four import bag reused by the
  // other binding kinds below — the http adapter imports just that one name.
  const importDecls: PythonImportDeclarationInput[] = [
    { moduleSpecifier: `${runtimePackageName}.http.host`, names: ['HttpOperationHost'] },
    operationImport,
  ]
  if (types.hasInputModel && input.operationTypes?.modelsFilePath) {
    importDecls.push({ moduleSpecifier: pythonModuleSpecifierFromPath(input.operationTypes.modelsFilePath), names: [types.inputType] })
  }
  const importBlock = renderPythonImportBlock(importDecls)

  const body = [
    `def ${functionName}(host: HttpOperationHost) -> None:`,
    `    """exposure: ${binding.exposure}; operation: ${binding.operationId}@${binding.operationVersion}"""`,
    '    host.add_operation(',
    `        path=${JSON.stringify(binding.path)},`,
    '        operation=operation,',
    `        input_schema=${inputSchemaExpr},`,
    `        method=${JSON.stringify(binding.method)},`,
    `        operation_id=${JSON.stringify(binding.operationId)},`,
    ...(input.observedPath ? [`        observed_path=${JSON.stringify(input.observedPath)},`] : []),
    '    )',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics,
  }
}

function planCliAdapter(input: PythonInboundAdapterGenerationInput, binding: Extract<InboundBinding, { kind: 'cli' }>): PythonInboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME
  const operationImport = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes)
  const diagnostics: string[] = []
  const inputSchemaExpr = pythonInputSchemaExpression(types, diagnostics)
  const functionName = `build_${toSnakeCase(binding.bindingId)}_command`

  const importDecls: PythonImportDeclarationInput[] = [
    { moduleSpecifier: 'argparse', names: [] },
    { moduleSpecifier: 'typing', names: ['Any', 'Optional'] },
    { moduleSpecifier: `${runtimePackageName}.cli.host`, names: ['CliCommand'] },
    operationImport,
  ]
  if (types.typeImportSpecifier) importDecls.push({ moduleSpecifier: types.typeImportSpecifier, names: types.typeImports })

  // argumentMappings order is caller-intended positional order and is preserved verbatim (never reordered).
  const argumentMappings = binding.argumentMappings ?? []
  const argNames = argumentMappings.map((mapping) => toSnakeCase(mapping.to))

  const addArgumentsLines =
    argumentMappings.length > 0
      ? argNames.map((argName, index) => `    parser.add_argument(${JSON.stringify(argName)})  # from argv position ${index} ("${argumentMappings[index]!.from}")`)
      : ['    parser.add_argument("input_json")  # a single JSON-encoded argument']

  const buildInputLines =
    argumentMappings.length > 0
      ? [
          '    return {',
          ...argNames.map((argName) => `        ${JSON.stringify(argName)}: getattr(args, ${JSON.stringify(argName)}),`),
          '    }',
        ]
      : ['    return json.loads(args.input_json)']

  if (argumentMappings.length === 0) {
    importDecls.unshift({ moduleSpecifier: 'json', names: [] })
  }
  const finalImportBlock = renderPythonImportBlock(importDecls)

  const body = [
    'def _add_arguments(parser: argparse.ArgumentParser) -> None:',
    ...addArgumentsLines,
    '',
    '',
    'def _build_input(args: argparse.Namespace, stdin_text: Optional[str]) -> Any:',
    ...buildInputLines,
    '',
    '',
    `def ${functionName}() -> CliCommand:`,
    `    """exposure: ${binding.exposure}; operation: ${binding.operationId}@${binding.operationVersion}"""`,
    '    return CliCommand(',
    `        name=${JSON.stringify(binding.command)},`,
    '        operation=operation,',
    `        input_schema=${inputSchemaExpr},`,
    '        build_input=_build_input,',
    '        add_arguments=_add_arguments,',
    '    )',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), finalImportBlock, body]) },
    diagnostics,
  }
}

const PYTHON_OVERLAP_POLICY_MAP: Record<string, string> = { skip: 'SKIP', queue: 'QUEUE', 'allow-concurrent': 'ALLOW_CONCURRENT' }
const PYTHON_MISFIRE_POLICY_MAP: Record<string, string> = { skip: 'SKIP', 'run-once': 'RUN_ONCE', 'run-all': 'RUN_ALL' }

function planScheduleAdapter(
  input: PythonInboundAdapterGenerationInput,
  binding: Extract<InboundBinding, { kind: 'schedule' }>,
): PythonInboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME
  const operationImport = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes)
  const diagnostics: string[] = []
  const inputSchemaExpr = pythonInputSchemaExpression(types, diagnostics)
  const functionName = `build_${toSnakeCase(binding.bindingId)}_job`

  // CAP-CONTRACT-028 policy values map 1:1 to the reconciled Python worker enum
  // MEMBER NAMES (SCHED-ENUM); each member's `.value` equals the contract string. No loss.
  const overlapPolicy = PYTHON_OVERLAP_POLICY_MAP[binding.overlapPolicy] ?? 'SKIP'
  const misfirePolicy = PYTHON_MISFIRE_POLICY_MAP[binding.misfirePolicy] ?? 'SKIP'

  const importDecls: PythonImportDeclarationInput[] = [
    { moduleSpecifier: 'typing', names: ['Optional'] },
    { moduleSpecifier: `${runtimePackageName}.core`, names: ['Container'] },
    { moduleSpecifier: `${runtimePackageName}.worker.cron`, names: ['CronSchedule'] },
    { moduleSpecifier: `${runtimePackageName}.worker.scheduler`, names: ['CronJob', 'MisfirePolicy', 'OverlapPolicy'] },
    operationImport,
  ]
  if (types.typeImportSpecifier) importDecls.push({ moduleSpecifier: types.typeImportSpecifier, names: types.typeImports })
  const importBlock = renderPythonImportBlock(importDecls)

  const body = [
    `def ${functionName}(container: Optional[Container] = None) -> CronJob:`,
    `    """exposure: ${binding.exposure}; operation: ${binding.operationId}@${binding.operationVersion}"""`,
    '    return CronJob(',
    `        name=${JSON.stringify(binding.bindingId)},`,
    `        schedule=CronSchedule.parse(${JSON.stringify(binding.cronExpression)}, ${JSON.stringify(binding.timezone)}),`,
    '        operation=operation,',
    `        input_schema=${inputSchemaExpr},`,
    `        overlap_policy=OverlapPolicy.${overlapPolicy},`,
    `        misfire_policy=MisfirePolicy.${misfirePolicy},`,
    '        container=container,',
    '    )',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics,
  }
}

function planEmbeddedLibraryAdapter(
  input: PythonInboundAdapterGenerationInput,
  binding: Extract<InboundBinding, { kind: 'embedded-library' }>,
): PythonInboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_PYTHON_RUNTIME_PACKAGE_NAME
  const operationImport = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes)
  const diagnostics: string[] = []
  const inputSchemaExpr = pythonInputSchemaExpression(types, diagnostics)
  const functionName = sanitizePythonIdentifier(toSnakeCase(binding.exportedCallable))

  const importDecls: PythonImportDeclarationInput[] = [
    { moduleSpecifier: `${runtimePackageName}.core`, names: ['AnyOutcome', 'Context', 'dispatch'] },
    operationImport,
  ]
  if (types.typeImportSpecifier) importDecls.push({ moduleSpecifier: types.typeImportSpecifier, names: types.typeImports })
  const importBlock = renderPythonImportBlock(importDecls)

  const body = [
    `def ${functionName}(input: ${types.inputType}, context: Context) -> AnyOutcome:`,
    `    """exposure: ${binding.exposure}; reason: ${JSON.stringify(binding.reason)}"""`,
    `    return dispatch(operation, input, context, input_schema=${inputSchemaExpr})`,
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics,
  }
}

function planUiAdapter(input: PythonInboundAdapterGenerationInput, binding: Extract<InboundBinding, { kind: 'ui' }>): PythonInboundAdapterGenerationResult {
  const diagnostics: string[] = [
    `binding "${binding.bindingId}": Python has no UI target; emitting an embedded-library/HTTP-client note only (CAP-ERA-001 §10.3 "React UI" — the browser/TypeScript client reaches this deployable's operation through the generated OpenAPI 3.1 HTTP boundary or an embedded-library export, not Python-generated UI code)`,
  ]

  const note = [
    '"""',
    `Python has no UI target for inbound binding ${JSON.stringify(binding.bindingId)}`,
    `(transport: ${binding.transport}; trigger: ${binding.trigger}; exposure: ${binding.exposure}).`,
    '',
    `Operation ${binding.operationId}@${binding.operationVersion} is realized for a UI consumer via:`,
    '  - the browser/TypeScript client (see the WP3B-gen generated `ui` adapter) calling',
    '    this deployable through the generated OpenAPI 3.1 HTTP boundary (a sibling `http`',
    '    inbound binding), or',
    '  - an `embedded-library` export, for an embedded (non-network) Python-hosted UI shell.',
    '"""',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), note]) },
    diagnostics,
  }
}

/**
 * Plans the generated Python inbound-adapter source for one
 * `InboundBinding`, dispatching on its `kind` discriminant. Pure and
 * order-independent.
 */
export function planPythonInboundAdapter(input: PythonInboundAdapterGenerationInput): PythonInboundAdapterGenerationResult {
  const binding = input.binding
  switch (binding.kind) {
    case 'http':
      return planHttpAdapter(input, binding)
    case 'cli':
      return planCliAdapter(input, binding)
    case 'schedule':
      return planScheduleAdapter(input, binding)
    case 'embedded-library':
      return planEmbeddedLibraryAdapter(input, binding)
    case 'ui':
      return planUiAdapter(input, binding)
  }
}

// ---------------------------------------------------------------------------
// Group C — OpenAPI 3.1 emission
// ---------------------------------------------------------------------------

/** A minimal JSON-value shape sufficient for a deterministic OpenAPI 3.1 document. */
export type JsonSchemaValue = Record<string, unknown>

export type OpenApiGenerationInput = {
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  readonly title: string
  /** OpenAPI `info.version` (independent of any single operation's version). */
  readonly apiVersion: string
  readonly schemas: readonly GeneratedSchemaDefinition[]
  readonly operations: readonly OperationContract[]
  readonly httpBindings: readonly HttpInboundBinding[]
  /** Repo-relative path for the generated OpenAPI JSON document. */
  readonly documentFilePath: string
}

export type OpenApiGenerationResult = {
  /** The parsed OpenAPI 3.1 document (before JSON serialization); useful for callers that want to inspect/merge it. */
  readonly document: JsonSchemaValue
  readonly file: GeneratedVirtualFile
  readonly diagnostics: readonly string[]
}

function schemaNodeToJsonSchema(
  node: GeneratedSchemaNode,
  schemasById: ReadonlyMap<string, GeneratedSchemaDefinition>,
  diagnostics: string[],
): JsonSchemaValue {
  switch (node.kind) {
    case 'string': {
      const values = uniqueSorted([...(node.enumValues ?? [])])
      return values.length > 0 ? { type: 'string', enum: values } : { type: 'string' }
    }
    case 'integer':
      return { type: 'integer' }
    case 'number':
      return { type: 'number' }
    case 'boolean':
      return { type: 'boolean' }
    case 'null':
      return { type: 'null' }
    case 'unknown':
      return {}
    case 'array':
      return { type: 'array', items: schemaNodeToJsonSchema(node.items, schemasById, diagnostics) }
    case 'object': {
      const properties = dedupeAndSortProperties(node.properties)
      const propertiesObject: Record<string, JsonSchemaValue> = {}
      for (const property of properties) {
        propertiesObject[property.name] = schemaNodeToJsonSchema(property.schema, schemasById, diagnostics)
      }
      const required = properties.filter((property) => property.required).map((property) => property.name)
      const result: JsonSchemaValue = { type: 'object', properties: propertiesObject, additionalProperties: false }
      if (required.length > 0) result.required = required
      return result
    }
    case 'ref': {
      const resolved = schemasById.get(node.schemaId)
      if (!resolved) {
        diagnostics.push(`unresolved schema reference "${node.schemaId}"; substituting an unconstrained schema`)
        return {}
      }
      return { $ref: `#/components/schemas/${resolved.typeName}` }
    }
    case 'union': {
      const options = node.options.map((option) => schemaNodeToJsonSchema(option, schemasById, diagnostics))
      const unique = sortByKey(
        [...new Map(options.map((option) => [JSON.stringify(option), option])).values()],
        (option) => JSON.stringify(option),
      )
      return unique.length > 0 ? { anyOf: unique } : {}
    }
  }
}

function httpBindingSortKey(binding: HttpInboundBinding): string {
  return `${binding.path} ${binding.method} ${binding.bindingId}`
}

/**
 * Plans a deterministic OpenAPI 3.1 document (JSON) from canonical schemas,
 * frozen `OperationContract`s, and their `http` `InboundBinding`s, so a
 * browser/TS client and the Python FastAPI host share one boundary (§5.3,
 * §10.3). Pure and order-independent.
 */
export function planOpenApiDocument(input: OpenApiGenerationInput): OpenApiGenerationResult {
  const diagnostics: string[] = []
  const schemas = sortByKey([...input.schemas], (schema) => schema.schemaId)
  const schemasById = new Map(schemas.map((schema) => [schema.schemaId, schema]))
  const operationsById = new Map(input.operations.map((operation) => [`${operation.operationId}@${operation.version}`, operation]))

  const componentSchemas: Record<string, JsonSchemaValue> = {}
  for (const schema of sortByKey([...schemas], (schema) => schema.typeName)) {
    componentSchemas[schema.typeName] = schemaNodeToJsonSchema(schema.schema, schemasById, diagnostics)
  }

  const paths: Record<string, Record<string, JsonSchemaValue>> = {}
  const httpBindings = sortByKey([...input.httpBindings], httpBindingSortKey)
  for (const binding of httpBindings) {
    const operation = operationsById.get(`${binding.operationId}@${binding.operationVersion}`)
    if (!operation) {
      diagnostics.push(
        `http binding "${binding.bindingId}" routes to operation "${binding.operationId}@${binding.operationVersion}", which is not present in the supplied operations list; skipping its OpenAPI path`,
      )
      continue
    }
    const inputSchema = schemasById.get(operation.inputSchemaRef)
    const outputSchema = schemasById.get(operation.outputSchemaRef)
    const requestSchema: JsonSchemaValue = inputSchema ? { $ref: `#/components/schemas/${inputSchema.typeName}` } : {}
    const successSchema: JsonSchemaValue = outputSchema ? { $ref: `#/components/schemas/${outputSchema.typeName}` } : {}
    if (!inputSchema) diagnostics.push(`operation "${operation.operationId}" inputSchemaRef "${operation.inputSchemaRef}" does not resolve; using an unconstrained request schema`)
    if (!outputSchema) diagnostics.push(`operation "${operation.operationId}" outputSchemaRef "${operation.outputSchemaRef}" does not resolve; using an unconstrained response schema`)

    const pathItem = paths[binding.path] ?? {}
    pathItem[binding.method.toLowerCase()] = {
      operationId: `${operation.operationId.replace(/[^0-9A-Za-z]+/g, '_')}_${operation.version.replace(/[^0-9A-Za-z]+/g, '_')}`,
      summary: `${operation.operationId} v${operation.version} (${operation.behavior})`,
      requestBody: { required: true, content: { 'application/json': { schema: requestSchema } } },
      responses: {
        '200': { description: 'success', content: { 'application/json': { schema: successSchema } } },
        default: {
          description: 'domain rejection, technical failure, cancellation, or timed-out outcome',
          content: { 'application/json': { schema: {} } },
        },
      },
    }
    paths[binding.path] = pathItem
  }

  const header = generatedPythonFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: [
      ...schemas.map((schema) => schema.schemaId),
      ...input.operations.map((operation) => `${operation.operationId}@${operation.version}`),
    ],
  })

  const document: JsonSchemaValue = {
    openapi: '3.1.0',
    info: {
      title: input.title,
      version: input.apiVersion,
      description: header,
    },
    paths,
    components: { schemas: componentSchemas },
  }

  const file: GeneratedVirtualFile = {
    path: input.documentFilePath,
    contents: `${JSON.stringify(document, null, 2)}\n`,
  }

  return { document, file, diagnostics: uniqueSorted(diagnostics) }
}

// Re-exported so tests/other consumers never need to import an identifier
// naming helper straight from `python-emit.ts` for basic validity checks.
export { isValidPythonIdentifier }
