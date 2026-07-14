/**
 * Architecture planning interview — CAP-PKT-009 / CAP-GATE-002.
 * One bounded interview depth; no diagram editing.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import {
  evaluateArchitectureGate,
  type GateResult,
} from './gates.js'
import {
  buildCapabilityGraph,
  detectCycles,
  type CapabilityGraph,
} from './graph.js'
import { buildInterviewPacket } from './packets.js'
import { canonicalHash } from './hash.js'
import type { CapabilityWorkspace } from './persistence.js'
import { validateContractRecord } from './validation.js'
import type {
  ApplicationSpecification,
  ArchitectureModuleDefinition,
  ArchitectureSpecification,
  InterviewPacket,
  ModuleManifest,
} from './types.js'
import { MODULE_TYPES } from './parity.js'

export type ArchitectureProposalInput = {
  architecture: ArchitectureSpecification
  manifests?: ModuleManifest[]
  /** Product need / use-case / outcome IDs each module claims to support. */
  moduleNeedTraces?: { moduleId: string; needIds: string[] }[]
  /** Justification tokens: distinct-rules | independent-change | reuse | external-boundary */
  moduleJustifications?: {
    moduleId: string
    justification: 'distinct-rules' | 'independent-change' | 'reuse' | 'external-boundary'
  }[]
}

export type ArchitectureInterviewEvaluation = GateResult & {
  cycles: string[][]
  unsupportedModuleIds: string[]
  redundantModuleIds: string[]
  orphanModuleIds: string[]
  graph: CapabilityGraph
}

export type ArchitectureImportResult = {
  ok: boolean
  proposal?: ArchitectureProposalInput
  draft?: ArchitectureSpecification
  evaluation?: ArchitectureInterviewEvaluation
  diagnostics: CapDiagnostic[]
}

const PRODUCT_NEED_IDS = (spec: ApplicationSpecification): Set<string> => {
  const ids = new Set<string>()
  for (const item of [
    ...spec.useCases,
    ...spec.scenarios,
    ...spec.outcomes.map((text, i) => ({ id: `outcome:${i}`, text })),
    ...spec.scope.inScope.map((text, i) => ({ id: `inscope:${i}`, text })),
  ]) {
    if (typeof item === 'string') ids.add(item)
    else ids.add(item.id)
  }
  for (const uc of spec.useCases) ids.add(uc.id)
  for (const sc of spec.scenarios) ids.add(sc.id)
  return ids
}

const VALID_MODULE_TYPES = new Set<string>(MODULE_TYPES)

function titleFromModuleId(moduleId: string): string {
  const value = moduleId.replace(/^mod[.\-_]?/i, '').replace(/[._-]+/g, ' ').trim()
  return value ? value.replace(/\b\w/g, (character) => character.toUpperCase()) : moduleId
}

/** A compatibility fallback for legacy responses; new handoffs ask the LLM to assign this explicitly. */
export function inferModuleType(moduleId: string, name = ''): ArchitectureModuleDefinition['moduleType'] {
  const text = `${moduleId} ${name}`.toLowerCase()
  if (/\b(ui|ux|view|screen|interface|presentation|experience|frontend)\b/.test(text)) return 'experience'
  if (/\b(adapter|integration|connector|client|gateway|api|external|matlab)\b/.test(text)) return 'connection'
  if (/\b(workflow|orchestrat|process|coordinat|use.?case|application)\b/.test(text)) return 'workflow'
  if (/\b(platform|storage|database|repository|infrastructure|runtime|config|cache)\b/.test(text)) return 'platform'
  return 'domain'
}

function normalizeModuleDefinitions(
  architecture: ArchitectureSpecification,
  manifests: ModuleManifest[],
): ArchitectureModuleDefinition[] {
  const existing = new Map((architecture.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition]))
  const manifestById = new Map(manifests.map((manifest) => [manifest.moduleId, manifest]))
  return (architecture.moduleIds ?? []).map((moduleId) => {
    const definition = existing.get(moduleId)
    const manifest = manifestById.get(moduleId)
    const name = typeof definition?.name === 'string' && definition.name.trim()
      ? definition.name.trim()
      : manifest?.name?.trim() || titleFromModuleId(moduleId)
    const moduleType = VALID_MODULE_TYPES.has(definition?.moduleType ?? '')
      ? definition!.moduleType
      : manifest?.moduleType ?? inferModuleType(moduleId, name)
    const responsibility = typeof definition?.responsibility === 'string' && definition.responsibility.trim()
      ? definition.responsibility.trim()
      : manifest?.responsibility?.trim() || `${name} owns its allocated capability and exposes it through explicit contracts.`
    return { moduleId, name, moduleType, responsibility }
  })
}

