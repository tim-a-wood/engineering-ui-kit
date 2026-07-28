import type {
  ActivityEdge,
  ActivityGraph,
  ActivityNode,
  ApplicationSpecification,
  ApplicationWorkflowDefinition,
  ModuleBehaviorSpecification,
  UseCaseDefinition,
  UseCasePathDefinition,
  UseCaseStepDefinition,
  WorkflowNodeAllocation,
} from '@engineering-ui-kit/core'

type SourceApplication = Pick<ApplicationSpecification, 'rules' | 'sources'>

const findingWorkflowId = 'workflow:uc-findings'
const reviewWorkflowId = 'workflow:uc-reviews'
const packageWorkflowId = 'workflow:uc-package'

function step(
  source: SourceApplication,
  useCaseId: string,
  suffix: string,
  order: number,
  actorId: string | undefined,
  action: string,
  expectedResult: string,
  evidencePolicy: UseCaseStepDefinition['evidencePolicy'] = 'structured',
): UseCaseStepDefinition {
  return {
    id: `${useCaseId}:step:${suffix}`,
    order,
    ...(actorId ? { actorId } : {}),
    action,
    expectedResult,
    inputIds: [],
    outputIds: [],
    ruleIds: source.rules.map((rule) => rule.id),
    evidencePolicy,
  }
}

function path(
  id: string,
  name: string,
  kind: UseCasePathDefinition['kind'],
  steps: UseCaseStepDefinition[],
  outcome: string,
): UseCasePathDefinition {
  return { id, name, kind, preconditions: [], steps, outcome }
}

function node(
  id: string,
  kind: ActivityNode['kind'],
  label: string,
  description: string,
  refinesIds: string[] = [],
  actorId?: string,
): ActivityNode {
  return { id, kind, label, description, refinesIds, ...(actorId ? { actorId } : {}) }
}

function edge(
  graphId: string,
  suffix: string,
  fromNodeId: string,
  toNodeId: string,
  traceIds: string[],
  options: Omit<ActivityEdge, 'id' | 'fromNodeId' | 'toNodeId' | 'traceIds'> = {},
): ActivityEdge {
  return {
    id: `${graphId}:edge:${suffix}`,
    fromNodeId,
    toNodeId,
    traceIds,
    ...options,
  }
}

function findingWorkflow(): ApplicationWorkflowDefinition {
  const graphId = `${findingWorkflowId}:graph`
  const main = 'uc-findings:main'
  const alternate = 'uc-findings:path:return'
  const recovery = 'uc-findings:path:update'
  const graph: ActivityGraph = {
    id: graphId,
    name: 'Close audit finding',
    nodes: [
      node('finding:start', 'initial', 'Initial', 'The finding workflow starts.'),
      node('finding:inspect', 'action', 'Inspect finding evidence', 'The user sees the exact evidence revision and history.', ['uc-findings:step:open'], 'actor-vv'),
      node('finding:assign', 'action', 'Assign finding owner', 'The finding records the owner and due date.', ['uc-findings:step:assign'], 'actor-qa'),
      node('finding:correct', 'action', 'Record corrective action', 'The finding records the corrective action.', ['uc-findings:step:correct'], 'actor-vv'),
      node('finding:review-merge', 'merge', 'Review request', 'The workflow combines new and revised closure requests.'),
      node('finding:ready', 'decision', 'Closure evidence ready', 'The workflow checks the closure evidence.'),
      node('finding:return', 'action', 'Return finding', 'The finding returns to corrective action.', ['uc-findings:step:return'], 'actor-qa'),
      node('finding:reverify', 'action', 'Verify corrective action', 'The lead records the verification result.', ['uc-findings:step:reverify'], 'actor-lead'),
      node('finding:closure', 'decision', 'Closure approved', 'The workflow checks the closure decision.'),
      node('finding:update', 'action', 'Update corrective action', 'The engineer updates the corrective action.', ['uc-findings:step:update'], 'actor-vv'),
      node('finding:close', 'action', 'Close audit finding', 'The finding closes with immutable history.', ['uc-findings:step:close'], 'actor-lead'),
      node('finding:end', 'final', 'Final', 'The finding workflow ends.'),
    ],
    edges: [
      edge(graphId, 'start-inspect', 'finding:start', 'finding:inspect', [main, alternate, recovery]),
      edge(graphId, 'inspect-assign', 'finding:inspect', 'finding:assign', [main, alternate, recovery]),
      edge(graphId, 'assign-correct', 'finding:assign', 'finding:correct', [main, alternate, recovery]),
      edge(graphId, 'correct-merge', 'finding:correct', 'finding:review-merge', [main, alternate, recovery]),
      edge(graphId, 'merge-ready', 'finding:review-merge', 'finding:ready', [main, alternate, recovery]),
      edge(graphId, 'ready-reverify', 'finding:ready', 'finding:reverify', [main], {
        guard: 'The closure evidence is complete.',
        outcome: 'success',
      }),
      edge(graphId, 'ready-return', 'finding:ready', 'finding:return', [alternate], {
        guard: 'The closure evidence is incomplete.',
        outcome: 'alternate',
      }),
      edge(graphId, 'return-merge', 'finding:return', 'finding:review-merge', [alternate], {
        outcome: 'recovery',
        loop: { exitCondition: 'The closure evidence is complete.', maximumIterations: 3 },
      }),
      edge(graphId, 'reverify-closure', 'finding:reverify', 'finding:closure', [main, recovery]),
      edge(graphId, 'closure-close', 'finding:closure', 'finding:close', [main], {
        guard: 'The closure decision is approved.',
        outcome: 'success',
      }),
      edge(graphId, 'closure-update', 'finding:closure', 'finding:update', [recovery], {
        guard: 'The closure decision needs changes.',
        outcome: 'alternate',
      }),
      edge(graphId, 'update-merge', 'finding:update', 'finding:review-merge', [recovery], {
        outcome: 'recovery',
        loop: { exitCondition: 'The closure decision is approved.', maximumIterations: 2 },
      }),
      edge(graphId, 'close-end', 'finding:close', 'finding:end', [main]),
    ],
  }
  return {
    id: findingWorkflowId,
    useCaseId: 'uc-findings',
    name: 'Close audit finding',
    graph,
    pathIds: [main, alternate, recovery],
    acceptanceCaseIds: ['ac-7'],
    sourceRefs: [],
  }
}

