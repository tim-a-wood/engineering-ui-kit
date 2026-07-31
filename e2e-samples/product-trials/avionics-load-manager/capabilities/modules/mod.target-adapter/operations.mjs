export const moduleDefinition = {
  "moduleId": "mod.target-adapter",
  "name": "Target adapter",
  "moduleType": "connection",
  "responsibility": "Isolates aircraft or bench loading protocols."
}

export const ownedOperations = [
  "schedule-aircraft-load"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
