export const moduleDefinition = {
  "moduleId": "mod.release-ledger",
  "name": "Release ledger",
  "moduleType": "platform",
  "responsibility": "Preserves package identity, signatures, and installation history."
}

export const ownedOperations = [
  "record-aircraft-installation"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
