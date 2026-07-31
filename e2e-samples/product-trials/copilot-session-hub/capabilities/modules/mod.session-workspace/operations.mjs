export const moduleDefinition = {
  "moduleId": "mod.session-workspace",
  "name": "Session workspace",
  "moduleType": "experience",
  "responsibility": "Shows active agent work, decisions, issues, and next actions."
}

export const ownedOperations = [
  "start-copilot-session",
  "record-next-action"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
