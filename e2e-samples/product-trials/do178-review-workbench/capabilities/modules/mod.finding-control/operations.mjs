export const moduleDefinition = {
  "moduleId": "mod.finding-control",
  "name": "Finding control",
  "moduleType": "domain",
  "responsibility": "Owns findings, ownership, closure evidence, and review rules."
}

export const ownedOperations = [
  "assign-finding-owner",
  "export-review-evidence"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
