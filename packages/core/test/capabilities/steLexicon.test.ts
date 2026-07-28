import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { ApplicationSpecification } from '../../src/capabilities/types.js'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function application(): ApplicationSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project-1',
    id: 'application-1',
    revision: '1',
    status: 'draft',
    purpose: 'Use forbiddenword.',
    outcomes: [],
    actors: [],
    goals: [],
    useCases: [],
    scenarios: [],
    information: [],
    rules: [],
    externalSystems: [],
    constraints: [],
    scope: { inScope: [], outOfScope: [] },
    acceptanceCases: [],
    sources: [],
    unresolvedQuestions: [],
    contentHash: 'pending',
  }
}

describe('project STE vocabulary persistence', () => {
  it('blocks unknown words during approval and accepts approved technical terms', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-ste-lexicon-'))
    directories.push(directory)
    const workspace = new CapabilityWorkspace(directory)

    const initial = workspace.saveSteLexicon(
      'project-1',
      { generalWords: ['use'] },
      'Licensed checker export 2026-07',
      '2026-07-28T00:00:00.000Z',
    )

    expect(workspace.getSteLexicon('project-1')).toEqual(initial)
    expect(() => workspace.approveApplication('project-1', application())).toThrow(
      /STE-LEXICON-UNKNOWN/,
    )

    workspace.saveSteLexicon(
      'project-1',
      {
        generalWords: ['use'],
        technicalTerms: ['forbiddenword'],
      },
      'Licensed checker export 2026-07',
      '2026-07-28T00:00:00.000Z',
    )

    expect(() => workspace.approveApplication('project-1', application())).not.toThrow()
  })

  it('rejects an empty or unversioned vocabulary record', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-ste-lexicon-'))
    directories.push(directory)
    const workspace = new CapabilityWorkspace(directory)

    expect(() => workspace.saveSteLexicon(
      'project-1',
      { generalWords: [] },
      'Checker export',
    )).toThrow(/generalWords/)
  })
})
