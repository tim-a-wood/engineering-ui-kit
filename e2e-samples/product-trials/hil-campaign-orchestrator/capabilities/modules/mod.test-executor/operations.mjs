export const moduleDefinition = {
  "moduleId": "mod.test-executor",
  "name": "Test executor",
  "moduleType": "workflow",
  "responsibility": "Loads configurations and controls procedure execution."
}

export const ownedOperations = [
  "start-test-campaign",
  "release-test-bench"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