function reviewWorkflow(): ApplicationWorkflowDefinition {
  const graphId = `${reviewWorkflowId}:graph`
  const main = 'uc-reviews:main'
  const alternate = 'uc-reviews:path:change'
  return {
    id: reviewWorkflowId,
    useCaseId: 'uc-reviews',
    name: 'Record assurance review',
    graph: {
      id: graphId,
      name: 'Record assurance review',
      nodes: [
        node('review:start', 'initial', 'Initial', 'The review workflow starts.'),
        node('review:select', 'action', 'Select review evidence', 'The user selects exact evidence revisions.', ['uc-reviews:step:scope'], 'actor-qa'),
        node('review:fork', 'fork', 'Parallel review', 'The workflow starts two independent checks.'),
        node('review:independence', 'action', 'Confirm reviewer independence', 'The reviewer records independence evidence.', ['uc-reviews:step:independence'], 'actor-auditor'),
        node('review:inspect', 'action', 'Inspect review history', 'The engineer inspects prior review decisions.', ['uc-reviews:step:inspect'], 'actor-vv'),
        node('review:join', 'join', 'Review checks complete', 'The workflow waits for both checks.'),
        node('review:accepted', 'decision', 'Review accepted', 'The auditor checks the review result.'),
        node('review:request-change', 'action', 'Request review change', 'The auditor records a required change.', ['uc-reviews:step:change'], 'actor-auditor'),
        node('review:merge', 'merge', 'Review decision', 'The workflow combines the review paths.'),
        node('review:record', 'action', 'Record review decision', 'The workflow appends the review decision.', ['uc-reviews:step:decide'], 'actor-auditor'),
        node('review:end', 'final', 'Final', 'The review workflow ends.'),
      ],
      edges: [
        edge(graphId, 'start-select', 'review:start', 'review:select', [main, alternate]),
        edge(graphId, 'select-fork', 'review:select', 'review:fork', [main, alternate]),
        edge(graphId, 'fork-independence', 'review:fork', 'review:independence', [main, alternate]),
        edge(graphId, 'fork-inspect', 'review:fork', 'review:inspect', [main, alternate]),
        edge(graphId, 'independence-join', 'review:independence', 'review:join', [main, alternate]),
        edge(graphId, 'inspect-join', 'review:inspect', 'review:join', [main, alternate]),
        edge(graphId, 'join-accepted', 'review:join', 'review:accepted', [main, alternate]),
        edge(graphId, 'accepted-merge', 'review:accepted', 'review:merge', [main], {
          guard: 'The review evidence is acceptable.',
          outcome: 'success',
        }),
        edge(graphId, 'accepted-change', 'review:accepted', 'review:request-change', [alternate], {
          guard: 'The review evidence needs changes.',
          outcome: 'alternate',
        }),
        edge(graphId, 'change-merge', 'review:request-change', 'review:merge', [alternate]),
        edge(graphId, 'merge-record', 'review:merge', 'review:record', [main, alternate]),
        edge(graphId, 'record-end', 'review:record', 'review:end', [main, alternate]),
      ],
    },
    pathIds: [main, alternate],
    acceptanceCaseIds: ['ac-2'],
    sourceRefs: [],
  }
}

