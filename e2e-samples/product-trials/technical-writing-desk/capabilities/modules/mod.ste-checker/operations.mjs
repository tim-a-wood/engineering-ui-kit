export const moduleDefinition = {
  "moduleId": "mod.ste-checker",
  "name": "STE checker",
  "moduleType": "domain",
  "responsibility": "Applies approved terminology and ASD-STE100 writing rules."
}

export const ownedOperations = [
  "check-ste-wording",
  "approve-controlled-revision"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
