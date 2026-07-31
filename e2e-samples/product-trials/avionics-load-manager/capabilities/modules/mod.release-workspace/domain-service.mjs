const transitions = new Map([
  [
    "register-software-load",
    {
      "result": "Software load FCS-24.8.3 registered",
      "target": "loads",
      "protected": false
    }
  ],
  [
    "check-hardware-compatibility",
    {
      "result": "Hardware compatibility checked",
      "target": "fleet",
      "protected": false
    }
  ],
  [
    "authorize-load-release",
    {
      "result": "Load release authorized",
      "target": "loads",
      "protected": false
    }
  ],
  [
    "schedule-aircraft-load",
    {
      "result": "Aircraft load scheduled",
      "target": "fleet",
      "protected": false
    }
  ],
  [
    "record-aircraft-installation",
    {
      "result": "Aircraft installation recorded",
      "target": "install",
      "protected": false
    }
  ],
  [
    "verify-loaded-configuration",
    {
      "result": "Loaded configuration verified",
      "target": "install",
      "protected": false
    }
  ],
  [
    "reject-incompatible-load",
    {
      "result": "Incompatible load rejected",
      "target": "fleet",
      "protected": true
    }
  ]
])

export function createProductState() {
  return {
    product: "Avionics Software Load Manager",
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
  if (state.completed.includes("reject-incompatible-load")) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
