export const moduleDefinition = {
  "moduleId": "mod.signal-analysis",
  "name": "Signal analysis",
  "moduleType": "domain",
  "responsibility": "Computes thresholds, dropouts, and correlated events."
}

export const ownedOperations = [
  "mark-analysis-interval"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
