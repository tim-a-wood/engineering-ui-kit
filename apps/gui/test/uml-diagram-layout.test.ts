import { describe, expect, it } from 'vitest'
import type {
  DiagramKind,
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
} from '@engineering-ui-kit/core'
import {
  layoutUmlDiagram,
  type UmlDiagramLayout,
  type UmlLayoutNode,
} from '../src/views/capabilities/umlDiagramLayout'

function node(
  id: string,
  kind: DiagramProjectionNode['kind'],
  label: string,
  parentId?: string,
): DiagramProjectionNode {
  return {
    id,
    kind,
    label,
    parentId,
    description: `${label} description`,
    sourceRecordId: `record:${id}`,
    traceIds: [`trace:${id}`],
  }
}

function edge(
  id: string,
  kind: DiagramProjectionEdge['kind'],
  fromId: string,
  toId: string,
  label?: string,
): DiagramProjectionEdge {
  return {
    id,
    kind,
    fromId,
    toId,
    label,
    description: `${fromId} to ${toId}`,
    sourceRecordId: `record:${id}`,
    traceIds: [`trace:${id}`],
  }
}

function diagram(
  kind: DiagramKind,
  nodes: DiagramProjectionNode[],
  edges: DiagramProjectionEdge[],
): DiagramProjection {
  return {
    schemaVersion: '1.0',
    id: `diagram:${kind}`,
    kind,
    projectId: 'project:test',
    contextId: 'module:focus',
    title: `${kind} test`,
    sourceRevision: '7',
    nodes,
    edges,
    diagnostics: [],
    textAlternative: `${kind} diagram`,
    contentHash: `hash:${kind}:${nodes.length}:${edges.length}`,
  }
}

function overlaps(a: UmlLayoutNode, b: UmlLayoutNode): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

function expectValidCanvas(layout: UmlDiagramLayout): void {
  expect(layout.width).toBeGreaterThanOrEqual(920)
  expect(layout.height).toBeGreaterThanOrEqual(520)
  for (const node of layout.nodes) {
    expect(node.x).toBeGreaterThanOrEqual(0)
    expect(node.y).toBeGreaterThanOrEqual(0)
    expect(node.x + node.width).toBeLessThanOrEqual(layout.width)
    expect(node.y + node.height).toBeLessThanOrEqual(layout.height)
  }
  for (const connector of layout.edges) {
    expect(connector.points.length).toBeGreaterThanOrEqual(2)
    for (const point of connector.points) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(layout.width)
      expect(point.y).toBeLessThanOrEqual(layout.height)
    }
  }
}

function properOrthogonalCrossingMetrics(layout: UmlDiagramLayout): {
  count: number
  minimumClearance: number
} {
  const aligned = (left: number, right: number) => Math.abs(left - right) < 0.01
  const segments = layout.edges.flatMap((connector) =>
    connector.points.slice(0, -1).map((start, index) => ({
      edgeId: connector.id,
      start,
      end: connector.points[index + 1]!,
    })))
  let crossings = 0
  let minimumClearance = Number.POSITIVE_INFINITY
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      const a = segments[left]!
      const b = segments[right]!
      if (a.edgeId === b.edgeId) continue
      const horizontal = aligned(a.start.y, a.end.y)
        ? a
        : aligned(b.start.y, b.end.y) ? b : undefined
      const vertical = aligned(a.start.x, a.end.x)
        ? a
        : aligned(b.start.x, b.end.x) ? b : undefined
      if (!horizontal || !vertical || horizontal === vertical) continue
      const x = vertical.start.x
      const y = horizontal.start.y
      const withinHorizontal = x > Math.min(horizontal.start.x, horizontal.end.x)
        && x < Math.max(horizontal.start.x, horizontal.end.x)
      const withinVertical = y > Math.min(vertical.start.y, vertical.end.y)
        && y < Math.max(vertical.start.y, vertical.end.y)
      if (withinHorizontal && withinVertical) {
        crossings += 1
        minimumClearance = Math.min(
          minimumClearance,
          Math.abs(x - horizontal.start.x),
          Math.abs(x - horizontal.end.x),
          Math.abs(y - vertical.start.y),
          Math.abs(y - vertical.end.y),
        )
      }
    }
  }
  return { count: crossings, minimumClearance }
}

