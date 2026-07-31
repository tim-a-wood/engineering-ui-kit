export const moduleDefinition = {
  "moduleId": "mod.document-control",
  "name": "Document control",
  "moduleType": "workflow",
  "responsibility": "Coordinates drafts, revisions, reviews, and controlled export."
}

export const ownedOperations = [
  "draft-technical-note",
  "record-review-comment"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
