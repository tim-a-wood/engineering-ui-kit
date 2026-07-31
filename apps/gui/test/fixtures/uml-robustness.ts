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

function satelliteCommandChain(): DiagramProjection {
  const components = [
    ['console', 'Mission console'],
    ['access', 'Access control'],
    ['command', 'Command service'],
    ['validate', 'Command validator'],
    ['schedule', 'Pass scheduler'],
    ['uplink', 'Uplink gateway'],
    ['spacecraft', 'Spacecraft computer'],
    ['downlink', 'Downlink gateway'],
    ['decode', 'Telemetry decoder'],
    ['health', 'Health evaluator'],
    ['archive', 'Mission archive'],
    ['audit', 'Command audit'],
  ] as const
  const links = [
    ['console', 'access'],
    ['access', 'command'],
    ['command', 'validate'],
    ['validate', 'schedule'],
    ['schedule', 'uplink'],
    ['uplink', 'spacecraft'],
    ['spacecraft', 'downlink'],
    ['downlink', 'decode'],
    ['decode', 'health'],
    ['health', 'archive'],
    ['validate', 'audit'],
    ['schedule', 'audit'],
    ['uplink', 'audit'],
    ['health', 'audit'],
    ['spacecraft', 'command'],
  ] as const
  return diagram(
    'stress:satellite:component',
    'component',
    'Satellite command chain',
    components.map(([id, label]) => node(`sat:${id}`, 'component', label)),
    links.map(([from, to], index) =>
      edge(`sat:dependency:${index}`, 'dependency', `sat:${from}`, `sat:${to}`, '«use»')),
  )
}

function identityBrokerBoundary(): DiagramProjection {
  const broker = 'identity:broker'
  const consumers = [
    'Administration console',
    'Customer web app',
    'Automation CLI',
    'Partner gateway',
    'Mobile app',
    'Audit agent',
  ]
  const dependencies = [
    'Identity store',
    'Token signer',
    'Policy service',
    'Event stream',
    'Directory adapter',
    'Risk engine',
  ]
  const provided = [
    'Authenticate user',
    'Refresh session',
    'Revoke session',
    'Inspect token',
    'List permissions',
    'Export access log',
  ]
  const required = [
    'Read identity',
    'Sign token',
    'Evaluate policy',
    'Publish event',
    'Query directory',
    'Score risk',
  ]
  return diagram(
    'stress:identity:component',
    'component',
    'Identity broker boundary',
    [
      node(broker, 'component', 'Identity broker'),
      ...consumers.map((label, index) => node(`identity:consumer:${index}`, 'component', label)),
      ...dependencies.map((label, index) => node(`identity:dependency:${index}`, 'component', label)),
      ...provided.map((label, index) =>
        node(`identity:provided:${index}`, 'provided-interface', label, broker)),
      ...required.map((label, index) =>
        node(`identity:required:${index}`, 'required-interface', label, broker)),
    ],
    [
      ...consumers.map((_label, index) =>
        edge(
          `identity:consumer-edge:${index}`,
          'dependency',
          `identity:consumer:${index}`,
          `identity:provided:${index}`,
          '«use»',
        )),
      ...dependencies.map((_label, index) =>
        edge(
          `identity:dependency-edge:${index}`,
          'dependency',
          `identity:required:${index}`,
          `identity:dependency:${index}`,
          '«use»',
        )),
    ],
  )
}

function analyticsDiamond(): DiagramProjection {
  const components = [
    ['files', 'File source'],
    ['events', 'Event source'],
    ['api', 'API source'],
    ['ingest', 'Ingestion gateway'],
    ['validate', 'Schema validator'],
    ['normalize', 'Normalizer'],
    ['dedupe', 'Duplicate detector'],
    ['enrich', 'Metadata enricher'],
    ['classify', 'Record classifier'],
    ['merge', 'Record assembler'],
    ['index', 'Search index'],
    ['lake', 'Data lake'],
    ['notify', 'Notification service'],
    ['audit', 'Processing audit'],
  ] as const
  const links = [
    ['files', 'ingest'],
    ['events', 'ingest'],
    ['api', 'ingest'],
    ['ingest', 'validate'],
    ['validate', 'normalize'],
    ['validate', 'dedupe'],
    ['validate', 'enrich'],
    ['validate', 'classify'],
    ['normalize', 'merge'],
    ['dedupe', 'merge'],
    ['enrich', 'merge'],
    ['classify', 'merge'],
    ['merge', 'index'],
    ['merge', 'lake'],
    ['merge', 'notify'],
    ['validate', 'audit'],
    ['merge', 'audit'],
    ['index', 'audit'],
    ['lake', 'audit'],
  ] as const
  return diagram(
    'stress:analytics:component',
    'component',
    'Analytics split and merge',
    components.map(([id, label]) => node(`analytics:${id}`, 'component', label)),
    links.map(([from, to], index) =>
      edge(`analytics:dependency:${index}`, 'dependency', `analytics:${from}`, `analytics:${to}`, '«use»')),
  )
}

