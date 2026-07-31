export const moduleDefinition = {
  "moduleId": "mod.bench-scheduler",
  "name": "Bench scheduler",
  "moduleType": "domain",
  "responsibility": "Owns reservations, conflicts, assets, and campaign windows."
}

export const ownedOperations = [
  "load-test-configuration",
  "approve-campaign-evidence"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
