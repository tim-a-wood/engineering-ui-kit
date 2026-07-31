export const moduleDefinition = {
  "moduleId": "mod.impact-engine",
  "name": "Impact engine",
  "moduleType": "domain",
  "responsibility": "Traverses dependencies and classifies affected records."
}

export const ownedOperations = [
  "compare-trace-revision",
  "approve-impact-decision"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
