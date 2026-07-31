export const moduleDefinition = {
  "moduleId": "mod.review-control",
  "name": "Review control",
  "moduleType": "workflow",
  "responsibility": "Coordinates independent review tasks and review state."
}

export const ownedOperations = [
  "review-requirement-set",
  "check-objective-coverage"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
