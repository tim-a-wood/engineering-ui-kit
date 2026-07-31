export const moduleDefinition = {
  "moduleId": "mod.action-control",
  "name": "Action control",
  "moduleType": "workflow",
  "responsibility": "Owns containment, correction, verification, and overdue work."
}

export const ownedOperations = [
  "analyze-root-cause"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
