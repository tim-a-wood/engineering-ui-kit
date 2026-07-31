export const moduleDefinition = {
  "moduleId": "mod.comment-service",
  "name": "Comment service",
  "moduleType": "domain",
  "responsibility": "Owns review threads, decisions, and resolution state."
}

export const ownedOperations = [
  "compare-document-revision",
  "export-approved-document"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
