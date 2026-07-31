export const moduleDefinition = {
  "moduleId": "mod.gap-control",
  "name": "Gap control",
  "moduleType": "domain",
  "responsibility": "Owns gaps, supplier responses, due dates, and closure."
}

export const ownedOperations = [
  "review-compliance-gap"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
