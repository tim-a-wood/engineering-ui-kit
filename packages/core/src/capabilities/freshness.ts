/**
 * Deterministic freshness calculation (CAP-PKT-015 / CAP-FRESH-001).
 */

import type { FreshnessRecord, VerificationRecord } from './types.js'
import { canonicalHash } from './hash.js'

export type FreshnessInputs = {
  moduleId: string
  moduleVersion: string
  specificationHash: string
  implementationHash: string
  architectureHash: string
  dependencyHash: string
  adapterHash: string
  bindingHash: string
  verificationSuiteHash: string
  ownedFileHash?: string
  previousImplementationHash?: string
  verification?: VerificationRecord | null
  evaluatedAt?: string
}

export function calculateFreshness(inputs: FreshnessInputs): FreshnessRecord {
  const hashes = {
    specification: inputs.specificationHash,
    implementation: inputs.implementationHash,
    architecture: inputs.architectureHash,
    dependencies: inputs.dependencyHash,
    adapters: inputs.adapterHash,
    bindings: inputs.bindingHash,
    verificationSuites: inputs.verificationSuiteHash,
  }
  const reasonCodes: string[] = []
  let primaryState: FreshnessRecord['primaryState'] = 'draft'

  const verification = inputs.verification
  const exactMatch =
    verification &&
    verification.outcome === 'passed' &&
    verification.moduleId === inputs.moduleId &&
    verification.inputHashes.specification === hashes.specification &&
    verification.inputHashes.implementation === hashes.implementation &&
    verification.inputHashes.architecture === hashes.architecture &&
    verification.inputHashes.dependencies === hashes.dependencies &&
    verification.inputHashes.adapters === hashes.adapters &&
    verification.inputHashes.bindings === hashes.bindings &&
    verification.inputHashes.verificationSuites === hashes.verificationSuites

  if (!verification) {
    primaryState = 'draft'
    reasonCodes.push('verification:missing')
  } else if (verification.outcome === 'failed-setup' || verification.outcome === 'failed-technical') {
    primaryState = 'failed'
    reasonCodes.push(`verification:${verification.outcome}`)
  } else if (verification.outcome === 'failed-domain') {
    primaryState = 'failed'
    reasonCodes.push('verification:failed-domain')
  } else if (verification.outcome !== 'passed') {
    primaryState = 'blocked'
    reasonCodes.push(`verification:${verification.outcome}`)
  } else if (!exactMatch) {
    if (verification.inputHashes.specification !== hashes.specification) {
      primaryState = 'needs-review'
      reasonCodes.push('definition:specification-changed')
    } else if (
      inputs.ownedFileHash &&
      inputs.previousImplementationHash &&
      inputs.ownedFileHash !== inputs.previousImplementationHash
    ) {
      // CAP-DEC-007: manual owned-file change → verification-needed
      primaryState = 'verification-needed'
      reasonCodes.push('implementation:owned-file-changed')
    } else if (verification.inputHashes.implementation !== hashes.implementation) {
      primaryState = 'verification-needed'
      reasonCodes.push('implementation:changed')
    } else if (verification.inputHashes.bindings !== hashes.bindings) {
      primaryState = 'connection-outdated'
      reasonCodes.push('connection:binding-changed')
    } else if (verification.inputHashes.dependencies !== hashes.dependencies) {
      primaryState = 'verification-needed'
      reasonCodes.push('dependency:changed')
    } else if (verification.inputHashes.adapters !== hashes.adapters) {
      primaryState = 'verification-needed'
      reasonCodes.push('configuration:adapter-changed')
    } else {
      primaryState = 'verification-needed'
      reasonCodes.push('verification:provenance-mismatch')
    }
  } else {
    primaryState = 'ready'
    reasonCodes.push('verification:exact-pass')
  }

  return {
    schemaVersion: '1.0',
    moduleId: inputs.moduleId,
    moduleVersion: inputs.moduleVersion,
    hashes,
    verificationEvidenceId: verification?.verificationId,
    evaluatedAt: inputs.evaluatedAt ?? new Date().toISOString(),
    primaryState,
    reasonCodes,
  }
}

export function fingerprint(parts: Record<string, string>): string {
  return canonicalHash(parts)
}
