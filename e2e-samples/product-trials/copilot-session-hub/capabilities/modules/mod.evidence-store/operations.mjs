export const moduleDefinition = {
  "moduleId": "mod.evidence-store",
  "name": "Evidence store",
  "moduleType": "platform",
  "responsibility": "Preserves outputs, links, checks, and completion evidence."
}

export const ownedOperations = [
  "link-branch-output",
  "reopen-paused-session"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
