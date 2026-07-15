/**
 * Canonical schema and language-type planning (CAP-ERA-001 §9 CAP-CONTRACT-004,
 * §11.1 `contracts.ts`, §7.2 generated application-local code).
 *
 * Pure: given a frozen `OperationContract` (CAP-CONTRACT-004) list and the
 * canonical JSON-Schema-shaped type descriptions its `inputSchemaRef` /
 * `outputSchemaRef` resolve to, plans deterministic generated TypeScript
 * source — type declarations, operation interfaces, and typed-outcome
 * aliases — targeting `@engineering-ui-kit/capabilities-runtime`. Given
 * identical inputs, output is byte-identical regardless of input array
 * ordering. Never imports `node:*`; never calls
 * `Date.now()`/`Math.random()`/`crypto`.
 */

import type { OperationContract } from '../types.js'
import { sortByKey, uniqueSorted } from './paths.js'
import {
  DEFAULT_RUNTIME_PACKAGE_NAME,
  generatedFileHeader,
  relativeModuleSpecifier,
  renderImportBlock,
  renderPropertyKey,
  renderVirtualFileBody,
  toPascalCase,
  type GeneratedVirtualFile,
} from './typescript.js'

/**
 * A minimal, deterministic JSON-Schema-shaped node — sufficient to plan a
 * generated TypeScript type declaration. This is the generator's own
 * canonical intermediate form, not a full JSON Schema implementation: a
 * caller (e.g. a JSON Schema 2020-12 document loader) reduces the schemas it
 * loads into this shape before calling `planContractTypes`.
 */
export type GeneratedSchemaNode =
  | { readonly kind: 'string'; readonly enumValues?: readonly string[] }
  | { readonly kind: 'number' | 'integer' | 'boolean' | 'null' | 'unknown' }
  | { readonly kind: 'array'; readonly items: GeneratedSchemaNode }
  | {
      readonly kind: 'object'
      readonly properties: readonly { readonly name: string; readonly schema: GeneratedSchemaNode; readonly required?: boolean }[]
    }
  | { readonly kind: 'ref'; readonly schemaId: string }
  | { readonly kind: 'union'; readonly options: readonly GeneratedSchemaNode[] }

/** One canonical named schema; `schemaId` is matched against `OperationContract.inputSchemaRef`/`outputSchemaRef`. */
export type GeneratedSchemaDefinition = {
  readonly schemaId: string
  /** Exported TypeScript type/interface name. */
  readonly typeName: string
  readonly schema: GeneratedSchemaNode
}

export type ContractsGenerationInput = {
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  readonly schemas: readonly GeneratedSchemaDefinition[]
  readonly operations: readonly OperationContract[]
  /** Repo-relative path for the generated type-declarations file. */
  readonly typesFilePath: string
  /** Repo-relative path for the generated operation-interfaces file. */
  readonly operationsFilePath: string
  readonly runtimePackageName?: string
}

export type ContractsGenerationResult = {
  readonly typesFile: GeneratedVirtualFile
  readonly operationsFile: GeneratedVirtualFile
  /** Non-fatal planning notes, e.g. an operation referencing an unresolved schema id. */
  readonly diagnostics: readonly string[]
}

function dedupeAndSortProperties(
  properties: readonly { readonly name: string; readonly schema: GeneratedSchemaNode; readonly required?: boolean }[],
): { name: string; schema: GeneratedSchemaNode; required: boolean }[] {
  const byName = new Map<string, { name: string; schema: GeneratedSchemaNode; required: boolean }>()
  for (const property of properties) {
    byName.set(property.name, { name: property.name, schema: property.schema, required: property.required ?? false })
  }
  return sortByKey([...byName.values()], (entry) => entry.name)
}

function renderInlineType(
  node: GeneratedSchemaNode,
  schemasById: ReadonlyMap<string, GeneratedSchemaDefinition>,
  diagnostics: string[],
): string {
  switch (node.kind) {
    case 'string': {
      const values = uniqueSorted([...(node.enumValues ?? [])])
      return values.length > 0 ? values.map((value) => JSON.stringify(value)).join(' | ') : 'string'
    }
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'unknown':
      return 'unknown'
    case 'array':
      return `(${renderInlineType(node.items, schemasById, diagnostics)})[]`
    case 'object': {
      const properties = dedupeAndSortProperties(node.properties)
      if (properties.length === 0) return 'Record<string, never>'
      const members = properties.map(
        (property) =>
          `${renderPropertyKey(property.name)}${property.required ? '' : '?'}: ${renderInlineType(property.schema, schemasById, diagnostics)}`,
      )
      return `{ ${members.join('; ')} }`
    }
    case 'ref': {
      const resolved = schemasById.get(node.schemaId)
      if (!resolved) {
        diagnostics.push(`unresolved schema reference "${node.schemaId}"; substituting "unknown"`)
        return 'unknown'
      }
      return resolved.typeName
    }
    case 'union': {
      const rendered = node.options.map((option) => renderInlineType(option, schemasById, diagnostics))
      const unique = [...new Set(rendered)].sort()
      return unique.length > 0 ? unique.join(' | ') : 'never'
    }
  }
}

