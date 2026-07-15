/**
 * CAP-TEST-045 — workspace schema 1.0 -> 2.0 migration is idempotent and reversible.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import {
  applyCapabilityMigration,
  rollbackCapabilityMigration,
} from '../../src/capabilities/migration.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadFrontendBinding(): FrontendBinding {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'fixtures', 'frontend-binding-valid.json'), 'utf8'),
  )
}

function schemaVersion(ws: CapabilityWorkspace, projectId: string): string {
  const metaPath = path.join(ws.root(projectId), 'meta', 'schema-version.json')
  return JSON.parse(fs.readFileSync(metaPath, 'utf8')).schemaVersion
}

describe('CAP-TEST-045 workspace 1.0 -> 2.0 migration', () => {
  it('migrates, is idempotent on re-apply, and is fully reversible', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-045-'))
    const ws = new CapabilityWorkspace(dir)
    const binding = loadFrontendBinding()
    ws.approveBinding('proj-1', binding)
    expect(schemaVersion(ws, 'proj-1')).toBe('1.0')

    const first = applyCapabilityMigration(ws, 'proj-1', { deployableId: 'web' })
    expect(first.evidence.idempotent).toBe(false)
    expect(first.evidence.toVersion).toBe('2.0')
    expect(first.backupId).toBeDefined()
    expect(schemaVersion(ws, 'proj-1')).toBe('2.0')
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(false)

    const inboundPath = path.join(
      ws.root('proj-1'),
      'bindings',
      binding.bindingId,
      'inbound',
      'approved',
      `${binding.version}.json`,
    )
    expect(fs.existsSync(inboundPath)).toBe(true)

    // Idempotent: re-applying at 2.0 is a no-op.
    const second = applyCapabilityMigration(ws, 'proj-1', { deployableId: 'web' })
    expect(second.evidence.idempotent).toBe(true)
    expect(schemaVersion(ws, 'proj-1')).toBe('2.0')

    // Reversible: rollback restores 1.0, the original binding, and drops the inbound artifact.
    rollbackCapabilityMigration(ws, 'proj-1', first.backupId!)
    expect(schemaVersion(ws, 'proj-1')).toBe('1.0')
    expect(fs.existsSync(inboundPath)).toBe(false)
    expect(ws.getApprovedBinding('proj-1', binding.bindingId)).toEqual(binding)
  })
})
