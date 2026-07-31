export const moduleDefinition = {
  "moduleId": "mod.review-records",
  "name": "Review records",
  "moduleType": "platform",
  "responsibility": "Preserves approved review records and immutable evidence."
}

export const ownedOperations = [
  "verify-finding-closure"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
