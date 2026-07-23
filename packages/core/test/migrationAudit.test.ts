import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditWorkspaceMigrations } from '../src/migrationAudit.js'
import { Workspace } from '../src/persistence.js'
import { CapabilityWorkspace } from '../src/capabilities/persistence.js'

describe('read-only migration audit', () => {
  it('classifies uninitialized, migration-ready, and future-version projects without writes', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-migration-audit-'))
    const workspace = new Workspace(dataDir)
    const caps = new CapabilityWorkspace(dataDir)
    for (const id of ['plain', 'legacy', 'future']) {
      workspace.createProject({ id, name: id, repoPath: `/repo/${id}`, status: 'active' })
    }
    caps.ensureInitialized('legacy')
    caps.ensureInitialized('future')
    const futureMeta = path.join(caps.root('future'), 'meta', 'schema-version.json')
    fs.writeFileSync(futureMeta, JSON.stringify({
      schemaVersion: '99.0',
      initializedAt: '2026-07-23T00:00:00.000Z',
    }))

    const before = fs.readdirSync(path.join(dataDir, 'projects', 'legacy', 'capabilities', 'meta')).sort()
    const audit = auditWorkspaceMigrations(dataDir, '2026-07-23T00:00:00.000Z')
    const after = fs.readdirSync(path.join(dataDir, 'projects', 'legacy', 'capabilities', 'meta')).sort()

    expect(audit.projects.map((project) => [project.projectId, project.status])).toEqual([
      ['future', 'read-only'],
      ['legacy', 'migration-available'],
      ['plain', 'not-initialized'],
    ])
    expect(audit.summary).toEqual({
      'not-initialized': 1,
      current: 0,
      'migration-available': 1,
      'read-only': 1,
      attention: 0,
    })
    expect(after).toEqual(before)
  })
})
