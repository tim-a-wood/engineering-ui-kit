import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  DiagramKind,
  DiagramProjection,
} from '@engineering-ui-kit/core'
import { JointUmlCanvas } from './JointUmlCanvas'
import {
  layoutUmlDiagram,
  type UmlDiagramLayout,
} from './umlDiagramLayout'

type Props = {
  diagrams: DiagramProjection[]
  onOpenImpact?: () => void
  onSelectElement?: (diagram: DiagramProjection, elementId: string) => void
  /** Distinguishes controls when a page shows more than one UML workspace. */
  controlLabelPrefix?: string
}

type WorkerResponse = {
  id: string
  layout?: UmlDiagramLayout
  error?: string
}

const KIND_LABEL: Record<DiagramKind, string> = {
  component: 'Component',
  activity: 'Activity',
  'state-machine': 'State machine',
  sequence: 'Sequence',
  'use-case': 'Use case',
}

function clampZoom(value: number, rounding: 'nearest' | 'floor' = 'nearest'): number {
  const steps = rounding === 'floor' ? Math.floor(value * 20) : Math.round(value * 20)
  return Math.max(0.4, Math.min(1.5, steps / 20))
}

function fittedZoom(
  viewportWidth: number,
  viewportHeight: number,
  layout: UmlDiagramLayout,
): number {
  return clampZoom(Math.min(
    (viewportWidth - 32) / layout.width,
    (viewportHeight - 32) / layout.height,
  ), 'floor')
}

function isPortKind(kind: string): boolean {
  return kind === 'provided-interface' || kind === 'required-interface' || kind === 'port'
}

function layoutDiagram(
  diagram: DiagramProjection,
  onWorker: (worker: Worker) => void,
): Promise<UmlDiagramLayout> {
  if (typeof Worker === 'undefined') return layoutUmlDiagram(diagram)

  return new Promise<UmlDiagramLayout>((resolve, reject) => {
    const worker = new Worker(new URL('./umlLayout.worker.ts', import.meta.url), { type: 'module' })
    const id = `${diagram.id}:${diagram.contentHash}`
    onWorker(worker)
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return
      worker.terminate()
      if (event.data.layout) resolve(event.data.layout)
      else reject(new Error(event.data.error ?? 'The UML layout worker returned no result.'))
    })
    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(new Error(event.message || 'The UML layout worker failed.'))
    })
    worker.postMessage({ id, diagram })
  }).catch(() => {
    // Some Chromium/Electron builds cannot construct ELK's bundled fake worker
    // from inside a module worker. Keep the worker fast path where supported,
    // but always preserve a fully functional in-process layout path.
    return layoutUmlDiagram(diagram)
  })
}

