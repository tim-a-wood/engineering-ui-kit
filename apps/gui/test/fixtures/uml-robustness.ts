import type {
  DiagramKind,
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
} from '@engineering-ui-kit/core'

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
    description: `${label}.`,
    sourceRecordId: `record:${id}`,
    traceIds: [`trace:${id}`],
    ...(parentId ? { parentId } : {}),
  }
}

function edge(
  id: string,
  kind: DiagramProjectionEdge['kind'],
  fromId: string,
  toId: string,
  label?: string,
  options: Partial<Pick<DiagramProjectionEdge, 'guard' | 'isLoop' | 'outcome'>> = {},
): DiagramProjectionEdge {
  return {
    id,
    kind,
    fromId,
    toId,
    ...(label ? { label } : {}),
    ...options,
    description: `${fromId} to ${toId}.`,
    sourceRecordId: `record:${id}`,
    traceIds: [`trace:${id}`],
  }
}

function diagram(
  id: string,
  kind: DiagramKind,
  title: string,
  nodes: DiagramProjectionNode[],
  edges: DiagramProjectionEdge[],
): DiagramProjection {
  return {
    schemaVersion: '1.0',
    id,
    kind,
    projectId: 'project:uml-robustness',
    contextId: `context:${id}`,
    title,
    sourceRevision: '1',
    sourceRecordIds: [`record:${id}`],
    nodes,
    edges,
    diagnostics: [],
    textAlternative: `${title}. ${nodes.length} symbols. ${edges.length} connectors.`,
    contentHash: `hash:${id}:1`,
  }
}

function logisticsPlatform(): DiagramProjection {
  const components = [
    ['console', 'Control console'],
    ['driver', 'Driver app'],
    ['gateway', 'API gateway'],
    ['dispatch', 'Dispatch service'],
    ['planning', 'Route planner'],
    ['orders', 'Order service'],
    ['fleet', 'Fleet service'],
    ['tracking', 'Tracking service'],
    ['events', 'Event stream'],
    ['audit', 'Audit store'],
    ['maps', 'Map adapter'],
    ['traffic', 'Traffic adapter'],
    ['notify', 'Message adapter'],
  ] as const
  const nodes = components.map(([id, label]) => node(`component:${id}`, 'component', label))
  const links = [
    ['console', 'gateway'],
    ['driver', 'gateway'],
    ['gateway', 'dispatch'],
    ['gateway', 'tracking'],
    ['dispatch', 'planning'],
    ['dispatch', 'orders'],
    ['dispatch', 'fleet'],
    ['dispatch', 'tracking'],
    ['planning', 'orders'],
    ['planning', 'fleet'],
    ['planning', 'maps'],
    ['planning', 'traffic'],
    ['dispatch', 'notify'],
    ['orders', 'events'],
    ['fleet', 'events'],
    ['tracking', 'events'],
    ['events', 'audit'],
    ['dispatch', 'audit'],
    ['planning', 'audit'],
    ['driver', 'tracking'],
  ] as const
  return diagram(
    'stress:logistics:component',
    'component',
    'Regional logistics platform',
    nodes,
    links.map(([from, to], index) =>
      edge(`dependency:${index}`, 'dependency', `component:${from}`, `component:${to}`, '«use»')),
  )
}

function telemetryBoundary(): DiagramProjection {
  const mainId = 'component:telemetry'
  const consumers = ['Cockpit display', 'Maintenance console', 'Health monitor', 'Audit recorder', 'Remote support']
  const dependencies = ['Sensor gateway', 'Event store', 'Time service', 'Alert adapter', 'Configuration store']
  const provided = ['Read health', 'Stream samples', 'Query events', 'Export audit', 'Subscribe alerts']
  const required = ['Read sensor', 'Write event', 'Read time', 'Send alert', 'Read configuration']
  const nodes = [
    node(mainId, 'component', 'Telemetry coordinator'),
    ...consumers.map((label, index) => node(`consumer:${index}`, 'component', label)),
    ...dependencies.map((label, index) => node(`dependency:${index}`, 'component', label)),
    ...provided.map((label, index) => node(`provided:${index}`, 'provided-interface', label, mainId)),
    ...required.map((label, index) => node(`required:${index}`, 'required-interface', label, mainId)),
  ]
  const edges = [
    ...consumers.map((_label, index) =>
      edge(`consumer-edge:${index}`, 'dependency', `consumer:${index}`, `provided:${index % provided.length}`, '«use»')),
    ...dependencies.map((_label, index) =>
      edge(`dependency-edge:${index}`, 'dependency', `required:${index}`, `dependency:${index}`, '«use»')),
  ]
  return diagram(
    'stress:telemetry:component',
    'component',
    'Aircraft telemetry boundary',
    nodes,
    edges,
  )
}

