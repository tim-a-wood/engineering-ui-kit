export const moduleDefinition = {
  "moduleId": "mod.package-validator",
  "name": "Package validator",
  "moduleType": "domain",
  "responsibility": "Checks manifests, file integrity, metadata, and required content."
}

export const ownedOperations = [
  "validate-package-manifest",
  "accept-supplier-delivery"
]

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
