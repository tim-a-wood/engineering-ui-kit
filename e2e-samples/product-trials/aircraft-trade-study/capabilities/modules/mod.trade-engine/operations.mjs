export const moduleDefinition = {
  "moduleId": "mod.trade-engine",
  "name": "Trade engine",
  "moduleType": "domain",
  "responsibility": "Computes comparison, sensitivity, margin, and rank."
}

export const ownedOperations = [
  "review-sensitivity-result"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
