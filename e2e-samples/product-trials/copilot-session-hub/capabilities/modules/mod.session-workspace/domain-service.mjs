const transitions = new Map([
  [
    "start-copilot-session",
    {
      "result": "Session started with packet PKT-204",
      "target": "active",
      "protected": false
    }
  ],
  [
    "update-session-progress",
    {
      "result": "Progress updated to 68 percent",
      "target": "active",
      "protected": false
    }
  ],
  [
    "record-session-issue",
    {
      "result": "Issue linked to the active session",
      "target": "issues",
      "protected": false
    }
  ],
  [
    "link-branch-output",
    {
      "result": "Branch output linked to the session",
      "target": "active",
      "protected": false
    }
  ],
  [
    "record-next-action",
    {
      "result": "Next action added to the session",
      "target": "active",
      "protected": false
    }
  ],
  [
    "review-active-sessions",
    {
      "result": "Twelve active sessions shown",
      "target": "active",
      "protected": false
    }
  ],
  [
    "close-completed-session",
    {
      "result": "Session closed with evidence",
      "target": "history",
      "protected": false
    }
  ],
  [
    "reopen-paused-session",
    {
      "result": "Paused session returned to active work",
      "target": "active",
      "protected": false
    }
  ],
  [
    "reject-unresolved-session",
    {
      "result": "Unresolved session kept open",
      "target": "issues",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Copilot Sessions",
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
  if (state.completed.includes("reject-unresolved-session")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
