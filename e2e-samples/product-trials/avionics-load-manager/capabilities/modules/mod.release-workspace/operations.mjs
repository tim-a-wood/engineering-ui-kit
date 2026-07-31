export const moduleDefinition = {
  "moduleId": "mod.release-workspace",
  "name": "Release workspace",
  "moduleType": "experience",
  "responsibility": "Guides package selection, checks, authorization, and load state."
}

export const ownedOperations = [
  "register-software-load",
  "verify-loaded-configuration"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