function packageWorkflow(): ApplicationWorkflowDefinition {
  const graphId = `${packageWorkflowId}:graph`
  const main = 'uc-package:main'
  const alternate = 'uc-package:path:remove'
  const failure = 'uc-package:path:failure'
  const recovery = 'uc-package:path:retry'
  return {
    id: packageWorkflowId,
    useCaseId: 'uc-package',
    name: 'Build audit package',
    graph: {
      id: graphId,
      name: 'Build audit package',
      nodes: [
        node('package:start', 'initial', 'Initial', 'The package workflow starts.'),
        node('package:select', 'action', 'Select package evidence', 'The lead selects evidence for the package.', ['uc-package:step:select'], 'actor-lead'),
        node('package:baseline', 'action', 'Record baseline metadata', 'The engineer records exact source revisions.', ['uc-package:step:baseline'], 'actor-cm'),
        node('package:selection-merge', 'merge', 'Package selection', 'The workflow combines new and corrected selections.'),
        node('package:check', 'action', 'Check package integrity', 'The auditor checks hashes and source data.', ['uc-package:step:verify'], 'actor-auditor'),
        node('package:valid', 'decision', 'Package valid', 'The workflow checks package integrity.'),
        node('package:remove', 'action', 'Remove invalid item', 'The lead removes invalid evidence.', ['uc-package:step:remove'], 'actor-lead'),
        node('package:watermark', 'action', 'Mark synthetic sample', 'The package records the sample watermark.', ['uc-package:step:watermark']),
        node('package:export', 'action', 'Export audit package', 'The adapter writes the package and manifest.', ['uc-package:step:export'], 'actor-lead'),
        node('package:exported', 'decision', 'Export complete', 'The workflow checks the export result.'),
        node('package:retain', 'action', 'Retain last package', 'The hub keeps the last valid package.', ['uc-package:step:retain'], 'actor-cm'),
        node('package:retry', 'action', 'Retry package export', 'The lead retries the local export.', ['uc-package:step:retry'], 'actor-lead'),
        node('package:end', 'final', 'Final', 'The package workflow ends.'),
      ],
      edges: [
        edge(graphId, 'start-select', 'package:start', 'package:select', [main, alternate, failure, recovery]),
        edge(graphId, 'select-baseline', 'package:select', 'package:baseline', [main, alternate, failure, recovery]),
        edge(graphId, 'baseline-merge', 'package:baseline', 'package:selection-merge', [main, alternate, failure, recovery]),
        edge(graphId, 'merge-check', 'package:selection-merge', 'package:check', [main, alternate, failure, recovery]),
        edge(graphId, 'check-valid', 'package:check', 'package:valid', [main, alternate, failure, recovery]),
        edge(graphId, 'valid-watermark', 'package:valid', 'package:watermark', [main, failure, recovery], {
          guard: 'All package items are valid.',
          outcome: 'success',
        }),
        edge(graphId, 'valid-remove', 'package:valid', 'package:remove', [alternate], {
          guard: 'A package item is invalid.',
          outcome: 'alternate',
        }),
        edge(graphId, 'remove-merge', 'package:remove', 'package:selection-merge', [alternate], {
          loop: { exitCondition: 'All package items are valid.', maximumIterations: 10 },
          outcome: 'recovery',
        }),
        edge(graphId, 'watermark-export', 'package:watermark', 'package:export', [main, failure, recovery]),
        edge(graphId, 'export-result', 'package:export', 'package:exported', [main, failure, recovery]),
        edge(graphId, 'exported-end', 'package:exported', 'package:end', [main], {
          guard: 'The package export is complete.',
          outcome: 'success',
        }),
        edge(graphId, 'exported-retain', 'package:exported', 'package:retain', [failure, recovery], {
          guard: 'The package export failed.',
          outcome: 'failure',
        }),
        edge(graphId, 'retain-retry', 'package:retain', 'package:retry', [recovery], {
          outcome: 'recovery',
        }),
        edge(graphId, 'retry-export', 'package:retry', 'package:export', [recovery], {
          loop: { exitCondition: 'The package export is complete.', maximumIterations: 3 },
          outcome: 'recovery',
        }),
        edge(graphId, 'retain-end', 'package:retain', 'package:end', [failure], {
          outcome: 'failure',
        }),
      ],
    },
    pathIds: [main, alternate, failure, recovery],
    acceptanceCaseIds: ['ac-9'],
    sourceRefs: [],
  }
}