function surgicalWorkflow(): DiagramProjection {
  const lanes = [
    node('lane:clinician', 'swimlane', 'Clinician'),
    node('lane:controller', 'swimlane', 'Device controller'),
    node('lane:safety', 'swimlane', 'Safety monitor'),
    node('lane:evidence', 'swimlane', 'Evidence service'),
  ]
  const nodes = [
    ...lanes,
    node('start', 'initial', 'Start', 'lane:clinician'),
    node('identify', 'action', 'Identify patient', 'lane:clinician'),
    node('load', 'call-operation', 'Load procedure', 'lane:controller'),
    node('validate', 'decision', 'Inputs valid?', 'lane:safety'),
    node('reject', 'send-event', 'Reject setup', 'lane:clinician'),
    node('prepare', 'action', 'Prepare device', 'lane:controller'),
    node('fork', 'fork', 'Start monitoring', 'lane:controller'),
    node('monitor', 'receive-event', 'Monitor signals', 'lane:safety'),
    node('capture', 'action', 'Capture evidence', 'lane:evidence'),
    node('limits', 'decision', 'Limits safe?', 'lane:safety'),
    node('pause', 'call-operation', 'Pause energy', 'lane:controller'),
    node('alert', 'send-event', 'Alert clinician', 'lane:clinician'),
    node('join', 'join', 'Finish case', 'lane:evidence'),
    node('record', 'action', 'Record result', 'lane:evidence'),
    node('complete', 'final', 'Complete', 'lane:clinician'),
  ]
  const edges = [
    edge('flow:01', 'control-flow', 'start', 'identify'),
    edge('flow:02', 'control-flow', 'identify', 'load'),
    edge('flow:03', 'control-flow', 'load', 'validate'),
    edge('flow:04', 'control-flow', 'validate', 'reject', 'Invalid', { guard: 'The input is invalid.', outcome: 'failure' }),
    edge('flow:05', 'control-flow', 'validate', 'prepare', 'Valid', { guard: 'The input is valid.', outcome: 'success' }),
    edge('flow:06', 'control-flow', 'reject', 'identify', 'Correct data', { isLoop: true }),
    edge('flow:07', 'control-flow', 'prepare', 'fork'),
    edge('flow:08', 'control-flow', 'fork', 'monitor'),
    edge('flow:09', 'control-flow', 'fork', 'capture'),
    edge('flow:10', 'control-flow', 'monitor', 'limits'),
    edge('flow:11', 'control-flow', 'limits', 'join', 'Safe', { outcome: 'success' }),
    edge('flow:12', 'control-flow', 'limits', 'pause', 'Unsafe', { outcome: 'failure' }),
    edge('flow:13', 'control-flow', 'pause', 'alert'),
    edge('flow:14', 'control-flow', 'alert', 'monitor', 'Resume', { isLoop: true }),
    edge('flow:15', 'control-flow', 'capture', 'join'),
    edge('flow:16', 'control-flow', 'join', 'record'),
    edge('flow:17', 'control-flow', 'record', 'complete'),
  ]
  return diagram('stress:surgical:activity', 'activity', 'Surgical device workflow', nodes, edges)
}

function paymentLifecycle(): DiagramProjection {
  const states = ['Created', 'Authorized', 'Capturing', 'Captured', 'Settling', 'Settled', 'Declined', 'Canceled', 'Refunding', 'Refunded']
  const nodes = [
    node('state:initial', 'initial', 'Initial'),
    ...states.map((label) => node(`state:${label.toLowerCase()}`, 'state', label)),
    node('state:final', 'final', 'Closed'),
  ]
  const transitions = [
    ['initial', 'created', 'Create'],
    ['created', 'authorized', 'Authorize'],
    ['created', 'declined', 'Decline'],
    ['authorized', 'capturing', 'Capture'],
    ['authorized', 'canceled', 'Cancel'],
    ['capturing', 'captured', 'Confirm'],
    ['capturing', 'authorized', 'Retry'],
    ['captured', 'settling', 'Settle'],
    ['settling', 'settled', 'Confirm'],
    ['settling', 'captured', 'Retry'],
    ['captured', 'refunding', 'Refund'],
    ['settled', 'refunding', 'Refund'],
    ['refunding', 'refunded', 'Confirm'],
    ['refunding', 'captured', 'Retry'],
    ['declined', 'created', 'Retry'],
    ['canceled', 'final', 'Close'],
    ['refunded', 'final', 'Close'],
    ['settled', 'final', 'Close'],
  ] as const
  return diagram(
    'stress:payment:state',
    'state-machine',
    'Payment lifecycle',
    nodes,
    transitions.map(([from, to, label], index) =>
      edge(`transition:${index}`, 'transition', `state:${from}`, `state:${to}`, label)),
  )
}

