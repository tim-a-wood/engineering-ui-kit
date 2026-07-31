/**
 * EUC-05: Contract registry.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §9.7, §25.3
 * (EUC-05). Owns operation-version provider ownership, provider/consumer
 * indexes, semantic compatibility classification, consumer review
 * requirements, and the "no unapproved contract in a packet" check.
 *
 * Reuses the canonical `OperationContract` record (../types.js) and the
 * shared design-record approval primitives (./records.ts). The registry
 * envelope (`RegisteredContract`) is defined here because `OperationContract`
 * itself carries no id, revision, provider, or approval fields.
 */

import type { OperationContract } from '../types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from '../diagnostics.js'
import { canonicalHash } from '../hash.js'
import { isNonHumanActor, type DesignApproval, type ModuleDesignSpecification } from './records.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisteredContract = {
  operationId: string
  version: string
  providerModuleId: string
  status: 'draft' | 'approved'
  contract: OperationContract
  approval?: DesignApproval
  contentHash: string
}

export type ContractRegistry = {
  contracts: RegisteredContract[]
}

export function createContractRegistry(): ContractRegistry {
  return { contracts: [] }
}

function contractKey(operationId: string, version: string): string {
  return `${operationId}@${version}`
}

// ---------------------------------------------------------------------------
// Registration and approval (§9.7 "contract-first design")
// ---------------------------------------------------------------------------

export type RegisterContractInput = {
  operationId: string
  version: string
  providerModuleId: string
  contract: OperationContract
  /** Approved module designs, used to detect a second provider of the same operation version. */
  moduleDesigns?: ModuleDesignSpecification[]
}

export type RegisterContractResult = {
  ok: boolean
  registry?: ContractRegistry
  contract?: RegisteredContract
  diagnostics: CapDiagnostic[]
}

/**
 * Registers a draft contract. Enforces that one operation version has
 * exactly one provider module, and that the product never creates a
 * separate consumer-specific version of the same operationId + version
 * (§9.7 last paragraph).
 */
export function registerContract(registry: ContractRegistry, input: RegisterContractInput): RegisterContractResult {
  const diagnostics: CapDiagnostic[] = []
  const key = contractKey(input.operationId, input.version)

  const declaredProviders = new Set(
    (input.moduleDesigns ?? [])
      .filter((m) => m.providedOperations.some((op) => op.operationId === input.operationId && op.version === input.version))
      .map((m) => m.module.moduleId),
  )
  declaredProviders.add(input.providerModuleId)
  if (declaredProviders.size > 1) {
    diagnostics.push(
      diagnostic('CAP-DES-CTR-MULTI-PROVIDER', 'one operation version must have exactly one provider module', {
        ruleId: 'CAP-DES-CTR-PROVIDER',
        relatedIds: [...declaredProviders].sort((a, b) => a.localeCompare(b)),
      }),
    )
  }

  const contentHash = canonicalHash({ operationId: input.operationId, version: input.version, contract: input.contract })
  const existing = registry.contracts.find((c) => contractKey(c.operationId, c.version) === key)

  if (existing) {
    if (existing.providerModuleId !== input.providerModuleId) {
      diagnostics.push(
        diagnostic(
          'CAP-DES-CTR-MULTI-PROVIDER',
          'the operation version is already registered with a different provider module',
          { ruleId: 'CAP-DES-CTR-PROVIDER', relatedIds: [key, existing.providerModuleId, input.providerModuleId] },
        ),
      )
    }
    if (existing.contentHash !== contentHash) {
      diagnostics.push(
        diagnostic(
          'CAP-DES-CTR-VARIANT',
          'the product shall not create a separate consumer-specific version of an approved contract',
          { ruleId: 'CAP-DES-CTR-VARIANT', relatedIds: [key] },
        ),
      )
    }
    if (diagnostics.length) return { ok: false, diagnostics: sortDiagnostics(diagnostics) }
    return { ok: true, registry, contract: existing, diagnostics: [] }
  }

  if (diagnostics.length) return { ok: false, diagnostics: sortDiagnostics(diagnostics) }

  const registered: RegisteredContract = {
    operationId: input.operationId,
    version: input.version,
    providerModuleId: input.providerModuleId,
    status: 'draft',
    contract: input.contract,
    contentHash,
  }
  return { ok: true, registry: { contracts: [...registry.contracts, registered] }, contract: registered, diagnostics: [] }
}

export type ApproveContractInput = { approvedBy: string; authority: string; approvedAt?: string }

