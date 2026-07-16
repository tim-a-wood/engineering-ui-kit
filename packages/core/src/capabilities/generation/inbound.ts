/**
 * Inbound adapter source planning (CAP-ERA-001 §9 CAP-CONTRACT-028, §11.1
 * `inbound.ts`, §10.3 host behavior).
 *
 * Pure: given one `InboundBinding` (discriminated on `kind`), plans the
 * generated inbound-adapter TypeScript source for that kind — `ui`
 * (framework-neutral client/controller wiring), `http` (route -> dispatch),
 * `cli` (command -> dispatch), `schedule` (cron -> dispatch), and
 * `embedded-library` (exported callable) — wired to the composition root's
 * resolved operation instance and to
 * `@engineering-ui-kit/capabilities-runtime`'s host foundations. Given
 * identical inputs, output is byte-identical regardless of input array
 * ordering. Never imports `node:*`; never calls
 * `Date.now()`/`Math.random()`/`crypto`.
 *
 * Depth note: `ui` emits a transport-agnostic client wrapper only. Richer
 * React hook/controller and Electron renderer/preload/main IPC generation
 * are a later increment (CAP-ERA-001 WP3B executable slices / WP7); see the
 * WP3B-gen handoff.
 */

import type { InboundBinding } from '../types.js'
import { uniqueSorted } from './paths.js'
import {
  DEFAULT_RUNTIME_PACKAGE_NAME,
  generatedFileHeader,
  relativeModuleSpecifier,
  renderImportBlock,
  renderPropertyKey,
  renderVirtualFileBody,
  sanitizeIdentifier,
  toCamelCase,
  toPascalCase,
  type GeneratedVirtualFile,
  type ImportDeclarationInput,
} from './typescript.js'

export type InboundOperationTypeNames = {
  /** Repo-relative module path exporting the named types below (from `contracts.ts`'s generated types file). */
  readonly typesModulePath?: string
  readonly inputTypeName?: string
  readonly successTypeName?: string
  readonly domainRejectionTypeName?: string
  readonly technicalFailureTypeName?: string
}

export type InboundAdapterGenerationInput = {
  readonly binding: InboundBinding
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  /** Repo-relative path for the generated inbound-adapter module. */
  readonly filePath: string
  /** Repo-relative module path exporting the composition-root-resolved `Operation` instance this binding dispatches to. */
  readonly operationModulePath: string
  /** Named export of the resolved `Operation` instance in `operationModulePath`. Defaults to `"operation"`. */
  readonly operationExportName?: string
  readonly runtimePackageName?: string
  readonly operationTypes?: InboundOperationTypeNames
  /** Runtime evidence metadata emitted only after this generated route dispatches. */
  readonly observedPath?: {
    readonly inboundAdapter: string
    readonly compositionRoot: string
    readonly operation: string
    readonly outboundAdapters: readonly string[]
    readonly workflow?: string
  }
}

export type InboundAdapterGenerationResult = {
  readonly file: GeneratedVirtualFile
  readonly diagnostics: readonly string[]
}

const DEFAULT_OPERATION_EXPORT_NAME = 'operation'

function resolveOperationImport(input: InboundAdapterGenerationInput): { importDecl: { moduleSpecifier: string; namedImports: string[] } } {
  const exportName = input.operationExportName ?? DEFAULT_OPERATION_EXPORT_NAME
  const specifier = relativeModuleSpecifier(input.filePath, input.operationModulePath)
  const namedImports = exportName === DEFAULT_OPERATION_EXPORT_NAME ? ['operation'] : [`${exportName} as operation`]
  return { importDecl: { moduleSpecifier: specifier, namedImports } }
}

type ResolvedOperationTypes = {
  inputType: string
  successType: string
  domainRejectionType: string
  technicalFailureType: string
  typeImports: string[]
  typeImportSpecifier?: string
}

function resolveOperationTypes(operationTypes: InboundOperationTypeNames | undefined, filePath: string): ResolvedOperationTypes {
  const inputType = operationTypes?.inputTypeName ?? 'unknown'
  const successType = operationTypes?.successTypeName ?? 'unknown'
  const domainRejectionType = operationTypes?.domainRejectionTypeName ?? 'never'
  const technicalFailureType = operationTypes?.technicalFailureTypeName ?? 'never'
  const typeImports = uniqueSorted(
    [
      operationTypes?.inputTypeName,
      operationTypes?.successTypeName,
      operationTypes?.domainRejectionTypeName,
      operationTypes?.technicalFailureTypeName,
    ].filter((name): name is string => Boolean(name)),
  )
  const typeImportSpecifier =
    typeImports.length > 0 && operationTypes?.typesModulePath ? relativeModuleSpecifier(filePath, operationTypes.typesModulePath) : undefined
  return { inputType, successType, domainRejectionType, technicalFailureType, typeImports, typeImportSpecifier }
}

