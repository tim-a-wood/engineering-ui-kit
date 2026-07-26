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

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
const MIN_SCALE = 0.75
const MAX_SCALE = 2.5

const DIAGRAM_KIND_LABEL: Record<DiagramKind, string> = {
  component: 'Component',
  activity: 'Activity',
  stateMachine: 'State machine',
  sequence: 'Sequence',
  useCase: 'Use case',
}

const DIAGRAM_KIND_DESCRIPTION: Record<DiagramKind, string> = {
  component: 'Module boundary, dependencies, and provided or required interfaces',
  activity: 'Executable control flow, guarded decisions, outcomes, and recovery behavior',
  stateMachine: 'Lifecycle states and valid trigger-driven transitions',
  sequence: 'Ordered collaboration between participants and module boundaries',
  useCase: 'Approved actors and use-case relationships traced into this module',
}

export type ModuleDiagramsProps = {
  store: DesignStore
  design: ModuleDesignSpecification
  architecture: SystemStructureSpecification
  allDesigns: ModuleDesignSpecification[]
  useCaseAnalysis?: UseCaseAnalysis
  diagramDiscussions: Record<string, DiagramDiscussionEntry[]>
  diagramImpacts: Record<string, DesignImpactRecord>
  initialSelectionId?: string
  onSelectionChange?: (selectionId?: string) => void
}

function useDiagramContainer(breakpoint = NARROW_BREAKPOINT) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(900)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(element.getBoundingClientRect().width || 900)
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width, narrow: width < breakpoint }
}

function boundsOf(layout: DiagramLayout) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
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
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, width: 480, height: 320 }
  }
  const padding = 48
  return { minX: minX - padding, minY: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 }
}

function isModuleSelfElement(design: ModuleDesignSpecification, element: UmlElement): boolean {
  return element.kind === 'component' && element.sourceRecordId === design.id && element.sourceElementRef === 'module'
}

