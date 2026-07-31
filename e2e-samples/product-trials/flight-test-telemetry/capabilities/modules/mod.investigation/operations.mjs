export const moduleDefinition = {
  "moduleId": "mod.investigation",
  "name": "Investigation",
  "moduleType": "workflow",
  "responsibility": "Owns intervals, engineering notes, review, and export."
}

export const ownedOperations = [
  "compare-sensor-source"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
