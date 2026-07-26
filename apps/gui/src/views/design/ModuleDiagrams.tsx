/**
 * §9.8 module diagrams + §15 UML rendering.
 *
 * Renders every applicable UML projection for the selected module: component
 * (always), plus activity/state machine/sequence/use-case when the module has
 * that behavior data. Every meaningful node and relationship is selectable
 * (click + keyboard); selection opens `DiagramDetailModal`. A toggleable text
 * alternative (`projection.textAlternative`, §15.2, §18.4) is always
 * available. Layout diagnostics are shown; `layoutDiagram` never hides a
 * relationship.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  layoutDiagram,
  projectActivityDiagram,
  projectComponentDiagram,
  projectSequenceDiagram,
  projectStateMachineDiagram,
  projectUseCaseDiagram,
  type DesignImpactRecord,
  type DiagramDiscussionEntry,
  type DiagramKind,
  type DiagramLayout,
  type DiagramProjection,
  type ModuleDesignSpecification,
  type SystemStructureSpecification,
  type UmlElement,
  type UseCaseAnalysis,
} from '@engineering-ui-kit/core/design-browser'
import { DiagramDetailModal, type DiagramDetailSelection } from './DiagramDetailModal'
import type { DiagramElementTarget, DesignStore } from './designState'

const NODE_WIDTH = 180
const NODE_HEIGHT = 68
const NARROW_BREAKPOINT = 700

const DIAGRAM_KIND_LABEL: Record<DiagramKind, string> = {
  component: 'Component',
  activity: 'Activity',
  stateMachine: 'State machine',
  sequence: 'Sequence',
  useCase: 'Use case',
}

export type ModuleDiagramsProps = {
  store: DesignStore
  design: ModuleDesignSpecification
  architecture: SystemStructureSpecification
  allDesigns: ModuleDesignSpecification[]
  useCaseAnalysis?: UseCaseAnalysis
  diagramDiscussions: Record<string, DiagramDiscussionEntry[]>
  diagramImpacts: Record<string, DesignImpactRecord>
}

function useIsNarrowContainer(breakpoint = NARROW_BREAKPOINT): boolean {
  const [narrow, setNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const listener = () => setNarrow(query.matches)
    if (query.addEventListener) query.addEventListener('change', listener)
    else query.addListener(listener)
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', listener)
      else query.removeListener(listener)
    }
  }, [breakpoint])
  return narrow
}

function boundsOf(layout: DiagramLayout) {
  let minX = 0
  let minY = 0
  let maxX = 400
  let maxY = 260
  for (const node of layout.nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  for (const edge of layout.edges) {
    for (const point of edge.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }
  return { minX: minX - 30, minY: minY - 30, width: maxX - minX + 60, height: maxY - minY + 60 }
}

function isModuleSelfElement(design: ModuleDesignSpecification, element: UmlElement): boolean {
  return element.kind === 'component' && element.sourceRecordId === design.id && element.sourceElementRef === 'module'
}

function wrapNodeLabel(label: string, limit = 25): string[] {
  const words = label.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  for (const word of words) {
    const current = lines[lines.length - 1]
    if (!current || (current.length + word.length + 1 > limit && lines.length < 2)) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  if (lines.length > 2) {
    const tail = lines.slice(1).join(' ')
    lines.splice(1, lines.length - 1, tail)
  }
  if ((lines[1]?.length ?? 0) > limit + 6) lines[1] = `${lines[1]!.slice(0, limit + 3).trimEnd()}…`
  return lines.slice(0, 2)
}

function shortRelationshipLabel(label: string): string {
  return label.length > 32 ? `${label.slice(0, 29).trimEnd()}…` : label
}

function visibleRelationshipLabel(kind: string | undefined, label: string | undefined): string | undefined {
  // Component dependency prose belongs in the relationship detail/list. On
  // the canvas the standard UML stereotype is shorter, unambiguous, and does
  // not collide with neighboring routes.
  if (kind === 'dependency') return '«use»'
  if (!label) return undefined
  return shortRelationshipLabel(label)
}

function UmlNodeSymbol(props: { element: UmlElement; width: number; height: number }) {
  const { element, width, height } = props
  const centerY = height / 2
  const lines = wrapNodeLabel(element.label)
  const text = (x: number, y: number, anchor: 'start' | 'middle' = 'start') => (
    <text x={x} y={y} textAnchor={anchor} className="design-diagram-node-title">
      {lines.map((line, index) => <tspan key={`${line}.${index}`} x={x} dy={index === 0 ? 0 : 15}>{line}</tspan>)}
    </text>
  )

  switch (element.kind) {
    case 'providedInterface':
      return (
        <g className="design-uml-interface design-uml-provided">
          <line x1={width} y1={centerY} x2={width - 12} y2={centerY} />
          <circle cx={width - 20} cy={centerY} r={8} />
          <text x={width - 38} y={centerY - (lines.length > 1 ? 7 : -4)} textAnchor="end" className="design-diagram-node-title">
            {lines.map((line, index) => <tspan key={`${line}.${index}`} x={width - 38} dy={index === 0 ? 0 : 15}>{line}</tspan>)}
          </text>
        </g>
      )
    case 'requiredInterface':
      return (
        <g className="design-uml-interface design-uml-required">
          <line x1={0} y1={centerY} x2={16} y2={centerY} />
          <path d={`M 16 ${centerY - 9} A 9 9 0 0 0 16 ${centerY + 9}`} />
          {text(38, centerY - (lines.length > 1 ? 7 : -4))}
        </g>
      )
    case 'actor':
      return (
        <g className="design-uml-actor">
          <circle cx={28} cy={14} r={7} />
          <line x1={28} y1={21} x2={28} y2={45} />
          <line x1={16} y1={29} x2={40} y2={29} />
          <line x1={28} y1={45} x2={18} y2={60} />
          <line x1={28} y1={45} x2={38} y2={60} />
          {text(52, centerY - (lines.length > 1 ? 7 : -4))}
        </g>
      )
    case 'useCase':
      return (
        <g className="design-uml-use-case">
          <ellipse cx={width / 2} cy={centerY} rx={width / 2 - 2} ry={centerY - 3} />
          {text(width / 2, centerY - (lines.length > 1 ? 7 : -4), 'middle')}
        </g>
      )
    case 'systemBoundary':
      return (
        <g className="design-uml-boundary">
          <rect width={width} height={height} rx={2} />
          <text x={10} y={18} className="design-diagram-node-title">{element.label}</text>
        </g>
      )
    case 'initialNode':
      return (
        <g className="design-uml-initial">
          <circle cx={24} cy={centerY} r={10} />
          {text(46, centerY + 4)}
        </g>
      )
    case 'finalNode':
      return (
        <g className="design-uml-final">
          <circle cx={24} cy={centerY} r={12} />
          <circle cx={24} cy={centerY} r={7} />
          {text(48, centerY + 4)}
        </g>
      )
    case 'decision':
    case 'merge':
      return (
        <g className="design-uml-decision">
          <path d={`M ${width / 2} 2 L ${width - 2} ${centerY} L ${width / 2} ${height - 2} L 2 ${centerY} Z`} />
          {text(width / 2, centerY - (lines.length > 1 ? 7 : -4), 'middle')}
        </g>
      )
    case 'fragment':
      return (
        <g className="design-uml-fragment">
          <rect width={width} height={height} />
          <path d="M 0 22 H 74 L 84 12 V 0" />
          {text(8, 16)}
        </g>
      )
    case 'lifeline':
      return (
        <g className="design-uml-lifeline">
          <rect width={width} height={height} rx={3} />
          {text(width / 2, 28, 'middle')}
          <line x1={width / 2} y1={height} x2={width / 2} y2={height + 120} />
        </g>
      )
    case 'component':
      return (
        <g className="design-uml-component">
          <rect width={width} height={height} rx={5} />
          <g className="design-uml-component-mark" aria-hidden="true">
            <rect x={width - 27} y={10} width={17} height={19} rx={1} />
            <rect x={width - 33} y={13} width={8} height={5} rx={1} />
            <rect x={width - 33} y={21} width={8} height={5} rx={1} />
          </g>
          {text(10, 26)}
          <text x={10} y={height - 10} className="design-diagram-node-type" aria-hidden="true">«component»</text>
        </g>
      )
    case 'state':
    case 'action':
    default:
      return (
        <g className={`design-uml-${element.kind}`}>
          <rect width={width} height={height} rx={element.kind === 'state' ? 12 : 5} />
          {text(10, centerY - (lines.length > 1 ? 7 : -4))}
          <text x={width - 10} y={height - 9} textAnchor="end" className="design-diagram-node-type" aria-hidden="true">{element.umlType}</text>
        </g>
      )
  }
}

export function ModuleDiagrams(props: ModuleDiagramsProps) {
  const { design, architecture, allDesigns, useCaseAnalysis } = props
  const narrow = useIsNarrowContainer()
  const [showTextAlternative, setShowTextAlternative] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const tabs = useMemo(() => {
    const built: { kind: DiagramKind; projection: DiagramProjection }[] = [
      { kind: 'component', projection: projectComponentDiagram({ design, architecture, allDesigns }) },
    ]
    if ((design.behavior.activities ?? []).length > 0) {
      built.push({ kind: 'activity', projection: projectActivityDiagram(design) })
    }
    if ((design.behavior.states ?? []).length > 0) {
      built.push({ kind: 'stateMachine', projection: projectStateMachineDiagram(design) })
    }
    if ((design.behavior.interactions ?? []).length > 0) {
      built.push({ kind: 'sequence', projection: projectSequenceDiagram(design) })
    }
    if (design.trace.useCaseIds.length > 0 && useCaseAnalysis) {
      built.push({ kind: 'useCase', projection: projectUseCaseDiagram({ design, analysis: useCaseAnalysis }) })
    }
    return built
  }, [design, architecture, allDesigns, useCaseAnalysis])

  const [activeKind, setActiveKind] = useState<DiagramKind>(tabs[0]?.kind ?? 'component')
  useEffect(() => {
    if (!tabs.some((tab) => tab.kind === activeKind)) setActiveKind(tabs[0]?.kind ?? 'component')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  const active = tabs.find((tab) => tab.kind === activeKind) ?? tabs[0]
  const layout = useMemo(() => {
    if (!active) return undefined
    return layoutDiagram(active.projection, narrow ? 'narrow' : 'wide', { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT })
  }, [active, narrow])

  if (!active || !layout) {
    return <p className="secondary-text">No diagrams apply to this module yet.</p>
  }

  const projection = active.projection
  const bounds = boundsOf(layout)
  const elementById = new Map(projection.elements.map((element) => [element.id, element]))

  const selectedElement = selectedId ? elementById.get(selectedId) : undefined
  const selectedRelationship = selectedId && !selectedElement ? projection.relationships.find((rel) => rel.id === selectedId) : undefined
  const selection: DiagramDetailSelection | undefined = selectedElement
    ? { kind: 'element', element: selectedElement }
    : selectedRelationship
      ? { kind: 'relationship', relationship: selectedRelationship }
      : undefined

  function targetFor(id: string, label: string): DiagramElementTarget {
    const element = elementById.get(id)
    return {
      diagramId: projection.diagramId,
      diagramKind: projection.kind,
      elementId: id,
      elementLabel: label,
      isRenameable: element ? isModuleSelfElement(design, element) : false,
    }
  }

  const discussion = selectedId ? props.diagramDiscussions[selectedId] ?? [] : []
  const lastImpactEntry = [...discussion].reverse().find((entry) => entry.kind === 'impactAnalysis')
  const lastApprovalEntry = [...discussion].reverse().find((entry) => entry.kind === 'approvedChangePlan')
  const impactIsPending = Boolean(lastImpactEntry) && (!lastApprovalEntry || discussion.indexOf(lastApprovalEntry) < discussion.indexOf(lastImpactEntry!))
  const pendingImpact = impactIsPending && lastImpactEntry?.impactRecordId ? props.diagramImpacts[lastImpactEntry.impactRecordId] : undefined

  return (
    <div className="design-diagrams">
      <div role="tablist" aria-label="Module diagrams" className="design-diagrams-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            id={`design-diagram-tab-${tab.kind}`}
            aria-selected={tab.kind === activeKind}
            aria-controls={`design-diagram-panel-${tab.kind}`}
            className={tab.kind === activeKind ? 'design-diagrams-tab active' : 'design-diagrams-tab'}
            onClick={() => {
              setActiveKind(tab.kind)
              setSelectedId(undefined)
            }}
          >
            {DIAGRAM_KIND_LABEL[tab.kind]}
          </button>
        ))}
        <button type="button" className="design-diagrams-toggle" aria-pressed={showTextAlternative} onClick={() => setShowTextAlternative((v) => !v)}>
          {showTextAlternative ? 'Show diagram' : 'Show relationship list'}
        </button>
      </div>

      <div role="tabpanel" id={`design-diagram-panel-${activeKind}`} aria-labelledby={`design-diagram-tab-${activeKind}`}>
        <h3>{projection.title}</h3>

        {showTextAlternative ? (
          <div className="design-diagrams-text-alternative">
            {projection.textAlternative.length === 0 ? (
              <p className="secondary-text">No relationships to list.</p>
            ) : (
              <ul aria-label="Relationship list">
                {projection.textAlternative.map((line, index) => (
                  <li key={`${line}.${index}`}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <svg
            className={narrow ? 'design-diagram-svg narrow' : 'design-diagram-svg wide'}
            width="100%"
            height={Math.min(560, bounds.height)}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          >
            <defs>
              <marker id={`design-open-arrow-${activeKind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 1 L 9 5 L 1 9" className="design-uml-open-arrow" />
              </marker>
              <marker id={`design-filled-arrow-${activeKind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 1 L 9 5 L 1 9 Z" className="design-uml-filled-arrow" />
              </marker>
            </defs>
            {layout.edges.map((edge) => {
              const relationship = projection.relationships.find((rel) => rel.id === edge.relationshipId)
              const displayLabel = visibleRelationshipLabel(relationship?.kind, relationship?.label)
              const arrowKind = relationship?.kind === 'provides' || relationship?.kind === 'requires' || relationship?.kind === 'association'
                ? undefined
                : relationship?.kind === 'dependency' || relationship?.kind === 'include' || relationship?.kind === 'extend' || relationship?.kind === 'reply'
                  ? `url(#design-open-arrow-${activeKind})`
                  : `url(#design-filled-arrow-${activeKind})`
              const points = edge.points.map((point) => `${point.x},${point.y}`).join(' ')
              return (
                <g key={edge.relationshipId} className={`design-diagram-edge design-diagram-edge-${relationship?.kind ?? 'relationship'}`}>
                  <polyline
                    points={points}
                    markerEnd={arrowKind}
                    className="design-diagram-edge-visible"
                    aria-hidden="true"
                  />
                  <polyline
                    points={points}
                    tabIndex={0}
                    role="button"
                    aria-label={`Relationship: ${relationship?.kind ?? 'relationship'}${relationship?.label ? `, ${relationship.label}` : ''}`}
                    className={selectedId === edge.relationshipId ? 'design-diagram-edge-line selected' : 'design-diagram-edge-line'}
                    onClick={() => setSelectedId(edge.relationshipId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(edge.relationshipId)
                      }
                    }}
                  />
                  {edge.labelPosition && displayLabel && (
                    <g className="design-diagram-edge-label" transform={`translate(${edge.labelPosition.x} ${edge.labelPosition.y - 8})`}>
                      <rect x={-(displayLabel.length * 3.4 + 7)} y={-9} width={displayLabel.length * 6.8 + 14} height={17} rx={4} />
                      <text y={3} textAnchor="middle">{displayLabel}</text>
                    </g>
                  )}
                </g>
              )
            })}
            {layout.nodes.map((node) => {
              const element = elementById.get(node.elementId)
              if (!element) return null
              const selected = selectedId === node.elementId
              return (
                <g
                  key={node.elementId}
                  data-diagram-node-id={node.elementId}
                  tabIndex={0}
                  role="button"
                  aria-label={`${element.umlType}: ${element.label}`}
                  aria-pressed={selected}
                  className={selected ? `design-diagram-node design-diagram-node-${element.kind} selected` : `design-diagram-node design-diagram-node-${element.kind}`}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => setSelectedId(node.elementId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(node.elementId)
                    }
                  }}
                >
                  <UmlNodeSymbol element={element} width={node.width} height={node.height} />
                </g>
              )
            })}
          </svg>
        )}

        {layout.diagnostics.length > 0 && (
          <ul className="design-diagram-diagnostics" aria-label="Layout diagnostics">
            {layout.diagnostics.map((diagnostic) => (
              <li key={diagnostic.id} className={`design-diagnostic-${diagnostic.severity}`}>
                {diagnostic.message}
              </li>
            ))}
          </ul>
        )}
        {projection.diagnostics.length > 0 && (
          <ul className="design-diagram-diagnostics" aria-label="UML validation diagnostics">
            {projection.diagnostics.map((diagnostic) => (
              <li key={diagnostic.id} className={`design-diagnostic-${diagnostic.severity}`}>
                {diagnostic.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selection && selectedId && (
        <DiagramDetailModal
          diagramTitle={projection.title}
          target={targetFor(selectedId, selection.kind === 'element' ? selection.element.label : selection.relationship.label ?? selection.relationship.kind)}
          selection={selection}
          projection={projection}
          discussion={discussion}
          pendingImpact={pendingImpact}
          canApproveChangePlan={Boolean(pendingImpact)}
          onDiscuss={(text) =>
            props.store.addDiagramDiscussion(
              design.module.moduleId,
              targetFor(selectedId, selection.kind === 'element' ? selection.element.label : selection.relationship.label ?? selection.relationship.kind),
              text,
            )
          }
          onProposeChange={(description) =>
            props.store.proposeDiagramChange(
              design.module.moduleId,
              targetFor(selectedId, selection.kind === 'element' ? selection.element.label : selection.relationship.label ?? selection.relationship.kind),
              description,
            )
          }
          onApproveChangePlan={() =>
            props.store.approveDiagramChangePlan(
              design.module.moduleId,
              targetFor(selectedId, selection.kind === 'element' ? selection.element.label : selection.relationship.label ?? selection.relationship.kind),
            )
          }
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </div>
  )
}
