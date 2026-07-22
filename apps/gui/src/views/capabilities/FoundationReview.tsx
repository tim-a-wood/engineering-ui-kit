/**
 * Foundation plan review (WP5A — CAP-TEST-074/075).
 *
 * Renders ONE canonical `FoundationPlan` — the proposed deployables, the
 * module→deployable allocation rationale, and any unresolved ambiguity
 * questions — identically from Guided and Design (bullet f: both projections
 * show the same records; only copy/detail density differs). Answering a
 * question re-derives the plan through the same pure `proposeFoundation`
 * core function and persists the draft; approval is only possible once
 * `readiness.status === 'ready'` (bullet d backing: `foundationHandoffGate`
 * only enables the downstream Build handoff once an approved, non-stale
 * foundation exists).
 */

import { useId, useState } from 'react'
import type { ArchitectureSpecification, FoundationPlan } from '@engineering-ui-kit/core'
import { foundationHandoffGate } from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../bridge'
import { Dialog } from '../../components'
import { humanizeIdentifier } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  /** The current draft (preferred) or approved plan to review — undefined until first proposed. */
  plan: FoundationPlan | undefined
  approvedFoundation: FoundationPlan | undefined
  approvedArchitecture: ArchitectureSpecification
  projection: 'guided' | 'design'
  /** Called after any persisted mutation (propose/answer/approve) so the parent can refetch canonical state. */
  onChanged?: () => void
}

type Deployable = FoundationPlan['deployables'][number]

type DeploymentConnection = {
  id: string
  fromDeployableId: string
  toDeployableId: string
  reasons: string[]
}

type DeploymentPosition = {
  deployable: Deployable
  x: number
  y: number
}

const DEPLOYMENT_NODE_WIDTH = 260
const DEPLOYMENT_NODE_HEIGHT = 96
const DEPLOYMENT_COLUMN_GAP = 200
const DEPLOYMENT_ROW_GAP = 28
const DEPLOYMENT_PADDING_X = 40
const DEPLOYMENT_PADDING_Y = 36

const genericDeployableNames = new Set([
  'browser',
  'electron main',
  'http api',
  'cli',
  'worker',
  'embedded library',
])

function deployablePresentation(deployable: Deployable): {
  label: string
  description: string
} {
  const fallback = deployable.name.trim()
  const preferFallback = fallback && !genericDeployableNames.has(fallback.toLowerCase())
  switch (deployable.kind) {
    case 'browser':
      return { label: preferFallback ? fallback : 'User interface', description: 'Screens and controls used by people.' }
    case 'electron-main':
      return { label: preferFallback ? fallback : 'Desktop application', description: 'Runs the installed app and local features.' }
    case 'http-api':
      return { label: preferFallback ? fallback : 'Application service', description: 'Runs shared workflows, calculations, and data.' }
    case 'cli':
      return { label: preferFallback ? fallback : 'Command-line tool', description: 'Runs the app from a terminal or script.' }
    case 'worker':
      return { label: preferFallback ? fallback : 'Background processing', description: 'Runs longer tasks in the background.' }
    case 'embedded-library':
      return { label: preferFallback ? fallback : 'Built-in application logic', description: 'Runs inside another application part.' }
  }
}

function deployableRole(deployable: Deployable): string {
  switch (deployable.kind) {
    case 'browser': return 'User-facing'
    case 'electron-main': return 'Desktop'
    case 'http-api': return 'Service'
    case 'cli': return 'Command line'
    case 'worker': return 'Background'
    case 'embedded-library': return 'Built in'
  }
}

function connectionSummary(from: Deployable, to: Deployable): string {
  if (from.kind === 'browser' && to.kind === 'http-api') return 'Sends requests'
  if (from.kind === 'cli' && to.kind === 'http-api') return 'Sends commands'
  if (to.kind === 'worker') return 'Queues work'
  if (to.kind === 'embedded-library') return 'Uses logic'
  if (from.kind === 'worker') return 'Shares results'
  return 'Communicates'
}