/**
 * Renders a mechanical (metadata-driven, never business-logic) placeholder
 * object expression from a binding's `inputMappings`: each target field is
 * present with an inline comment naming its declared source, so the
 * generated adapter is structurally complete without inventing domain
 * behavior. An empty `inputMappings` renders `undefined`.
 */
function renderInputMappingExpression(inputMappings: readonly { from: string; to: string }[]): string {
  if (inputMappings.length === 0) return 'undefined'
  const members = inputMappings.map((mapping) => `${renderPropertyKey(mapping.to)}: undefined /* from: ${JSON.stringify(mapping.from)} */`)
  return `{ ${members.join(', ')} }`
}

function buildHeader(input: InboundAdapterGenerationInput): string {
  return generatedFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: [
      `${input.binding.bindingId}@${input.binding.version}`,
      `${input.binding.operationId}@${input.binding.operationVersion}`,
    ],
  })
}

function planHttpAdapter(input: InboundAdapterGenerationInput, binding: Extract<InboundBinding, { kind: 'http' }>): InboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME
  const { importDecl } = resolveOperationImport(input)
  const constName = `${toCamelCase(binding.bindingId)}Route`

  const importBlock = renderImportBlock([
    { moduleSpecifier: `${runtimePackageName}/node`, namedImports: ['HttpRoute'], typeOnly: true },
    { moduleSpecifier: importDecl.moduleSpecifier, namedImports: importDecl.namedImports },
  ])

  const body = [
    `/** exposure: ${binding.exposure}; operation: ${binding.operationId}@${binding.operationVersion} */`,
    `export const ${constName}: HttpRoute = {`,
    `  method: ${JSON.stringify(binding.method)},`,
    `  path: ${JSON.stringify(binding.path)},`,
    '  operation,',
    ...(input.observedPath ? [`  observedPath: ${JSON.stringify(input.observedPath)},`] : []),
    '}',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics: [],
  }
}

function planCliAdapter(input: InboundAdapterGenerationInput, binding: Extract<InboundBinding, { kind: 'cli' }>): InboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME
  const { importDecl } = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes, input.filePath)
  const constName = `${toCamelCase(binding.bindingId)}Command`

  const importDecls: ImportDeclarationInput[] = [
    { moduleSpecifier: `${runtimePackageName}/node`, namedImports: ['CliCommand', 'CliParseError'], typeOnly: true },
    { moduleSpecifier: importDecl.moduleSpecifier, namedImports: importDecl.namedImports },
  ]
  if (types.typeImportSpecifier) {
    importDecls.push({ moduleSpecifier: types.typeImportSpecifier, namedImports: types.typeImports, typeOnly: true })
  }
  const importBlock = renderImportBlock(importDecls)

  // argumentMappings order is caller-intended positional order and is preserved verbatim (never reordered).
  const argumentMappings = binding.argumentMappings ?? []
  const parseArgsBody =
    argumentMappings.length > 0
      ? [
          `    const input = {`,
          ...argumentMappings.map((mapping, index) => `      ${renderPropertyKey(mapping.to)}: args[${index}], // from argv position ${index} ("${mapping.from}")`),
          `    } as ${types.inputType}`,
          '    return { ok: true, input }',
        ].join('\n')
      : [
          '    if (args.length === 0) return { ok: true, input: undefined as unknown as ' + types.inputType + ' }',
          '    try {',
          `      return { ok: true, input: JSON.parse(args[0] as string) as ${types.inputType} }`,
          '    } catch {',
          "      return { ok: false, error: { message: 'expected a single JSON-encoded argument' } }",
          '    }',
        ].join('\n')

  const body = [
    `/** exposure: ${binding.exposure}; operation: ${binding.operationId}@${binding.operationVersion} */`,
    `export const ${constName}: CliCommand<${types.inputType}> = {`,
    `  name: ${JSON.stringify(binding.command)},`,
    '  operation,',
    `  parseArgs(args: ReadonlyArray<string>): { ok: true; input: ${types.inputType} } | { ok: false; error: CliParseError } {`,
    parseArgsBody,
    '  },',
    '}',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics: [],
  }
}

