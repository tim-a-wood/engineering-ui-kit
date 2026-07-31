export const moduleDefinition = {
  "moduleId": "mod.model-runner",
  "name": "Model runner",
  "moduleType": "connection",
  "responsibility": "Runs the approved analysis model and captures execution data."
}

export const ownedOperations = [
  "compare-design-options"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
