export const moduleDefinition = {
  "moduleId": "mod.flight-archive",
  "name": "Flight archive",
  "moduleType": "platform",
  "responsibility": "Preserves source samples and investigation packages."
}

export const ownedOperations = [
  "annotate-data-dropout"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
