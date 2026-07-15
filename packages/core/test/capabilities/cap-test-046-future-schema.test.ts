/**
 * CAP-TEST-046 — a workspace whose schema version is beyond this build is read-only,
 * while the current 2.0 version remains writable.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadFrontendBinding(): FrontendBinding {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'fixtures', 'frontend-binding-valid.json'), 'utf8'),
  )
}

function setVersion(ws: CapabilityWorkspace, projectId: string, version: string): void {
  const metaPath = path.join(ws.root(projectId), 'meta', 'schema-version.json')
  fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: version, initializedAt: new Date().toISOString() }))
}

describe('CAP-TEST-046 future-version read-only', () => {
  it('blocks writes on a future schema version but allows 1.0 and 2.0', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-046-'))
    const ws = new CapabilityWorkspace(dir)
    ws.ensureInitialized('proj-1')

    setVersion(ws, 'proj-1', '3.0')
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(true)
    expect(() => ws.saveBindingDraft('proj-1', loadFrontendBinding())).toThrow(/read-only/)

    setVersion(ws, 'proj-1', '2.0')
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(false)
    expect(() => ws.saveBindingDraft('proj-1', loadFrontendBinding())).not.toThrow()

    setVersion(ws, 'proj-1', '1.0')
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(false)
  })
})
