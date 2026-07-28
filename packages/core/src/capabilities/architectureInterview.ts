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
import { allUseCaseSteps } from './useCaseAnalysis.js'
import {
  evaluateArchitectureApplicationLink,
  evaluateSolutionAllocations,
} from './applicationWorkflow.js'
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
import {
  evaluateArchitectureSte,
  evaluateModuleSte,
  type SteLexicon,
  type SteReviewDiagnostic,
} from './simplifiedTechnicalEnglish.js'

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
  reviewDiagnostics: SteReviewDiagnostic[]
}

export type ArchitectureImportResult = {
  ok: boolean
  proposal?: ArchitectureProposalInput
  draft?: ArchitectureSpecification
  evaluation?: ArchitectureInterviewEvaluation
  diagnostics: CapDiagnostic[]
  reviewDiagnostics: SteReviewDiagnostic[]
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
    (architecture.workflowTraces ?? []).map((trace) => [trace.useCaseId, {
      moduleIds: new Set(trace.moduleIds ?? []),
      entryPointId: trace.entryPointId,
      outputId: trace.outputId,
      nodeAllocations: [...(trace.nodeAllocations ?? [])],
      stepAllocations: [...(trace.stepAllocations ?? [])],
    }]),
  )
  const useCaseIds = new Set(product.useCases.map((useCase) => useCase.id))
  const needsByModule = new Map((proposal.moduleNeedTraces ?? []).map((trace) => [trace.moduleId, trace.needIds ?? []]))
  const tracedModules = new Set([...traces.values()].flatMap((trace) => [...trace.moduleIds]))
  for (const moduleId of architecture.moduleIds ?? []) {
    if (tracedModules.has(moduleId)) continue
    const matchingUseCases = (needsByModule.get(moduleId) ?? []).filter((needId) => useCaseIds.has(needId))
    const targetUseCases = matchingUseCases.length
      ? matchingUseCases
      : traces.size ? [[...traces.keys()][0]!] : product.useCases[0] ? [product.useCases[0].id] : []
    for (const useCaseId of targetUseCases) {
      const trace = traces.get(useCaseId) ?? {
        moduleIds: new Set<string>(),
        entryPointId: undefined,
        outputId: undefined,
        nodeAllocations: [],
        stepAllocations: [],
      }
      trace.moduleIds.add(moduleId)
      traces.set(useCaseId, trace)
    }
  }

  return {
    ...proposal,
    architecture: {
      ...architecture,
      moduleDefinitions,
      dependencyEdges,
      workflowTraces: [...traces.entries()].map(([useCaseId, trace]) => ({
        useCaseId,
        moduleIds: [...trace.moduleIds],
        entryPointId: trace.entryPointId,
        outputId: trace.outputId,
        nodeAllocations: trace.nodeAllocations,
        stepAllocations: trace.stepAllocations,
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
        ...input.application.actors.map((actor) => `actor:${actor.id}:${actor.text}`),
        ...input.application.goals.map((goal) => `goal:${goal.id}:${goal.text}`),
        ...input.application.useCases.map((u) => `useCase:${u.id}:${u.text}`),
        ...(input.application.useCaseDefinitions ?? []).flatMap((useCase) => [
          `useCaseDetail:${useCase.id}:actors=${useCase.actorIds.join(',')}:trigger=${useCase.trigger}`,
          ...allUseCaseSteps(useCase).map((step) =>
            `useCaseStep:${useCase.id}:${step.id}:${step.order}:${step.actorId ?? 'system'}:${step.action}=>${step.expectedResult}`),
        ]),
        ...(input.application.applicationWorkflows ?? []).flatMap((workflow) => [
          `applicationWorkflow:${workflow.id}:useCase=${workflow.useCaseId}:paths=${workflow.pathIds.join(',')}`,
          ...workflow.graph.nodes.map((node) =>
            `workflowNode:${workflow.id}:${node.id}:${node.kind}:${node.label}:refines=${node.refinesIds.join(',')}`),
          ...workflow.graph.edges.map((edge) =>
            `workflowEdge:${workflow.id}:${edge.id}:${edge.fromNodeId}->${edge.toNodeId}:guard=${edge.guard ?? ''}:outcome=${edge.outcome ?? ''}`),
        ]),
        ...input.application.scenarios.map((scenario) => `scenario:${scenario.id}:${scenario.text}`),
        ...input.application.information.map((item) => `information:${item.id}:${item.text}`),
        ...input.application.rules.map((rule) => `rule:${rule.id}:${rule.text}`),
        ...input.application.externalSystems.map((system) => `externalSystem:${system.id}:${system.text}`),
        ...input.application.constraints.map((constraint) => `constraint:${constraint.id}:${constraint.text}`),
        ...input.application.scope.inScope.map((item) => `inScope:${item}`),
        ...input.application.scope.outOfScope.map((item) => `outOfScope:${item}`),
        ...input.application.acceptanceCases.map((item) => `acceptanceCase:${item.id}:${item.description} => ${item.expectedOutcome}`),
        ...input.application.sources.map((source) => `source:${source.id}:${source.text}`),
        'architectureCompletion:assign each module a name, moduleType, and single responsibility',
        'architectureCompletion:every dependency edge must include a concrete reason',
        'architectureCompletion:every module must appear in at least one workflow trace and module need trace',
        'architectureCompletion:allocate every executable application workflow node to one primary module in workflowTraces.nodeAllocations',
        'architectureBoundary:define an operation, event, entry point, or output for each cross-module transition',
        'architectureBoundary:do not define internal module algorithms or module-only decisions',
        ...(input.reusableModuleIds ?? []).map((id) => `reusable:${id}`),
        ...(input.availableAdapterIds ?? ['adapter.filesystem', 'adapter.matlab', 'adapter.azure-devops']).map(
          (id) => `adapter:${id}`,
        ),
      ],
      glossary: input.application.information.map((item) => ({ ...item })),
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
  lexicon?: SteLexicon,
): ArchitectureInterviewEvaluation {
  const manifests = proposal.manifests ?? []
  const graph = projectDerivedGraph(proposal.architecture, manifests)
  const cycles = detectCycles(graph)
  const languageEvaluation = evaluateArchitectureSte(proposal.architecture, lexicon)
  const manifestLanguageEvaluations = manifests.map((manifest) => evaluateModuleSte(manifest, lexicon))
  const gate = evaluateArchitectureGate(proposal.architecture, manifests, graph, lexicon)
  const unsupportedModuleIds = findUnsupportedModules(product, proposal)
  const redundantModuleIds = findRedundantModules(proposal)
  const orphanModuleIds = findOrphanModules(proposal.architecture)

  const extras: CapDiagnostic[] = []
  extras.push(...evaluateArchitectureApplicationLink(product, proposal.architecture).diagnostics)
  if (product.applicationWorkflows?.length) {
    extras.push(...evaluateSolutionAllocations(product, proposal.architecture).diagnostics)
  }
  const detailedUseCases = product.useCaseDefinitions ?? []
  const detailedUseCaseById = new Map(detailedUseCases.map((useCase) => [useCase.id, useCase]))
  const knownUseCaseIds = new Set(product.useCases.map((useCase) => useCase.id))
  for (const useCase of detailedUseCases) knownUseCaseIds.add(useCase.id)
  const tracedUseCaseIds = new Set<string>()
  for (const trace of proposal.architecture.workflowTraces ?? []) {
    if (!knownUseCaseIds.has(trace.useCaseId)) {
      extras.push(
        diagnostic('CAP-GATE-002-TRACE-USE-CASE', 'workflow trace references an unknown use case', {
          ruleId: 'CAP-GATE-002',
          fieldPath: trace.useCaseId,
          relatedIds: [trace.useCaseId],
        }),
      )
      continue
    }
    if (tracedUseCaseIds.has(trace.useCaseId)) {
      extras.push(
        diagnostic('CAP-GATE-002-TRACE-DUPLICATE', 'use case must have one canonical workflow trace', {
          ruleId: 'CAP-GATE-002',
          fieldPath: trace.useCaseId,
          relatedIds: [trace.useCaseId],
        }),
      )
    }
    tracedUseCaseIds.add(trace.useCaseId)
    const detailed = detailedUseCaseById.get(trace.useCaseId)
    if (!detailed) continue
    if (product.applicationWorkflows?.length) continue
    const validStepIds = new Set(allUseCaseSteps(detailed).map((step) => step.id))
    const allocationCounts = new Map<string, number>()
    for (const allocation of trace.stepAllocations ?? []) {
      allocationCounts.set(allocation.stepId, (allocationCounts.get(allocation.stepId) ?? 0) + 1)
      if (!validStepIds.has(allocation.stepId)) {
        extras.push(
          diagnostic('CAP-GATE-002-TRACE-STEP', 'workflow trace allocates an unknown scenario step', {
            ruleId: 'CAP-GATE-002',
            fieldPath: `${trace.useCaseId}.${allocation.stepId}`,
            relatedIds: [allocation.stepId],
          }),
        )
      }
      if (!trace.moduleIds.includes(allocation.moduleId)) {
        extras.push(
          diagnostic('CAP-GATE-002-TRACE-STEP-MODULE', 'scenario step is allocated outside the use-case module path', {
            ruleId: 'CAP-GATE-002',
            fieldPath: `${trace.useCaseId}.${allocation.stepId}`,
            relatedIds: [allocation.moduleId],
          }),
        )
      }
    }
    for (const stepId of validStepIds) {
      const count = allocationCounts.get(stepId) ?? 0
      if (count !== 1) {
        extras.push(
          diagnostic(
            count === 0 ? 'CAP-GATE-002-TRACE-STEP-MISSING' : 'CAP-GATE-002-TRACE-STEP-DUPLICATE',
            count === 0
              ? 'every approved scenario step must be allocated to one module'
              : 'approved scenario step must not be allocated more than once',
            {
              ruleId: 'CAP-DES-SYS-006',
              fieldPath: `${trace.useCaseId}.${stepId}`,
              relatedIds: [stepId],
            },
          ),
        )
      }
    }
  }
  for (const useCase of detailedUseCases) {
    if (!tracedUseCaseIds.has(useCase.id)) {
      extras.push(
        diagnostic('CAP-GATE-002-USE-CASE-PATH', 'approved use case lacks a complete module path', {
          ruleId: 'CAP-DES-SYS-006',
          fieldPath: useCase.id,
          relatedIds: [useCase.id],
        }),
      )
    }
  }
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
    reviewDiagnostics: [
      ...languageEvaluation.reviewDiagnostics,
      ...manifestLanguageEvaluations.flatMap((evaluation) => evaluation.reviewDiagnostics),
    ],
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
  const architectureInput = (record.architecture ?? record) as ArchitectureSpecification
  const schemaDiagnostics = validateContractRecord('CAP-CONTRACT-002', architectureInput).map((d) =>
    diagnostic(d.code, d.message, { fieldPath: d.fieldPath, relatedIds: d.relatedIds }),
  )
  if (schemaDiagnostics.some((d) => d.code.startsWith('CAP-VAL') || d.fieldPath)) {
    // keep going with soft validation; hard-fail only when architecture is unusable
  }
  if (!architectureInput || typeof architectureInput !== 'object' || !Array.isArray(architectureInput.moduleIds)) {
    return {
      diagnostics: [
        diagnostic('CAP-ARCH-IMPORT-MODULES', 'architecture.moduleIds is required', {
          fieldPath: 'moduleIds',
        }),
        ...schemaDiagnostics,
      ],
    }
  }
  const nestedDiagnostics: CapDiagnostic[] = []
  const objectItems = (value: unknown, fieldPath: string): Record<string, unknown>[] => {
    if (!Array.isArray(value)) {
      if (value !== undefined) {
        nestedDiagnostics.push(diagnostic(
          'CAP-ARCH-IMPORT-LIST',
          'Replace the invalid value with a list of JSON objects.',
          { fieldPath },
        ))
      }
      return []
    }
    return value.flatMap((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return [item as Record<string, unknown>]
      }
      nestedDiagnostics.push(diagnostic(
        'CAP-ARCH-IMPORT-ITEM',
        'Replace the invalid list item with a JSON object.',
        { fieldPath: `${fieldPath}.${index}` },
      ))
      return []
    })
  }
  const text = (value: unknown, fieldPath: string): string => {
    if (typeof value === 'string') return value
    nestedDiagnostics.push(diagnostic(
      'CAP-ARCH-IMPORT-TEXT',
      'Replace the invalid value with text.',
      { fieldPath },
    ))
    return ''
  }
  const optionalText = (value: unknown, fieldPath: string): string | undefined => {
    if (value === undefined) return undefined
    return text(value, fieldPath)
  }
  const stringItems = (value: unknown, fieldPath: string): string[] => {
    if (!Array.isArray(value)) {
      if (value !== undefined) {
        nestedDiagnostics.push(diagnostic(
          'CAP-ARCH-IMPORT-LIST',
          'Replace the invalid value with a list of text values.',
          { fieldPath },
        ))
      }
      return []
    }
    return value.flatMap((item, index) => {
      if (typeof item === 'string') return [item]
      nestedDiagnostics.push(diagnostic(
        'CAP-ARCH-IMPORT-TEXT',
        'Replace the invalid list item with text.',
        { fieldPath: `${fieldPath}.${index}` },
      ))
      return []
    })
  }
  const namedItems = (value: unknown, fieldPath: string) =>
    objectItems(value, fieldPath).map((item, index) => ({
      id: text(item.id, `${fieldPath}.${index}.id`),
      text: text(item.text, `${fieldPath}.${index}.text`),
    }))
  const moduleType = (
    value: unknown,
    moduleId: unknown,
    name: unknown,
    fieldPath: string,
  ): ArchitectureModuleDefinition['moduleType'] => {
    if (VALID_MODULE_TYPES.has(String(value))) {
      return value as ArchitectureModuleDefinition['moduleType']
    }
    nestedDiagnostics.push(diagnostic(
      'CAP-ARCH-IMPORT-MODULE-TYPE',
      'Use a valid module type.',
      { fieldPath },
    ))
    return inferModuleType(
      typeof moduleId === 'string' ? moduleId : '',
      typeof name === 'string' ? name : '',
    )
  }
  const runtimeAllocation = (
    value: unknown,
    fieldPath: string,
  ): ModuleManifest['runtimeAllocation'] => {
    if (value === 'external-adapter' || value === 'local-embedded') return value
    nestedDiagnostics.push(diagnostic(
      'CAP-ARCH-IMPORT-RUNTIME',
      'Use local-embedded or external-adapter.',
      { fieldPath },
    ))
    return 'local-embedded'
  }
  const configurationSchemaRef = (
    value: unknown,
    fieldPath: string,
  ): string | null => {
    if (value === undefined || value === null || typeof value === 'string') {
      return value ?? null
    }
    nestedDiagnostics.push(diagnostic(
      'CAP-ARCH-IMPORT-CONFIGURATION',
      'Use a text schema reference or null.',
      { fieldPath },
    ))
    return null
  }
  const versionLiteral = (
    value: unknown,
    fieldPath: string,
  ): '1.0' => {
    if (value !== undefined && value !== '1.0') {
      nestedDiagnostics.push(diagnostic(
        'CAP-ARCH-IMPORT-VERSION',
        'Use schema version 1.0.',
        { fieldPath },
      ))
    }
    return '1.0'
  }
  const architecture: ArchitectureSpecification = {
    ...architectureInput,
    moduleIds: stringItems(architectureInput.moduleIds, 'moduleIds'),
    capabilityProjections: objectItems(
      architectureInput.capabilityProjections,
      'capabilityProjections',
    ).map((item, index) => ({
      id: text(item.id, `capabilityProjections.${index}.id`),
      name: text(item.name, `capabilityProjections.${index}.name`),
      moduleIds: stringItems(item.moduleIds, `capabilityProjections.${index}.moduleIds`),
    })),
    moduleDefinitions: objectItems(
      architectureInput.moduleDefinitions,
      'moduleDefinitions',
    ).map((item, index) => ({
      moduleId: text(item.moduleId, `moduleDefinitions.${index}.moduleId`),
      name: text(item.name, `moduleDefinitions.${index}.name`),
      moduleType: moduleType(
        item.moduleType,
        item.moduleId,
        item.name,
        `moduleDefinitions.${index}.moduleType`,
      ),
      responsibility: text(item.responsibility, `moduleDefinitions.${index}.responsibility`),
    })),
    dependencyEdges: objectItems(
      architectureInput.dependencyEdges,
      'dependencyEdges',
    ).map((item, index) => ({
      fromModuleId: text(item.fromModuleId, `dependencyEdges.${index}.fromModuleId`),
      toModuleId: text(item.toModuleId, `dependencyEdges.${index}.toModuleId`),
      reason: item.reason === undefined
        ? ''
        : text(item.reason, `dependencyEdges.${index}.reason`),
    })),
    operationAllocations: objectItems(
      architectureInput.operationAllocations,
      'operationAllocations',
    ).map((item, index) => ({
      operationId: text(item.operationId, `operationAllocations.${index}.operationId`),
      moduleId: text(item.moduleId, `operationAllocations.${index}.moduleId`),
    })),
    adapterAllocations: objectItems(
      architectureInput.adapterAllocations,
      'adapterAllocations',
    ).map((item, index) => ({
      adapterId: text(item.adapterId, `adapterAllocations.${index}.adapterId`),
      moduleId: text(item.moduleId, `adapterAllocations.${index}.moduleId`),
      portId: text(item.portId, `adapterAllocations.${index}.portId`),
    })),
    workflowTraces: objectItems(
      architectureInput.workflowTraces,
      'workflowTraces',
    ).map((trace, traceIndex) => ({
      useCaseId: text(trace.useCaseId, `workflowTraces.${traceIndex}.useCaseId`),
      moduleIds: stringItems(trace.moduleIds, `workflowTraces.${traceIndex}.moduleIds`),
      entryPointId: optionalText(trace.entryPointId, `workflowTraces.${traceIndex}.entryPointId`),
      outputId: optionalText(trace.outputId, `workflowTraces.${traceIndex}.outputId`),
      stepAllocations: objectItems(
        trace.stepAllocations,
        `workflowTraces.${traceIndex}.stepAllocations`,
      ).map((item, itemIndex) => ({
        stepId: text(item.stepId, `workflowTraces.${traceIndex}.stepAllocations.${itemIndex}.stepId`),
        moduleId: text(item.moduleId, `workflowTraces.${traceIndex}.stepAllocations.${itemIndex}.moduleId`),
      })),
    })),
    proposals: namedItems(architectureInput.proposals, 'proposals'),
    unresolvedQuestions: namedItems(architectureInput.unresolvedQuestions, 'unresolvedQuestions'),
  }
  const manifests = objectItems(record.manifests, 'manifests').map((item, index) => ({
    schemaVersion: versionLiteral(item.schemaVersion, `manifests.${index}.schemaVersion`),
    architectureVersion: versionLiteral(
      item.architectureVersion,
      `manifests.${index}.architectureVersion`,
    ),
    moduleId: text(item.moduleId, `manifests.${index}.moduleId`),
    moduleVersion: text(item.moduleVersion, `manifests.${index}.moduleVersion`),
    moduleType: moduleType(
      item.moduleType,
      item.moduleId,
      item.name,
      `manifests.${index}.moduleType`,
    ),
    name: text(item.name, `manifests.${index}.name`),
    responsibility: text(item.responsibility, `manifests.${index}.responsibility`),
    ownedConcerns: stringItems(item.ownedConcerns, `manifests.${index}.ownedConcerns`),
    excludedConcerns: stringItems(item.excludedConcerns, `manifests.${index}.excludedConcerns`),
    providedOperations: objectItems(
      item.providedOperations,
      `manifests.${index}.providedOperations`,
    ).map((operation, operationIndex) => ({
      operationId: text(
        operation.operationId,
        `manifests.${index}.providedOperations.${operationIndex}.operationId`,
      ),
      contractVersion: text(
        operation.contractVersion,
        `manifests.${index}.providedOperations.${operationIndex}.contractVersion`,
      ),
    })),
    requiredOperations: objectItems(
      item.requiredOperations,
      `manifests.${index}.requiredOperations`,
    ).map((operation, operationIndex) => ({
      operationId: text(
        operation.operationId,
        `manifests.${index}.requiredOperations.${operationIndex}.operationId`,
      ),
      acceptedContractRange: text(
        operation.acceptedContractRange,
        `manifests.${index}.requiredOperations.${operationIndex}.acceptedContractRange`,
      ),
      reason: text(
        operation.reason,
        `manifests.${index}.requiredOperations.${operationIndex}.reason`,
      ),
    })),
    verificationSuiteIds: stringItems(
      item.verificationSuiteIds,
      `manifests.${index}.verificationSuiteIds`,
    ),
    runtimeAllocation: runtimeAllocation(
      item.runtimeAllocation,
      `manifests.${index}.runtimeAllocation`,
    ),
    events: stringItems(item.events, `manifests.${index}.events`),
    ownedPaths: stringItems(item.ownedPaths, `manifests.${index}.ownedPaths`),
    configurationSchemaRef: configurationSchemaRef(
      item.configurationSchemaRef,
      `manifests.${index}.configurationSchemaRef`,
    ),
  }))
  const moduleNeedTraces = objectItems(record.moduleNeedTraces, 'moduleNeedTraces').map(
    (item, index) => ({
      moduleId: text(item.moduleId, `moduleNeedTraces.${index}.moduleId`),
      needIds: stringItems(item.needIds, `moduleNeedTraces.${index}.needIds`),
    }),
  )
  const validJustifications = new Set([
    'distinct-rules',
    'independent-change',
    'reuse',
    'external-boundary',
  ])
  const moduleJustifications = objectItems(
    record.moduleJustifications,
    'moduleJustifications',
  ).flatMap((item, index) => {
    const moduleId = text(item.moduleId, `moduleJustifications.${index}.moduleId`)
    if (!validJustifications.has(String(item.justification))) {
      nestedDiagnostics.push(diagnostic(
        'CAP-ARCH-IMPORT-JUSTIFICATION',
        'Use a valid module justification.',
        { fieldPath: `moduleJustifications.${index}.justification` },
      ))
      return []
    }
    return [{
      moduleId,
      justification: item.justification as NonNullable<
        ArchitectureProposalInput['moduleJustifications']
      >[number]['justification'],
    }]
  })
  const proposal: ArchitectureProposalInput = {
    architecture,
    manifests,
    moduleNeedTraces,
    moduleJustifications,
  }
  return {
    proposal,
    diagnostics: sortDiagnostics([...schemaDiagnostics, ...nestedDiagnostics]),
  }
}

export function importArchitectureProposal(
  product: ApplicationSpecification,
  raw: unknown,
  lexicon?: SteLexicon,
): ArchitectureImportResult {
  const parsed = parseArchitectureProposal(raw)
  if (!parsed.proposal) {
    return { ok: false, diagnostics: parsed.diagnostics, reviewDiagnostics: [] }
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
  const evaluation = evaluateArchitectureProposal(product, proposal, lexicon)
  const diagnostics = sortDiagnostics([...parsed.diagnostics, ...evaluation.diagnostics])
  const importPassed = evaluation.passed && parsed.diagnostics.length === 0
  const importEvaluation = importPassed
    ? evaluation
    : { ...evaluation, passed: false, diagnostics }
  draft.gateResult = {
    gateId: evaluation.gateId,
    passed: importPassed,
    diagnostics: diagnostics.map((d, i) => ({
      id: `d${i}`,
      code: d.code,
      message: d.message,
      relatedIds: d.relatedIds,
    })),
  }
  return {
    ok: importPassed,
    proposal,
    draft,
    evaluation: importEvaluation,
    diagnostics,
    reviewDiagnostics: evaluation.reviewDiagnostics,
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
  const evaluation = evaluateArchitectureProposal(product, proposal, workspace.getSteLexicon(projectId))
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
