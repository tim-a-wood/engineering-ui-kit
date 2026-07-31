export const moduleDefinition = {
  "moduleId": "mod.intake-flow",
  "name": "Intake flow",
  "moduleType": "workflow",
  "responsibility": "Coordinates submission, checks, correction, and acceptance."
}

export const ownedOperations = [
  "receive-supplier-package",
  "verify-corrected-package"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
