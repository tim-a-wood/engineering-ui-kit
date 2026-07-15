/**
 * Composition model, registration validation, and composition-root source
 * planning (CAP-ERA-001 §9 CAP-CONTRACT-027, §11.1 `composition.ts`, §10.2).
 *
 * Pure: given a `CompositionManifest`, validates it (unambiguous provider
 * resolution, no forbidden dependency cycles, unambiguous inbound-route
 * resolution) and plans an explicit, statically-inspectable composition-root
 * TypeScript module wired against the runtime's `LifecycleContainer`. Given
 * identical inputs, output is byte-identical regardless of input array
 * ordering. Never imports `node:*`; never calls
 * `Date.now()`/`Math.random()`/`crypto`.
 */

import type { CompositionManifest, CompositionRegistration } from '../types.js'
import { ordinalCompare, sortByKey, uniqueSorted } from './paths.js'
import {
  DEFAULT_RUNTIME_PACKAGE_NAME,
  generatedFileHeader,
  relativeModuleSpecifier,
  renderImportBlock,
  sanitizeIdentifier,
  toCamelCase,
  toPascalCase,
  renderVirtualFileBody,
  type GeneratedVirtualFile,
} from './typescript.js'

export type CompositionValidationIssueCode =
  | 'ambiguous-provider'
  | 'forbidden-cycle'
  | 'undeclared-dependency'
  | 'ambiguous-inbound-route'

export type CompositionValidationIssue = {
  readonly code: CompositionValidationIssueCode
  readonly message: string
}

function registrationSortKey(registration: CompositionRegistration): string {
  return registration.contractId
}

/**
 * Validates a `CompositionManifest` against the CAP-CONTRACT-027 invariants:
 * unambiguous provider resolution (one registration per `contractId`), no
 * forbidden dependency cycles, no dependency on an undeclared `contractId`,
 * and an unambiguous operation route per inbound binding. Deterministic:
 * issues are always returned in the same order regardless of the manifest's
 * array ordering.
 */
export function validateComposition(manifest: CompositionManifest): { valid: boolean; issues: CompositionValidationIssue[] } {
  const issues: CompositionValidationIssue[] = []
  const registrations = sortByKey([...manifest.registrations], registrationSortKey)

  const countByContractId = new Map<string, number>()
  for (const registration of registrations) {
    countByContractId.set(registration.contractId, (countByContractId.get(registration.contractId) ?? 0) + 1)
  }
  for (const [contractId, count] of [...countByContractId.entries()].sort((a, b) => ordinalCompare(a[0], b[0]))) {
    if (count > 1) {
      issues.push({
        code: 'ambiguous-provider',
        message: `contract "${contractId}" has ${count} registrations; provider resolution must be unambiguous (exactly one)`,
      })
    }
  }

  const knownContractIds = new Set(countByContractId.keys())
  const dependencyGraph = new Map<string, string[]>()
  for (const registration of registrations) {
    dependencyGraph.set(registration.contractId, uniqueSorted([...registration.dependencies]))
  }
  for (const registration of registrations) {
    for (const dependency of dependencyGraph.get(registration.contractId) ?? []) {
      if (!knownContractIds.has(dependency)) {
        issues.push({
          code: 'undeclared-dependency',
          message: `contract "${registration.contractId}" depends on undeclared contract "${dependency}"`,
        })
      }
    }
  }

  const cycleReported = new Set<string>()
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(contractId: string, path: readonly string[]): void {
    if (visited.has(contractId)) return
    if (visiting.has(contractId)) {
      const cycleStart = path.indexOf(contractId)
      const cyclePath = [...path.slice(cycleStart), contractId]
      const key = uniqueSorted(cyclePath).join('|')
      if (!cycleReported.has(key)) {
        cycleReported.add(key)
        issues.push({ code: 'forbidden-cycle', message: `forbidden dependency cycle: ${cyclePath.join(' -> ')}` })
      }
      return
    }
    visiting.add(contractId)
    for (const dependency of dependencyGraph.get(contractId) ?? []) {
      if (knownContractIds.has(dependency)) visit(dependency, [...path, contractId])
    }
    visiting.delete(contractId)
    visited.add(contractId)
  }
  for (const contractId of sortByKey([...knownContractIds], (id) => id)) {
    visit(contractId, [])
  }

  const routeCombosByBindingId = new Map<string, Set<string>>()
  for (const route of manifest.operationRoutes) {
    const combo = `${route.operationId}@${route.operationVersion}`
    const set = routeCombosByBindingId.get(route.inboundBindingId) ?? new Set<string>()
    set.add(combo)
    routeCombosByBindingId.set(route.inboundBindingId, set)
  }
  for (const bindingId of sortByKey([...routeCombosByBindingId.keys()], (id) => id)) {
    const combos = [...(routeCombosByBindingId.get(bindingId) ?? [])].sort(ordinalCompare)
    if (combos.length > 1) {
      issues.push({
        code: 'ambiguous-inbound-route',
        message: `inbound binding "${bindingId}" resolves to ${combos.length} distinct operation versions (${combos.join(', ')}); an inbound route must resolve to exactly one`,
      })
    }
  }

  return { valid: issues.length === 0, issues: sortByKey(issues, (issue) => `${issue.code} ${issue.message}`) }
}