export type ApproveContractResult = {
  ok: boolean
  registry?: ContractRegistry
  contract?: RegisteredContract
  diagnostics: CapDiagnostic[]
}

export function approveContract(
  registry: ContractRegistry,
  operationId: string,
  version: string,
  approval: ApproveContractInput,
): ApproveContractResult {
  const key = contractKey(operationId, version)
  const existing = registry.contracts.find((c) => contractKey(c.operationId, c.version) === key)
  if (!existing) {
    return { ok: false, diagnostics: [diagnostic('CAP-DES-CTR-UNKNOWN', `unknown contract: ${key}`, { relatedIds: [key] })] }
  }
  // §4, §17.3 (second-review finding: self-asserted approval identity):
  // case-insensitive after trim, and rejects a `service:` actor the same as
  // an `agent:` actor: `'Agent:copilot'` and `' SERVICE:bot '` are both
  // rejected here, not just a lowercase `'agent:...'` string.
  if (isNonHumanActor(approval.approvedBy)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-CTR-AGENT-APPROVAL', 'a non-human (agent or service) actor cannot approve a contract', {
          ruleId: 'CAP-4',
          relatedIds: [approval.approvedBy],
        }),
      ],
    }
  }
  const approvedAt = approval.approvedAt ?? new Date(0).toISOString()
  const approved: RegisteredContract = {
    ...existing,
    status: 'approved',
    approval: {
      approvedBy: approval.approvedBy,
      authority: approval.authority,
      approvedAt,
      recordId: key,
      revision: existing.version,
      contentHash: existing.contentHash,
    },
  }
  const contracts = registry.contracts.map((c) => (contractKey(c.operationId, c.version) === key ? approved : c))
  return { ok: true, registry: { contracts }, contract: approved, diagnostics: [] }
}

// ---------------------------------------------------------------------------
// Provider / consumer index
// ---------------------------------------------------------------------------

export function buildProviderIndex(moduleDesigns: ModuleDesignSpecification[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const design of moduleDesigns) {
    for (const op of design.providedOperations) {
      const key = contractKey(op.operationId, op.version)
      const list = new Set(index.get(key) ?? [])
      list.add(design.module.moduleId)
      index.set(key, [...list].sort((a, b) => a.localeCompare(b)))
    }
  }
  return index
}

export function buildConsumerIndex(moduleDesigns: ModuleDesignSpecification[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const design of moduleDesigns) {
    for (const req of design.requiredOperations) {
      const list = new Set(index.get(req.operationId) ?? [])
      list.add(design.module.moduleId)
      index.set(req.operationId, [...list].sort((a, b) => a.localeCompare(b)))
    }
  }
  return index
}

// ---------------------------------------------------------------------------
// Compatibility classification (§9.7)
// ---------------------------------------------------------------------------

export type ContractCompatibility = 'compatibleAdditive' | 'conditionallyCompatible' | 'incompatible'

export type ContractChangeClassification = {
  classification: ContractCompatibility
  newRequiredMigration: boolean
  reasons: string[]
  /** §25.3: an incompatible change identifies every known consumer. */
  staleConsumerModuleIds: string[]
}

/**
 * §9.7: classifies a contract change: additive optional outputs or
 * postconditions are additive; a new precondition or a tightened input
 * schema is conditionally compatible; a removed operation, a changed
 * behavior type, a removed output, or an incompatible schema reference is
 * incompatible.
 */
