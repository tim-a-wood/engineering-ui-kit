export const moduleDefinition = {
  "moduleId": "mod.campaign-evidence",
  "name": "Campaign evidence",
  "moduleType": "platform",
  "responsibility": "Stores results, logs, configurations, and approvals."
}

export const ownedOperations = [
  "review-failed-procedure"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