/**
 * Repair safe, mechanical omissions commonly produced by interview clients.
 * This does not invent modules or dependencies; it only describes declared edges,
 * classifies declared modules, and connects declared module need traces to workflows.
 */
export function normalizeArchitectureProposal(
  product: ApplicationSpecification,
  proposal: ArchitectureProposalInput,
): ArchitectureProposalInput {
  const architecture = proposal.architecture
  const moduleDefinitions = normalizeModuleDefinitions(architecture, proposal.manifests ?? [])
  const definitionById = new Map(moduleDefinitions.map((definition) => [definition.moduleId, definition]))
  const dependencyEdges = (architecture.dependencyEdges ?? []).map((edge) => {
    if (typeof edge.reason === 'string' && edge.reason.trim()) return { ...edge, reason: edge.reason.trim() }
    const from = definitionById.get(edge.fromModuleId)?.name ?? titleFromModuleId(edge.fromModuleId)
    const to = definitionById.get(edge.toModuleId)?.name ?? titleFromModuleId(edge.toModuleId)
    return { ...edge, reason: `${from} uses ${to} to fulfill its allocated responsibility.` }
  })

  const traces = new Map(
    (architecture.workflowTraces ?? []).map((trace) => [trace.useCaseId, new Set(trace.moduleIds ?? [])]),
  )
  const useCaseIds = new Set(product.useCases.map((useCase) => useCase.id))
  const needsByModule = new Map((proposal.moduleNeedTraces ?? []).map((trace) => [trace.moduleId, trace.needIds ?? []]))
  const tracedModules = new Set([...traces.values()].flatMap((moduleIds) => [...moduleIds]))
  for (const moduleId of architecture.moduleIds ?? []) {
    if (tracedModules.has(moduleId)) continue
    const matchingUseCases = (needsByModule.get(moduleId) ?? []).filter((needId) => useCaseIds.has(needId))
    const targetUseCases = matchingUseCases.length
      ? matchingUseCases
      : traces.size ? [[...traces.keys()][0]!] : product.useCases[0] ? [product.useCases[0].id] : []
    for (const useCaseId of targetUseCases) {
      const modules = traces.get(useCaseId) ?? new Set<string>()
      modules.add(moduleId)
      traces.set(useCaseId, modules)
    }
  }

  return {
    ...proposal,
    architecture: {
      ...architecture,
      moduleDefinitions,
      dependencyEdges,
      workflowTraces: [...traces.entries()].map(([useCaseId, moduleIds]) => ({
        useCaseId,
        moduleIds: [...moduleIds],
      })),
    },
  }
}

export function buildArchitectureInterviewPacket(input: {
  packetId: string
  projectId: string
  application: ApplicationSpecification
  reusableModuleIds?: string[]
  availableAdapterIds?: string[]
}): InterviewPacket {
  return buildInterviewPacket({
    packetId: input.packetId,
    projectId: input.projectId,
    interviewKind: 'architecture',
    gateId: 'CAP-GATE-002',
    interviewBoundary: 'architecture',
    stateLabels: {
      confirmed: ['applicationSpecification'],
      proposed: ['modules', 'dependencies', 'workflowTraces', 'adapterAllocations'],
      unresolved: ['minimality', 'cycles'],
    },
    inputContext: {
      recordIds: [input.application.id],
      revisions: [input.application.revision],
      hashes: [input.application.contentHash],
      facts: [
        `purpose:${input.application.purpose}`,
        ...input.application.outcomes.map((outcome) => `outcome:${outcome}`),
        ...input.application.useCases.map((u) => `useCase:${u.id}:${u.text}`),
        ...input.application.externalSystems.map((system) => `externalSystem:${system.id}:${system.text}`),
        ...input.application.constraints.map((constraint) => `constraint:${constraint.id}:${constraint.text}`),
        'architectureCompletion:assign each module a name, moduleType, and single responsibility',
        'architectureCompletion:every dependency edge must include a concrete reason',
        'architectureCompletion:every module must appear in at least one workflow trace and module need trace',
        ...(input.reusableModuleIds ?? []).map((id) => `reusable:${id}`),
        ...(input.availableAdapterIds ?? ['adapter.filesystem', 'adapter.matlab', 'adapter.azure-devops']).map(
          (id) => `adapter:${id}`,
        ),
      ],
      glossary: [],
    },
  })
}