function emergencyResponseFanout(): DiagramProjection {
  const nodes = [
    node('emergency:start', 'initial', 'Start'),
    node('emergency:receive', 'receive-event', 'Receive incident'),
    node('emergency:valid', 'decision', 'Incident valid?'),
    node('emergency:reject', 'send-event', 'Reject incident'),
    node('emergency:classify', 'action', 'Classify incident'),
    node('emergency:fork', 'fork', 'Start response'),
    node('emergency:dispatch', 'call-operation', 'Dispatch responders'),
    node('emergency:notify', 'send-event', 'Notify stakeholders'),
    node('emergency:map', 'call-operation', 'Prepare incident map'),
    node('emergency:resources', 'call-operation', 'Reserve resources'),
    node('emergency:evidence', 'action', 'Open evidence record'),
    node('emergency:join', 'join', 'Response ready'),
    node('emergency:risk', 'decision', 'Risk controlled?'),
    node('emergency:escalate', 'send-event', 'Escalate response'),
    node('emergency:monitor', 'receive-event', 'Monitor response'),
    node('emergency:close', 'action', 'Close incident'),
    node('emergency:end', 'final', 'Complete'),
  ]
  const links = [
    ['start', 'receive'],
    ['receive', 'valid'],
    ['valid', 'reject'],
    ['reject', 'receive'],
    ['valid', 'classify'],
    ['classify', 'fork'],
    ['fork', 'dispatch'],
    ['fork', 'notify'],
    ['fork', 'map'],
    ['fork', 'resources'],
    ['fork', 'evidence'],
    ['dispatch', 'join'],
    ['notify', 'join'],
    ['map', 'join'],
    ['resources', 'join'],
    ['evidence', 'join'],
    ['join', 'risk'],
    ['risk', 'escalate'],
    ['escalate', 'monitor'],
    ['risk', 'monitor'],
    ['monitor', 'risk'],
    ['monitor', 'close'],
    ['close', 'end'],
  ] as const
  return diagram(
    'stress:emergency:activity',
    'activity',
    'Emergency response fan-out',
    nodes,
    links.map(([from, to], index) => edge(
      `emergency:flow:${index}`,
      'control-flow',
      `emergency:${from}`,
      `emergency:${to}`,
      undefined,
      {
        ...(from === 'valid' && to === 'reject' ? { guard: 'The incident is invalid.', outcome: 'failure' as const } : {}),
        ...(from === 'valid' && to === 'classify' ? { guard: 'The incident is valid.', outcome: 'success' as const } : {}),
        ...(from === 'reject' || (from === 'monitor' && to === 'risk') ? { isLoop: true } : {}),
      },
    )),
  )
}

function batchProcessingChain(): DiagramProjection {
  const actions = [
    'Accept batch',
    'Check authorization',
    'Read manifest',
    'Validate manifest',
    'Resolve references',
    'Load source files',
    'Parse records',
    'Normalize records',
    'Validate records',
    'Apply rules',
    'Build result',
    'Write result',
    'Index result',
    'Create summary',
    'Publish completion',
    'Archive inputs',
  ]
  const nodes = [
    node('batch:start', 'initial', 'Start'),
    ...actions.map((label, index) => node(`batch:step:${index}`, 'action', label)),
    node('batch:end', 'final', 'Complete'),
  ]
  return diagram(
    'stress:batch:activity',
    'activity',
    'Long batch-processing chain',
    nodes,
    [
      edge('batch:flow:start', 'control-flow', 'batch:start', 'batch:step:0'),
      ...actions.slice(0, -1).map((_label, index) =>
        edge(`batch:flow:${index}`, 'control-flow', `batch:step:${index}`, `batch:step:${index + 1}`)),
      edge('batch:flow:end', 'control-flow', `batch:step:${actions.length - 1}`, 'batch:end'),
    ],
  )
}

