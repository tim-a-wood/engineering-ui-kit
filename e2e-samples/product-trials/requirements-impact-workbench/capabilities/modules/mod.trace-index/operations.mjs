export const moduleDefinition = {
  "moduleId": "mod.trace-index",
  "name": "Trace index",
  "moduleType": "platform",
  "responsibility": "Indexes requirements, design, code, tests, and approved revisions."
}

export const ownedOperations = [
  "trace-affected-design",
  "estimate-change-effort"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