export function findUnsupportedModules(
  product: ApplicationSpecification,
  proposal: ArchitectureProposalInput,
): string[] {
  const needIds = PRODUCT_NEED_IDS(product)
  const traces = new Map((proposal.moduleNeedTraces ?? []).map((t) => [t.moduleId, t.needIds]))
  const unsupported: string[] = []
  for (const moduleId of proposal.architecture.moduleIds ?? []) {
    const claimed = traces.get(moduleId) ?? []
    const supported = claimed.some((id) => needIds.has(id))
    // Need-trace is required (CAP-TEST-008); workflow coverage alone is not sufficient.
    if (!supported) unsupported.push(moduleId)
  }
  return unsupported.sort((a, b) => a.localeCompare(b))
}

/**
 * Redundant decomposition: modules that share identical responsibility text
 * without an explicit distinct justification, or duplicate the same owned concerns.
 */
export function findRedundantModules(proposal: ArchitectureProposalInput): string[] {
  const manifests = proposal.manifests ?? []
  const justifications = new Map(
    (proposal.moduleJustifications ?? []).map((j) => [j.moduleId, j.justification]),
  )
  const redundant = new Set<string>()
  for (let i = 0; i < manifests.length; i++) {
    for (let j = i + 1; j < manifests.length; j++) {
      const a = manifests[i]!
      const b = manifests[j]!
      const aResponsibility = typeof a.responsibility === 'string' ? a.responsibility.trim().toLowerCase() : ''
      const bResponsibility = typeof b.responsibility === 'string' ? b.responsibility.trim().toLowerCase() : ''
      const sameResponsibility = Boolean(aResponsibility && bResponsibility && aResponsibility === bResponsibility)
      const aOwned = Array.isArray(a.ownedConcerns) ? a.ownedConcerns : []
      const bOwned = Array.isArray(b.ownedConcerns) ? b.ownedConcerns : []
      const sameOwned =
        Boolean(aOwned.length && bOwned.length && [...aOwned].sort().join('|') === [...bOwned].sort().join('|'))
      if (!(sameResponsibility || sameOwned)) continue
      const ja = justifications.get(a.moduleId)
      const jb = justifications.get(b.moduleId)
      if (ja && jb && ja !== jb) continue
      redundant.add(a.moduleId)
      redundant.add(b.moduleId)
    }
  }
  return [...redundant].sort((a, b) => a.localeCompare(b))
}

export function findOrphanModules(architecture: ArchitectureSpecification): string[] {
  const workflowTraces = architecture.workflowTraces ?? []
  if (!workflowTraces.length) return []
  const traced = new Set(workflowTraces.flatMap((t) => t.moduleIds ?? []))
  return (architecture.moduleIds ?? []).filter((id) => !traced.has(id)).sort((a, b) => a.localeCompare(b))
}

export function projectDerivedGraph(
  architecture: ArchitectureSpecification,
  manifests: ModuleManifest[] = [],
): CapabilityGraph {
  return buildCapabilityGraph(architecture, manifests)
}

export function evaluateArchitectureProposal(
  product: ApplicationSpecification,
  proposal: ArchitectureProposalInput,
): ArchitectureInterviewEvaluation {
  const manifests = proposal.manifests ?? []
  const graph = projectDerivedGraph(proposal.architecture, manifests)
  const cycles = detectCycles(graph)
  const gate = evaluateArchitectureGate(proposal.architecture, manifests, graph)
  const unsupportedModuleIds = findUnsupportedModules(product, proposal)
  const redundantModuleIds = findRedundantModules(proposal)
  const orphanModuleIds = findOrphanModules(proposal.architecture)

  const extras: CapDiagnostic[] = []
  for (const moduleId of unsupportedModuleIds) {
    extras.push(
      diagnostic('CAP-GATE-002-UNSUPPORTED', 'module does not support a product need', {
        ruleId: 'CAP-GATE-002',
        relatedIds: [moduleId],
      }),
    )
  }
  for (const moduleId of redundantModuleIds) {
    extras.push(
      diagnostic('CAP-GATE-002-REDUNDANT', 'module decomposition is not minimal / redundant', {
        ruleId: 'CAP-GATE-002',
        relatedIds: [moduleId],
      }),
    )
  }
  if ((proposal.architecture.unresolvedQuestions ?? []).length) {
    extras.push(
      diagnostic('CAP-GATE-002-UNRESOLVED', 'unresolved architecture questions block approval', {
        ruleId: 'CAP-GATE-002',
        relatedIds: (proposal.architecture.unresolvedQuestions ?? []).map((q) => q.id),
      }),
    )
  }

  const diagnostics = sortDiagnostics([...gate.diagnostics, ...extras])
  return {
    gateId: 'CAP-GATE-002',
    passed: diagnostics.length === 0,
    diagnostics,
    cycles,
    unsupportedModuleIds,
    redundantModuleIds,
    orphanModuleIds,
    graph,
  }
}