/** Deterministic `ServiceToken` variable name for one registration's `contractId`. */
export function compositionTokenName(contractId: string): string {
  return `${sanitizeIdentifier(toCamelCase(contractId))}Token`
}

type ImplementationTargetReference = { readonly modulePath: string; readonly exportName: string }

/**
 * Parses a `CompositionRegistration.implementationTarget` of the form
 * `"<repo-relative-module-path>#<namedExport>"`. When no `#<namedExport>` is
 * present, a deterministic default export name is derived from the
 * `contractId` (`create<PascalContractId>`).
 */
function parseImplementationTarget(target: string, contractId: string): ImplementationTargetReference {
  const hashIndex = target.indexOf('#')
  if (hashIndex === -1) {
    return { modulePath: target, exportName: `create${toPascalCase(contractId)}` }
  }
  return { modulePath: target.slice(0, hashIndex), exportName: target.slice(hashIndex + 1) }
}

export type CompositionRootModuleInput = {
  readonly manifest: CompositionManifest
  readonly generatorVersion: string
  readonly referenceProfileVersion: string
  /** Repo-relative path for the generated composition-root module. */
  readonly filePath: string
  readonly runtimePackageName?: string
}

export type CompositionRootModuleResult = {
  readonly file: GeneratedVirtualFile
  readonly issues: CompositionValidationIssue[]
}

/**
 * Plans the explicit, statically-inspectable composition-root TypeScript
 * module for one `CompositionManifest` (one deployable's composition, per
 * CAP-CONTRACT-027): imports every registration's implementation target,
 * declares one `ServiceToken` per `contractId`, and registers each with its
 * declared lifecycle and dependencies against the runtime `LifecycleContainer`.
 * Always emits a file; `issues` surfaces CAP-CONTRACT-027 invariant violations
 * for the caller to act on (this generator never silently drops a
 * registration to "fix" an invalid manifest).
 */
export function planCompositionRootModule(input: CompositionRootModuleInput): CompositionRootModuleResult {
  const { issues } = validateComposition(input.manifest)
  const runtimePackageName = input.runtimePackageName ?? DEFAULT_RUNTIME_PACKAGE_NAME
  const registrations = sortByKey([...input.manifest.registrations], registrationSortKey)

  const targetsByContractId = new Map(
    registrations.map((registration) => [registration.contractId, parseImplementationTarget(registration.implementationTarget, registration.contractId)]),
  )

  const importsByModule = new Map<string, Set<string>>()
  for (const [contractId, target] of targetsByContractId) {
    const specifier = relativeModuleSpecifier(input.filePath, target.modulePath)
    const names = importsByModule.get(specifier) ?? new Set<string>()
    names.add(target.exportName)
    importsByModule.set(specifier, names)
  }

  const importBlock = renderImportBlock([
    { moduleSpecifier: runtimePackageName, namedImports: ['LifecycleContainer', 'createToken'] },
    { moduleSpecifier: runtimePackageName, namedImports: ['ServiceToken', 'ResolutionContext'], typeOnly: true },
    ...sortByKey([...importsByModule.entries()], ([specifier]) => specifier).map(([specifier, names]) => ({
      moduleSpecifier: specifier,
      namedImports: [...names].sort(ordinalCompare),
    })),
  ])

  const tokenDeclarations = registrations.map(
    (registration) => `export const ${compositionTokenName(registration.contractId)}: ServiceToken = createToken(${JSON.stringify(registration.contractId)})`,
  )

  const registrationStatements = registrations.map((registration) => {
    const target = targetsByContractId.get(registration.contractId)!
    const dependencies = uniqueSorted([...registration.dependencies])
    const args = dependencies.map((dependency) => `scope.resolve(${compositionTokenName(dependency)})`).join(', ')
    return [
      `container.register({`,
      `  token: ${compositionTokenName(registration.contractId)},`,
      `  lifecycle: ${JSON.stringify(registration.lifecycle)},`,
      `  factory: (scope: ResolutionContext) => ${target.exportName}(${args}),`,
      `})`,
    ].join('\n')
  })

  const functionName = `build${toPascalCase(input.manifest.compositionId)}Container`
  const bodyLines = [
    `/** Provider module ids, in registration order: ${registrations.map((r) => r.providerModuleId).join(', ') || '(none)'} */`,
    `export function ${functionName}(): LifecycleContainer {`,
    '  const container = new LifecycleContainer()',
    ...registrationStatements.map((statement) => `  ${statement.replace(/\n/g, '\n  ')}`),
    '  return container',
    '}',
  ]

  const header = generatedFileHeader({
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: [input.manifest.compositionHash],
  })

  const file: GeneratedVirtualFile = {
    path: input.filePath,
    contents: renderVirtualFileBody([header, importBlock, tokenDeclarations.join('\n'), bodyLines.join('\n')]),
  }

  return { file, issues }
}
