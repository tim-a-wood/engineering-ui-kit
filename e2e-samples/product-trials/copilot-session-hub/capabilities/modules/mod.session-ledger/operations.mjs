export const moduleDefinition = {
  "moduleId": "mod.session-ledger",
  "name": "Session ledger",
  "moduleType": "domain",
  "responsibility": "Owns session identity, state, progress, and history."
}

export const ownedOperations = [
  "update-session-progress",
  "review-active-sessions"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