function marketplaceCheckout(): DiagramProjection {
  const participants = [
    ['buyer', 'Buyer'],
    ['web', 'Web app'],
    ['checkout', 'Checkout service'],
    ['inventory', 'Inventory service'],
    ['payment', 'Payment service'],
    ['fraud', 'Fraud service'],
    ['orders', 'Order service'],
    ['notify', 'Message service'],
  ] as const
  const messages = [
    ['buyer', 'web', 'Submit order', 'synchronous-message'],
    ['web', 'checkout', 'Create checkout', 'synchronous-message'],
    ['checkout', 'inventory', 'Reserve stock', 'synchronous-message'],
    ['inventory', 'checkout', 'Reservation', 'reply-message'],
    ['checkout', 'fraud', 'Check order', 'synchronous-message'],
    ['fraud', 'checkout', 'Risk result', 'reply-message'],
    ['checkout', 'payment', 'Authorize payment', 'synchronous-message'],
    ['payment', 'payment', 'Apply request key', 'synchronous-message'],
    ['payment', 'checkout', 'Authorization', 'reply-message'],
    ['checkout', 'orders', 'Create order', 'synchronous-message'],
    ['orders', 'inventory', 'Commit stock', 'synchronous-message'],
    ['inventory', 'orders', 'Stock committed', 'reply-message'],
    ['orders', 'checkout', 'Order created', 'reply-message'],
    ['checkout', 'notify', 'Send receipt', 'synchronous-message'],
    ['notify', 'buyer', 'Receipt', 'synchronous-message'],
    ['checkout', 'web', 'Checkout result', 'reply-message'],
    ['web', 'buyer', 'Show result', 'reply-message'],
  ] as const
  const edges = messages.map(([from, to, label, kind], index) => ({
    ...edge(`message:${index}`, kind, `lifeline:${from}`, `lifeline:${to}`, label),
    traceIds: [`message:${index}`],
  }))
  const fragment = {
    ...node('fragment:risk', 'fragment', 'alt: risk result'),
    traceIds: ['message:4', 'message:5'],
  }
  return diagram(
    'stress:marketplace:sequence',
    'sequence',
    'Marketplace checkout',
    [
      ...participants.map(([id, label]) => node(`lifeline:${id}`, 'lifeline', label)),
      fragment,
    ],
    edges,
  )
}

function flightSafetyCases(): DiagramProjection {
  const boundaryId = 'system:flight'
  const actors = [
    ['pilot', 'Pilot'],
    ['engineer', 'Maintenance engineer'],
    ['dispatcher', 'Flight dispatcher'],
    ['auditor', 'Safety auditor'],
    ['weather-service', 'Weather service'],
  ] as const
  const cases = [
    ['plan', 'Plan flight'],
    ['weather', 'Review weather'],
    ['load', 'Check aircraft load'],
    ['dispatch', 'Release flight'],
    ['monitor', 'Monitor flight'],
    ['alert', 'Handle safety alert'],
    ['defer', 'Defer defect'],
    ['repair', 'Record repair'],
    ['evidence', 'Prepare evidence'],
    ['audit', 'Review compliance'],
  ] as const
  const associations = [
    ['pilot', 'plan'],
    ['pilot', 'monitor'],
    ['pilot', 'alert'],
    ['dispatcher', 'plan'],
    ['dispatcher', 'weather'],
    ['dispatcher', 'load'],
    ['dispatcher', 'dispatch'],
    ['engineer', 'load'],
    ['engineer', 'defer'],
    ['engineer', 'repair'],
    ['auditor', 'evidence'],
    ['auditor', 'audit'],
    ['weather-service', 'weather'],
  ] as const
  const relationships = [
    ...associations.map(([actorId, useCaseId], index) =>
      edge(`association:${index}`, 'association', `actor:${actorId}`, `use-case:${useCaseId}`)),
    edge('include:01', 'include', 'use-case:plan', 'use-case:weather', '«include»'),
    edge('include:02', 'include', 'use-case:plan', 'use-case:load', '«include»'),
    edge('include:03', 'include', 'use-case:dispatch', 'use-case:plan', '«include»'),
    edge('extend:01', 'extend', 'use-case:alert', 'use-case:monitor', '«extend»'),
    edge('extend:02', 'extend', 'use-case:defer', 'use-case:load', '«extend»'),
    edge('include:04', 'include', 'use-case:audit', 'use-case:evidence', '«include»'),
    edge('include:05', 'include', 'use-case:evidence', 'use-case:repair', '«include»'),
  ]
  return diagram(
    'stress:flight:use-case',
    'use-case',
    'Flight safety use cases',
    [
      node(boundaryId, 'system-boundary', 'Flight operations'),
      ...actors.map(([id, label]) => node(`actor:${id}`, 'actor', label)),
      ...cases.map(([id, label]) => node(`use-case:${id}`, 'use-case', label, boundaryId)),
    ],
    relationships,
  )
}

