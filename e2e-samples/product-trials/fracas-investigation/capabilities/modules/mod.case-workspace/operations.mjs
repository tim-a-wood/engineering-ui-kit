export const moduleDefinition = {
  "moduleId": "mod.case-workspace",
  "name": "Case workspace",
  "moduleType": "experience",
  "responsibility": "Combines failure evidence, analysis, actions, and recurrence."
}

export const ownedOperations = [
  "record-failure-report",
  "assign-corrective-action"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