export function buildDo178UseCases(source: SourceApplication): UseCaseDefinition[] {
  const rules = source.rules.map((rule) => rule.id)
  const sources = source.sources.map((item) => item.id)
  const findingReturn = step(
    source,
    'uc-findings',
    'return',
    1,
    'actor-qa',
    'Return finding',
    'The finding returns with the missing closure evidence.',
  )
  const findingUpdate = step(
    source,
    'uc-findings',
    'update',
    1,
    'actor-vv',
    'Update corrective action',
    'The finding records the revised corrective action.',
  )
  const reviewChange = step(
    source,
    'uc-reviews',
    'change',
    1,
    'actor-auditor',
    'Request review change',
    'The review records the required change.',
  )
  const packageRemove = step(
    source,
    'uc-package',
    'remove',
    1,
    'actor-lead',
    'Remove invalid item',
    'The invalid item leaves the package selection.',
  )
  const packageRetain = step(
    source,
    'uc-package',
    'retain',
    1,
    'actor-cm',
    'Retain last package',
    'The last valid package remains available.',
  )
  const packageRetry = step(
    source,
    'uc-package',
    'retry',
    1,
    'actor-lead',
    'Retry package export',
    'The hub starts another local export.',
  )
  return [{
    id: 'uc-findings',
    name: 'Close audit finding',
    actorIds: ['actor-vv', 'actor-qa', 'actor-lead'],
    trigger: 'A reviewer opens an audit finding that is ready for work.',
    preconditions: ['The selected snapshot contains evidence for an open finding.'],
    mainFlow: [
      step(source, 'uc-findings', 'open', 1, 'actor-vv', 'Inspect finding evidence', 'The view shows the evidence revision and history.', 'screenshot'),
      step(source, 'uc-findings', 'assign', 2, 'actor-qa', 'Assign finding owner', 'The finding records the owner and due date.'),
      step(source, 'uc-findings', 'correct', 3, 'actor-vv', 'Record corrective action', 'The finding records the corrective action.'),
      step(source, 'uc-findings', 'reverify', 4, 'actor-lead', 'Verify corrective action', 'The finding records the verification result.'),
      step(source, 'uc-findings', 'close', 5, 'actor-lead', 'Close audit finding', 'The finding closes with immutable history.'),
    ],
    alternatePaths: [path(
      'uc-findings:path:return',
      'Return audit finding',
      'alternate',
      [findingReturn],
      'The finding returns for more work.',
    )],
    failurePaths: [],
    recoveryPaths: [path(
      'uc-findings:path:update',
      'Update corrective action',
      'recovery',
      [findingUpdate],
      'The finding returns to closure review.',
    )],
    ruleIds: rules,
    inputIds: [],
    outputIds: [],
    acceptanceCaseIds: ['ac-7'],
    sourceRefs: sources,
  }, {
    id: 'uc-reviews',
    name: 'Record assurance review',
    actorIds: ['actor-qa', 'actor-vv', 'actor-auditor'],
    trigger: 'A reviewer starts an assurance review for the selected snapshot.',
    preconditions: ['The reviewer has approved access to the selected snapshot.'],
    mainFlow: [
      step(source, 'uc-reviews', 'scope', 1, 'actor-qa', 'Select review evidence', 'The review uses exact evidence revisions.'),
      step(source, 'uc-reviews', 'independence', 2, 'actor-auditor', 'Confirm reviewer independence', 'The review records independence evidence.'),
      step(source, 'uc-reviews', 'inspect', 3, 'actor-vv', 'Inspect review history', 'The view shows related traces and prior decisions.', 'screenshot'),
      step(source, 'uc-reviews', 'decide', 4, 'actor-auditor', 'Record review decision', 'The review appends the decision and comments.'),
    ],
    alternatePaths: [path(
      'uc-reviews:path:change',
      'Request review change',
      'alternate',
      [reviewChange],
      'The review records a required change.',
    )],
    failurePaths: [],
    recoveryPaths: [],
    ruleIds: rules,
    inputIds: [],
    outputIds: [],
    acceptanceCaseIds: ['ac-2'],
    sourceRefs: sources,
  }, {
    id: 'uc-package',
    name: 'Build audit package',
    actorIds: ['actor-lead', 'actor-auditor', 'actor-cm'],
    trigger: 'A certification lead starts an audit package export.',
    preconditions: ['A published snapshot and package selection exist.'],
    mainFlow: [
      step(source, 'uc-package', 'select', 1, 'actor-lead', 'Select package evidence', 'The selection includes required assurance evidence.'),
      step(source, 'uc-package', 'baseline', 2, 'actor-cm', 'Record baseline metadata', 'The manifest records exact source revisions.'),
      step(source, 'uc-package', 'verify', 3, 'actor-auditor', 'Check package integrity', 'Each package item passes its integrity checks.'),
      step(source, 'uc-package', 'watermark', 4, undefined, 'Mark synthetic sample', 'The watermark identifies sample evidence.'),
      step(source, 'uc-package', 'export', 5, 'actor-lead', 'Export audit package', 'The adapter writes a reproducible package.'),
    ],
    alternatePaths: [path(
      'uc-package:path:remove',
      'Remove invalid item',
      'alternate',
      [packageRemove],
      'The package selection excludes the invalid item.',
    )],
    failurePaths: [path(
      'uc-package:path:failure',
      'Retain last package',
      'failure',
      [packageRetain],
      'The last valid package remains available.',
    )],
    recoveryPaths: [path(
      'uc-package:path:retry',
      'Retry package export',
      'recovery',
      [packageRetry],
      'The hub retries the package export.',
    )],
    ruleIds: rules,
    inputIds: [],
    outputIds: [],
    acceptanceCaseIds: ['ac-9'],
    sourceRefs: sources,
  }]
}

export function buildDo178ApplicationWorkflows(
  source: SourceApplication,
): ApplicationWorkflowDefinition[] {
  const sourceRefs = source.sources.map((item) => item.id)
  return [findingWorkflow(), reviewWorkflow(), packageWorkflow()].map((workflow) => ({
    ...workflow,
    sourceRefs,
  }))
}

function allocation(
  workflowId: string,
  nodeId: string,
  primaryModuleId: string,
  operationId: string,
  participatingModuleIds: string[] = [],
): WorkflowNodeAllocation {
  return {
    workflowId,
    nodeId,
    primaryModuleId,
    participatingModuleIds,
    operationId,
    entryPointId: `entry:${primaryModuleId}`,
  }
}