export function classifyContractChange(
  oldContract: OperationContract,
  newContract: OperationContract | undefined,
  moduleDesigns: ModuleDesignSpecification[] = [],
): ContractChangeClassification {
  const reasons: string[] = []

  if (!newContract) {
    const consumerIndex = buildConsumerIndex(moduleDesigns)
    return {
      classification: 'incompatible',
      newRequiredMigration: true,
      reasons: ['the operation was removed'],
      staleConsumerModuleIds: consumerIndex.get(oldContract.operationId) ?? [],
    }
  }

  const removedPostconditions = oldContract.postconditions.filter((p) => !newContract.postconditions.includes(p))
  const addedPostconditions = newContract.postconditions.filter((p) => !oldContract.postconditions.includes(p))
  const removedArtifactTypes = oldContract.artifactTypes.filter((a) => !newContract.artifactTypes.includes(a))
  const addedPreconditions = newContract.preconditions.filter((p) => !oldContract.preconditions.includes(p))
  const removedPreconditions = oldContract.preconditions.filter((p) => !newContract.preconditions.includes(p))

  const incompatibleReasons: string[] = []
  if (newContract.behavior !== oldContract.behavior) incompatibleReasons.push('the behavior type changed')
  if (newContract.outputSchemaRef !== oldContract.outputSchemaRef) {
    incompatibleReasons.push('the output schema reference changed')
  }
  if (removedPostconditions.length) incompatibleReasons.push('a postcondition (output guarantee) was removed')
  if (removedArtifactTypes.length) incompatibleReasons.push('an artifact type (output) was removed')

  const conditionalReasons: string[] = []
  if (addedPreconditions.length) conditionalReasons.push('a new precondition was added')
  if (newContract.inputSchemaRef !== oldContract.inputSchemaRef) {
    conditionalReasons.push('the input schema reference changed')
  }
  if (newContract.idempotency !== oldContract.idempotency && newContract.idempotency === 'non-idempotent') {
    conditionalReasons.push('the idempotency guarantee was tightened')
  }

  let classification: ContractCompatibility
  if (incompatibleReasons.length) {
    classification = 'incompatible'
    reasons.push(...incompatibleReasons)
  } else if (conditionalReasons.length) {
    classification = 'conditionallyCompatible'
    reasons.push(...conditionalReasons)
  } else {
    classification = 'compatibleAdditive'
    if (addedPostconditions.length) reasons.push('an additive postcondition was added')
    if (removedPreconditions.length) reasons.push('a precondition was relaxed')
    if (newContract.artifactTypes.length > oldContract.artifactTypes.length) {
      reasons.push('an optional output artifact type was added')
    }
    if (!reasons.length) reasons.push('no observable behavior change')
  }

  const consumerIndex = buildConsumerIndex(moduleDesigns)
  const staleConsumerModuleIds =
    classification === 'incompatible' ? consumerIndex.get(oldContract.operationId) ?? [] : []

  return {
    classification,
    newRequiredMigration: classification === 'incompatible',
    reasons,
    staleConsumerModuleIds,
  }
}

// ---------------------------------------------------------------------------
// Review requirements (§9.7 "The provider and every known consumer shall review")
// ---------------------------------------------------------------------------

export type ContractReviewRequirement = { moduleId: string; role: 'provider' | 'consumer' }

export function consumerReviewRequirements(
  change: { operationId: string; providerModuleId: string },
  registry: { moduleDesigns: ModuleDesignSpecification[] },
): ContractReviewRequirement[] {
  const consumers = buildConsumerIndex(registry.moduleDesigns).get(change.operationId) ?? []
  const requirements: ContractReviewRequirement[] = [{ moduleId: change.providerModuleId, role: 'provider' }]
  for (const moduleId of consumers) {
    if (moduleId === change.providerModuleId) continue
    requirements.push({ moduleId, role: 'consumer' })
  }
  return requirements.sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.role.localeCompare(b.role))
}

// ---------------------------------------------------------------------------
// Packet guard (EUC-05 acceptance: "no implementation packet uses an unapproved contract")
// ---------------------------------------------------------------------------

export function assertNoUnapprovedContractForPacket(
  moduleDesign: ModuleDesignSpecification,
  registry: ContractRegistry,
): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = []
  const byKey = new Map(registry.contracts.map((c) => [contractKey(c.operationId, c.version), c]))

  for (const provided of moduleDesign.providedOperations) {
    const key = contractKey(provided.operationId, provided.version)
    const found = byKey.get(key)
    if (!found || found.status !== 'approved') {
      diagnostics.push(
        diagnostic('CAP-DES-CTR-UNAPPROVED-PROVIDED', 'no implementation packet may use an unapproved provided contract', {
          ruleId: 'CAP-DES-CTR-PACKET',
          relatedIds: [moduleDesign.module.moduleId, key],
        }),
      )
    }
  }
  for (const required of moduleDesign.requiredOperations) {
    const hasApproved = registry.contracts.some((c) => c.operationId === required.operationId && c.status === 'approved')
    if (!hasApproved) {
      diagnostics.push(
        diagnostic('CAP-DES-CTR-UNAPPROVED-REQUIRED', 'no implementation packet may use an unapproved required contract', {
          ruleId: 'CAP-DES-CTR-PACKET',
          relatedIds: [moduleDesign.module.moduleId, required.operationId],
        }),
      )
    }
  }
  return sortDiagnostics(diagnostics)
}
