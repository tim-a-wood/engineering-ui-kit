export const moduleDefinition = {
  "moduleId": "mod.decision-control",
  "name": "Decision control",
  "moduleType": "workflow",
  "responsibility": "Owns dispositions, review assignments, and approval."
}

export const ownedOperations = [
  "review-module-impact"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