function deviceConnectionLifecycle(): DiagramProjection {
  const states = [
    'Offline',
    'Discovering',
    'Connecting',
    'Authenticating',
    'Online',
    'Degraded',
    'Recovering',
    'Updating',
    'Restarting',
    'Locked',
    'Failed',
    'Shutting down',
  ]
  const transitions = [
    ['initial', 'offline', 'Initialize'],
    ['offline', 'discovering', 'Start discovery'],
    ['discovering', 'connecting', 'Device found'],
    ['discovering', 'offline', 'Timeout'],
    ['connecting', 'authenticating', 'Connected'],
    ['connecting', 'discovering', 'Retry'],
    ['authenticating', 'online', 'Accepted'],
    ['authenticating', 'locked', 'Rejected'],
    ['online', 'degraded', 'Health warning'],
    ['degraded', 'recovering', 'Recover'],
    ['recovering', 'online', 'Recovered'],
    ['recovering', 'failed', 'Recovery failed'],
    ['online', 'updating', 'Install update'],
    ['updating', 'restarting', 'Update complete'],
    ['updating', 'online', 'Update rejected'],
    ['restarting', 'discovering', 'Restart complete'],
    ['locked', 'offline', 'Unlock'],
    ['failed', 'offline', 'Reset'],
    ['online', 'shutting-down', 'Shutdown'],
    ['degraded', 'shutting-down', 'Shutdown'],
    ['shutting-down', 'final', 'Power off'],
  ] as const
  return diagram(
    'stress:device:state',
    'state-machine',
    'Device connection lifecycle',
    [
      node('device:initial', 'initial', 'Initial'),
      ...states.map((label) => node(`device:${label.toLowerCase().replace(/\s+/g, '-')}`, 'state', label)),
      node('device:final', 'final', 'Final'),
    ],
    transitions.map(([from, to, label], index) =>
      edge(`device:transition:${index}`, 'transition', `device:${from}`, `device:${to}`, label)),
  )
}

function incidentCoordinationSequence(): DiagramProjection {
  const participants = [
    ['operator', 'Operator'],
    ['console', 'Operations console'],
    ['incident', 'Incident service'],
    ['policy', 'Policy service'],
    ['directory', 'Directory service'],
    ['dispatch', 'Dispatch service'],
    ['mapping', 'Map service'],
    ['evidence', 'Evidence service'],
    ['message', 'Message service'],
    ['audit', 'Audit service'],
  ] as const
  const messages = [
    ['operator', 'console', 'Report incident', 'synchronous-message'],
    ['console', 'incident', 'Open incident', 'synchronous-message'],
    ['incident', 'policy', 'Read response policy', 'synchronous-message'],
    ['policy', 'incident', 'Policy result', 'reply-message'],
    ['incident', 'directory', 'Find response team', 'synchronous-message'],
    ['directory', 'incident', 'Team roster', 'reply-message'],
    ['incident', 'incident', 'Assign incident key', 'synchronous-message'],
    ['incident', 'dispatch', 'Dispatch team', 'synchronous-message'],
    ['dispatch', 'mapping', 'Request route', 'synchronous-message'],
    ['mapping', 'dispatch', 'Route result', 'reply-message'],
    ['dispatch', 'incident', 'Dispatch accepted', 'reply-message'],
    ['incident', 'evidence', 'Create evidence record', 'synchronous-message'],
    ['evidence', 'incident', 'Evidence record', 'reply-message'],
    ['incident', 'message', 'Notify stakeholders', 'synchronous-message'],
    ['message', 'operator', 'Incident opened', 'synchronous-message'],
    ['incident', 'audit', 'Record incident', 'synchronous-message'],
    ['audit', 'incident', 'Audit recorded', 'reply-message'],
    ['incident', 'console', 'Incident summary', 'reply-message'],
    ['console', 'operator', 'Show incident', 'reply-message'],
    ['operator', 'console', 'Close incident', 'synchronous-message'],
    ['console', 'incident', 'Close incident', 'synchronous-message'],
    ['incident', 'dispatch', 'Release team', 'synchronous-message'],
    ['incident', 'evidence', 'Seal evidence', 'synchronous-message'],
    ['incident', 'audit', 'Record closure', 'synchronous-message'],
    ['incident', 'console', 'Closure result', 'reply-message'],
    ['console', 'operator', 'Show closure', 'reply-message'],
  ] as const
  return diagram(
    'stress:incident:sequence',
    'sequence',
    'Incident coordination sequence',
    [
      ...participants.map(([id, label]) => node(`incident:${id}`, 'lifeline', label)),
      {
        ...node('incident:fragment', 'fragment', 'alt: dispatch result'),
        traceIds: ['incident:message:8', 'incident:message:9', 'incident:message:10'],
      },
    ],
    messages.map(([from, to, label, kind], index) => ({
      ...edge(
        `incident:message:${index}`,
        kind,
        `incident:${from}`,
        `incident:${to}`,
        label,
      ),
      traceIds: [`incident:message:${index}`],
    })),
  )
}

