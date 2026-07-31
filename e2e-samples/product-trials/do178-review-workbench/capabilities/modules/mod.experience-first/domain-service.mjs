const transitions = new Map([
  [
    "review-requirement-set",
    {
      "result": "Requirement set opened",
      "target": "artifacts",
      "protected": false
    }
  ],
  [
    "record-review-finding",
    {
      "result": "Finding REV-218 recorded",
      "target": "findings",
      "protected": false
    }
  ],
  [
    "assign-finding-owner",
    {
      "result": "Finding assigned to Navigation team",
      "target": "findings",
      "protected": false
    }
  ],
  [
    "verify-finding-closure",
    {
      "result": "Closure evidence verified",
      "target": "findings",
      "protected": false
    }
  ],
  [
    "check-objective-coverage",
    {
      "result": "Objective coverage check passed",
      "target": "artifacts",
      "protected": false
    }
  ],
  [
    "approve-review-record",
    {
      "result": "Review record approved",
      "target": "records",
      "protected": false
    }
  ],
  [
    "export-review-evidence",
    {
      "result": "Review evidence package exported",
      "target": "records",
      "protected": false
    }
  ],
  [
    "reject-author-approval",
    {
      "result": "Author approval rejected",
      "target": "records",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "DO-178C Review Workbench",
    revision: 0,
    completed: [],
    lastResult: '',
    protectedRejections: 0,
  }
}

export function executeProductAction(state, actionId) {
  const transition = transitions.get(actionId)
  if (!transition) throw new Error(`Unknown product action: ${actionId}`)
  if (transition.protected) {
    return {
      state: { ...state, protectedRejections: state.protectedRejections + 1 },
      result: transition.result,
      mutatedApprovedState: false,
    }
  }
  return {
    state: {
      ...state,
      revision: state.revision + 1,
      completed: [...state.completed, actionId],
      lastResult: transition.result,
    },
    result: transition.result,
    mutatedApprovedState: true,
  }
}

export function validateProductState(state) {
  if (!Array.isArray(state.completed)) throw new Error('The product state has no completed action list.')
  if (state.completed.includes("reject-author-approval")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
