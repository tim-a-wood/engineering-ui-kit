import { describe, expect, it } from 'vitest'
import { buildNeedsAttention } from '../../src/capabilities/attention.js'
import type { FreshnessRecord } from '../../src/capabilities/types.js'

describe('CAP-TEST-020 needs attention ordering', () => {
  it('orders by impact dependency and exposes next action', () => {
    const freshness: FreshnessRecord[] = [
      {
        schemaVersion: '1.0',
        moduleId: 'mod.ui',
        moduleVersion: '1',
        hashes: {
          specification: 'a',
          implementation: 'b',
          architecture: 'c',
          dependencies: 'd',
          adapters: 'e',
          bindings: 'f',
          verificationSuites: 'g',
        },
        evaluatedAt: 't',
        primaryState: 'connection-outdated',
        reasonCodes: ['connection:binding-changed'],
      },
      {
        schemaVersion: '1.0',
        moduleId: 'mod.domain',
        moduleVersion: '1',
        hashes: {
          specification: 'a',
          implementation: 'b',
          architecture: 'c',
          dependencies: 'd',
          adapters: 'e',
          bindings: 'f',
          verificationSuites: 'g',
        },
        evaluatedAt: 't',
        primaryState: 'verification-needed',
        reasonCodes: ['implementation:changed'],
      },
      {
        schemaVersion: '1.0',
        moduleId: 'mod.ok',
        moduleVersion: '1',
        hashes: {
          specification: 'a',
          implementation: 'b',
          architecture: 'c',
          dependencies: 'd',
          adapters: 'e',
          bindings: 'f',
          verificationSuites: 'g',
        },
        evaluatedAt: 't',
        primaryState: 'ready',
        reasonCodes: [],
      },
    ]
    const items = buildNeedsAttention(freshness, {
      schemaVersion: '1.0',
      changeId: 'c',
      initiatingRecordId: 'mod.domain',
      initiatingRevision: '2',
      classification: 'required-additive',
      affectedModules: [],
      unaffectedModules: [],
      proposedPacketOrder: ['mod.domain', 'mod.ui'],
      recalculationEvidence: [],
    })
    expect(items.map((i) => i.moduleId)).toEqual(['mod.domain', 'mod.ui'])
    expect(items[0]?.nextAction).toMatch(/verification/i)
  })
})
