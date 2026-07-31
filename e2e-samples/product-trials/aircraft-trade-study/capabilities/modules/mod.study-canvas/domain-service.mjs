const transitions = new Map([
  [
    "define-study-case",
    {
      "result": "Study case TS-CRZ-019 defined",
      "target": "cases",
      "protected": false
    }
  ],
  [
    "run-performance-analysis",
    {
      "result": "Performance analysis completed",
      "target": "results",
      "protected": false
    }
  ],
  [
    "compare-design-options",
    {
      "result": "Four design options compared",
      "target": "results",
      "protected": false
    }
  ],
  [
    "review-sensitivity-result",
    {
      "result": "Sensitivity result opened",
      "target": "results",
      "protected": false
    }
  ],
  [
    "approve-study-baseline",
    {
      "result": "Study baseline B approved",
      "target": "baselines",
      "protected": false
    }
  ],
  [
    "reject-stale-assumption",
    {
      "result": "Stale assumption rejected",
      "target": "cases",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Aircraft Performance Trade-Study Workbench",
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
  if (state.completed.includes("reject-stale-assumption")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
