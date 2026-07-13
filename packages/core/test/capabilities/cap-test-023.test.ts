import { describe, expect, it } from 'vitest'
import { rebuildRegistry, resolveProvider } from '../../src/capabilities/registry.js'
import type { ModuleManifest } from '../../src/capabilities/types.js'

const manifest = (id: string, op: string, version = '1.0.0'): ModuleManifest => ({
  schemaVersion: '1.0',
  architectureVersion: '1.0',
  moduleId: id,
  moduleVersion: '1.0.0',
  moduleType: 'domain',
  name: id,
  responsibility: 'r',
  ownedConcerns: ['r'],
  excludedConcerns: ['x'],
  providedOperations: [{ operationId: op, contractVersion: version }],
  requiredOperations: [],
  verificationSuiteIds: ['s'],
  runtimeAllocation: 'local-embedded',
  events: [],
  ownedPaths: [`capabilities/modules/${id}/`],
})

describe('CAP-TEST-023 registry resolver', () => {
  it('resolves exactly one compatible ready provider and rejects ambiguous/missing cases', () => {
    const one = rebuildRegistry(
      [manifest('mod.a', 'op.calc')],
      { 'mod.a': { schemaVersion: '1.0', moduleId: 'mod.a', moduleVersion: '1.0.0', hashes: { specification: 'a', implementation: 'b', architecture: 'c', dependencies: 'd', adapters: 'e', bindings: 'f', verificationSuites: 'g' }, evaluatedAt: 't', primaryState: 'ready', reasonCodes: [] } },
      { 'mod.a': true },
    )
    expect(resolveProvider(one, { operationId: 'op.calc' }).ok).toBe(true)

    const missing = resolveProvider(one, { operationId: 'op.missing' })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.failure).toBe('missing')

    const two = rebuildRegistry(
      [manifest('mod.a', 'op.calc'), manifest('mod.b', 'op.calc')],
      {
        'mod.a': { schemaVersion: '1.0', moduleId: 'mod.a', moduleVersion: '1.0.0', hashes: { specification: 'a', implementation: 'b', architecture: 'c', dependencies: 'd', adapters: 'e', bindings: 'f', verificationSuites: 'g' }, evaluatedAt: 't', primaryState: 'ready', reasonCodes: [] },
        'mod.b': { schemaVersion: '1.0', moduleId: 'mod.b', moduleVersion: '1.0.0', hashes: { specification: 'a', implementation: 'b', architecture: 'c', dependencies: 'd', adapters: 'e', bindings: 'f', verificationSuites: 'g' }, evaluatedAt: 't', primaryState: 'ready', reasonCodes: [] },
      },
      { 'mod.a': true, 'mod.b': true },
    )
    const ambiguous = resolveProvider(two, { operationId: 'op.calc' })
    expect(ambiguous.ok).toBe(false)
    if (!ambiguous.ok) expect(ambiguous.failure).toBe('ambiguous')

    const unverified = rebuildRegistry(
      [manifest('mod.a', 'op.calc')],
      { 'mod.a': { schemaVersion: '1.0', moduleId: 'mod.a', moduleVersion: '1.0.0', hashes: { specification: 'a', implementation: 'b', architecture: 'c', dependencies: 'd', adapters: 'e', bindings: 'f', verificationSuites: 'g' }, evaluatedAt: 't', primaryState: 'draft', reasonCodes: [] } },
      { 'mod.a': true },
    )
    const u = resolveProvider(unverified, { operationId: 'op.calc' })
    expect(u.ok).toBe(false)
    if (!u.ok) expect(u.failure).toBe('unverified')
  })
})
