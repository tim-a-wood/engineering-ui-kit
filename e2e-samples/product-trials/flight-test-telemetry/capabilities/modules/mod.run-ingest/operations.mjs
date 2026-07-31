export const moduleDefinition = {
  "moduleId": "mod.run-ingest",
  "name": "Run ingest",
  "moduleType": "connection",
  "responsibility": "Reads recorded channels and validates time and source identity."
}

export const ownedOperations = [
  "review-exceedance-event",
  "export-investigation-package"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
