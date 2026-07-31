export const moduleDefinition = {
  "moduleId": "mod.case-control",
  "name": "Case control",
  "moduleType": "domain",
  "responsibility": "Owns cases, assumptions, units, and approved baselines."
}

export const ownedOperations = [
  "run-performance-analysis"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
