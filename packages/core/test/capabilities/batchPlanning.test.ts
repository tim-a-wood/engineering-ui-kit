import { describe, expect, it } from 'vitest'
import {
  planImplementationWaves,
  proposeArchitectureModuleBatch,
} from '../../src/capabilities/batchPlanning.js'
import type {
  ArchitectureSpecification,
  CapabilityModuleRecord,
  ModuleManifest,
} from '../../src/capabilities/types.js'

function architecture(
  overrides: Partial<ArchitectureSpecification> = {},
): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project-1',
    id: 'architecture-1',
    revision: '7',
    status: 'approved',
    applicationSpecId: 'application-1',
    applicationSpecRevision: '4',
    applicationSpecHash: 'application-hash',
    capabilityProjections: [],
    moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience', 'mod.connection'],
    moduleDefinitions: [
      { moduleId: 'mod.domain', name: 'Domain', moduleType: 'domain', responsibility: 'Own audit rules.' },
      { moduleId: 'mod.workflow', name: 'Workflow', moduleType: 'workflow', responsibility: 'Coordinate audit work.' },
      { moduleId: 'mod.experience', name: 'Experience', moduleType: 'experience', responsibility: 'Present audit work.' },
      { moduleId: 'mod.connection', name: 'MATLAB port', moduleType: 'connection', responsibility: 'Connect to MATLAB.' },
    ],
    dependencyEdges: [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'Uses audit rules.' },
      { fromModuleId: 'mod.experience', toModuleId: 'mod.workflow', reason: 'Starts workflows.' },
    ],
    operationAllocations: [
      { operationId: 'audit.evaluate', moduleId: 'mod.domain' },
      { operationId: 'audit.run', moduleId: 'mod.workflow' },
      { operationId: 'audit.render', moduleId: 'mod.experience' },
    ],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'architecture-hash',
    ...overrides,
  }
}

function approved(manifest: ModuleManifest): CapabilityModuleRecord {
  return { moduleId: manifest.moduleId, approved: manifest }
}

describe('architecture-wide module planning', () => {
  it('proposes every allocated module in one deterministic review batch', () => {
    const result = proposeArchitectureModuleBatch({
      projectId: 'project-1',
      architecture: architecture(),
      generatedAt: '2026-07-23T00:00:00.000Z',
    })

    expect(result.proposals.map((proposal) => proposal.moduleId)).toEqual([
      'mod.domain',
      'mod.workflow',
      'mod.experience',
      'mod.connection',
    ])
    expect(result.commonAssumptions).toHaveLength(4)
    expect(result.proposals.every((proposal) => proposal.manifest.ownedPaths.length === 1)).toBe(true)
    expect(result.proposals.find((proposal) => proposal.moduleId === 'mod.workflow')?.manifest.requiredOperations)
      .toContainEqual({
        operationId: 'audit.evaluate',
        acceptedContractRange: '^1.0',
        reason: 'Uses audit rules.',
      })
  })

  it('surfaces architecture gaps as exceptions and keeps existing records unchanged', () => {
    const existing = proposeArchitectureModuleBatch({
      projectId: 'project-1',
      architecture: architecture(),
      generatedAt: '2026-07-23T00:00:00.000Z',
    }).proposals[0].manifest
    existing.name = 'Human-edited domain'
    const result = proposeArchitectureModuleBatch({
      projectId: 'project-1',
      architecture: architecture(),
      existing: [approved(existing)],
      generatedAt: '2026-07-23T00:00:00.000Z',
    })

    expect(result.proposals[0].manifest.name).toBe('Human-edited domain')
    expect(result.proposals[0].exceptionReasons).toEqual([])
    const connection = result.proposals.find((proposal) => proposal.moduleId === 'mod.connection')!
    expect(connection.exceptionReasons).toEqual([
      'Architecture allocates no explicit provided operation; a reviewable placeholder was proposed.',
      'Connection module has no actor-specific adapter allocation.',
    ])
  })

  it('orders approved targets into dependency-first implementation waves', () => {
    const batch = proposeArchitectureModuleBatch({
      projectId: 'project-1',
      architecture: architecture(),
    })
    const result = planImplementationWaves({
      projectId: 'project-1',
      architecture: architecture(),
      modules: batch.proposals.map((proposal) => approved(proposal.manifest)),
    })

    expect(result.waves.map((wave) => wave.targets.map((target) => target.moduleId))).toEqual([
      ['mod.connection', 'mod.domain'],
      ['mod.workflow'],
      ['mod.experience'],
    ])
    expect(result.blockedCycles).toEqual([])
    expect(result.unapprovedModuleIds).toEqual([])
    expect(result.blockedByUnapproved).toEqual([])
  })

  it('excludes unapproved targets and reports dependency cycles', () => {
    const cyclicArchitecture = architecture({
      moduleIds: ['mod.domain', 'mod.workflow'],
      moduleDefinitions: architecture().moduleDefinitions?.slice(0, 2),
      dependencyEdges: [
        { fromModuleId: 'mod.domain', toModuleId: 'mod.workflow', reason: 'A' },
        { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'B' },
      ],
    })
    const batch = proposeArchitectureModuleBatch({
      projectId: 'project-1',
      architecture: cyclicArchitecture,
    })
    const result = planImplementationWaves({
      projectId: 'project-1',
      architecture: cyclicArchitecture,
      modules: [approved(batch.proposals[0].manifest), approved(batch.proposals[1].manifest)],
    })

    expect(result.waves).toEqual([])
    expect(result.blockedCycles[0]).toEqual(['mod.domain', 'mod.workflow', 'mod.domain'])

    const partial = planImplementationWaves({
      projectId: 'project-1',
      architecture: architecture(),
      modules: [approved(batch.proposals[0].manifest)],
    })
    expect(partial.unapprovedModuleIds).toEqual(['mod.workflow', 'mod.experience', 'mod.connection'])
    expect(partial.waves.map((wave) => wave.targets.map((target) => target.moduleId))).toEqual([
      ['mod.domain'],
    ])
    expect(partial.blockedByUnapproved).toEqual([])
  })

  it('does not schedule approved consumers whose dependencies are unapproved', () => {
    const batch = proposeArchitectureModuleBatch({
      projectId: 'project-1',
      architecture: architecture(),
    })
    const domain = batch.proposals.find((proposal) => proposal.moduleId === 'mod.domain')!
    const experience = batch.proposals.find((proposal) => proposal.moduleId === 'mod.experience')!
    const result = planImplementationWaves({
      projectId: 'project-1',
      architecture: architecture(),
      modules: [approved(domain.manifest), approved(experience.manifest)],
    })

    expect(result.waves.map((wave) => wave.targets.map((target) => target.moduleId))).toEqual([
      ['mod.domain'],
    ])
    expect(result.blockedByUnapproved).toEqual([
      { moduleId: 'mod.experience', dependencyIds: ['mod.workflow'] },
    ])
  })
})
