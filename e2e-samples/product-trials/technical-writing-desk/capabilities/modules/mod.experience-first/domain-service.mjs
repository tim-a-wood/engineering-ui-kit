const transitions = new Map([
  [
    "draft-technical-note",
    {
      "result": "Technical note draft saved",
      "target": "documents",
      "protected": false
    }
  ],
  [
    "check-ste-wording",
    {
      "result": "STE check completed with four items",
      "target": "terminology",
      "protected": false
    }
  ],
  [
    "compare-document-revision",
    {
      "result": "Revision comparison opened",
      "target": "documents",
      "protected": false
    }
  ],
  [
    "record-review-comment",
    {
      "result": "Review comment recorded",
      "target": "comments",
      "protected": false
    }
  ],
  [
    "approve-controlled-revision",
    {
      "result": "Controlled revision approved",
      "target": "documents",
      "protected": false
    }
  ],
  [
    "export-approved-document",
    {
      "result": "Approved document package exported",
      "target": "documents",
      "protected": false
    }
  ],
  [
    "reject-prohibited-term",
    {
      "result": "Prohibited term rejected",
      "target": "terminology",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Technical Writing and Review Desk",
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
  if (state.completed.includes("reject-prohibited-term")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