describe('JointJS + ELK UML layout adapter', () => {
  it('routes component dependencies to declared UML interfaces and keeps components separate', async () => {
    const projection = diagram('component', [
      node('component:consumer', 'component', 'Operations console'),
      node('component:focus', 'component', 'Workflow orchestration'),
      node('provided:focus:start', 'provided-interface', 'startWorkflow', 'component:focus'),
      node('required:focus:store', 'required-interface', 'persistWorkflowState', 'component:focus'),
      node('component:store', 'component', 'Workflow state repository'),
    ], [
      edge('dependency:consumer:focus', 'dependency', 'component:consumer', 'provided:focus:start', '«use»'),
      edge('dependency:focus:store', 'dependency', 'required:focus:store', 'component:store', '«use»'),
    ])

    const layout = await layoutUmlDiagram(projection)
    expect(layout.engine).toBe('elk-layered')
    expectValidCanvas(layout)

    const components = layout.nodes.filter((candidate) => candidate.kind === 'component')
    for (let left = 0; left < components.length; left += 1) {
      for (let right = left + 1; right < components.length; right += 1) {
        expect(overlaps(components[left]!, components[right]!)).toBe(false)
      }
    }

    const focus = layout.nodes.find((candidate) => candidate.id === 'component:focus')!
    expect(focus.ports.map((port) => port.id)).toEqual([
      'provided:focus:start',
      'required:focus:store',
    ])
    const provided = focus.ports[0]!
    const required = focus.ports[1]!
    expect(Math.abs(provided.x - focus.x)).toBeLessThanOrEqual(9)
    expect(Math.abs(required.x - (focus.x + focus.width))).toBeLessThanOrEqual(9)

    const inbound = layout.edges.find((candidate) => candidate.id === 'dependency:consumer:focus')!
    const outbound = layout.edges.find((candidate) => candidate.id === 'dependency:focus:store')!
    const inboundEnd = inbound.points.at(-1)!
    const outboundStart = outbound.points[0]!
    expect(Math.hypot(inboundEnd.x - provided.x, inboundEnd.y - provided.y)).toBeLessThanOrEqual(9)
    expect(Math.hypot(outboundStart.x - required.x, outboundStart.y - required.y)).toBeLessThanOrEqual(9)
    expect(inbound.points).toHaveLength(2)
    expect(outbound.points).toHaveLength(2)
    for (const connector of layout.edges) {
      for (let index = 1; index < connector.points.length - 1; index += 1) {
        const before = connector.points[index - 1]!
        const point = connector.points[index]!
        const after = connector.points[index + 1]!
        expect(
          (before.x === point.x && point.x === after.x)
          || (before.y === point.y && point.y === after.y),
        ).toBe(false)
      }
    }
    expect(inbound.label).toBeDefined()
    expect(outbound.label).toBeDefined()
  })

  it('lays activity and state behavior out deterministically without overlapping semantic nodes', async () => {
    const activity = diagram('activity', [
      node('activity:initial', 'initial', 'Initial'),
      node('activity:validate', 'action', 'Validate the complete workflow request and authorization context'),
      node('activity:execute', 'action', 'Execute the approved workflow against the current application state'),
      node('activity:final', 'final', 'Final'),
    ], [
      edge('flow:1', 'control-flow', 'activity:initial', 'activity:validate'),
      {
        ...edge('flow:2', 'control-flow', 'activity:validate', 'activity:execute', 'Success'),
        guard: 'The request is valid.',
        outcome: 'success',
      },
      edge('flow:3', 'control-flow', 'activity:execute', 'activity:final'),
    ])

    const first = await layoutUmlDiagram(activity)
    const second = await layoutUmlDiagram(activity)
    expect(first).toEqual(second)
    expect(first.engine).toBe('ranked-activity')
    expectValidCanvas(first)
    expect(first.nodes.map((candidate) => candidate.y)).toEqual(
      [...first.nodes].sort((a, b) => a.y - b.y).map((candidate) => candidate.y),
    )
    for (let index = 0; index < first.nodes.length - 1; index += 1) {
      expect(overlaps(first.nodes[index]!, first.nodes[index + 1]!)).toBe(false)
    }
    expect(first.edges.find((candidate) => candidate.id === 'flow:2')?.label).toBeDefined()

    const state = diagram('state-machine', [
      node('state:initial', 'initial', 'Initial'),
      node('state:draft', 'state', 'Draft awaiting complete user input'),
      node('state:review', 'state', 'Ready for engineering review'),
      node('state:final', 'final', 'Final'),
    ], [
      edge('transition:1', 'transition', 'state:initial', 'state:draft', 'create / initialize'),
      edge('transition:2', 'transition', 'state:draft', 'state:review', 'submit [valid] / queue review'),
      edge('transition:3', 'transition', 'state:review', 'state:final', 'approve / publish'),
    ])
    const stateLayout = await layoutUmlDiagram(state)
    expectValidCanvas(stateLayout)
    expect(stateLayout.engine).toBe('balanced-state')
    expect(stateLayout.width / stateLayout.height).toBeGreaterThan(1.8)
    expect(stateLayout.edges.every((candidate) => candidate.label)).toBe(true)
  })

  it('keeps allocated actions inside UML swimlanes and preserves fork and join routing', async () => {
    const projection = diagram('activity', [
      node('lane:ui', 'swimlane', 'Audit experience'),
      node('lane:workflow', 'swimlane', 'Assurance workflow'),
      node('activity:start', 'initial', 'Initial'),
      node('activity:select', 'action', 'Select review evidence', 'lane:ui'),
      node('activity:fork', 'fork', 'Start checks', 'lane:workflow'),
      node('activity:independence', 'call-operation', 'Check reviewer independence', 'lane:workflow'),
      node('activity:history', 'action', 'Check review history', 'lane:workflow'),
      node('activity:join', 'join', 'Finish checks', 'lane:workflow'),
      node('activity:result', 'send-event', 'Send review result', 'lane:ui'),
      node('activity:end', 'final', 'Final'),
    ], [
      edge('flow:lane:1', 'control-flow', 'activity:start', 'activity:select'),
      edge('flow:lane:2', 'control-flow', 'activity:select', 'activity:fork'),
      edge('flow:lane:3', 'control-flow', 'activity:fork', 'activity:independence'),
      edge('flow:lane:4', 'control-flow', 'activity:fork', 'activity:history'),
      edge('flow:lane:5', 'control-flow', 'activity:independence', 'activity:join'),
      edge('flow:lane:6', 'control-flow', 'activity:history', 'activity:join'),
      edge('flow:lane:7', 'control-flow', 'activity:join', 'activity:result'),
      edge('flow:lane:8', 'control-flow', 'activity:result', 'activity:end'),
    ])

    const layout = await layoutUmlDiagram(projection)
    expect(layout.engine).toBe('swimlane')
    expectValidCanvas(layout)
    const byId = new Map(layout.nodes.map((candidate) => [candidate.id, candidate]))
    for (const [actionId, laneId] of [
      ['activity:select', 'lane:ui'],
      ['activity:result', 'lane:ui'],
      ['activity:fork', 'lane:workflow'],
      ['activity:independence', 'lane:workflow'],
      ['activity:history', 'lane:workflow'],
      ['activity:join', 'lane:workflow'],
    ] as const) {
      const action = byId.get(actionId)!
      const lane = byId.get(laneId)!
      expect(action.x).toBeGreaterThan(lane.x)
      expect(action.y).toBeGreaterThan(lane.y + 42)
      expect(action.x + action.width).toBeLessThan(lane.x + lane.width)
      expect(action.y + action.height).toBeLessThan(lane.y + lane.height)
    }
    expect(byId.get('activity:fork')?.height).toBe(12)
    expect(byId.get('activity:join')?.height).toBe(12)
    expect(layout.edges.every((connector) => connector.points.length >= 2)).toBe(true)
  })

  it('balances a cyclic state machine with distinct forward and return routes', async () => {
    const projection = diagram('state-machine', [
      node('state:initial', 'initial', 'Initial'),
      node('state:open', 'state', 'Open'),
      node('state:assigned', 'state', 'Assigned'),
      node('state:correcting', 'state', 'Correcting'),
      node('state:ready', 'state', 'Ready'),
      node('state:closed', 'state', 'Closed'),
    ], [
      edge('transition:initialize', 'transition', 'state:initial', 'state:open', 'Initialize'),
      edge('transition:assign', 'transition', 'state:open', 'state:assigned', 'Assign owner'),
      edge('transition:correct', 'transition', 'state:assigned', 'state:correcting', 'Record correction'),
      {
        ...edge('transition:submit', 'transition', 'state:correcting', 'state:ready', 'Request closure'),
        guard: 'The evidence is complete.',
      },
      {
        ...edge('transition:return', 'transition', 'state:ready', 'state:correcting', 'Return finding'),
        guard: 'A closure rule fails.',
      },
      {
        ...edge('transition:close', 'transition', 'state:ready', 'state:closed', 'Approve closure'),
        guard: 'All closure rules pass.',
      },
      {
        ...edge('transition:reopen', 'transition', 'state:closed', 'state:open', 'Reopen finding'),
        guard: 'New evidence invalidates closure.',
      },
    ])

    const layout = await layoutUmlDiagram(projection)
    expect(layout.engine).toBe('balanced-state')
    expectValidCanvas(layout)
    expect(layout.edges).toHaveLength(projection.edges.length)
    expect(layout.edges.every((connector) => connector.label)).toBe(true)
    for (let left = 0; left < layout.nodes.length; left += 1) {
      for (let right = left + 1; right < layout.nodes.length; right += 1) {
        expect(overlaps(layout.nodes[left]!, layout.nodes[right]!)).toBe(false)
      }
    }
    const forward = layout.edges.find((connector) => connector.id === 'transition:submit')!
    const reverse = layout.edges.find((connector) => connector.id === 'transition:return')!
    expect(forward.points).not.toEqual(reverse.points)
  })

  it('uses a temporal layout for sequence messages and preserves their semantic order', async () => {
    const projection = diagram('sequence', [
      node('lifeline:user', 'lifeline', 'Workflow operator'),
      node('lifeline:controller', 'lifeline', 'Workflow controller'),
      node('lifeline:repository', 'lifeline', 'Application state repository'),
    ], [
      edge('message:1', 'synchronous-message', 'lifeline:user', 'lifeline:controller', '1: submitWorkflow(request)'),
      edge('message:2', 'synchronous-message', 'lifeline:controller', 'lifeline:repository', '2: loadCurrentState()'),
      edge('message:3', 'reply-message', 'lifeline:repository', 'lifeline:controller', '3: currentState'),
    ])

    const layout = await layoutUmlDiagram(projection)
    expect(layout.engine).toBe('temporal')
    expectValidCanvas(layout)
    const messageRows = layout.edges.map((candidate) => candidate.points[0]!.y)
    expect(messageRows).toEqual([...messageRows].sort((a, b) => a - b))
    expect(new Set(messageRows).size).toBe(projection.edges.length)
    expect(layout.nodes.every((candidate) => candidate.height > messageRows.at(-1)! - candidate.y)).toBe(true)
  })

  it('limits a sequence fragment to the referenced message rows', async () => {
    const first = {
      ...edge('message:first', 'synchronous-message', 'lifeline:user', 'lifeline:controller', 'Submit request'),
      traceIds: ['message:first'],
    }
    const guarded = {
      ...edge('message:guarded', 'reply-message', 'lifeline:controller', 'lifeline:user', 'Reject request'),
      guard: 'The request is invalid.',
      traceIds: ['message:guarded'],
    }
    const last = {
      ...edge('message:last', 'synchronous-message', 'lifeline:user', 'lifeline:controller', 'Revise request'),
      traceIds: ['message:last'],
    }
    const fragment = {
      ...node('fragment:alternate', 'fragment', 'alt'),
      traceIds: ['fragment:alternate', 'message:guarded'],
    }
    const projection = diagram('sequence', [
      node('lifeline:user', 'lifeline', 'Workflow operator'),
      node('lifeline:controller', 'lifeline', 'Workflow controller'),
      fragment,
    ], [first, guarded, last])

    const layout = await layoutUmlDiagram(projection)
    const fragmentLayout = layout.nodes.find((candidate) => candidate.id === fragment.id)!
    const rows = layout.edges.map((candidate) => candidate.points[0]!.y)
    expect(rows[0]).toBeLessThan(fragmentLayout.y)
    expect(rows[1]).toBeGreaterThanOrEqual(fragmentLayout.y)
    expect(rows[1]).toBeLessThanOrEqual(fragmentLayout.y + fragmentLayout.height)
    expect(rows[2]).toBeGreaterThan(fragmentLayout.y + fragmentLayout.height)
    expect(layout.edges[1]!.label?.height).toBeGreaterThan(24)
  })

  it('keeps use cases inside the system boundary and actors outside it', async () => {
    const projection = diagram('use-case', [
      node('system:app', 'system-boundary', 'Workflow management application'),
      node('actor:operator', 'actor', 'Workflow operator'),
      node('actor:auditor', 'actor', 'Compliance auditor'),
      node('use-case:start', 'use-case', 'Start and monitor an approved workflow', 'system:app'),
      node('use-case:audit', 'use-case', 'Review immutable workflow evidence', 'system:app'),
    ], [
      edge('association:operator:start', 'association', 'actor:operator', 'use-case:start'),
      edge('association:auditor:audit', 'association', 'actor:auditor', 'use-case:audit'),
    ])

    const layout = await layoutUmlDiagram(projection)
    expectValidCanvas(layout)
    const boundary = layout.nodes.find((candidate) => candidate.kind === 'system-boundary')!
    const useCases = layout.nodes.filter((candidate) => candidate.kind === 'use-case')
    const actors = layout.nodes.filter((candidate) => candidate.kind === 'actor')
    for (const useCase of useCases) {
      expect(useCase.x).toBeGreaterThan(boundary.x)
      expect(useCase.y).toBeGreaterThan(boundary.y)
      expect(useCase.x + useCase.width).toBeLessThan(boundary.x + boundary.width)
      expect(useCase.y + useCase.height).toBeLessThan(boundary.y + boundary.height)
    }
    expect(actors.every((actor) => !overlaps(actor, boundary))).toBe(true)
  })

  it('splits a dense assurance graph and gives any residual crossover room for an explicit bridge', async () => {
    const projection = diagram('use-case', [
      node('system:audit-hub', 'system-boundary', 'DO-178C Audit Hub'),
      node('actor:vv', 'actor', 'Verification and validation engineer'),
      node('actor:qa', 'actor', 'Software quality assurance engineer'),
      node('actor:lead', 'actor', 'Certification lead or authorized representative'),
      node('actor:auditor', 'actor', 'Internal or external auditor with approved access'),
      node('actor:cm', 'actor', 'Configuration management engineer'),
      node('use-case:findings', 'use-case', 'Manage an assurance finding through closure', 'system:audit-hub'),
      node('use-case:reviews', 'use-case', 'Record an independent assurance review', 'system:audit-hub'),
      node('use-case:package', 'use-case', 'Build a deterministic audit package', 'system:audit-hub'),
    ], [
      edge('association:vv:findings', 'association', 'actor:vv', 'use-case:findings'),
      edge('association:qa:findings', 'association', 'actor:qa', 'use-case:findings'),
      edge('association:lead:findings', 'association', 'actor:lead', 'use-case:findings'),
      edge('association:qa:reviews', 'association', 'actor:qa', 'use-case:reviews'),
      edge('association:vv:reviews', 'association', 'actor:vv', 'use-case:reviews'),
      edge('association:auditor:reviews', 'association', 'actor:auditor', 'use-case:reviews'),
      edge('association:lead:package', 'association', 'actor:lead', 'use-case:package'),
      edge('association:auditor:package', 'association', 'actor:auditor', 'use-case:package'),
      edge('association:cm:package', 'association', 'actor:cm', 'use-case:package'),
    ])

    const layout = await layoutUmlDiagram(projection)
    expectValidCanvas(layout)
    const crossings = properOrthogonalCrossingMetrics(layout)
    expect(crossings.count).toBeLessThanOrEqual(1)
    if (crossings.count) expect(crossings.minimumClearance).toBeGreaterThanOrEqual(18)
    const boundary = layout.nodes.find((candidate) => candidate.kind === 'system-boundary')!
    const actors = layout.nodes.filter((candidate) => candidate.kind === 'actor')
    expect(actors.some((actor) => actor.x + actor.width < boundary.x)).toBe(true)
    expect(actors.some((actor) => actor.x > boundary.x + boundary.width)).toBe(true)
  })

  it('responds to projection changes rather than retaining stale presentation geometry', async () => {
    const original = diagram('component', [
      node('component:a', 'component', 'Application shell'),
      node('component:b', 'component', 'Workflow module'),
    ], [
      edge('dependency:a:b', 'dependency', 'component:a', 'component:b', '«use»'),
    ])
    const updated = diagram('component', [
      ...original.nodes,
      node('component:c', 'component', 'Evidence service'),
    ], [
      ...original.edges,
      edge('dependency:b:c', 'dependency', 'component:b', 'component:c', '«use»'),
    ])

    const before = await layoutUmlDiagram(original)
    const after = await layoutUmlDiagram(updated)
    expect(before.nodes.map((candidate) => candidate.id)).not.toContain('component:c')
    expect(after.nodes.map((candidate) => candidate.id)).toContain('component:c')
    expect(after.edges.map((candidate) => candidate.id)).toContain('dependency:b:c')
    expect(after.width).toBeGreaterThan(before.width)
  })
})
