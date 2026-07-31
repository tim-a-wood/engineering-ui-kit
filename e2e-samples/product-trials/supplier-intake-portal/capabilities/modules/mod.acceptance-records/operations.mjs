export const moduleDefinition = {
  "moduleId": "mod.acceptance-records",
  "name": "Acceptance records",
  "moduleType": "platform",
  "responsibility": "Preserves accepted packages and approval evidence."
}

export const ownedOperations = [
  "request-supplier-correction"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
