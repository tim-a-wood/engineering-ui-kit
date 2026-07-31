const transitions = new Map([
  [
    "record-failure-report",
    {
      "result": "Failure report FR-2026-118 recorded",
      "target": "reports",
      "protected": false
    }
  ],
  [
    "classify-failure-mode",
    {
      "result": "Failure mode classified",
      "target": "reports",
      "protected": false
    }
  ],
  [
    "record-containment-action",
    {
      "result": "Containment action recorded",
      "target": "actions",
      "protected": false
    }
  ],
  [
    "analyze-root-cause",
    {
      "result": "Root cause analysis opened",
      "target": "investigations",
      "protected": false
    }
  ],
  [
    "link-causal-evidence",
    {
      "result": "Causal evidence linked",
      "target": "investigations",
      "protected": false
    }
  ],
  [
    "assign-corrective-action",
    {
      "result": "Corrective action assigned",
      "target": "actions",
      "protected": false
    }
  ],
  [
    "verify-action-closure",
    {
      "result": "Action closure verified",
      "target": "actions",
      "protected": false
    }
  ],
  [
    "monitor-failure-recurrence",
    {
      "result": "Recurrence monitor started",
      "target": "reports",
      "protected": false
    }
  ],
  [
    "reject-open-corrective-action",
    {
      "result": "Open corrective action retained",
      "target": "actions",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "FRACAS Investigations",
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
  if (state.completed.includes("reject-open-corrective-action")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
