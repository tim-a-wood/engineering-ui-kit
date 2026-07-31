export const moduleDefinition = {
  "moduleId": "mod.cause-analysis",
  "name": "Cause analysis",
  "moduleType": "domain",
  "responsibility": "Owns hypotheses, evidence, causal links, and conclusions."
}

export const ownedOperations = [
  "record-containment-action",
  "monitor-failure-recurrence"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