function hospitalAccessUseCases(): DiagramProjection {
  const boundary = 'hospital:boundary'
  const actors = [
    ['clinician', 'Clinician'],
    ['nurse', 'Nurse'],
    ['pharmacist', 'Pharmacist'],
    ['administrator', 'Administrator'],
    ['auditor', 'Privacy auditor'],
    ['patient', 'Patient'],
    ['identity', 'Identity provider'],
  ] as const
  const cases = [
    ['sign-in', 'Sign in'],
    ['open-record', 'Open patient record'],
    ['record-note', 'Record clinical note'],
    ['order-drug', 'Order medication'],
    ['dispense', 'Dispense medication'],
    ['manage-role', 'Manage access role'],
    ['review-access', 'Review access history'],
    ['request-copy', 'Request record copy'],
    ['break-glass', 'Use emergency access'],
    ['confirm-identity', 'Confirm identity'],
    ['check-consent', 'Check patient consent'],
    ['record-access', 'Record access event'],
    ['revoke-session', 'Revoke session'],
    ['export-audit', 'Export audit evidence'],
  ] as const
  const associations = [
    ['clinician', 'sign-in'],
    ['clinician', 'open-record'],
    ['clinician', 'record-note'],
    ['clinician', 'order-drug'],
    ['nurse', 'sign-in'],
    ['nurse', 'open-record'],
    ['nurse', 'record-note'],
    ['pharmacist', 'sign-in'],
    ['pharmacist', 'dispense'],
    ['administrator', 'manage-role'],
    ['administrator', 'revoke-session'],
    ['auditor', 'review-access'],
    ['auditor', 'export-audit'],
    ['patient', 'request-copy'],
    ['identity', 'confirm-identity'],
  ] as const
  const semanticLinks = [
    ['include', 'sign-in', 'confirm-identity'],
    ['include', 'open-record', 'check-consent'],
    ['include', 'open-record', 'record-access'],
    ['include', 'record-note', 'record-access'],
    ['include', 'order-drug', 'record-access'],
    ['include', 'dispense', 'record-access'],
    ['include', 'review-access', 'record-access'],
    ['include', 'request-copy', 'confirm-identity'],
    ['include', 'export-audit', 'review-access'],
    ['extend', 'break-glass', 'open-record'],
    ['extend', 'revoke-session', 'manage-role'],
  ] as const
  return diagram(
    'stress:hospital:use-case',
    'use-case',
    'Hospital access use cases',
    [
      node(boundary, 'system-boundary', 'Hospital access system'),
      ...actors.map(([id, label]) => node(`hospital:actor:${id}`, 'actor', label)),
      ...cases.map(([id, label]) => node(`hospital:case:${id}`, 'use-case', label, boundary)),
    ],
    [
      ...associations.map(([actor, useCase], index) =>
        edge(
          `hospital:association:${index}`,
          'association',
          `hospital:actor:${actor}`,
          `hospital:case:${useCase}`,
        )),
      ...semanticLinks.map(([kind, from, to], index) =>
        edge(
          `hospital:${kind}:${index}`,
          kind,
          `hospital:case:${from}`,
          `hospital:case:${to}`,
          kind === 'include' ? '«include»' : '«extend»',
        )),
    ],
  )
}

export const UML_ROBUSTNESS_FIXTURES = [
  { context: 'Regional logistics', projection: logisticsPlatform() },
  { context: 'Aircraft telemetry', projection: telemetryBoundary() },
  { context: 'Surgical device', projection: surgicalWorkflow() },
  { context: 'Payment processing', projection: paymentLifecycle() },
  { context: 'Marketplace checkout', projection: marketplaceCheckout() },
  { context: 'Flight safety', projection: flightSafetyCases() },
  { context: 'Rail traffic', projection: railTrafficFlow() },
  { context: 'Satellite command', projection: satelliteCommandChain() },
  { context: 'Identity brokerage', projection: identityBrokerBoundary() },
  { context: 'Analytics processing', projection: analyticsDiamond() },
  { context: 'Emergency response', projection: emergencyResponseFanout() },
  { context: 'Batch processing', projection: batchProcessingChain() },
  { context: 'Device connectivity', projection: deviceConnectionLifecycle() },
  { context: 'Incident coordination', projection: incidentCoordinationSequence() },
  { context: 'Hospital access', projection: hospitalAccessUseCases() },
] as const
