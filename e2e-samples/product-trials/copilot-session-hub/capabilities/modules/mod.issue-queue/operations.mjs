export const moduleDefinition = {
  "moduleId": "mod.issue-queue",
  "name": "Issue queue",
  "moduleType": "workflow",
  "responsibility": "Routes blockers, decisions, and review requests."
}

export const ownedOperations = [
  "record-session-issue",
  "close-completed-session"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