function connectionExplanation(from: Deployable, to: Deployable): string {
  const fromName = deployablePresentation(from).label
  const toName = deployablePresentation(to).label
  if (from.kind === 'browser' && to.kind === 'http-api') {
    return 'Sends user requests to the application service and presents the results.'
  }
  if (from.kind === 'cli' && to.kind === 'http-api') {
    return 'Sends commands to the application service and reports the results.'
  }
  if (to.kind === 'worker') return `Sends longer-running work to ${toName} so it can continue in the background.`
  if (to.kind === 'embedded-library') return `Uses ${toName} to complete work inside the same application.`
  return `${fromName} relies on ${toName} to complete part of the application workflow.`
}

function deploymentConnections(
  plan: FoundationPlan,
  architecture: ArchitectureSpecification,
): DeploymentConnection[] {
  const deployableByModule = new Map<string, string>()
  for (const allocation of plan.allocations) deployableByModule.set(allocation.moduleId, allocation.deployableId)
  for (const deployable of plan.deployables) {
    for (const moduleId of deployable.moduleIds) {
      if (!deployableByModule.has(moduleId)) deployableByModule.set(moduleId, deployable.deployableId)
    }
  }

  const grouped = new Map<string, DeploymentConnection>()
  for (const edge of architecture.dependencyEdges ?? []) {
    const fromDeployableId = deployableByModule.get(edge.fromModuleId)
    const toDeployableId = deployableByModule.get(edge.toModuleId)
    if (!fromDeployableId || !toDeployableId || fromDeployableId === toDeployableId) continue
    const id = `${fromDeployableId}::${toDeployableId}`
    const existing = grouped.get(id) ?? { id, fromDeployableId, toDeployableId, reasons: [] }
    if (edge.reason && !existing.reasons.includes(edge.reason)) existing.reasons.push(edge.reason)
    grouped.set(id, existing)
  }
  return [...grouped.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function deploymentLayout(deployables: Deployable[], connections: DeploymentConnection[]): {
  positions: DeploymentPosition[]
  width: number
  height: number
} {
  const deployableById = new Map(deployables.map((deployable) => [deployable.deployableId, deployable]))
  const indegree = new Map(deployables.map((deployable) => [deployable.deployableId, 0]))
  const outgoing = new Map(deployables.map((deployable) => [deployable.deployableId, [] as string[]]))
  const layerById = new Map(deployables.map((deployable) => [deployable.deployableId, 0]))

  for (const connection of connections) {
    if (!deployableById.has(connection.fromDeployableId) || !deployableById.has(connection.toDeployableId)) continue
    indegree.set(connection.toDeployableId, (indegree.get(connection.toDeployableId) ?? 0) + 1)
    outgoing.get(connection.fromDeployableId)?.push(connection.toDeployableId)
  }

  const queue = deployables
    .filter((deployable) => (indegree.get(deployable.deployableId) ?? 0) === 0)
    .map((deployable) => deployable.deployableId)
  const visited = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const targetId of outgoing.get(id) ?? []) {
      layerById.set(targetId, Math.max(layerById.get(targetId) ?? 0, (layerById.get(id) ?? 0) + 1))
      indegree.set(targetId, (indegree.get(targetId) ?? 1) - 1)
      if ((indegree.get(targetId) ?? 0) === 0) queue.push(targetId)
    }
  }

  let nextFallbackLayer = Math.max(0, ...layerById.values())
  for (const deployable of deployables) {
    if (!visited.has(deployable.deployableId)) layerById.set(deployable.deployableId, nextFallbackLayer++)
  }
  if (connections.length === 0 && deployables.length > 1) {
    deployables.forEach((deployable, index) => layerById.set(deployable.deployableId, index))
  }

  const groups = new Map<number, Deployable[]>()
  for (const deployable of deployables) {
    const layer = layerById.get(deployable.deployableId) ?? 0
    groups.set(layer, [...(groups.get(layer) ?? []), deployable])
  }
  const layers = [...groups.keys()].sort((left, right) => left - right)
  const normalizedLayer = new Map(layers.map((layer, index) => [layer, index]))
  const maxRows = Math.max(1, ...[...groups.values()].map((items) => items.length))
  const graphHeight = maxRows * DEPLOYMENT_NODE_HEIGHT + (maxRows - 1) * DEPLOYMENT_ROW_GAP
  const graphWidth = layers.length * DEPLOYMENT_NODE_WIDTH + Math.max(0, layers.length - 1) * DEPLOYMENT_COLUMN_GAP
  const width = Math.max(960, DEPLOYMENT_PADDING_X * 2 + graphWidth)
  const height = Math.max(200, DEPLOYMENT_PADDING_Y * 2 + graphHeight)
  const startX = (width - graphWidth) / 2
  const positions: DeploymentPosition[] = []
  for (const [layer, items] of groups) {
    const column = normalizedLayer.get(layer) ?? 0
    const columnHeight = items.length * DEPLOYMENT_NODE_HEIGHT + (items.length - 1) * DEPLOYMENT_ROW_GAP
    const startY = (height - columnHeight) / 2
    items.forEach((deployable, row) => positions.push({
      deployable,
      x: startX + column * (DEPLOYMENT_NODE_WIDTH + DEPLOYMENT_COLUMN_GAP),
      y: startY + row * (DEPLOYMENT_NODE_HEIGHT + DEPLOYMENT_ROW_GAP),
    }))
  }

  return {
    positions,
    width,
    height,
  }
}