function humanizeDiagramText(value: string): string {
  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return normalized
  return `${normalized[0]!.toUpperCase()}${normalized.slice(1)}`
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

function selectorEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function visibleRelationshipLabel(kind: string | undefined, label: string | undefined): string | undefined {
  // Component dependency prose belongs in the relationship detail/list. On
  // the canvas the standard UML stereotype is shorter, unambiguous, and does
  // not collide with neighboring routes.
  if (kind === 'dependency') return '«use»'
  if (!label) return undefined
  return shortRelationshipLabel(humanizeDiagramText(label))
}

function UmlNodeSymbol(props: { element: UmlElement; width: number; height: number; diagramHeight: number }) {
  const { element, width, height, diagramHeight } = props
  const centerY = height / 2
  const isRecovery = element.sourceElementRef === 'recovery'
  const displayLabel = humanizeDiagramText(isRecovery ? element.label.replace(/^Recovery:\s*/i, '') : element.label)
  const lines = wrapNodeLabel(displayLabel, isRecovery ? 38 : 25)
  const text = (x: number, y: number, anchor: 'start' | 'middle' = 'start') => (
    <text x={x} y={y} textAnchor={anchor} className="design-diagram-node-title">
      {lines.map((line, index) => <tspan key={`${line}.${index}`} x={x} dy={index === 0 ? 0 : 15}>{line}</tspan>)}
    </text>
  )

  if (isRecovery) {
    const fold = 18
    return (
      <g className="design-uml-recovery-note">
        <path d={`M 1 1 H ${width - fold} L ${width - 1} ${fold} V ${height - 1} H 1 Z M ${width - fold} 1 V ${fold} H ${width - 1}`} />
        <text x={12} y={18} className="design-diagram-node-type">RECOVERY BEHAVIOR</text>
        <text x={12} y={39} className="design-diagram-node-title">
          {lines.map((line, index) => <tspan key={`${line}.${index}`} x={12} dy={index === 0 ? 0 : 15}>{line}</tspan>)}
        </text>
      </g>
    )
  }

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
      {
        const actorX = width / 2
        const labelY = height - (lines.length > 1 ? 19 : 8)
      return (
        <g className="design-uml-actor">
          <circle cx={actorX} cy={10} r={7} />
          <line x1={actorX} y1={17} x2={actorX} y2={52} />
          <line x1={actorX - 14} y1={29} x2={actorX + 14} y2={29} />
          <line x1={actorX} y1={52} x2={actorX - 12} y2={70} />
          <line x1={actorX} y1={52} x2={actorX + 12} y2={70} />
          {text(actorX, labelY, 'middle')}
        </g>
      )
      }
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
          <circle cx={width / 2} cy={centerY} r={10} />
          {text(width / 2 + 24, centerY + 4)}
        </g>
      )
    case 'finalNode':
      return (
        <g className="design-uml-final">
          <circle cx={width / 2} cy={centerY} r={12} />
          <circle cx={width / 2} cy={centerY} r={7} />
          {text(width / 2 + 26, centerY + 4)}
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
          <line x1={width / 2} y1={height} x2={width / 2} y2={Math.max(height + 120, diagramHeight - 36)} />
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
  const container = useDiagramContainer()
  const narrow = container.narrow
  const [showTextAlternative, setShowTextAlternative] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [scale, setScale] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    setScale(1)
    if (typeof viewportRef.current?.scrollTo === 'function') viewportRef.current.scrollTo({ left: 0, top: 0 })
  }, [activeKind])

  useEffect(() => {
    if (!props.initialSelectionId) return
    const containingTab = tabs.find((tab) =>
      tab.projection.elements.some((element) => element.id === props.initialSelectionId)
      || tab.projection.relationships.some((relationship) => relationship.id === props.initialSelectionId),
    )
    if (!containingTab) return
    setActiveKind(containingTab.kind)
    setSelectedId(props.initialSelectionId)
  }, [props.initialSelectionId, tabs])

  const active = tabs.find((tab) => tab.kind === activeKind) ?? tabs[0]
  const layout = useMemo(() => {
    if (!active) return undefined
    return layoutDiagram(active.projection, narrow ? 'narrow' : 'wide', { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT })
  }, [active, narrow])

  if (!active || !layout) {
    return <p className="secondary-text">No diagrams apply to this module yet.</p>
  }

  const diagramLayout = layout
  const projection = active.projection
  const bounds = boundsOf(diagramLayout)
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
  const pendingImpact = lastImpactEntry?.impactRecordId ? props.diagramImpacts[lastImpactEntry.impactRecordId] : undefined

  function selectId(id?: string) {
    setSelectedId(id)
    props.onSelectionChange?.(id)
  }

  function activateTab(kind: DiagramKind) {
    setActiveKind(kind)
    selectId(undefined)
  }

  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.kind === activeKind)
    const nextIndex =
      event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length
    const kind = tabs[nextIndex]?.kind
    if (!kind) return
    activateTab(kind)
    requestAnimationFrame(() => document.getElementById(`design-diagram-tab-${kind}`)?.focus())
  }

  function clampZoom(value: number) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))))
  }

  function fitDiagram() {
    const available = Math.max(1, container.width - 32)
    setScale(clampZoom(Math.min(1.35, available / bounds.width)))
    requestAnimationFrame(() => {
      if (typeof viewportRef.current?.scrollTo === 'function') viewportRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
    })
  }

  function fitSelection() {
    if (!selectedId) return
    const node = diagramLayout.nodes.find((candidate) => candidate.elementId === selectedId)
    const edge = diagramLayout.edges.find((candidate) => candidate.relationshipId === selectedId)
    const x = node?.x ?? edge?.points[0]?.x ?? 0
    const y = node?.y ?? edge?.points[0]?.y ?? 0
    if (typeof viewportRef.current?.scrollTo !== 'function') return
    viewportRef.current.scrollTo({
      left: Math.max(0, (x - bounds.minX) * scale - viewportRef.current.clientWidth / 2),
      top: Math.max(0, (y - bounds.minY) * scale - viewportRef.current.clientHeight / 2),
      behavior: 'smooth',
    })
  }

  function moveNodeFocus(fromId: string, key: string) {
    const from = diagramLayout.nodes.find((node) => node.elementId === fromId)
    if (!from) return
    const fromX = from.x + from.width / 2
    const fromY = from.y + from.height / 2
    const candidates = diagramLayout.nodes
      .filter((node) => node.elementId !== fromId)
      .map((node) => {
        const dx = node.x + node.width / 2 - fromX
        const dy = node.y + node.height / 2 - fromY
        const inDirection =
          key === 'ArrowRight' ? dx > 0
            : key === 'ArrowLeft' ? dx < 0
              : key === 'ArrowDown' ? dy > 0
                : dy < 0
        return { node, dx, dy, inDirection }
      })
      .filter((candidate) => candidate.inDirection)
      .sort((a, b) => {
        const aPrimary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(a.dx) : Math.abs(a.dy)
        const bPrimary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(b.dx) : Math.abs(b.dy)
        const aSecondary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(a.dy) : Math.abs(a.dx)
        const bSecondary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(b.dy) : Math.abs(b.dx)
        return aPrimary + aSecondary * .35 - (bPrimary + bSecondary * .35)
      })
    const next = candidates[0]?.node
    if (!next) return
    const element = viewportRef.current?.querySelector<SVGGElement>(`[data-diagram-node-id="${selectorEscape(next.elementId)}"]`)
    element?.focus()
  }

  return (
    <div ref={container.ref} className={fullscreen ? 'design-diagrams fullscreen' : 'design-diagrams'}>
      <div className="design-diagram-navigation">
        <div role="tablist" aria-label="Module diagrams" className="design-diagrams-tabs" onKeyDown={onTabsKeyDown}>
          {tabs.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              role="tab"
              id={`design-diagram-tab-${tab.kind}`}
              aria-selected={tab.kind === activeKind}
              aria-controls={`design-diagram-panel-${tab.kind}`}
              tabIndex={tab.kind === activeKind ? 0 : -1}
              className={tab.kind === activeKind ? 'design-diagrams-tab active' : 'design-diagrams-tab'}
              onClick={() => activateTab(tab.kind)}
            >
              {DIAGRAM_KIND_LABEL[tab.kind]}
            </button>
          ))}
        </div>
        <button type="button" className="design-diagrams-toggle" aria-pressed={showTextAlternative} onClick={() => setShowTextAlternative((value) => !value)}>
          Relationship list
        </button>
      </div>

      <div role="tabpanel" id={`design-diagram-panel-${activeKind}`} aria-labelledby={`design-diagram-tab-${activeKind}`}>
        <header className="design-diagram-view-heading">
          <div>
            <p className="overline">{showTextAlternative ? 'Relationship representation' : 'Diagram representation'}</p>
            <h3>{projection.title}</h3>
            <p className="design-diagram-description">{DIAGRAM_KIND_DESCRIPTION[projection.kind]}</p>
            {selectedId && <p className="design-diagram-selection-breadcrumb">Selected · {selectedElement?.label ?? selectedRelationship?.label ?? selectedRelationship?.kind}</p>}
          </div>
          {!showTextAlternative && (
            <div className="design-diagram-heading-actions">
              <span className="design-diagram-standard">UML notation</span>
              <div className="design-diagram-viewport-controls" role="group" aria-label="Diagram viewport controls">
                <button type="button" aria-label="Zoom out" onClick={() => setScale((value) => clampZoom(value - .15))}>−</button>
                <output aria-label="Diagram zoom">{Math.round(scale * 100)}%</output>
                <button type="button" aria-label="Zoom in" onClick={() => setScale((value) => clampZoom(value + .15))}>+</button>
                <button type="button" onClick={fitDiagram}>Fit</button>
                <button type="button" disabled={!selectedId} onClick={fitSelection}>Selection</button>
                <button type="button" aria-pressed={fullscreen} onClick={() => setFullscreen((value) => !value)}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
              </div>
            </div>
          )}
        </header>

        {!showTextAlternative && (
          <details className="design-uml-legend">
            <summary>UML legend</summary>
            <div>
              <span><i className="component" />Component</span>
              <span><i className="provided" />Provided interface</span>
              <span><i className="required" />Required interface</span>
              <span><i className="dependency" />Dependency</span>
              <span><i className="flow" />Flow/message</span>
            </div>
          </details>
        )}

        {showTextAlternative ? (
          <div className="design-diagrams-text-alternative">
            {projection.relationships.length === 0 ? (
              <p className="secondary-text">No relationships to list.</p>
            ) : (
              <ul aria-label="Relationship list">
                {projection.relationships.map((relationship, index) => (
                  <li key={relationship.id}>
                    <button type="button" onClick={() => selectId(relationship.id)}>
                      <span>{relationship.kind}</span>
                      <b>{elementById.get(relationship.fromId)?.label ?? relationship.fromId} → {elementById.get(relationship.toId)?.label ?? relationship.toId}</b>
                      <small>{projection.textAlternative[index] ?? relationship.label ?? 'No additional label'}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="design-diagram-viewport-shell">
          <div
            ref={viewportRef}
            className="design-diagram-viewport"
            role="application"
            tabIndex={0}
            aria-label="Interactive UML diagram. Tab reaches elements and relationships. Arrow keys on a selected element move spatially. Use the Relationship list button for an equivalent linear representation."
            onKeyDown={(event) => {
              if (event.currentTarget !== event.target) return
              const amount = 60
              if (typeof event.currentTarget.scrollBy !== 'function') return
              if (event.key === 'ArrowLeft') event.currentTarget.scrollBy({ left: -amount })
              else if (event.key === 'ArrowRight') event.currentTarget.scrollBy({ left: amount })
              else if (event.key === 'ArrowUp') event.currentTarget.scrollBy({ top: -amount })
              else if (event.key === 'ArrowDown') event.currentTarget.scrollBy({ top: amount })
              else return
              event.preventDefault()
            }}
          >
          <svg
            className={narrow ? 'design-diagram-svg narrow' : 'design-diagram-svg wide'}
            width={Math.max(720, bounds.width * scale)}
            height={Math.max(460, Math.min(820, bounds.height * scale))}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
            preserveAspectRatio="xMidYMid meet"
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
              const displayLabel = visibleRelationshipLabel(relationship?.kind, relationship?.label ?? relationship?.guard)
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
                    onClick={() => selectId(edge.relationshipId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectId(edge.relationshipId)
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
                  onClick={() => selectId(node.elementId)}
                  onKeyDown={(event) => {
                    if (event.key.startsWith('Arrow')) {
                      event.preventDefault()
                      moveNodeFocus(node.elementId, event.key)
                    } else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectId(node.elementId)
                    }
                  }}
                >
                  <UmlNodeSymbol element={element} width={node.width} height={node.height} diagramHeight={bounds.height} />
                </g>
              )
            })}
          </svg>
          </div>
          <div className="design-diagram-minimap" aria-label="Diagram minimap">
            <svg viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`} width="180" height="110" aria-hidden="true">
              {layout.edges.map((edge) => <polyline key={edge.relationshipId} points={edge.points.map((point) => `${point.x},${point.y}`).join(' ')} />)}
              {layout.nodes.map((node) => <rect key={node.elementId} x={node.x} y={node.y} width={node.width} height={node.height} rx={4} />)}
            </svg>
          </div>
          </div>
        )}
        {!showTextAlternative && (
          <footer className="design-diagram-footer">
            <span>Select any UML element or connector to inspect its source and traceability.</span>
            <span>{projection.elements.length} elements · {projection.relationships.length} relationships · {layout.diagnostics.length === 0 ? 'layout verified' : `${layout.diagnostics.length} layout notes`}</span>
          </footer>
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
          canApproveChangePlan={Boolean(pendingImpact && !pendingImpact.approval)}
          canExecuteChangePlan={Boolean(pendingImpact?.approval && !pendingImpact.execution && targetFor(selectedId, selection.kind === 'element' ? selection.element.label : selection.relationship.label ?? selection.relationship.kind).isRenameable)}
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
          onExecuteChangePlan={() =>
            props.store.executeDiagramChangePlan(
              design.module.moduleId,
              targetFor(selectedId, selection.kind === 'element' ? selection.element.label : selection.relationship.label ?? selection.relationship.kind),
            )
          }
          onClose={() => selectId(undefined)}
        />
      )}
    </div>
  )
}
