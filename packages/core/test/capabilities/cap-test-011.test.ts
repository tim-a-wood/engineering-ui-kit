/**
 * CAP-TEST-011 — Capability definition persistence.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { ApplicationSpecification } from '../../src/capabilities/types.js'

function tempWorkspace(): CapabilityWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-'))
  return new CapabilityWorkspace(dir)
}

const draft = (revision: string): ApplicationSpecification => ({
  schemaVersion: '1.0',
  projectId: 'proj-1',
  id: 'app-1',
  revision,
  status: 'draft',
  purpose: 'p',
  outcomes: ['o'],
  actors: [{ id: 'a', text: 'u' }],
  goals: [],
  useCases: [{ id: 'u', text: 'u' }],
  scenarios: [],
  information: [],
  rules: [],
  externalSystems: [],
  constraints: [],
  scope: { inScope: ['x'], outOfScope: [] },
  acceptanceCases: [{ id: 'ac', description: 'd', expectedOutcome: 'ok' }],
  sources: [],
  unresolvedQuestions: [],
  contentHash: 'pending',
})

describe('CAP-TEST-011 capability definition persistence', () => {
  it('initializes atomically and round-trips drafts', () => {
    const ws = tempWorkspace()
    ws.ensureInitialized('proj-1')
    ws.saveApplicationDraft('proj-1', draft('1'))
    expect(ws.getApplicationDraft('proj-1')?.revision).toBe('1')
    ws.saveApplicationDraft('proj-1', draft('1b'))
    expect(ws.getApplicationDraft('proj-1')?.revision).toBe('1b')
  })

  it('makes approved revisions immutable and ignores invalid draft replacement of approval', () => {
    const ws = tempWorkspace()
    const approved = ws.approveApplication('proj-1', draft('1'))
    expect(approved.status).toBe('approved')
    expect(ws.getApprovedApplication('proj-1')?.revision).toBe('1')
    expect(() => ws.approveApplication('proj-1', draft('1'))).toThrow(/already exists/)
    ws.saveApplicationDraft('proj-1', { ...draft('2'), purpose: '' })
    expect(ws.getApprovedApplication('proj-1')?.purpose).toBe('p')
    expect(ws.getApplicationDraft('proj-1')?.revision).toBe('2')
  })

  it('recovers after interrupted temp write left beside target', () => {
    const ws = tempWorkspace()
    ws.ensureInitialized('proj-1')
    const target = path.join(ws.root('proj-1'), 'application', 'drafts', 'current.json')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(`${target}.orphan.tmp`, '{')
    ws.saveApplicationDraft('proj-1', draft('3'))
    expect(ws.getApplicationDraft('proj-1')?.revision).toBe('3')
  })

  it('marks future schema versions read-only', () => {
    const ws = tempWorkspace()
    ws.ensureInitialized('proj-1')
    const metaPath = path.join(ws.root('proj-1'), 'meta', 'schema-version.json')
    fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: '2.0', initializedAt: new Date().toISOString() }))
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(true)
    expect(() => ws.saveApplicationDraft('proj-1', draft('9'))).toThrow(/read-only/)
  })
})
