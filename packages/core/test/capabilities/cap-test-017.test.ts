import { describe, expect, it } from 'vitest'
import { calculateFreshness } from '../../src/capabilities/freshness.js'
import type { VerificationRecord } from '../../src/capabilities/types.js'

const baseHashes = {
  specificationHash: 'spec',
  implementationHash: 'impl',
  architectureHash: 'arch',
  dependencyHash: 'dep',
  adapterHash: 'adap',
  bindingHash: 'bind',
  verificationSuiteHash: 'suite',
}

function passing(): VerificationRecord {
  return {
    schemaVersion: '1.0',
    verificationId: 'ver-1',
    projectId: 'p',
    moduleId: 'mod.a',
    suiteIds: ['s'],
    suiteVersions: ['1'],
    suiteHashes: ['suite'],
    inputHashes: {
      specification: 'spec',
      implementation: 'impl',
      architecture: 'arch',
      dependencies: 'dep',
      adapters: 'adap',
      bindings: 'bind',
      verificationSuites: 'suite',
    },
    commandResults: [{ label: 'test', exitCode: 0, passed: true }],
    artifacts: [],
    diagnostics: [],
    startedAt: '2026-07-12T00:00:00.000Z',
    completedAt: '2026-07-12T00:00:01.000Z',
    outcome: 'passed',
  }
}

describe('CAP-TEST-017 freshness calculation', () => {
  it('reports ready only with exact successful verification provenance', () => {
    const ready = calculateFreshness({
      moduleId: 'mod.a',
      moduleVersion: '1.0.0',
      ...baseHashes,
      verification: passing(),
    })
    expect(ready.primaryState).toBe('ready')
  })

  it('marks owned-file hash change as verification-needed (CAP-DEC-007)', () => {
    const record = calculateFreshness({
      moduleId: 'mod.a',
      moduleVersion: '1.0.0',
      ...baseHashes,
      implementationHash: 'impl-new',
      ownedFileHash: 'impl-new',
      previousImplementationHash: 'impl',
      verification: passing(),
    })
    expect(record.primaryState).toBe('verification-needed')
    expect(record.reasonCodes.some((c) => c.includes('implementation'))).toBe(true)
  })

  it('does not report ready when verification is missing', () => {
    const record = calculateFreshness({
      moduleId: 'mod.a',
      moduleVersion: '1.0.0',
      ...baseHashes,
      verification: null,
    })
    expect(record.primaryState).not.toBe('ready')
  })
})
