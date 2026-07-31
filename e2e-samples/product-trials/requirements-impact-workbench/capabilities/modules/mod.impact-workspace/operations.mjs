export const moduleDefinition = {
  "moduleId": "mod.impact-workspace",
  "name": "Impact workspace",
  "moduleType": "experience",
  "responsibility": "Shows change scope, trace paths, decisions, and review state."
}

export const ownedOperations = [
  "import-requirement-change",
  "assign-rework-action"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
