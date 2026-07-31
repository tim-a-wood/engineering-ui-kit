/**
 * EUC-04: pure compilers from `ModuleDesignSpecification` to the current
 * module records (§26 Increment 1): `ModuleManifest`, `OperationContract`,
 * and `ModuleImplementationSpecification`.
 *
 * All functions here are pure: same input produces the same output, no I/O,
 * no randomness, no wall-clock reads (§24.1 "deterministic hashes").
 */

import type { ModuleDesignSpecification } from './records.js'
import { stableSortBy } from './identity.js'
import { RUNTIME_ALLOCATIONS, RUNTIME_LANGUAGES, LIFECYCLE_KINDS } from '../parity.js'
import type {
  ModuleImplementationSpecification,
  ModuleManifest,
  OperationContract,
  RuntimeAllocation,
  RuntimeLanguage,
  LifecycleKind,
} from '../types.js'

function normalizeRuntimeAllocation(value: string): RuntimeAllocation {
  return (RUNTIME_ALLOCATIONS as readonly string[]).includes(value) ? (value as RuntimeAllocation) : 'local-embedded'
}

function normalizeRuntimeLanguage(value: string): RuntimeLanguage {
  return (RUNTIME_LANGUAGES as readonly string[]).includes(value) ? (value as RuntimeLanguage) : 'typescript'
}

function normalizeLifecycle(value: string): LifecycleKind {
  return (LIFECYCLE_KINDS as readonly string[]).includes(value) ? (value as LifecycleKind) : 'singleton'
}

function normalizeIdempotency(text: string): OperationContract['idempotency'] {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized.includes('non-idempotent') || normalized.includes('not idempotent')) return 'non-idempotent'
  if (normalized.includes('idempotent')) return 'idempotent'
  return 'unknown'
}

function normalizeTimeoutClass(text: string): OperationContract['timeoutClass'] {
  const normalized = text.trim().toLowerCase()
  if (normalized.includes('short')) return 'short'
  if (normalized.includes('long')) return 'long'
  return 'medium'
}

function normalizeCancellable(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return !/^(none|not cancellable|no)$/.test(normalized)
}

/** §26 Increment 1: `ModuleDesignSpecification` -> `ModuleManifest` (CAP-CONTRACT-003). */
export function compileModuleManifest(design: ModuleDesignSpecification): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: design.module.moduleId,
    moduleVersion: design.module.moduleVersion,
    moduleType: design.module.moduleType,
    name: design.module.name,
    responsibility: design.module.responsibility,
    ownedConcerns: [...design.module.ownedConcerns],
    excludedConcerns: [...design.module.excludedConcerns],
    providedOperations: stableSortBy(design.providedOperations, (operation) => operation.operationId).map((operation) => ({
      operationId: operation.operationId,
      contractVersion: operation.version,
    })),
    requiredOperations: stableSortBy(design.requiredOperations, (operation) => operation.operationId).map((operation) => ({
      operationId: operation.operationId,
      acceptedContractRange: operation.acceptedVersionRange,
      reason: operation.reason,
    })),
    configurationSchemaRef: design.runtime.configurationRefs[0] ?? null,
    verificationSuiteIds: [...design.verification.verificationSuiteIds],
    runtimeAllocation: normalizeRuntimeAllocation(design.boundary.runtimeAllocation),
    events: [...design.behavior.emittedEvents],
    ownedPaths: [...design.boundary.ownedPaths],
  }
}

/**
 * §26 Increment 1 / §9.7: provided `OperationContractRef`s + design
 * behavior -> `OperationContract[]` skeletons. When `registry` already
 * contains a full contract for an exact `operationId@version`, that
 * contract is preserved as-is (version identity is never changed by the
 * compiler); otherwise a skeleton is built from the module's behavior.
 */
