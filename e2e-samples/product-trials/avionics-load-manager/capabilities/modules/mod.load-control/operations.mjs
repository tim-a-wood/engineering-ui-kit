export const moduleDefinition = {
  "moduleId": "mod.load-control",
  "name": "Load control",
  "moduleType": "workflow",
  "responsibility": "Coordinates authorization, transfer, verification, and rollback."
}

export const ownedOperations = [
  "authorize-load-release"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
