export const moduleDefinition = {
  "moduleId": "mod.trend-service",
  "name": "Trend service",
  "moduleType": "platform",
  "responsibility": "Computes Pareto, repeat rate, exposure, and recurrence signals."
}

export const ownedOperations = [
  "link-causal-evidence"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
