/**
 * CAP-TEST-072 — `proposeFoundation` surfaces exactly the genuinely
 * ambiguous choices, resolves them from supplied `answers`, is idempotent on
 * re-run with the same answers, and round-trips draft persistence (WP5A-core).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import { proposeFoundation } from '../../src/capabilities/foundation.js'
import type { RepositoryDiscoveryResult } from '../../src/capabilities/generation/repositoryDiscovery.js'
import type { ArchitectureSpecification } from '../../src/capabilities/types.js'

function tmpWorkspace(): CapabilityWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-072-'))
  return new CapabilityWorkspace(dir)
}

function architecture(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: '1',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: '1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.domain'] }],
    moduleIds: ['mod.domain'],
    moduleDefinitions: [
      { moduleId: 'mod.domain', name: 'Domain', moduleType: 'domain', responsibility: 'inventory rules' },
    ],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.domain'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash-1',
    ...overrides,
  }
}

function emptyDiscovery(overrides: Partial<RepositoryDiscoveryResult> = {}): RepositoryDiscoveryResult {
  return {
    packageManager: 'unknown',
    languages: [],
    sourceRoots: [],
    testRoots: [],
    entryPoints: [],
    frameworks: [],
    existingCompositionPaths: [],
    ciOperatingSystems: [],
    ambiguities: [],
    ...overrides,
  }
}

describe('CAP-TEST-072 foundation ambiguity resolution', () => {
  const ambiguousDiscovery = emptyDiscovery({
    frameworks: ['express', 'fastapi'],
    languages: ['typescript', 'python'],
  })

  it('surfaces exactly one unresolved http-api-language ambiguity and readiness ambiguous', () => {
    const plan = proposeFoundation({ architecture: architecture(), discovery: ambiguousDiscovery })

    expect(plan.unresolvedAmbiguities).toHaveLength(1)
    expect(plan.unresolvedAmbiguities[0]?.id).toBe('http-api-language')
    expect(plan.readiness.status).toBe('ambiguous')
    expect(plan.readiness.issues.some((issue) => issue.id === 'http-api-language')).toBe(true)
  })

  it('resolves the ambiguity from a supplied answer, yielding the corresponding deployable', () => {
    const plan = proposeFoundation({
      architecture: architecture(),
      discovery: ambiguousDiscovery,
      answers: [{ id: 'http-api-language', choice: 'fastapi' }],
    })

    expect(plan.unresolvedAmbiguities).toEqual([])
    expect(plan.resolvedAnswers).toEqual([{ id: 'http-api-language', choice: 'fastapi' }])
    expect(plan.readiness.status).toBe('ready')
    const httpApi = plan.deployables.find((d) => d.deployableId === 'http-api')
    expect(httpApi).toBeDefined()
    expect(httpApi?.runtimeLanguage).toBe('python')
  })

  it('is idempotent on re-run with the same answers (asks once)', () => {
    const answers = [{ id: 'http-api-language', choice: 'express' }]
    const first = proposeFoundation({ architecture: architecture(), discovery: ambiguousDiscovery, answers })
    const second = proposeFoundation({ architecture: architecture(), discovery: ambiguousDiscovery, answers })

    expect(first.unresolvedAmbiguities).toEqual([])
    expect(second.unresolvedAmbiguities).toEqual([])
    expect(second.resolvedAnswers).toEqual(first.resolvedAnswers)
    expect(second.deployables.find((d) => d.deployableId === 'http-api')?.runtimeLanguage).toBe('typescript')
  })

  it('leaves an unanswered ambiguity surfaced while resolving the answered one', () => {
    const discoveryWithTwoAmbiguities = emptyDiscovery({ frameworks: [], languages: ['typescript', 'python'] })
    const archWithExperience = architecture({
      moduleIds: ['mod.experience'],
      moduleDefinitions: [
        { moduleId: 'mod.experience', name: 'Experience', moduleType: 'experience', responsibility: 'ui' },
      ],
      capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.experience'] }],
      workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.experience'] }],
    })
    const unanswered = proposeFoundation({ architecture: archWithExperience, discovery: discoveryWithTwoAmbiguities })
    expect(unanswered.unresolvedAmbiguities.map((a) => a.id).sort()).toEqual([
      'deployable-language',
      'ui-deployable-missing',
    ])

    const partiallyAnswered = proposeFoundation({
      architecture: archWithExperience,
      discovery: discoveryWithTwoAmbiguities,
      answers: [{ id: 'deployable-language', choice: 'python' }],
    })
    expect(partiallyAnswered.unresolvedAmbiguities.map((a) => a.id)).toEqual(['ui-deployable-missing'])
    expect(partiallyAnswered.readiness.status).toBe('ambiguous')
  })

  it('round-trips resolvedAnswers via saveFoundationDraft -> getFoundationDraft', () => {
    const ws = tmpWorkspace()
    const plan = proposeFoundation({
      architecture: architecture(),
      discovery: ambiguousDiscovery,
      answers: [{ id: 'http-api-language', choice: 'fastapi' }],
    })
    ws.saveFoundationDraft('proj-1', plan)
    const loaded = ws.getFoundationDraft('proj-1')
    expect(loaded?.resolvedAnswers).toEqual(plan.resolvedAnswers)
    expect(loaded).toEqual(plan)
  })
})