export function UmlDiagramWorkspace({ diagrams, onOpenImpact, onSelectElement, controlLabelPrefix }: Props) {
  const headingId = useId()
  const descriptionId = useId()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [diagramId, setDiagramId] = useState(diagrams[0]?.id ?? '')
  const [selectionId, setSelectionId] = useState('')
  const [layout, setLayout] = useState<UmlDiagramLayout>()
  const [layoutError, setLayoutError] = useState('')
  const [zoom, setZoom] = useState(1)
  const diagram = diagrams.find((item) => item.id === diagramId) ?? diagrams[0]

  useEffect(() => {
    if (diagrams.length && !diagrams.some((item) => item.id === diagramId)) {
      setDiagramId(diagrams[0]!.id)
    }
  }, [diagrams, diagramId])

  useEffect(() => {
    setSelectionId('')
    setLayout(undefined)
    setLayoutError('')
    setZoom(1)
    if (!diagram) return

    let active = true
    let worker: Worker | undefined
    void layoutDiagram(diagram, (nextWorker) => { worker = nextWorker })
      .then((nextLayout) => {
        if (!active) return
        setLayout(nextLayout)
        requestAnimationFrame(() => {
          const viewportWidth = canvasRef.current?.clientWidth ?? 0
          const viewportHeight = canvasRef.current?.clientHeight ?? 0
          if (viewportWidth > 0 && viewportHeight > 0) {
            setZoom(fittedZoom(viewportWidth, viewportHeight, nextLayout))
          }
        })
      })
      .catch((error: unknown) => {
        if (active) setLayoutError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      active = false
      worker?.terminate()
    }
  }, [diagram?.contentHash])

  const selectionOptions = useMemo(() => {
    if (!diagram) return []
    return [
      ...diagram.nodes.map((node) => ({
        id: node.id,
        displayName: `${isPortKind(node.kind) ? 'Interface' : KIND_LABEL[diagram.kind]} · ${node.label}`,
      })),
      ...diagram.edges.map((edge) => ({
        id: edge.id,
        displayName: `Connector · ${edge.label ?? edge.description}`,
      })),
    ]
  }, [diagram])

  const selectedNode = diagram?.nodes.find((node) => node.id === selectionId)
  const selectedEdge = diagram?.edges.find((edge) => edge.id === selectionId)
  const selected = selectedNode ?? selectedEdge
  const hasInspector = Boolean(selected || diagram?.diagnostics.length)

  useEffect(() => {
    if (!layout) return
    requestAnimationFrame(() => {
      const viewportWidth = canvasRef.current?.clientWidth ?? 0
      const viewportHeight = canvasRef.current?.clientHeight ?? 0
      if (viewportWidth > 0 && viewportHeight > 0) {
        setZoom(fittedZoom(viewportWidth, viewportHeight, layout))
      }
    })
  }, [hasInspector, layout])

  if (!diagram) return <p className="capabilities-note">No diagram projections are available.</p>

  const engineLabel = layout?.engine === 'temporal'
    ? 'Temporal message layout'
    : layout?.engine === 'swimlane'
      ? 'Ranked swimlane layout'
      : layout?.engine === 'ranked-activity'
        ? 'Ranked activity layout'
      : layout?.engine === 'balanced-state' ? 'Balanced lifecycle layout' : 'ELK orthogonal layout'

  function fitDiagram() {
    if (!layout) return
    const viewportWidth = canvasRef.current?.clientWidth ?? layout.width
    const viewportHeight = canvasRef.current?.clientHeight ?? layout.height
    setZoom(fittedZoom(viewportWidth, viewportHeight, layout))
  }

  function zoomOut() {
    setZoom((value) => clampZoom(value - 0.1))
  }

  function zoomIn() {
    setZoom((value) => clampZoom(value + 0.1))
  }

  function selectElement(elementId: string) {
    setSelectionId(elementId)
    if (diagram) onSelectElement?.(diagram, elementId)
  }
  const controlLabel = (label: string) => controlLabelPrefix ? `${controlLabelPrefix} ${label.toLocaleLowerCase()}` : label

  return (
    <section
      className="uml-workspace"
      aria-labelledby={headingId}
      data-diagram-content-hash={diagram.contentHash}
    >
      <div className="uml-workspace-head">
        <div>
          <p className="capabilities-eyebrow">Live, record-driven UML</p>
          <h3 id={headingId}>{diagram.title}</h3>
          <p>Generated from the current application, architecture, use-case, and module-design records.</p>
        </div>
        <div className="uml-workspace-status" aria-label="Diagram generation status">
          <span className="uml-live-status"><i aria-hidden="true" />Live projection</span>
          <span className="badge">Revision {diagram.sourceRevision}</span>
        </div>
      </div>
      <div className="tab-row uml-tabs" role="tablist" aria-label="Diagram types">
        {diagrams.map((item) => {
          const repeatedKind = diagrams.filter((candidate) => candidate.kind === item.kind).length > 1
          return (
          <button
            type="button"
            role="tab"
            key={item.id}
            aria-selected={item.id === diagram.id}
            className={item.id === diagram.id ? 'tab active' : 'tab'}
            onClick={setDiagramId.bind(null, item.id)}
          >
            {repeatedKind ? item.title.replace(/\s+(?:module activity|internal sequence)$/i, '') : KIND_LABEL[item.kind]}
            {item.diagnostics.length ? <span className="uml-tab-diagnostic" aria-label="Has diagnostics">!</span> : null}
          </button>
          )
        })}
      </div>
      <div className="uml-canvas-toolbar">
        <div className="uml-layout-meta">
          <strong>{engineLabel}</strong>
          <span>{diagram.nodes.length} symbols</span>
          <span>{diagram.edges.length} connectors</span>
        </div>
        <label className="uml-element-picker">
          <span>Inspect</span>
          <select
            value={selectionId}
            onChange={(event) => selectElement(event.target.value)}
            aria-label={controlLabel('Inspect diagram element')}
          >
            <option value="">Diagram overview</option>
            {selectionOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.displayName}</option>
            ))}
          </select>
        </label>
        <div className="uml-zoom-controls" aria-label={controlLabel('Diagram zoom controls')}>
          <button
            type="button"
            aria-label={controlLabel('Zoom out')}
            disabled={!layout || zoom <= 0.4}
            onClick={zoomOut}
          >
            −
          </button>
          <button type="button" disabled={!layout} onClick={fitDiagram}>{controlLabel('Fit diagram')}</button>
          <output aria-label={controlLabel('Current zoom')}>{Math.round(zoom * 100)}%</output>
          <button
            type="button"
            aria-label={controlLabel('Zoom in')}
            disabled={!layout || zoom >= 1.5}
            onClick={zoomIn}
          >
            +
          </button>
        </div>
      </div>
      <div className={`uml-canvas-layout${hasInspector ? ' has-inspector' : ''}`}>
        <div
          ref={canvasRef}
          className="uml-canvas"
          style={layout?.engine === 'swimlane' || layout?.engine === 'ranked-activity'
            ? { minHeight: Math.min(1120, Math.max(680, layout.height * 0.72 + 32)) }
            : undefined}
          role="img"
          aria-labelledby={`${headingId} ${descriptionId}`}
        >
          <span id={descriptionId} className="sr-only">{diagram.textAlternative}</span>
          {!layout && !layoutError ? (
            <div className="uml-layout-loading" role="status">
              <span aria-hidden="true" />
              Routing symbols, ports, connectors, and labels…
            </div>
          ) : null}
          {layoutError ? (
            <div className="uml-layout-error" role="alert">
              <strong>Diagram layout failed</strong>
              <span>{layoutError}</span>
            </div>
          ) : null}
          {layout ? (
            <JointUmlCanvas
              diagram={diagram}
              layout={layout}
              selectionId={selectionId}
              zoom={zoom}
              onSelect={selectElement}
            />
          ) : null}
        </div>
        {hasInspector ? <aside className="uml-inspector" aria-label="Diagram element details">
          {selected ? (
            <>
              <span className="uml-inspector-kind">{selected.kind}</span>
              <h4>{selectedNode?.label ?? selectedEdge?.label ?? selected.id}</h4>
              <p>{selected.description}</p>
              <dl>
                <div><dt>Source record</dt><dd><code>{selected.sourceRecordId}</code></dd></div>
                <div><dt>Trace IDs</dt><dd>{selected.traceIds.length ? selected.traceIds.map((id) => <code key={id}>{id}</code>) : 'None'}</dd></div>
                {selectedNode?.stereotype ? <div><dt>Stereotype</dt><dd>«{selectedNode.stereotype}»</dd></div> : null}
              </dl>
              {onOpenImpact ? (
                <button type="button" className="btn btn-secondary btn-compact" onClick={onOpenImpact}>
                  Review change impact
                </button>
              ) : null}
              <p>Change the source record to update this projection. Presentation geometry is recalculated and never becomes a second design truth.</p>
            </>
          ) : (
            <>
              <span className="uml-inspector-kind">Diagram</span>
              <h4>Traceable semantics</h4>
              <p>{diagram.textAlternative}</p>
              <dl>
                <div><dt>Layout engine</dt><dd>{engineLabel}</dd></div>
                <div><dt>Projection hash</dt><dd><code>{diagram.contentHash.slice(0, 12)}</code></dd></div>
              </dl>
              <p>Select a symbol, port, connector, or label to inspect its source record and trace identifiers.</p>
            </>
          )}
          {diagram.diagnostics.length ? (
            <div className="uml-diagnostics" role="status">
              <strong>Not fully applicable</strong>
              {diagram.diagnostics.map((item) => <p key={item.id}>{item.message}</p>)}
            </div>
          ) : null}
        </aside> : null}
      </div>
    </section>
  )
}
