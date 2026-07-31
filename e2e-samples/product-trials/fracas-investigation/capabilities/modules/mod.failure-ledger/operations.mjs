export const moduleDefinition = {
  "moduleId": "mod.failure-ledger",
  "name": "Failure ledger",
  "moduleType": "domain",
  "responsibility": "Owns failure reports, classifications, assets, and occurrence data."
}

export const ownedOperations = [
  "classify-failure-mode",
  "verify-action-closure"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
