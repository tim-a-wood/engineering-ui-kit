export const moduleDefinition = {
  "moduleId": "mod.study-canvas",
  "name": "Study canvas",
  "moduleType": "experience",
  "responsibility": "Owns parameter editing, result comparison, and decision views."
}

export const ownedOperations = [
  "define-study-case",
  "approve-study-baseline"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