export function compileOperationContracts(
  design: ModuleDesignSpecification,
  registry: readonly OperationContract[] = [],
): OperationContract[] {
  const byKey = new Map(registry.map((contract) => [`${contract.operationId}@${contract.version}`, contract]))
  const inputSchemaRef = design.schemas.find((schema) => schema.role === 'input')?.schemaId ?? ''
  const outputSchemaRef = design.schemas.find((schema) => schema.role === 'output')?.schemaId ?? ''

  return stableSortBy(design.providedOperations, (operation) => operation.operationId).map((ref) => {
    const existing = byKey.get(`${ref.operationId}@${ref.version}`)
    if (existing) return existing
    const skeleton: OperationContract = {
      schemaVersion: '1.0',
      operationId: ref.operationId,
      version: ref.version,
      behavior: 'command',
      inputSchemaRef,
      outputSchemaRef,
      preconditions: [...design.behavior.preconditions],
      postconditions: [...design.behavior.postconditions],
      domainRejections: [...design.behavior.domainRejections],
      technicalErrors: [...design.behavior.technicalFailures],
      sideEffects: [...design.behavior.sideEffects],
      idempotency: normalizeIdempotency(design.behavior.idempotency),
      timeoutClass: normalizeTimeoutClass(design.behavior.timeouts),
      cancellable: normalizeCancellable(design.behavior.cancellation),
      artifactTypes: [],
      provenanceFields: [...design.data.provenanceFields],
    }
    return skeleton
  })
}

/** Maps §16.1 `nonmaterial`/`material` to CAP-CONTRACT-031 `non-material`/`material`. */
function toImplementationMateriality(materiality: 'material' | 'nonmaterial'): 'material' | 'non-material' {
  return materiality === 'material' ? 'material' : 'non-material'
}

/**
 * §26 Increment 1: `ModuleDesignSpecification` -> `ModuleImplementationSpecification`
 * (CAP-CONTRACT-031), mapping boundary/behavior/data/runtime/verification.
 */
export function compileModuleImplementationSpecification(design: ModuleDesignSpecification): ModuleImplementationSpecification {
  return {
    schemaVersion: '1.0',
    projectId: design.projectId,
    moduleId: design.module.moduleId,
    moduleVersion: design.module.moduleVersion,
    moduleType: design.module.moduleType,
    runtimeLanguage: normalizeRuntimeLanguage(design.boundary.runtimeLanguage),
    deployableId: design.boundary.deployableId,
    ownedPaths: [...design.boundary.ownedPaths],
    editablePaths: [...design.boundary.editableSharedPaths],
    responsibility: design.module.responsibility,
    nonResponsibilities: [...design.module.nonResponsibilities],
    providedOperations: stableSortBy(design.providedOperations, (operation) => operation.operationId).map((operation) => ({
      operationId: operation.operationId,
      contractVersion: operation.version,
    })),
    requiredOperations: stableSortBy(design.requiredOperations, (operation) => operation.operationId).map((operation) => ({
      operationId: operation.operationId,
      acceptedContractRange: operation.acceptedVersionRange,
      reason: operation.reason,
    })),
    providedPorts: [],
    requiredPorts: [],
    canonicalSchemaRefs: design.schemas.map((schema) => schema.schemaId),
    generatedTypeTargets: [],
    rules: [...design.rules],
    invariants: [...design.invariants],
    examples: [...design.verification.examples],
    edgeCases: [...design.verification.edgeCases],
    failureSemantics: [...design.behavior.domainRejections, ...design.behavior.technicalFailures],
    performanceConstraints: [],
    cancellationExpectations: design.behavior.cancellation,
    timeoutExpectations: design.behavior.timeouts,
    concurrencyExpectations: design.behavior.concurrency,
    lifecycleRegistration: normalizeLifecycle(design.runtime.lifecycleRegistration),
    configurationRefs: [...design.runtime.configurationRefs],
    secretReferenceIds: [...design.runtime.secretReferenceIds],
    persistenceExpectations: design.data.dataOwnership,
    telemetryExpectations: design.runtime.telemetry,
    healthExpectations: design.runtime.healthBehavior,
    implementationSteps: [],
    acceptanceCases: design.verification.acceptanceCases.map((item) => ({ ...item })),
    acceptanceCommands: [...design.verification.configuredCommands],
    unresolvedItems: design.unresolvedItems.map((item) => ({
      id: item.id,
      description: item.description,
      materiality: toImplementationMateriality(item.materiality),
    })),
  }
}