function moduleName(moduleId: string, architecture: ArchitectureSpecification): string {
  return architecture.moduleDefinitions?.find((module) => module.moduleId === moduleId)?.name
    ?? humanizeIdentifier(moduleId)
}

function readinessMessage(plan: FoundationPlan): string {
  if (plan.readiness.status === 'ready') return 'Ready to approve.'
  if (plan.readiness.status === 'ambiguous') return 'A few decisions are needed before this can be approved.'
  return 'This application structure needs attention before it can be approved.'
}

function DeploymentDetails(props: {
  deployable: Deployable
  plan: FoundationPlan
  architecture: ArchitectureSpecification
  connections: DeploymentConnection[]
  onClose: () => void
}) {
  const { deployable, plan, architecture, connections } = props
  const presentation = deployablePresentation(deployable)
  const includedModules = plan.allocations
    .filter((allocation) => allocation.deployableId === deployable.deployableId)
    .map((allocation) => moduleName(allocation.moduleId, architecture))
  const relatedConnections = connections.filter((connection) =>
    connection.fromDeployableId === deployable.deployableId || connection.toDeployableId === deployable.deployableId)
  const deployableById = new Map(plan.deployables.map((item) => [item.deployableId, item]))

  return (
    <Dialog title={presentation.label} onClose={props.onClose} wide>
      <div className="cap-deployment-detail-hero">
        <span>{deployableRole(deployable)}</span>
        <p>{presentation.description}</p>
      </div>
      <section className="cap-deployment-detail-section" aria-label="Included responsibilities">
        <h3>What it includes</h3>
        {includedModules.length ? (
          <ul className="architecture-chip-list">
            {includedModules.map((name) => <li key={name}>{name}</li>)}
          </ul>
        ) : <p className="capabilities-note">No responsibilities are assigned yet.</p>}
      </section>
      <section className="cap-deployment-detail-section" aria-label="Deployment interactions">
        <h3>How it works with other parts</h3>
        {relatedConnections.length ? (
          <ul className="cap-deployment-detail-connections">
            {relatedConnections.map((connection) => {
              const outgoing = connection.fromDeployableId === deployable.deployableId
              const other = deployableById.get(outgoing ? connection.toDeployableId : connection.fromDeployableId)
              if (!other) return null
              return (
                <li key={connection.id}>
                  <span className="architecture-direction">{outgoing ? 'Uses' : 'Used by'}</span>
                  <strong>{deployablePresentation(other).label}</strong>
                  <p>{connectionExplanation(outgoing ? deployable : other, outgoing ? other : deployable)}</p>
                </li>
              )
            })}
          </ul>
        ) : <p className="capabilities-note">This part does not need to communicate with another running part.</p>}
      </section>
    </Dialog>
  )
}

