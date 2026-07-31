export const moduleDefinition = {
  "moduleId": "mod.rig-adapter",
  "name": "Rig adapter",
  "moduleType": "connection",
  "responsibility": "Isolates real-time bench commands and observations."
}

export const ownedOperations = [
  "pause-test-campaign"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
