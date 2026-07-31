export const moduleDefinition = {
  "moduleId": "mod.campaign-console",
  "name": "Campaign console",
  "moduleType": "experience",
  "responsibility": "Shows reservations, execution state, failures, and evidence."
}

export const ownedOperations = [
  "reserve-test-bench",
  "retry-failed-procedure"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
