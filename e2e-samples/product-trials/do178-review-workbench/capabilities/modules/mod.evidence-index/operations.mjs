export const moduleDefinition = {
  "moduleId": "mod.evidence-index",
  "name": "Evidence index",
  "moduleType": "domain",
  "responsibility": "Owns lifecycle data, trace links, revisions, and objective coverage."
}

export const ownedOperations = [
  "record-review-finding",
  "approve-review-record"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