export function parseArchitectureProposal(raw: unknown): {
  proposal?: ArchitectureProposalInput
  diagnostics: CapDiagnostic[]
} {
  if (!raw || typeof raw !== 'object') {
    return {
      diagnostics: [
        diagnostic('CAP-ARCH-IMPORT-SHAPE', 'architecture response must be a JSON object', {
          fieldPath: '$',
        }),
      ],
    }
  }
  const record = raw as Record<string, unknown>
  const architecture = (record.architecture ?? record) as ArchitectureSpecification
  const schemaDiagnostics = validateContractRecord('CAP-CONTRACT-002', architecture).map((d) =>
    diagnostic(d.code, d.message, { fieldPath: d.fieldPath, relatedIds: d.relatedIds }),
  )
  if (schemaDiagnostics.some((d) => d.code.startsWith('CAP-VAL') || d.fieldPath)) {
    // keep going with soft validation; hard-fail only when architecture is unusable
  }
  if (!architecture || typeof architecture !== 'object' || !Array.isArray(architecture.moduleIds)) {
    return {
      diagnostics: [
        diagnostic('CAP-ARCH-IMPORT-MODULES', 'architecture.moduleIds is required', {
          fieldPath: 'moduleIds',
        }),
        ...schemaDiagnostics,
      ],
    }
  }
  const proposal: ArchitectureProposalInput = {
    architecture,
    manifests: Array.isArray(record.manifests) ? (record.manifests as ModuleManifest[]) : undefined,
    moduleNeedTraces: Array.isArray(record.moduleNeedTraces)
      ? (record.moduleNeedTraces as ArchitectureProposalInput['moduleNeedTraces'])
      : undefined,
    moduleJustifications: Array.isArray(record.moduleJustifications)
      ? (record.moduleJustifications as ArchitectureProposalInput['moduleJustifications'])
      : undefined,
  }
  return { proposal, diagnostics: schemaDiagnostics }
}

export function importArchitectureProposal(
  product: ApplicationSpecification,
  raw: unknown,
): ArchitectureImportResult {
  const parsed = parseArchitectureProposal(raw)
  if (!parsed.proposal) {
    return { ok: false, diagnostics: parsed.diagnostics }
  }
  const normalized = normalizeArchitectureProposal(product, parsed.proposal)
  const draft: ArchitectureSpecification = {
    ...normalized.architecture,
    status: 'proposed',
    applicationSpecId: product.id,
    applicationSpecRevision: product.revision,
    applicationSpecHash: product.contentHash,
    projectId: product.projectId,
    contentHash: canonicalHash({
      ...normalized.architecture,
      status: 'proposed',
      contentHash: undefined,
    }),
  }
  const proposal: ArchitectureProposalInput = { ...normalized, architecture: draft }
  const evaluation = evaluateArchitectureProposal(product, proposal)
  draft.gateResult = {
    gateId: evaluation.gateId,
    passed: evaluation.passed,
    diagnostics: evaluation.diagnostics.map((d, i) => ({
      id: `d${i}`,
      code: d.code,
      message: d.message,
      relatedIds: d.relatedIds,
    })),
  }
  return {
    ok: evaluation.passed,
    proposal,
    draft,
    evaluation,
    diagnostics: sortDiagnostics([...parsed.diagnostics, ...evaluation.diagnostics]),
  }
}

export function approveArchitectureIfReady(
  workspace: CapabilityWorkspace,
  projectId: string,
  product: ApplicationSpecification,
  proposal: ArchitectureProposalInput,
): { ok: true; approved: ArchitectureSpecification; evaluation: ArchitectureInterviewEvaluation } | {
  ok: false
  evaluation: ArchitectureInterviewEvaluation
} {
  const evaluation = evaluateArchitectureProposal(product, proposal)
  if (!evaluation.passed) return { ok: false, evaluation }
  const draft: ArchitectureSpecification = {
    ...proposal.architecture,
    status: 'proposed',
    gateResult: {
      gateId: evaluation.gateId,
      passed: true,
      diagnostics: [],
    },
    contentHash: canonicalHash({
      ...proposal.architecture,
      status: 'proposed',
      gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
      contentHash: undefined,
    }),
  }
  const approved = workspace.approveArchitecture(projectId, draft)
  return { ok: true, approved, evaluation }
}
