const transitions = new Map([
  [
    "import-requirement-change",
    {
      "result": "Requirement change CR-1187 imported",
      "target": "changes",
      "protected": false
    }
  ],
  [
    "trace-affected-design",
    {
      "result": "Seventeen affected artifacts traced",
      "target": "artifacts",
      "protected": false
    }
  ],
  [
    "compare-trace-revision",
    {
      "result": "Trace revision comparison opened",
      "target": "artifacts",
      "protected": false
    }
  ],
  [
    "review-module-impact",
    {
      "result": "Four module impacts opened",
      "target": "artifacts",
      "protected": false
    }
  ],
  [
    "assign-rework-action",
    {
      "result": "Rework action assigned",
      "target": "artifacts",
      "protected": false
    }
  ],
  [
    "estimate-change-effort",
    {
      "result": "Change effort estimate recorded",
      "target": "decisions",
      "protected": false
    }
  ],
  [
    "approve-impact-decision",
    {
      "result": "Impact decision approved",
      "target": "decisions",
      "protected": false
    }
  ],
  [
    "reject-unreviewed-impact",
    {
      "result": "Unreviewed impact kept open",
      "target": "decisions",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Requirement Change Impact",
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
  if (state.completed.includes("reject-unreviewed-impact")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