export function buildDo178WorkflowAllocations(): Record<string, WorkflowNodeAllocation[]> {
  return {
    'uc-findings': [
      allocation(findingWorkflowId, 'finding:inspect', 'mod.audit-experience', 'op.render-audit-hub'),
      allocation(findingWorkflowId, 'finding:assign', 'mod.assurance-workflow', 'op.manage-finding', ['mod.evidence-store']),
      allocation(findingWorkflowId, 'finding:correct', 'mod.assurance-workflow', 'op.manage-finding', ['mod.evidence-store']),
      allocation(findingWorkflowId, 'finding:return', 'mod.assurance-workflow', 'op.manage-finding', ['mod.evidence-store']),
      allocation(findingWorkflowId, 'finding:reverify', 'mod.evidence-graph', 'op-traverse-evidence-chain', ['mod.assurance-workflow']),
      allocation(findingWorkflowId, 'finding:update', 'mod.assurance-workflow', 'op.manage-finding', ['mod.evidence-store']),
      allocation(findingWorkflowId, 'finding:close', 'mod.assurance-workflow', 'op.manage-finding', ['mod.evidence-store']),
    ],
    'uc-reviews': [
      allocation(reviewWorkflowId, 'review:select', 'mod.audit-experience', 'op.render-audit-hub'),
      allocation(reviewWorkflowId, 'review:independence', 'mod.assurance-workflow', 'op.record-review', ['mod.evidence-store']),
      allocation(reviewWorkflowId, 'review:inspect', 'mod.evidence-graph', 'op.query-dossier'),
      allocation(reviewWorkflowId, 'review:request-change', 'mod.assurance-workflow', 'op.record-review', ['mod.evidence-store']),
      allocation(reviewWorkflowId, 'review:record', 'mod.assurance-workflow', 'op.record-review', ['mod.evidence-store']),
    ],
    'uc-package': [
      allocation(packageWorkflowId, 'package:select', 'mod.audit-experience', 'op.render-audit-hub'),
      allocation(packageWorkflowId, 'package:baseline', 'mod.workspace-snapshots', 'op.select-workspace-baseline'),
      allocation(packageWorkflowId, 'package:check', 'mod.evidence-graph', 'op.query-dossier'),
      allocation(packageWorkflowId, 'package:remove', 'mod.assurance-workflow', 'op.build-audit-package'),
      allocation(packageWorkflowId, 'package:watermark', 'mod.assurance-workflow', 'op.build-audit-package'),
      allocation(packageWorkflowId, 'package:export', 'mod.external-adapters', 'op.access-external-artifacts'),
      allocation(packageWorkflowId, 'package:retain', 'mod.evidence-store', 'op.persist-evidence-state'),
      allocation(packageWorkflowId, 'package:retry', 'mod.assurance-workflow', 'op.build-audit-package'),
    ],
  }
}

function moduleEdge(
  graphId: string,
  suffix: string,
  fromNodeId: string,
  toNodeId: string,
  options: Omit<ActivityEdge, 'id' | 'fromNodeId' | 'toNodeId' | 'traceIds'> = {},
): ActivityEdge {
  return edge(graphId, suffix, fromNodeId, toNodeId, [graphId], options)
}

