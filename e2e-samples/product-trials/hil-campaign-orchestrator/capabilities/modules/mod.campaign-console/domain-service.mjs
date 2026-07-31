const transitions = new Map([
  [
    "reserve-test-bench",
    {
      "result": "Bench 04 reserved",
      "target": "schedule",
      "protected": false
    }
  ],
  [
    "load-test-configuration",
    {
      "result": "Configuration FCS-24.8 loaded",
      "target": "campaign",
      "protected": false
    }
  ],
  [
    "start-test-campaign",
    {
      "result": "Campaign HIL-FCS-088 started",
      "target": "campaign",
      "protected": false
    }
  ],
  [
    "pause-test-campaign",
    {
      "result": "Campaign paused at a safe procedure boundary",
      "target": "campaign",
      "protected": false
    }
  ],
  [
    "review-failed-procedure",
    {
      "result": "Failed procedure TC-FCS-104 opened",
      "target": "procedures",
      "protected": false
    }
  ],
  [
    "retry-failed-procedure",
    {
      "result": "Failed procedure queued for retry",
      "target": "procedures",
      "protected": false
    }
  ],
  [
    "approve-campaign-evidence",
    {
      "result": "Campaign evidence approved",
      "target": "evidence",
      "protected": false
    }
  ],
  [
    "release-test-bench",
    {
      "result": "Bench 04 released with a clean state",
      "target": "schedule",
      "protected": false
    }
  ],
  [
    "reject-unreserved-bench",
    {
      "result": "Unreserved bench request rejected",
      "target": "schedule",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "HIL Test Campaign",
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
  if (state.completed.includes("reject-unreserved-bench")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