function railTrafficFlow(): DiagramProjection {
  const nodes = [
    node('rail:start', 'initial', 'Start'),
    node('rail:read', 'receive-event', 'Read train state'),
    node('rail:valid', 'decision', 'State valid?'),
    node('rail:reject', 'send-event', 'Reject state'),
    node('rail:predict', 'call-operation', 'Predict route'),
    node('rail:conflict', 'decision', 'Conflict found?'),
    node('rail:hold', 'send-event', 'Hold train'),
    node('rail:replan', 'call-operation', 'Plan new route'),
    node('rail:reserve', 'action', 'Reserve track'),
    node('rail:issue', 'send-event', 'Issue authority'),
    node('rail:watch', 'receive-event', 'Watch movement'),
    node('rail:complete', 'decision', 'Route complete?'),
    node('rail:release', 'action', 'Release track'),
    node('rail:end', 'final', 'Complete'),
  ]
  const edges = [
    edge('rail:flow:01', 'control-flow', 'rail:start', 'rail:read'),
    edge('rail:flow:02', 'control-flow', 'rail:read', 'rail:valid'),
    edge('rail:flow:03', 'control-flow', 'rail:valid', 'rail:reject', 'No', { outcome: 'failure' }),
    edge('rail:flow:04', 'control-flow', 'rail:reject', 'rail:read', 'Retry', { isLoop: true }),
    edge('rail:flow:05', 'control-flow', 'rail:valid', 'rail:predict', 'Yes', { outcome: 'success' }),
    edge('rail:flow:06', 'control-flow', 'rail:predict', 'rail:conflict'),
    edge('rail:flow:07', 'control-flow', 'rail:conflict', 'rail:hold', 'Yes'),
    edge('rail:flow:08', 'control-flow', 'rail:hold', 'rail:replan'),
    edge('rail:flow:09', 'control-flow', 'rail:replan', 'rail:conflict', 'Check again', { isLoop: true }),
    edge('rail:flow:10', 'control-flow', 'rail:conflict', 'rail:reserve', 'No'),
    edge('rail:flow:11', 'control-flow', 'rail:reserve', 'rail:issue'),
    edge('rail:flow:12', 'control-flow', 'rail:issue', 'rail:watch'),
    edge('rail:flow:13', 'control-flow', 'rail:watch', 'rail:complete'),
    edge('rail:flow:14', 'control-flow', 'rail:complete', 'rail:watch', 'No', { isLoop: true }),
    edge('rail:flow:15', 'control-flow', 'rail:complete', 'rail:release', 'Yes'),
    edge('rail:flow:16', 'control-flow', 'rail:release', 'rail:end'),
  ]
  return diagram('stress:rail:activity', 'activity', 'Rail traffic authority flow', nodes, edges)
}

export const UML_ROBUSTNESS_FIXTURES = [
  { context: 'Regional logistics', projection: logisticsPlatform() },
  { context: 'Aircraft telemetry', projection: telemetryBoundary() },
  { context: 'Surgical device', projection: surgicalWorkflow() },
  { context: 'Payment processing', projection: paymentLifecycle() },
  { context: 'Marketplace checkout', projection: marketplaceCheckout() },
  { context: 'Flight safety', projection: flightSafetyCases() },
  { context: 'Rail traffic', projection: railTrafficFlow() },
] as const
