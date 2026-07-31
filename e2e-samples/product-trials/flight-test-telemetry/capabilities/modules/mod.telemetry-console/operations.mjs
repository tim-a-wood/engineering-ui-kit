export const moduleDefinition = {
  "moduleId": "mod.telemetry-console",
  "name": "Telemetry console",
  "moduleType": "experience",
  "responsibility": "Synchronizes plots, events, intervals, and investigation controls."
}

export const ownedOperations = [
  "load-telemetry-run",
  "record-engineering-note"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
