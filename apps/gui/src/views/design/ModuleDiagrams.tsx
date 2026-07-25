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

const NODE_WIDTH = 150
const NODE_HEIGHT = 50
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
            {layout.edges.map((edge) => {
              const relationship = projection.relationships.find((rel) => rel.id === edge.relationshipId)
              return (
                <g key={edge.relationshipId} className="design-diagram-edge">
                  <polyline
                    points={edge.points.map((point) => `${point.x},${point.y}`).join(' ')}
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
                  {edge.labelPosition && relationship?.label && (
                    <text x={edge.labelPosition.x} y={edge.labelPosition.y} className="design-diagram-edge-label">
                      {relationship.label}
                    </text>
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
                  <rect width={node.width} height={node.height} rx={6} />
                  <text x={8} y={18} className="design-diagram-node-title">
                    {element.label}
                  </text>
                  <text x={8} y={34} className="design-diagram-node-type" aria-hidden="true">
                    {element.umlType}
                  </text>
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
