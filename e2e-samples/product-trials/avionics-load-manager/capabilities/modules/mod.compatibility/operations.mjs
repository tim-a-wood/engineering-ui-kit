export const moduleDefinition = {
  "moduleId": "mod.compatibility",
  "name": "Compatibility",
  "moduleType": "domain",
  "responsibility": "Owns hardware, software, aircraft, and configuration rules."
}

export const ownedOperations = [
  "check-hardware-compatibility"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
