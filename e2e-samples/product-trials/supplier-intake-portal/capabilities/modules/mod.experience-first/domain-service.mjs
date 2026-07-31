const transitions = new Map([
  [
    "receive-supplier-package",
    {
      "result": "Supplier package SUP-ACU-241 received",
      "target": "deliveries",
      "protected": false
    }
  ],
  [
    "validate-package-manifest",
    {
      "result": "Package manifest validated",
      "target": "deliveries",
      "protected": false
    }
  ],
  [
    "review-compliance-gap",
    {
      "result": "Compliance gap GAP-ACU-018 opened",
      "target": "gaps",
      "protected": false
    }
  ],
  [
    "request-supplier-correction",
    {
      "result": "Correction request sent to supplier queue",
      "target": "gaps",
      "protected": false
    }
  ],
  [
    "verify-corrected-package",
    {
      "result": "Corrected package verification passed",
      "target": "deliveries",
      "protected": false
    }
  ],
  [
    "accept-supplier-delivery",
    {
      "result": "Supplier delivery accepted",
      "target": "deliveries",
      "protected": false
    }
  ],
  [
    "reject-unsigned-package",
    {
      "result": "Unsigned package quarantined",
      "target": "deliveries",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Supplier Deliverable Intake Portal",
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
  if (state.completed.includes("reject-unsigned-package")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
