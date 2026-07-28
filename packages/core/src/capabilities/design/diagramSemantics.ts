/**
 * EUC-08 — Diagram semantics.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §9.8, §15
 * (all), §24.1, §25.3 (EUC-08/09). Compiles canonical records
 * (`ModuleDesignSpecification`, `ArchitectureSpecification`,
 * `UseCaseAnalysis`) into semantic UML projections (`DiagramProjection`).
 *
 * All functions here are pure: same input produces the same output, no I/O,
 * no randomness, no wall-clock reads. Element and relationship IDs are
 * derived deterministically from source-record IDs via `childId`
 * (./identity.ts), so the same record always yields the same projection
 * (§25.3 EUC-08 acceptance).
 *
 * This module never edits `records.ts` or `identity.ts` (shared contracts);
 * it only imports from them.
 */

import type {
  ActivityActionDefinition,
  DesignDiagnostic,
  DiagramKind,
  DiagramProjection,
  ModuleDesignSpecification,
  ScenarioStep,
  StateTransitionDefinition,
  UmlElement,
  UmlRelationship,
  UseCaseAnalysis,
} from './records.js'
import type { ArchitectureSpecification } from '../types.js'
import { childId, designContentHash, stableSortBy, stableSortStrings } from './identity.js'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ELEMENT_KINDS = new Set<UmlElement['kind']>([
  'component',
  'providedInterface',
  'requiredInterface',
  'actor',
  'useCase',
  'systemBoundary',
  'initialNode',
  'finalNode',
  'action',
  'decision',
  'merge',
  'state',
  'lifeline',
  'fragment',
])

const RELATIONSHIP_KINDS = new Set<UmlRelationship['kind']>([
  'dependency',
  'provides',
  'requires',
  'transition',
  'controlFlow',
  'message',
  'reply',
  'include',
  'extend',
  'association',
])

type ProjectionShell = {
  diagramId: string
  kind: DiagramKind
  title: string
  sourceRecordId: string
  sourceRevision: string
  sourceContentHash: string
  elements: UmlElement[]
  relationships: UmlRelationship[]
}

function elementLabelMap(elements: readonly UmlElement[]): Map<string, string> {
  return new Map(elements.map((element) => [element.id, element.label]))
}

/** §15.2 accessible text alternative: one ordered line per relationship. */
function buildTextAlternative(elements: readonly UmlElement[], relationships: readonly UmlRelationship[]): string[] {
  const labelById = elementLabelMap(elements)
  const label = (id: string) => labelById.get(id) ?? id
  return relationships.map((rel) => {
    switch (rel.kind) {
      case 'dependency':
        return `${label(rel.fromId)} depends on ${label(rel.toId)}${rel.label ? ` — ${rel.label}` : ''}`
      case 'provides':
        return `${label(rel.fromId)} provides ${label(rel.toId)}`
      case 'requires':
        return `${label(rel.fromId)} requires ${label(rel.toId)}`
      case 'transition': {
        const guardPart = rel.guard ? ` [${rel.guard}]` : ''
        const effectPart = rel.effect ? ` / ${rel.effect}` : ''
        return `state ${label(rel.fromId)} → ${label(rel.toId)} on ${rel.trigger ?? ''}${guardPart}${effectPart}`
      }
      case 'controlFlow':
        return `${label(rel.fromId)} → ${label(rel.toId)}${rel.guard ? ` [${rel.guard}]` : ''}`
      case 'message':
        return `${label(rel.fromId)} calls ${label(rel.toId)}${rel.label ? `: ${rel.label}` : ''}`
      case 'reply':
        return `${label(rel.fromId)} replies to ${label(rel.toId)}${rel.label ? `: ${rel.label}` : ''}`
      case 'include':
        return `${label(rel.fromId)} «include» ${label(rel.toId)}`
      case 'extend':
        return `${label(rel.fromId)} «extend» ${label(rel.toId)}`
      case 'association':
      default:
        return `${label(rel.fromId)} — ${label(rel.toId)}`
    }
  })
}

