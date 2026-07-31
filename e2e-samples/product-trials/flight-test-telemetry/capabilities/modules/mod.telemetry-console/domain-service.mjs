const transitions = new Map([
  [
    "load-telemetry-run",
    {
      "result": "Flight FT-284 loaded",
      "target": "runs",
      "protected": false
    }
  ],
  [
    "review-exceedance-event",
    {
      "result": "Exceedance EVT-391 opened",
      "target": "events",
      "protected": false
    }
  ],
  [
    "mark-analysis-interval",
    {
      "result": "Analysis interval marked",
      "target": "events",
      "protected": false
    }
  ],
  [
    "compare-sensor-source",
    {
      "result": "Sensor source comparison opened",
      "target": "events",
      "protected": false
    }
  ],
  [
    "annotate-data-dropout",
    {
      "result": "Data dropout annotation recorded",
      "target": "runs",
      "protected": false
    }
  ],
  [
    "record-engineering-note",
    {
      "result": "Engineering note linked to EVT-391",
      "target": "investigations",
      "protected": false
    }
  ],
  [
    "export-investigation-package",
    {
      "result": "Investigation package exported",
      "target": "investigations",
      "protected": false
    }
  ],
  [
    "reject-unverified-exceedance",
    {
      "result": "Unverified exceedance withheld",
      "target": "events",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Flight Test Telemetry",
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
  if (state.completed.includes("reject-unverified-exceedance")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