function DeploymentDiagram(props: {
  plan: FoundationPlan
  connections: DeploymentConnection[]
  onOpen: (deployableId: string) => void
}) {
  const markerId = `deployment-arrow-${useId().replace(/:/g, '')}`
  const { positions, width, height } = deploymentLayout(props.plan.deployables, props.connections)
  const positionById = new Map(positions.map((position) => [position.deployable.deployableId, position]))

  return (
    <div className="cap-deployment-map-shell">
      <svg
        className="cap-deployment-topology"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Deployment diagram showing application parts and how they interact"
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>

        {props.connections.map((connection) => {
          const from = positionById.get(connection.fromDeployableId)
          const to = positionById.get(connection.toDeployableId)
          if (!from || !to) return null
          const leftToRight = to.x >= from.x
          const startX = leftToRight ? from.x + DEPLOYMENT_NODE_WIDTH : from.x
          const endX = leftToRight ? to.x : to.x + DEPLOYMENT_NODE_WIDTH
          const startY = from.y + DEPLOYMENT_NODE_HEIGHT / 2
          const endY = to.y + DEPLOYMENT_NODE_HEIGHT / 2
          const controlX = (startX + endX) / 2
          const labelWidth = 156
          const labelHeight = 28
          return (
            <g key={connection.id} className="cap-deployment-edge">
              <path
                d={`M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`}
                markerEnd={`url(#${markerId})`}
              />
              <circle cx={startX} cy={startY} r="5" />
              <foreignObject
                x={controlX - labelWidth / 2}
                y={(startY + endY) / 2 - labelHeight / 2}
                width={labelWidth}
                height={labelHeight}
              >
                <div className="cap-deployment-edge-label">
                  {connectionSummary(from.deployable, to.deployable)}
                </div>
              </foreignObject>
            </g>
          )
        })}

        {positions.map(({ deployable, x, y }) => {
          const presentation = deployablePresentation(deployable)
          return (
            <foreignObject key={deployable.deployableId} x={x} y={y} width={DEPLOYMENT_NODE_WIDTH} height={DEPLOYMENT_NODE_HEIGHT}>
              <button
                type="button"
                className={`cap-deployment-node kind-${deployable.kind}`}
                onClick={() => props.onOpen(deployable.deployableId)}
                aria-label={`${presentation.label}. Open deployment details`}
              >
                <span className="cap-deployment-node-icon" aria-hidden="true">{presentation.label.charAt(0)}</span>
                <span className="cap-deployment-node-copy">
                  <small>{deployableRole(deployable)}</small>
                  <strong>{presentation.label}</strong>
                  <span>{presentation.description}</span>
                </span>
              </button>
            </foreignObject>
          )
        })}
      </svg>
      <ul className="sr-only" aria-label="Deployment connections">
        {props.connections.map((connection) => {
          const from = positionById.get(connection.fromDeployableId)?.deployable
          const to = positionById.get(connection.toDeployableId)?.deployable
          return from && to ? <li key={connection.id}>{deployablePresentation(from).label} uses {deployablePresentation(to).label}: {connectionSummary(from, to)}</li> : null
        })}
      </ul>
      {props.connections.length === 0 ? <p className="cap-deployment-routes-empty">No communication is needed between separate running parts.</p> : null}
    </div>
  )
}