function planScheduleAdapter(
  input: InboundAdapterGenerationInput,
  binding: Extract<InboundBinding, { kind: 'schedule' }>,
): InboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME
  const { importDecl } = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes, input.filePath)
  const constName = `${toCamelCase(binding.bindingId)}Job`
  const diagnostics: string[] = []

  // CAP-CONTRACT-028 overlap/misfire policy values are consumed directly by the
  // reconciled runtime OverlapPolicy/MisfirePolicy unions (SCHED-ENUM) — no remapping, no loss.
  const overlapPolicy = binding.overlapPolicy
  const misfirePolicy = binding.misfirePolicy

  const importDecls: ImportDeclarationInput[] = [
    { moduleSpecifier: `${runtimePackageName}/node`, namedImports: ['ScheduledJobDefinition'], typeOnly: true },
    { moduleSpecifier: importDecl.moduleSpecifier, namedImports: importDecl.namedImports },
  ]
  if (types.typeImportSpecifier) {
    importDecls.push({ moduleSpecifier: types.typeImportSpecifier, namedImports: types.typeImports, typeOnly: true })
  }
  const importBlock = renderImportBlock(importDecls)

  const body = [
    `/** exposure: ${binding.exposure}; operation: ${binding.operationId}@${binding.operationVersion} */`,
    `export const ${constName}: ScheduledJobDefinition<${types.inputType}> = {`,
    `  name: ${JSON.stringify(binding.bindingId)},`,
    `  cronExpression: ${JSON.stringify(binding.cronExpression)},`,
    `  timeZone: ${JSON.stringify(binding.timezone)},`,
    '  operation,',
    `  input: () => (${renderInputMappingExpression(binding.inputMappings)}) as ${types.inputType},`,
    `  overlapPolicy: ${JSON.stringify(overlapPolicy)},`,
    `  misfirePolicy: ${JSON.stringify(misfirePolicy)},`,
    '}',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics,
  }
}

function planEmbeddedLibraryAdapter(
  input: InboundAdapterGenerationInput,
  binding: Extract<InboundBinding, { kind: 'embedded-library' }>,
): InboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME
  const { importDecl } = resolveOperationImport(input)
  const types = resolveOperationTypes(input.operationTypes, input.filePath)
  const functionName = sanitizeIdentifier(binding.exportedCallable)

  const importDecls: ImportDeclarationInput[] = [
    { moduleSpecifier: runtimePackageName, namedImports: ['dispatch'] },
    { moduleSpecifier: runtimePackageName, namedImports: ['Context'], typeOnly: true },
    { moduleSpecifier: importDecl.moduleSpecifier, namedImports: importDecl.namedImports },
  ]
  if (types.typeImportSpecifier) {
    importDecls.push({ moduleSpecifier: types.typeImportSpecifier, namedImports: types.typeImports, typeOnly: true })
  }
  const importBlock = renderImportBlock(importDecls)

  const body = [
    `/** exposure: ${binding.exposure}; reason: ${JSON.stringify(binding.reason)} */`,
    `export async function ${functionName}(input: ${types.inputType}, context: Context) {`,
    '  return dispatch(operation, input, context)',
    '}',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics: [],
  }
}

function planUiAdapter(input: InboundAdapterGenerationInput, binding: Extract<InboundBinding, { kind: 'ui' }>): InboundAdapterGenerationResult {
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME
  const types = resolveOperationTypes(input.operationTypes, input.filePath)
  const functionName = `create${toPascalCase(binding.bindingId)}Client`

  const importDecls: ImportDeclarationInput[] = [
    { moduleSpecifier: `${runtimePackageName}/browser`, namedImports: ['OperationClientOptions'], typeOnly: true },
    { moduleSpecifier: `${runtimePackageName}/browser`, namedImports: ['OperationClient'] },
  ]
  if (types.typeImportSpecifier) {
    importDecls.push({ moduleSpecifier: types.typeImportSpecifier, namedImports: types.typeImports, typeOnly: true })
  }
  const importBlock = renderImportBlock(importDecls)

  const diagnostics: string[] = []
  if (binding.transport === 'electron-ipc') {
    diagnostics.push(
      `binding "${binding.bindingId}": transport "electron-ipc" emits a transport-agnostic client only; typed preload/main IPC generation is deferred (CAP-ERA-001 WP3B executable slices / WP7)`,
    )
  }

  const body = [
    `/** transport: ${binding.transport}; trigger: ${binding.trigger}; exposure: ${binding.exposure} */`,
    `export function ${functionName}(options: OperationClientOptions) {`,
    '  const client = new OperationClient(options)',
    '  return {',
    `    call: (input: ${types.inputType}) =>`,
    `      client.call<${types.successType}, ${types.domainRejectionType}, ${types.technicalFailureType}>(${JSON.stringify(binding.operationId)}, input),`,
    '  }',
    '}',
  ].join('\n')

  return {
    file: { path: input.filePath, contents: renderVirtualFileBody([buildHeader(input), importBlock, body]) },
    diagnostics,
  }
}

/**
 * Plans the generated inbound-adapter TypeScript source for one
 * `InboundBinding`, dispatching on its `kind` discriminant. Pure and
 * order-independent.
 */
export function planInboundAdapter(input: InboundAdapterGenerationInput): InboundAdapterGenerationResult {
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