export function buildAssuranceModuleBehavior(
  base: ModuleBehaviorSpecification,
): ModuleBehaviorSpecification {
  const findingActivityId = 'activity:assurance:manage-finding'
  const findingGraphId = `${findingActivityId}:graph`
  const reviewActivityId = 'activity:assurance:record-review'
  const reviewGraphId = `${reviewActivityId}:graph`
  const packageActivityId = 'activity:assurance:build-package'
  const packageGraphId = `${packageActivityId}:graph`
  return {
    ...base,
    preconditions: ['The selected snapshot is published and immutable.'],
    postconditions: ['Each assurance decision is append-only and traceable.'],
    domainRejections: ['Closure evidence is incomplete.', 'Reviewer independence is not established.'],
    technicalFailures: ['The evidence store is not available.', 'The package export failed.'],
    retry: 'Retry a failed write three times.',
    recovery: 'Keep the last valid record and resume the operation.',
    emittedEvents: ['finding.assigned', 'finding.closed', 'review.recorded', 'audit-package.exported'],
    consumedEvents: ['finding.change-requested', 'review.requested', 'audit-package.requested'],
    activityDefinitions: [{
      id: findingActivityId,
      name: 'Manage audit finding',
      entryOperationId: 'op.manage-finding',
      refinesWorkflowNodeIds: [
        'finding:assign',
        'finding:correct',
        'finding:return',
        'finding:update',
        'finding:close',
      ],
      graph: {
        id: findingGraphId,
        name: 'Manage audit finding',
        nodes: [
          node('mf:start', 'initial', 'Initial', 'The module activity starts.'),
          { ...node('mf:receive', 'receive-event', 'Receive finding change', 'The module receives a finding change.', ['finding:assign']), eventId: 'finding.change-requested' },
          node('mf:load', 'action', 'Load finding history', 'The module loads the immutable finding history.', ['finding:assign']),
          { ...node('mf:query', 'call-operation', 'Query evidence dossier', 'The module queries the linked evidence.', ['finding:correct']), operationId: 'op.query-dossier' },
          node('mf:current', 'decision', 'Evidence current', 'The module checks the evidence revision.'),
          node('mf:reject', 'action', 'Reject stale change', 'The module rejects a stale change.', ['finding:return']),
          node('mf:fork', 'fork', 'Persist and notify', 'The module starts the write and notification work.'),
          { ...node('mf:persist', 'call-operation', 'Persist finding change', 'The module appends the finding change.', ['finding:update']), operationId: 'op.persist-evidence-state' },
          { ...node('mf:assigned', 'send-event', 'Send finding assignment', 'The module sends the assignment event.', ['finding:assign']), eventId: 'finding.assigned' },
          node('mf:join', 'join', 'Change recorded', 'The module waits for both branches.'),
          node('mf:closure', 'decision', 'Closure requested', 'The module checks the requested state.'),
          { ...node('mf:verify', 'call-operation', 'Verify evidence chain', 'The module verifies the evidence chain.', ['finding:close']), operationId: 'op-traverse-evidence-chain' },
          node('mf:allowed', 'decision', 'Closure allowed', 'The module checks the closure rules.'),
          node('mf:keep-open', 'action', 'Keep finding open', 'The module records the rejection reason.', ['finding:return']),
          node('mf:append-close', 'action', 'Append closure decision', 'The module appends the closure decision.', ['finding:close']),
          { ...node('mf:closed', 'send-event', 'Send finding closure', 'The module sends the closure event.', ['finding:close']), eventId: 'finding.closed' },
          node('mf:end', 'final', 'Final', 'The module activity ends.'),
          node('mf:rejected', 'final', 'Rejected', 'The module rejects the stale request.'),
        ],
        edges: [
          moduleEdge(findingGraphId, 'start-receive', 'mf:start', 'mf:receive'),
          moduleEdge(findingGraphId, 'receive-load', 'mf:receive', 'mf:load'),
          moduleEdge(findingGraphId, 'load-query', 'mf:load', 'mf:query'),
          moduleEdge(findingGraphId, 'query-current', 'mf:query', 'mf:current'),
          moduleEdge(findingGraphId, 'current-fork', 'mf:current', 'mf:fork', { guard: 'The evidence revision is current.', outcome: 'success' }),
          moduleEdge(findingGraphId, 'current-reject', 'mf:current', 'mf:reject', { guard: 'The evidence revision is stale.', outcome: 'failure' }),
          moduleEdge(findingGraphId, 'reject-end', 'mf:reject', 'mf:rejected', { outcome: 'failure' }),
          moduleEdge(findingGraphId, 'fork-persist', 'mf:fork', 'mf:persist'),
          moduleEdge(findingGraphId, 'fork-assigned', 'mf:fork', 'mf:assigned'),
          moduleEdge(findingGraphId, 'persist-join', 'mf:persist', 'mf:join'),
          moduleEdge(findingGraphId, 'assigned-join', 'mf:assigned', 'mf:join'),
          moduleEdge(findingGraphId, 'join-closure', 'mf:join', 'mf:closure'),
          moduleEdge(findingGraphId, 'closure-verify', 'mf:closure', 'mf:verify', { guard: 'The change requests closure.', outcome: 'success' }),
          moduleEdge(findingGraphId, 'closure-end', 'mf:closure', 'mf:end', { guard: 'The finding stays open.', outcome: 'alternate' }),
          moduleEdge(findingGraphId, 'verify-allowed', 'mf:verify', 'mf:allowed'),
          moduleEdge(findingGraphId, 'allowed-close', 'mf:allowed', 'mf:append-close', { guard: 'All closure rules pass.', outcome: 'success' }),
          moduleEdge(findingGraphId, 'allowed-open', 'mf:allowed', 'mf:keep-open', { guard: 'A closure rule fails.', outcome: 'failure' }),
          moduleEdge(findingGraphId, 'open-end', 'mf:keep-open', 'mf:end', { outcome: 'recovery' }),
          moduleEdge(findingGraphId, 'close-event', 'mf:append-close', 'mf:closed'),
          moduleEdge(findingGraphId, 'event-end', 'mf:closed', 'mf:end'),
        ],
      },
    }, {
      id: reviewActivityId,
      name: 'Record assurance review',
      entryOperationId: 'op.record-review',
      refinesWorkflowNodeIds: [
        'review:independence',
        'review:request-change',
        'review:record',
      ],
      graph: {
        id: reviewGraphId,
        name: 'Record assurance review',
        nodes: [
          node('rr:start', 'initial', 'Initial', 'The module activity starts.'),
          { ...node('rr:receive', 'receive-event', 'Receive review request', 'The module receives the review request.', ['review:record']), eventId: 'review.requested' },
          { ...node('rr:query', 'call-operation', 'Query review evidence', 'The module queries the selected evidence.', ['review:independence']), operationId: 'op.query-dossier' },
          node('rr:fork', 'fork', 'Check review evidence', 'The module starts two independent checks.'),
          node('rr:independence', 'action', 'Check reviewer independence', 'The module checks reviewer independence.', ['review:independence']),
          node('rr:history', 'action', 'Check review history', 'The module checks prior review decisions.', ['review:record']),
          node('rr:join', 'join', 'Review checks complete', 'The module waits for both checks.'),
          node('rr:valid', 'decision', 'Review valid', 'The module checks the review rules.'),
          node('rr:reject', 'action', 'Request review change', 'The module records a required change.', ['review:request-change']),
          node('rr:decision', 'action', 'Append review decision', 'The module appends the review decision.', ['review:record']),
          { ...node('rr:persist', 'call-operation', 'Persist review record', 'The module stores the review record.', ['review:record']), operationId: 'op.persist-evidence-state' },
          { ...node('rr:event', 'send-event', 'Send review result', 'The module sends the review event.', ['review:record']), eventId: 'review.recorded' },
          node('rr:end', 'final', 'Final', 'The module activity ends.'),
          node('rr:rejected', 'final', 'Rejected', 'The module rejects the review request.'),
        ],
        edges: [
          moduleEdge(reviewGraphId, 'start-receive', 'rr:start', 'rr:receive'),
          moduleEdge(reviewGraphId, 'receive-query', 'rr:receive', 'rr:query'),
          moduleEdge(reviewGraphId, 'query-fork', 'rr:query', 'rr:fork'),
          moduleEdge(reviewGraphId, 'fork-independence', 'rr:fork', 'rr:independence'),
          moduleEdge(reviewGraphId, 'fork-history', 'rr:fork', 'rr:history'),
          moduleEdge(reviewGraphId, 'independence-join', 'rr:independence', 'rr:join'),
          moduleEdge(reviewGraphId, 'history-join', 'rr:history', 'rr:join'),
          moduleEdge(reviewGraphId, 'join-valid', 'rr:join', 'rr:valid'),
          moduleEdge(reviewGraphId, 'valid-decision', 'rr:valid', 'rr:decision', { guard: 'All review rules pass.', outcome: 'success' }),
          moduleEdge(reviewGraphId, 'valid-reject', 'rr:valid', 'rr:reject', { guard: 'A review rule fails.', outcome: 'alternate' }),
          moduleEdge(reviewGraphId, 'reject-end', 'rr:reject', 'rr:rejected', { outcome: 'failure' }),
          moduleEdge(reviewGraphId, 'decision-persist', 'rr:decision', 'rr:persist'),
          moduleEdge(reviewGraphId, 'persist-event', 'rr:persist', 'rr:event'),
          moduleEdge(reviewGraphId, 'event-end', 'rr:event', 'rr:end'),
        ],
      },
    }, {
      id: packageActivityId,
      name: 'Build audit package',
      entryOperationId: 'op.build-audit-package',
      refinesWorkflowNodeIds: [
        'package:remove',
        'package:watermark',
        'package:retry',
      ],
      graph: {
        id: packageGraphId,
        name: 'Build audit package',
        nodes: [
          node('bp:start', 'initial', 'Initial', 'The module activity starts.'),
          { ...node('bp:receive', 'receive-event', 'Receive package request', 'The module receives the package request.', ['package:watermark']), eventId: 'audit-package.requested' },
          { ...node('bp:query', 'call-operation', 'Query package evidence', 'The module queries selected evidence.', ['package:remove']), operationId: 'op.query-dossier' },
          node('bp:validate', 'action', 'Validate package items', 'The module validates each package item.', ['package:remove']),
          node('bp:valid', 'decision', 'Items valid', 'The module checks package integrity.'),
          node('bp:remove', 'action', 'Remove invalid item', 'The module removes one invalid item.', ['package:remove']),
          node('bp:merge', 'merge', 'Validated selection', 'The module combines validated selections.'),
          node('bp:manifest', 'action', 'Build package manifest', 'The module creates the deterministic manifest.', ['package:watermark']),
          node('bp:watermark', 'action', 'Apply sample watermark', 'The module applies the sample watermark.', ['package:watermark']),
          { ...node('bp:persist', 'call-operation', 'Persist package record', 'The module stores the package manifest.', ['package:watermark']), operationId: 'op.persist-evidence-state' },
          node('bp:write', 'action', 'Request local export', 'The module requests the local export.', ['package:retry']),
          node('bp:written', 'decision', 'Export written', 'The module checks the export result.'),
          node('bp:retain', 'action', 'Retain valid package', 'The module keeps the last valid package.', ['package:retry']),
          node('bp:retry', 'action', 'Retry local export', 'The module retries the local export.', ['package:retry']),
          { ...node('bp:event', 'send-event', 'Send package export', 'The module sends the export event.', ['package:watermark']), eventId: 'audit-package.exported' },
          node('bp:end', 'final', 'Final', 'The module activity ends.'),
        ],
        edges: [
          moduleEdge(packageGraphId, 'start-receive', 'bp:start', 'bp:receive'),
          moduleEdge(packageGraphId, 'receive-query', 'bp:receive', 'bp:query'),
          moduleEdge(packageGraphId, 'query-validate', 'bp:query', 'bp:validate'),
          moduleEdge(packageGraphId, 'validate-valid', 'bp:validate', 'bp:valid'),
          moduleEdge(packageGraphId, 'valid-merge', 'bp:valid', 'bp:merge', { guard: 'All package items are valid.', outcome: 'success' }),
          moduleEdge(packageGraphId, 'valid-remove', 'bp:valid', 'bp:remove', { guard: 'A package item is invalid.', outcome: 'alternate' }),
          moduleEdge(packageGraphId, 'remove-merge', 'bp:remove', 'bp:merge'),
          moduleEdge(packageGraphId, 'merge-manifest', 'bp:merge', 'bp:manifest'),
          moduleEdge(packageGraphId, 'manifest-watermark', 'bp:manifest', 'bp:watermark'),
          moduleEdge(packageGraphId, 'watermark-persist', 'bp:watermark', 'bp:persist'),
          moduleEdge(packageGraphId, 'persist-write', 'bp:persist', 'bp:write'),
          moduleEdge(packageGraphId, 'write-result', 'bp:write', 'bp:written'),
          moduleEdge(packageGraphId, 'written-event', 'bp:written', 'bp:event', { guard: 'The local export is complete.', outcome: 'success' }),
          moduleEdge(packageGraphId, 'written-retain', 'bp:written', 'bp:retain', { guard: 'The local export failed.', outcome: 'failure' }),
          moduleEdge(packageGraphId, 'retain-retry', 'bp:retain', 'bp:retry', { outcome: 'recovery' }),
          moduleEdge(packageGraphId, 'retry-write', 'bp:retry', 'bp:write', {
            outcome: 'recovery',
            loop: { exitCondition: 'The local export is complete.', maximumIterations: 3 },
          }),
          moduleEdge(packageGraphId, 'event-end', 'bp:event', 'bp:end'),
        ],
      },
    }],
    stateDefinitions: [
      { id: 'open', name: 'Open', entryActionIds: ['mf:load'], exitActionIds: [] },
      { id: 'assigned', name: 'Assigned', entryActionIds: ['mf:assigned'], exitActionIds: [] },
      { id: 'correcting', name: 'Correcting', entryActionIds: ['mf:persist'], exitActionIds: [] },
      { id: 'ready', name: 'Ready', entryActionIds: ['mf:verify'], exitActionIds: [] },
      { id: 'closed', name: 'Closed', entryActionIds: ['mf:append-close'], exitActionIds: [] },
    ],
    stateTransitions: [
      { id: 'assign', fromStateId: 'open', toStateId: 'assigned', trigger: 'Assign owner', effectActivityNodeIds: ['mf:assigned'] },
      { id: 'correct', fromStateId: 'assigned', toStateId: 'correcting', trigger: 'Record correction', effectActivityNodeIds: ['mf:persist'] },
      { id: 'submit', fromStateId: 'correcting', toStateId: 'ready', trigger: 'Request closure', guard: 'The evidence is complete.', effectActivityNodeIds: ['mf:verify'] },
      { id: 'return', fromStateId: 'ready', toStateId: 'correcting', trigger: 'Return finding', guard: 'A closure rule fails.', effectActivityNodeIds: ['mf:keep-open'] },
      { id: 'close', fromStateId: 'ready', toStateId: 'closed', trigger: 'Approve closure', guard: 'All closure rules pass.', effectActivityNodeIds: ['mf:append-close'] },
      { id: 'reopen', fromStateId: 'closed', toStateId: 'open', trigger: 'Reopen finding', guard: 'New evidence invalidates closure.', effectActivityNodeIds: ['mf:load'] },
    ],
    interactionDefinitions: [{
      id: 'interaction:assurance:finding',
      name: 'Change audit finding',
      participants: [
        { id: 'ui', label: 'Audit Hub', kind: 'module' },
        { id: 'workflow', label: 'Assurance Workflow', kind: 'module' },
        { id: 'graph', label: 'Evidence Graph', kind: 'module' },
        { id: 'store', label: 'Evidence Store', kind: 'module' },
      ],
      messages: [
        { id: 'submit', fromParticipantId: 'ui', toParticipantId: 'workflow', label: 'Submit finding change', kind: 'synchronous', operationId: 'op.manage-finding', refinesActivityNodeIds: ['mf:receive'] },
        { id: 'query', fromParticipantId: 'workflow', toParticipantId: 'graph', label: 'Query evidence dossier', kind: 'synchronous', operationId: 'op.query-dossier', refinesActivityNodeIds: ['mf:query'] },
        { id: 'query-reply', fromParticipantId: 'graph', toParticipantId: 'workflow', label: 'Return evidence dossier', kind: 'reply', operationId: 'op.query-dossier', refinesActivityNodeIds: ['mf:query'] },
        { id: 'persist', fromParticipantId: 'workflow', toParticipantId: 'store', label: 'Persist finding change', kind: 'synchronous', operationId: 'op.persist-evidence-state', guard: 'The evidence revision is current.', refinesActivityNodeIds: ['mf:persist'] },
        { id: 'persist-reply', fromParticipantId: 'store', toParticipantId: 'workflow', label: 'Return stored revision', kind: 'reply', operationId: 'op.persist-evidence-state', refinesActivityNodeIds: ['mf:persist'] },
        { id: 'result', fromParticipantId: 'workflow', toParticipantId: 'ui', label: 'Return finding result', kind: 'reply', operationId: 'op.manage-finding', refinesActivityNodeIds: ['mf:end'] },
      ],
      fragments: [{
        id: 'current-evidence',
        kind: 'alt',
        label: 'Current evidence result',
        guard: 'The evidence revision is current or stale.',
        messageIds: ['persist', 'persist-reply'],
      }],
    }],
  }
}

export const DO178_COMPLEX_BEHAVIOR_COUNTS = {
  useCases: 3,
  actors: 6,
  applicationNodes: 36,
  modules: 6,
  moduleActivities: 3,
  findingActivityNodes: 18,
  packageActivityNodes: 16,
} as const