export function FoundationReview({
  bridge,
  projectId,
  plan,
  approvedFoundation,
  approvedArchitecture,
  projection,
  onChanged,
}: Props) {
  const guided = projection === 'guided'
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({})
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [deploymentDetailId, setDeploymentDetailId] = useState<string | null>(null)

  async function proposeInitial(answers: FoundationPlan['resolvedAnswers'] = []) {
    setBusy(true)
    setMessage('')
    try {
      const proposed = await bridge.capabilitiesProposeFoundation({ projectId, answers })
      await bridge.capabilitiesSaveFoundationDraft(projectId, proposed)
      setMessage(
        guided
          ? ''
          : `Updated the application structure with ${proposed.deployables.length} part${proposed.deployables.length === 1 ? '' : 's'}.`,
      )
      onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function answerAmbiguity(id: string) {
    if (!plan) return
    const choice = selectedChoices[id]
    if (!choice) return
    setBusy(true)
    setMessage('')
    try {
      const nextAnswers = [...plan.resolvedAnswers.filter((answer) => answer.id !== id), { id, choice }]
      const reproposed = await bridge.capabilitiesProposeFoundation({ projectId, answers: nextAnswers })
      await bridge.capabilitiesSaveFoundationDraft(projectId, reproposed)
      setMessage(guided ? '' : 'Decision recorded and the application structure updated.')
      onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!plan || plan.readiness.status !== 'ready') return
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesApproveFoundation(projectId, plan)
      if (!result.ok) {
        setMessage(result.reason ?? 'Foundation approval blocked.')
        return
      }
      setMessage('Application structure approved.')
      onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const gate = approvedFoundation
    ? foundationHandoffGate({ approvedFoundation, approvedArchitecture })
    : { enabled: false, reason: 'No approved foundation plan exists for this project.' }
  const foundationCurrent = Boolean(
    plan
    && approvedFoundation
    && plan.contentHash === approvedFoundation.contentHash
    && gate.enabled,
  )
  const connections = plan ? deploymentConnections(plan, approvedArchitecture) : []
  const selectedDeployable = plan?.deployables.find((deployable) => deployable.deployableId === deploymentDetailId)

  return (
    <section className="capabilities-foundation-review" role="region" aria-label="Application structure">
      <h3>How the application runs</h3>
      <p className="lede">
        Review the main parts of the application and what each one is responsible for. Technical implementation details are available separately.
      </p>

      {!plan ? (
        <>
          <p role="status">The application structure has not been proposed yet.</p>
          <button
            type="button"
            className="btn btn-primary btn-compact"
            onClick={() => void proposeInitial()}
            disabled={busy || !projectId}
          >
            Propose application structure
          </button>
        </>
      ) : (
        <>
          <p role="status">{message || (foundationCurrent ? 'Application structure approved.' : readinessMessage(plan))}</p>

          <div aria-label="Deployment diagram">
            <div className="cap-deployment-heading">
              <h4>Deployment diagram</h4>
              <span>{plan.deployables.length} part{plan.deployables.length === 1 ? '' : 's'} · {connections.length} connection{connections.length === 1 ? '' : 's'}</span>
            </div>
            {plan.deployables.length === 0 ? (
              <p className="capabilities-note">No application parts have been proposed.</p>
            ) : (
              <DeploymentDiagram plan={plan} connections={connections} onOpen={setDeploymentDetailId} />
            )}
          </div>

          {plan.unresolvedAmbiguities.length > 0 ? (
            <div aria-label="Open foundation questions" role="group">
              <h4>Open questions</h4>
              {plan.unresolvedAmbiguities.map((ambiguity) => (
                <div key={ambiguity.id} className="cap-foundation-ambiguity">
                  <label htmlFor={`foundation-ambiguity-${ambiguity.id}`}>{ambiguity.question}</label>
                  <select
                    id={`foundation-ambiguity-${ambiguity.id}`}
                    value={selectedChoices[ambiguity.id] ?? ''}
                    onChange={(event) =>
                      setSelectedChoices((prev) => ({ ...prev, [ambiguity.id]: event.target.value }))
                    }
                  >
                    <option value="">Select…</option>
                    {ambiguity.choices.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => void answerAmbiguity(ambiguity.id)}
                    disabled={busy || !selectedChoices[ambiguity.id]}
                  >
                    Answer
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="capabilities-toolbar" role="group" aria-label="Application structure actions">
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => setTechnicalOpen(true)}
            >
              Technical specification
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => void proposeInitial(plan.resolvedAnswers)}
              disabled={busy || !projectId}
            >
              Refresh application structure
            </button>
            {!foundationCurrent ? (
              <button
                type="button"
                className="btn btn-primary btn-compact"
                onClick={() => void approve()}
                disabled={busy || plan.readiness.status !== 'ready'}
              >
                Approve application structure
              </button>
            ) : null}
          </div>

          {projection === 'design' ? (
            <p className="capabilities-note" role="status">
              {gate.enabled ? 'Ready for Build.' : `Build is not ready yet — ${gate.reason}`}
            </p>
          ) : null}

          {technicalOpen ? (
            <Dialog
              title="Technical specification"
              wide
              onClose={() => setTechnicalOpen(false)}
              actions={(
                <button type="button" className="btn btn-primary" onClick={() => setTechnicalOpen(false)}>
                  Close
                </button>
              )}
            >
              <p className="lede">
                These implementation details are used to generate, build, and connect the application.
              </p>
              <dl className="cap-foundation-technical-summary">
                <div><dt>Architecture revision</dt><dd><code>{plan.architectureRevision}</code></dd></div>
                <div><dt>Specification hash</dt><dd><code>{plan.contentHash}</code></dd></div>
              </dl>
              <section className="cap-foundation-technical-section" aria-label="Deployable specifications">
                <h3>Deployables</h3>
                {plan.deployables.map((deployable) => (
                  <article key={deployable.deployableId} className="cap-foundation-technical-card">
                    <h4>{deployable.name}</h4>
                    <dl>
                      <div><dt>ID</dt><dd><code>{deployable.deployableId}</code></dd></div>
                      <div><dt>Host type</dt><dd><code>{deployable.kind}</code></dd></div>
                      <div><dt>Runtime</dt><dd><code>{deployable.runtimeLanguage} {deployable.runtimeVersionRange}</code></dd></div>
                      <div><dt>Composition root</dt><dd><code>{deployable.compositionRootPath}</code></dd></div>
                      <div><dt>Module IDs</dt><dd>{deployable.moduleIds.map((id) => <code key={id}>{id}</code>)}</dd></div>
                      {Object.keys(deployable.commands).length > 0 ? (
                        <div>
                          <dt>Commands</dt>
                          <dd>{Object.entries(deployable.commands).map(([name, command]) => <code key={name}>{name}: {command}</code>)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))}
              </section>
              <section className="cap-foundation-technical-section" aria-label="Module allocation specifications">
                <h3>Module allocations</h3>
                <ul className="cap-foundation-technical-allocations">
                  {plan.allocations.map((allocation) => (
                    <li key={`${allocation.moduleId}::${allocation.deployableId}`}>
                      <code>{allocation.moduleId}</code> → <code>{allocation.deployableId}</code>
                      <span>{allocation.moduleType}</span>
                      <p>{allocation.rationale}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="cap-foundation-technical-section" aria-label="Deployment connection specifications">
                <h3>Deployment connections</h3>
                {connections.length ? (
                  <ul className="cap-foundation-technical-allocations">
                    {connections.map((connection) => (
                      <li key={connection.id}>
                        <code>{connection.fromDeployableId}</code> → <code>{connection.toDeployableId}</code>
                        {connection.reasons.map((reason) => <p key={reason}>{reason}</p>)}
                      </li>
                    ))}
                  </ul>
                ) : <p className="capabilities-note">No cross-deployment connections.</p>}
              </section>
            </Dialog>
          ) : null}

          {selectedDeployable ? (
            <DeploymentDetails
              deployable={selectedDeployable}
              plan={plan}
              architecture={approvedArchitecture}
              connections={connections}
              onClose={() => setDeploymentDetailId(null)}
            />
          ) : null}
        </>
      )}
    </section>
  )
}