function finalizeProjection(shell: ProjectionShell): DiagramProjection {
  const withoutDiagnostics: Omit<DiagramProjection, 'diagnostics' | 'contentHash'> = {
    ...shell,
    textAlternative: buildTextAlternative(shell.elements, shell.relationships),
  }
  const diagnostics = validateUmlProjection(withoutDiagnostics)
  const withDiagnostics: Omit<DiagramProjection, 'contentHash'> = { ...withoutDiagnostics, diagnostics }
  return { ...withDiagnostics, contentHash: designContentHash({ ...withDiagnostics, contentHash: '' }) }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function referencePattern(id: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9_.-])${escapeRegExp(id)}([^A-Za-z0-9_.-]|$)`)
}

// ---------------------------------------------------------------------------
// §15.1 UML 2.5.1 subset semantic validation
// ---------------------------------------------------------------------------

/**
 * §15.1 / §9.9 "UML semantic validation fails for a required diagram" —
 * validates a diagram projection against the supported UML 2.5.1 subset.
 * Returns stable-coded diagnostics; never mutates the projection.
 */
export function validateUmlProjection(
  projection: Pick<DiagramProjection, 'diagramId' | 'kind' | 'elements' | 'relationships'>,
): DesignDiagnostic[] {
  const diagnostics: DesignDiagnostic[] = []
  const add = (code: string, severity: DesignDiagnostic['severity'], message: string, relatedIds?: string[]) => {
    diagnostics.push({
      id: childId(projection.diagramId, 'diagnostic', `${code}-${relatedIds?.join('.') ?? String(diagnostics.length)}`),
      code,
      severity,
      message,
      ...(relatedIds && relatedIds.length ? { relatedIds } : {}),
    })
  }

  const elementById = new Map(projection.elements.map((element) => [element.id, element]))

  for (const element of projection.elements) {
    if (!ELEMENT_KINDS.has(element.kind)) {
      add('DIAGRAM-UNKNOWN-ELEMENT-KIND', 'blocker', `unknown element kind: ${element.kind}`, [element.id])
    }
  }

  for (const rel of projection.relationships) {
    if (!RELATIONSHIP_KINDS.has(rel.kind)) {
      add('DIAGRAM-UNKNOWN-RELATIONSHIP-KIND', 'blocker', `unknown relationship kind: ${rel.kind}`, [rel.id])
    }
    if (!elementById.has(rel.fromId)) {
      add('DIAGRAM-DANGLING-ENDPOINT', 'blocker', `relationship ${rel.id} has a missing source element ${rel.fromId}`, [rel.id])
    }
    if (!elementById.has(rel.toId)) {
      add('DIAGRAM-DANGLING-ENDPOINT', 'blocker', `relationship ${rel.id} has a missing target element ${rel.toId}`, [rel.id])
    }
    if (rel.kind === 'transition' && !rel.trigger) {
      add('DIAGRAM-TRANSITION-NO-TRIGGER', 'blocker', `transition ${rel.id} has no trigger`, [rel.id])
    }
    const fromElement = elementById.get(rel.fromId)
    if (fromElement?.kind === 'decision' && !rel.guard) {
      add('DIAGRAM-DECISION-NO-GUARD', 'blocker', `decision ${fromElement.id} outgoing edge ${rel.id} has no guard`, [rel.id])
    }
  }

  if (projection.kind === 'sequence') {
    const openCalls: { fromId: string; toId: string }[] = []
    for (const rel of projection.relationships) {
      if (rel.kind === 'message') {
        openCalls.push({ fromId: rel.fromId, toId: rel.toId })
      } else if (rel.kind === 'reply') {
        let matchedIndex = -1
        for (let i = openCalls.length - 1; i >= 0; i--) {
          const call = openCalls[i]!
          if (call.fromId === rel.toId && call.toId === rel.fromId) {
            matchedIndex = i
            break
          }
        }
        if (matchedIndex === -1) {
          add('DIAGRAM-REPLY-WITHOUT-CALL', 'blocker', `reply ${rel.id} has no matching preceding call`, [rel.id])
        } else {
          openCalls.splice(matchedIndex, 1)
        }
      }
    }
  }

  if (projection.kind === 'useCase') {
    const boundary = projection.elements.find((element) => element.kind === 'systemBoundary')
    if (boundary) {
      for (const rel of projection.relationships) {
        if (rel.kind !== 'association' || rel.fromId !== boundary.id) continue
        const target = elementById.get(rel.toId)
        if (target?.kind === 'actor') {
          add('DIAGRAM-ACTOR-INSIDE-BOUNDARY', 'blocker', `actor ${target.id} must be outside the system boundary`, [rel.id])
        }
      }
    }
  }

  if (projection.kind === 'activity') {
    const initials = projection.elements.filter((element) => element.kind === 'initialNode')
    const finals = projection.elements.filter((element) => element.kind === 'finalNode')
    if (initials.length !== 1) {
      add('DIAGRAM-ACTIVITY-INITIAL-COUNT', 'blocker', `activity must have exactly one initial node, found ${initials.length}`)
    }
    if (finals.length < 1) {
      add('DIAGRAM-ACTIVITY-FINAL-MISSING', 'blocker', 'activity must have at least one final node')
    }
  }

  return diagnostics
}

// ---------------------------------------------------------------------------
// §9.8 Component diagram
// ---------------------------------------------------------------------------

export type ComponentDiagramInput = {
  design: ModuleDesignSpecification
  architecture: ArchitectureSpecification
  /** Peer module designs, used to resolve names/responsibility for consumer and dependency components when available. */
  allDesigns?: readonly ModuleDesignSpecification[]
}

/** §9.8 row 1 — selected module, direct consumers, direct dependencies, provided/required interfaces, dependency relationships. */
export function projectComponentDiagram(input: ComponentDiagramInput): DiagramProjection {
  const { design, architecture, allDesigns = [] } = input
  const designByModuleId = new Map(allDesigns.map((peer) => [peer.module.moduleId, peer]))
  const definitionByModuleId = new Map((architecture.moduleDefinitions ?? []).map((def) => [def.moduleId, def]))

  const diagramId = childId(design.id, 'diagram', 'component')
  const moduleElementId = childId(design.id, 'element', `component.${design.module.moduleId}`)
  const componentElementId = (moduleId: string) => childId(design.id, 'element', `component.${moduleId}`)

  const elements = new Map<string, UmlElement>()
  const relationships: UmlRelationship[] = []

  elements.set(moduleElementId, {
    id: moduleElementId,
    kind: 'component',
    label: design.module.name,
    sourceRecordId: design.id,
    sourceElementRef: 'module',
    umlType: '«component»',
    definition: design.module.responsibility,
  })

  const ensurePeerComponent = (moduleId: string): UmlElement => {
    const id = componentElementId(moduleId)
    const existing = elements.get(id)
    if (existing) return existing
    const peerDesign = designByModuleId.get(moduleId)
    const def = definitionByModuleId.get(moduleId)
    const element: UmlElement = {
      id,
      kind: 'component',
      label: peerDesign?.module.name ?? def?.name ?? moduleId,
      sourceRecordId: peerDesign?.id ?? architecture.id,
      sourceElementRef: peerDesign ? 'module' : moduleId,
      umlType: '«component»',
      definition: peerDesign?.module.responsibility ?? def?.responsibility,
    }
    elements.set(id, element)
    return element
  }

  for (const depId of stableSortStrings(design.boundary.directDependencyIds)) {
    ensurePeerComponent(depId)
    const edge = architecture.dependencyEdges.find((e) => e.fromModuleId === design.module.moduleId && e.toModuleId === depId)
    relationships.push({
      id: childId(design.id, 'relationship', `dependency.${design.module.moduleId}.${depId}`),
      kind: 'dependency',
      fromId: moduleElementId,
      toId: componentElementId(depId),
      label: edge?.reason,
      sourceRecordId: design.id,
    })
  }

  for (const consumerId of stableSortStrings(design.boundary.directConsumerIds)) {
    ensurePeerComponent(consumerId)
    const edge = architecture.dependencyEdges.find((e) => e.fromModuleId === consumerId && e.toModuleId === design.module.moduleId)
    relationships.push({
      id: childId(design.id, 'relationship', `dependency.${consumerId}.${design.module.moduleId}`),
      kind: 'dependency',
      fromId: componentElementId(consumerId),
      toId: moduleElementId,
      label: edge?.reason,
      sourceRecordId: design.id,
    })
  }

  for (const op of stableSortBy(design.providedOperations, (o) => o.operationId)) {
    const interfaceId = childId(design.id, 'element', `provided.${op.operationId}`)
    elements.set(interfaceId, {
      id: interfaceId,
      kind: 'providedInterface',
      label: op.operationId,
      sourceRecordId: design.id,
      sourceElementRef: op.operationId,
      umlType: 'provided interface',
    })
    relationships.push({
      id: childId(design.id, 'relationship', `provides.${op.operationId}`),
      kind: 'provides',
      fromId: moduleElementId,
      toId: interfaceId,
      sourceRecordId: design.id,
    })
  }

  for (const op of stableSortBy(design.requiredOperations, (o) => o.operationId)) {
    const interfaceId = childId(design.id, 'element', `required.${op.operationId}`)
    elements.set(interfaceId, {
      id: interfaceId,
      kind: 'requiredInterface',
      label: op.operationId,
      sourceRecordId: design.id,
      sourceElementRef: op.operationId,
      umlType: 'required interface',
      definition: op.reason,
    })
    relationships.push({
      id: childId(design.id, 'relationship', `requires.${op.operationId}`),
      kind: 'requires',
      fromId: moduleElementId,
      toId: interfaceId,
      sourceRecordId: design.id,
    })
  }

  return finalizeProjection({
    diagramId,
    kind: 'component',
    title: `${design.module.name} — component diagram`,
    sourceRecordId: design.id,
    sourceRevision: design.revision,
    sourceContentHash: design.contentHash,
    elements: [...elements.values()],
    relationships,
  })
}

// ---------------------------------------------------------------------------
// §9.8 Activity diagram
// ---------------------------------------------------------------------------

const ACTIVITY_ELEMENT_KIND: Record<ActivityActionDefinition['kind'], UmlElement['kind']> = {
  action: 'action',
  decision: 'decision',
  merge: 'merge',
  initial: 'initialNode',
  final: 'finalNode',
}

const ACTIVITY_UML_TYPE: Record<ActivityActionDefinition['kind'], string> = {
  action: 'action',
  decision: 'decision node',
  merge: 'merge node',
  initial: 'initial node',
  final: 'activity final',
}

/** §9.8 row 2 — main operation or workflow: actions, decisions, guards, recovery, final node. Selects `activityId`, defaulting to the first activity. */
export function projectActivityDiagram(design: ModuleDesignSpecification, activityId?: string): DiagramProjection {
  const activities = design.behavior.activities ?? []
  const activity = activityId ? activities.find((candidate) => candidate.id === activityId) : activities[0]
  const diagramId = childId(design.id, 'diagram', `activity.${activity?.id ?? 'none'}`)

  const elements: UmlElement[] = []
  const relationships: UmlRelationship[] = []

  if (activity) {
    const actionElementId = (actionId: string) => childId(design.id, 'element', `activity.${activity.id}.${actionId}`)
    for (const action of activity.actions) {
      elements.push({
        id: actionElementId(action.id),
        kind: ACTIVITY_ELEMENT_KIND[action.kind],
        label: action.label,
        sourceRecordId: design.id,
        sourceElementRef: action.id,
        umlType: ACTIVITY_UML_TYPE[action.kind],
      })
    }
    for (const action of activity.actions) {
      for (const next of action.next) {
        relationships.push({
          id: childId(design.id, 'relationship', `flow.${activity.id}.${action.id}.${next.targetId}`),
          kind: 'controlFlow',
          fromId: actionElementId(action.id),
          toId: actionElementId(next.targetId),
          guard: next.guard,
          sourceRecordId: design.id,
        })
      }
    }
    if (design.behavior.recovery.trim()) {
      elements.push({
        id: childId(design.id, 'element', `activity.${activity.id}.__recovery__`),
        kind: 'action',
        label: `Recovery: ${design.behavior.recovery}`,
        sourceRecordId: design.id,
        sourceElementRef: 'recovery',
        umlType: 'action',
        definition: design.behavior.recovery,
      })
    }
  }

  return finalizeProjection({
    diagramId,
    kind: 'activity',
    title: `${design.module.name} — ${activity?.name ?? 'activity'} diagram`,
    sourceRecordId: design.id,
    sourceRevision: design.revision,
    sourceContentHash: design.contentHash,
    elements,
    relationships,
  })
}

// ---------------------------------------------------------------------------
// §9.8 / §15.1 State machine diagram
// ---------------------------------------------------------------------------

function formatTransitionLabel(transition: StateTransitionDefinition): string {
  const guardPart = transition.guard ? ` [${transition.guard}]` : ''
  const effectPart = transition.effect ? ` / ${transition.effect}` : ''
  return `${transition.trigger}${guardPart}${effectPart}`
}

/** §9.8 row 3 / §15.1 `trigger [guard] / effect` — selects `recordName`, defaulting to the first state definition. */
export function projectStateMachineDiagram(design: ModuleDesignSpecification, recordName?: string): DiagramProjection {
  const states = design.behavior.states ?? []
  const stateDef = recordName ? states.find((candidate) => candidate.recordName === recordName) : states[0]
  const diagramId = childId(design.id, 'diagram', `stateMachine.${stateDef?.recordName ?? 'none'}`)

  const elements: UmlElement[] = []
  const relationships: UmlRelationship[] = []

  if (stateDef) {
    const stateElementId = (name: string) => childId(design.id, 'element', `state.${stateDef.recordName}.${name}`)
    for (const state of stateDef.states) {
      elements.push({
        id: stateElementId(state),
        kind: 'state',
        label: state,
        sourceRecordId: design.id,
        sourceElementRef: state,
        umlType: 'state',
      })
    }

    const initialId = childId(design.id, 'element', `state.${stateDef.recordName}.__initial__`)
    elements.push({
      id: initialId,
      kind: 'initialNode',
      label: 'Initial',
      sourceRecordId: design.id,
      sourceElementRef: '__initial__',
      umlType: 'initial node',
    })
    relationships.push({
      id: childId(design.id, 'relationship', `state.${stateDef.recordName}.initial`),
      kind: 'controlFlow',
      fromId: initialId,
      toId: stateElementId(stateDef.initialState),
      sourceRecordId: design.id,
    })

    if (stateDef.finalStates.length > 0) {
      const finalId = childId(design.id, 'element', `state.${stateDef.recordName}.__final__`)
      elements.push({
        id: finalId,
        kind: 'finalNode',
        label: 'Final',
        sourceRecordId: design.id,
        sourceElementRef: '__final__',
        umlType: 'final node',
      })
      for (const finalState of stableSortStrings(stateDef.finalStates)) {
        relationships.push({
          id: childId(design.id, 'relationship', `state.${stateDef.recordName}.final.${finalState}`),
          kind: 'controlFlow',
          fromId: stateElementId(finalState),
          toId: finalId,
          sourceRecordId: design.id,
        })
      }
    }

    for (const transition of stateDef.transitions) {
      relationships.push({
        id: childId(design.id, 'relationship', `state.${stateDef.recordName}.transition.${transition.id}`),
        kind: 'transition',
        fromId: stateElementId(transition.from),
        toId: stateElementId(transition.to),
        trigger: transition.trigger,
        guard: transition.guard,
        effect: transition.effect,
        label: formatTransitionLabel(transition),
        sourceRecordId: design.id,
      })
    }
  }

  return finalizeProjection({
    diagramId,
    kind: 'stateMachine',
    title: `${design.module.name} — ${stateDef?.recordName ?? 'state'} state machine`,
    sourceRecordId: design.id,
    sourceRevision: design.revision,
    sourceContentHash: design.contentHash,
    elements,
    relationships,
  })
}

// ---------------------------------------------------------------------------
// §9.8 / §15.1 Sequence diagram
// ---------------------------------------------------------------------------

/** §9.8 row 4 — lifelines, solid calls, dashed replies (ordered top to bottom), labeled combined fragments. Selects `interactionId`, defaulting to the first interaction. */
export function projectSequenceDiagram(design: ModuleDesignSpecification, interactionId?: string): DiagramProjection {
  const interactions = design.behavior.interactions ?? []
  const interaction = interactionId ? interactions.find((candidate) => candidate.id === interactionId) : interactions[0]
  const diagramId = childId(design.id, 'diagram', `sequence.${interaction?.id ?? 'none'}`)

  const elements: UmlElement[] = []
  const relationships: UmlRelationship[] = []

  if (interaction) {
    const lifelineElementId = (lifelineId: string) => childId(design.id, 'element', `lifeline.${interaction.id}.${lifelineId}`)
    for (const lifeline of interaction.lifelines) {
      elements.push({
        id: lifelineElementId(lifeline.id),
        kind: 'lifeline',
        label: lifeline.label,
        sourceRecordId: design.id,
        sourceElementRef: lifeline.id,
        umlType: lifeline.kind,
      })
    }

    for (const fragment of interaction.fragments) {
      elements.push({
        id: childId(design.id, 'element', `fragment.${interaction.id}.${fragment.id}`),
        kind: 'fragment',
        label: fragment.operands.map((operand) => operand.guard).join(' / '),
        sourceRecordId: design.id,
        sourceElementRef: fragment.id,
        umlType: `combined fragment «${fragment.operator}»`,
        definition: fragment.operands.map((operand) => `${operand.id}: ${operand.guard}`).join('; '),
      })
    }

    // Messages preserve `interaction.messages` order — the canonical top-to-bottom order (§15.1).
    for (const message of interaction.messages) {
      relationships.push({
        id: childId(design.id, 'relationship', `message.${interaction.id}.${message.id}`),
        kind: message.kind === 'call' ? 'message' : 'reply',
        fromId: lifelineElementId(message.from),
        toId: lifelineElementId(message.to),
        label: message.label,
        sourceRecordId: design.id,
      })
    }
  }

  return finalizeProjection({
    diagramId,
    kind: 'sequence',
    title: `${design.module.name} — ${interaction?.name ?? 'sequence'} diagram`,
    sourceRecordId: design.id,
    sourceRevision: design.revision,
    sourceContentHash: design.contentHash,
    elements,
    relationships,
  })
}

// ---------------------------------------------------------------------------
// §9.8 / §15.1 Use case diagram
// ---------------------------------------------------------------------------

export type UseCaseDiagramInput = {
  design: ModuleDesignSpecification
  analysis: UseCaseAnalysis
}

/**
 * §9.8 row 5 — actors outside the system boundary, use cases served inside
 * it, `«include»`/`«extend»` labeled. Include/extend relationships are
 * derived heuristically: a scenario step in `mainFlow` (include) or in an
 * `alternatePaths`/`failurePaths` scenario (extend) that references another
 * use case's ID creates a labeled relationship to that use case. See the
 * end-of-packet notes for a proposed `records.ts` field that would replace
 * this heuristic with an explicit source.
 */
export function projectUseCaseDiagram(input: UseCaseDiagramInput): DiagramProjection {
  const { design, analysis } = input
  const selectedIds = stableSortStrings(design.trace.useCaseIds)
  const allUseCaseIds = stableSortStrings(analysis.useCases.map((uc) => uc.id))
  const useCaseById = new Map(analysis.useCases.map((uc) => [uc.id, uc]))
  const actorById = new Map(analysis.actors.map((actor) => [actor.id, actor]))

  const diagramId = childId(design.id, 'diagram', 'useCase')
  const boundaryId = childId(design.id, 'element', 'boundary')
  const useCaseElementId = (ucId: string) => childId(design.id, 'element', `useCase.${ucId}`)
  const actorElementId = (actorId: string) => childId(design.id, 'element', `actor.${actorId}`)

  const elements = new Map<string, UmlElement>()
  const relationships: UmlRelationship[] = []

  elements.set(boundaryId, {
    id: boundaryId,
    kind: 'systemBoundary',
    label: design.module.name,
    sourceRecordId: design.id,
    sourceElementRef: 'module',
    umlType: 'system boundary',
  })

  const ensureUseCaseElement = (ucId: string): UmlElement | undefined => {
    const uc = useCaseById.get(ucId)
    if (!uc) return undefined
    const id = useCaseElementId(ucId)
    const existing = elements.get(id)
    if (existing) return existing
    const element: UmlElement = {
      id,
      kind: 'useCase',
      label: uc.name,
      sourceRecordId: analysis.id,
      sourceElementRef: uc.id,
      umlType: 'use case',
    }
    elements.set(id, element)
    relationships.push({
      id: childId(design.id, 'relationship', `contains.${ucId}`),
      kind: 'association',
      fromId: boundaryId,
      toId: id,
      sourceRecordId: analysis.id,
    })
    return element
  }

  const ensureActorElement = (actorId: string): UmlElement | undefined => {
    const actor = actorById.get(actorId)
    if (!actor) return undefined
    const id = actorElementId(actorId)
    const existing = elements.get(id)
    if (existing) return existing
    const element: UmlElement = {
      id,
      kind: 'actor',
      label: actor.text,
      sourceRecordId: analysis.id,
      sourceElementRef: actor.id,
      umlType: 'actor',
    }
    elements.set(id, element)
    return element
  }

  const scanForReferences = (ucId: string, steps: readonly ScenarioStep[], relKind: 'include' | 'extend') => {
    for (const step of steps) {
      for (const otherId of allUseCaseIds) {
        if (otherId === ucId) continue
        const pattern = referencePattern(otherId)
        if (!pattern.test(step.action) && !pattern.test(step.expectedResult)) continue
        const targetElement = ensureUseCaseElement(otherId)
        if (!targetElement) continue
        relationships.push({
          id: childId(design.id, 'relationship', `${relKind}.${ucId}.${otherId}.${step.id}`),
          kind: relKind,
          fromId: useCaseElementId(ucId),
          toId: targetElement.id,
          label: `«${relKind}»`,
          sourceRecordId: analysis.id,
        })
      }
    }
  }

  const addExplicitReferences = (ucId: string, targetIds: readonly string[], relKind: 'include' | 'extend') => {
    for (const otherId of targetIds) {
      if (otherId === ucId) continue
      const targetElement = ensureUseCaseElement(otherId)
      if (!targetElement) continue
      relationships.push({
        id: childId(design.id, 'relationship', `${relKind}.${ucId}.${otherId}.explicit`),
        kind: relKind,
        fromId: useCaseElementId(ucId),
        toId: targetElement.id,
        label: `«${relKind}»`,
        sourceRecordId: analysis.id,
      })
    }
  }

  for (const ucId of selectedIds) {
    const uc = useCaseById.get(ucId)
    if (!uc) continue
    ensureUseCaseElement(ucId)

    for (const actorId of uc.actors) {
      const actorElement = ensureActorElement(actorId)
      if (!actorElement) continue
      relationships.push({
        id: childId(design.id, 'relationship', `serves.${ucId}.${actorId}`),
        kind: 'association',
        fromId: actorElement.id,
        toId: useCaseElementId(ucId),
        sourceRecordId: analysis.id,
      })
    }

    // Explicit include/extend fields are authoritative when present; the
    // step-text scan remains the fallback for analyses that predate them.
    if (uc.includesUseCaseIds?.length || uc.extendsUseCaseIds?.length) {
      addExplicitReferences(ucId, uc.includesUseCaseIds ?? [], 'include')
      addExplicitReferences(ucId, uc.extendsUseCaseIds ?? [], 'extend')
    } else {
      scanForReferences(ucId, uc.mainFlow, 'include')
      for (const alt of uc.alternatePaths) scanForReferences(ucId, alt.steps, 'extend')
      for (const failure of uc.failurePaths) scanForReferences(ucId, failure.steps, 'extend')
    }
  }

  return finalizeProjection({
    diagramId,
    kind: 'useCase',
    title: `${design.module.name} — use case diagram`,
    sourceRecordId: design.id,
    sourceRevision: design.revision,
    sourceContentHash: design.contentHash,
    elements: [...elements.values()],
    relationships,
  })
}