function renderSchemaDeclaration(
  definition: GeneratedSchemaDefinition,
  schemasById: ReadonlyMap<string, GeneratedSchemaDefinition>,
  diagnostics: string[],
): string {
  if (definition.schema.kind === 'object') {
    const properties = dedupeAndSortProperties(definition.schema.properties)
    if (properties.length === 0) {
      return `export type ${definition.typeName} = Record<string, never>`
    }
    const members = properties
      .map(
        (property) =>
          `  ${renderPropertyKey(property.name)}${property.required ? '' : '?'}: ${renderInlineType(property.schema, schemasById, diagnostics)}`,
      )
      .join('\n')
    return `export interface ${definition.typeName} {\n${members}\n}`
  }
  return `export type ${definition.typeName} = ${renderInlineType(definition.schema, schemasById, diagnostics)}`
}

/** Deterministic exported type name for one `OperationContract` (operationId + version), collision-safe across versions. */
export function operationTypeBaseName(operation: Pick<OperationContract, 'operationId' | 'version'>): string {
  const versionSuffix = operation.version.replace(/[^0-9A-Za-z]+/g, '_')
  return `${toPascalCase(operation.operationId)}V${versionSuffix}`
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
): string {
  const resolved = schemasById.get(ref)
  if (!resolved) {
    diagnostics.push(`operation "${operationId}" ${role}SchemaRef "${ref}" does not resolve to a known schema; using "unknown"`)
    return 'unknown'
  }
  return resolved.typeName
}

function renderCodeUnionType(codes: readonly string[]): string {
  const unique = uniqueSorted([...codes])
  return unique.length > 0 ? unique.map((code) => JSON.stringify(code)).join(' | ') : 'never'
}

/**
 * Plans the generated type-declarations file and the generated
 * operation-interfaces file from canonical schemas and frozen
 * `OperationContract` records. Pure and order-independent: identical inputs
 * (in any array order) always produce byte-identical `GeneratedVirtualFile`s.
 */
export function planContractTypes(input: ContractsGenerationInput): ContractsGenerationResult {
  const diagnostics: string[] = []
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME

  const schemas = sortByKey([...input.schemas], (schema) => schema.schemaId)
  const schemasById = new Map(schemas.map((schema) => [schema.schemaId, schema]))
  const sourceContractHashes = schemas.map((schema) => schema.schemaId)

  const header = generatedFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes,
  })

  const typeDeclarations = schemas.map((schema) => renderSchemaDeclaration(schema, schemasById, diagnostics))
  const typesFile: GeneratedVirtualFile = {
    path: input.typesFilePath,
    contents: renderVirtualFileBody([header, ...typeDeclarations]),
  }

  const operations = sortByKey([...input.operations], operationSortKey)
  const operationSections = operations.map((operation) => {
    const baseName = operationTypeBaseName(operation)
    const inputTypeName = resolveSchemaTypeName(operation.inputSchemaRef, schemasById, diagnostics, 'input', operation.operationId)
    const successTypeName = resolveSchemaTypeName(operation.outputSchemaRef, schemasById, diagnostics, 'output', operation.operationId)
    const domainRejectionCodeType = renderCodeUnionType(operation.domainRejections)
    const technicalErrorCodeType = renderCodeUnionType(operation.technicalErrors)
    const codeLiteral = JSON.stringify(operation.operationId)

    return [
      `// ${operation.operationId} v${operation.version} (${operation.behavior})`,
      `export type ${baseName}Input = ${inputTypeName}`,
      `export type ${baseName}Success = ${successTypeName}`,
      `export type ${baseName}DomainRejectionCode = ${domainRejectionCodeType}`,
      `export type ${baseName}TechnicalErrorCode = ${technicalErrorCodeType}`,
      `export type ${baseName}Outcome = Outcome<${baseName}Success, ${baseName}DomainRejectionCode, ${baseName}TechnicalErrorCode>`,
      `export interface ${baseName}Operation extends Operation<${baseName}Input, ${baseName}Success, ${baseName}DomainRejectionCode, ${baseName}TechnicalErrorCode> {`,
      `  readonly code: ${codeLiteral}`,
      '}',
    ].join('\n')
  })

  const usesTypesImport = operations.some((operation) => {
    const inputResolved = schemasById.has(operation.inputSchemaRef)
    const outputResolved = schemasById.has(operation.outputSchemaRef)
    return inputResolved || outputResolved
  })
  const typeImportNames = new Set<string>()
  for (const operation of operations) {
    const inputSchema = schemasById.get(operation.inputSchemaRef)
    const outputSchema = schemasById.get(operation.outputSchemaRef)
    if (inputSchema) typeImportNames.add(inputSchema.typeName)
    if (outputSchema) typeImportNames.add(outputSchema.typeName)
  }

  const operationsImportBlock = renderImportBlock([
    { moduleSpecifier: runtimePackageName, namedImports: ['Operation', 'Outcome'], typeOnly: true },
    ...(usesTypesImport
      ? [
          {
            moduleSpecifier: relativeModuleSpecifier(input.operationsFilePath, input.typesFilePath),
            namedImports: [...typeImportNames].sort(),
            typeOnly: true,
          },
        ]
      : []),
  ])

  const operationsFileHeader = generatedFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: operations.map((operation) => `${operation.operationId}@${operation.version}`),
  })

  const operationsFile: GeneratedVirtualFile = {
    path: input.operationsFilePath,
    contents: renderVirtualFileBody([operationsFileHeader, operationsImportBlock, ...operationSections]),
  }

  return { typesFile, operationsFile, diagnostics: uniqueSorted(diagnostics) }
}
