/**
 * CAP-TEST-009 — Trace/graph projection from architecture + manifests; no direct graph edit.
 */
import { describe, expect, it } from 'vitest'
import {
  evaluateArchitectureProposal,
  findOrphanModules,
  projectDerivedGraph,
} from '../../src/capabilities/architectureInterview.js'
import { detectCycles } from '../../src/capabilities/graph.js'
import { evaluateArchitectureGate } from '../../src/capabilities/gates.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleManifest,
} from '../../src/capabilities/types.js'

const product: ApplicationSpecification = {
  schemaVersion: '1.0',
  projectId: 'proj-1',
  id: 'app-1',
  revision: '1',
  status: 'approved',
  purpose: 'demo',
  outcomes: ['o'],
  actors: [{ id: 'a1', text: 'user' }],
  goals: [],
  useCases: [{ id: 'u1', text: 'main' }, { id: 'u2', text: 'alt' }],
  scenarios: [{ id: 's1', text: 'scenario' }],
  information: [],
  rules: [],
  externalSystems: [],
  constraints: [],
  scope: { inScope: ['x'], outOfScope: [] },
  acceptanceCases: [{ id: 'ac1', description: 'd', expectedOutcome: 'ok' }],
  sources: [],
  unresolvedQuestions: [],
  contentHash: 'h',
}

function architecture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: '1',
    status: 'proposed',
    applicationSpecId: 'app-1',
    applicationSpecRevision: '1',
    applicationSpecHash: 'h',
    capabilityProjections: [
      { id: 'cap1', name: 'Primary', moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience'] },
    ],
    moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience'],
    dependencyEdges: [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'invokes domain' },
      { fromModuleId: 'mod.experience', toModuleId: 'mod.workflow', reason: 'starts workflow' },
    ],
    operationAllocations: [
      { operationId: 'op.calc', moduleId: 'mod.domain' },
      { operationId: 'op.run', moduleId: 'mod.workflow' },
    ],
    adapterAllocations: [],
    workflowTraces: [
      { useCaseId: 'u1', moduleIds: ['mod.experience', 'mod.workflow', 'mod.domain'] },
      { useCaseId: 'u2', moduleIds: ['mod.workflow', 'mod.domain'] },
    ],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] },
    contentHash: 'arch',
  }
}

function manifests(): ModuleManifest[] {
  return [
    {
      schemaVersion: '1.0',
      architectureVersion: '1.0',
      moduleId: 'mod.domain',
      moduleVersion: '1.0.0',
      moduleType: 'domain',
      name: 'Domain',
      responsibility: 'rules',
      ownedConcerns: ['rules'],
      excludedConcerns: ['ui'],
      providedOperations: [{ operationId: 'op.calc', contractVersion: '1.0.0' }],
      requiredOperations: [],
      verificationSuiteIds: ['s'],
      runtimeAllocation: 'local-embedded',
      events: [],
      ownedPaths: ['capabilities/modules/mod.domain/'],
    },
    {
      schemaVersion: '1.0',
      architectureVersion: '1.0',
      moduleId: 'mod.workflow',
      moduleVersion: '1.0.0',
      moduleType: 'workflow',
      name: 'Workflow',
      responsibility: 'coordination',
      ownedConcerns: ['flow'],
      excludedConcerns: ['ui'],
      providedOperations: [{ operationId: 'op.run', contractVersion: '1.0.0' }],
      requiredOperations: [
        { operationId: 'op.calc', acceptedContractRange: '^1', reason: 'needs calc' },
      ],
      verificationSuiteIds: ['s'],
      runtimeAllocation: 'local-embedded',
      events: [],
      ownedPaths: ['capabilities/modules/mod.workflow/'],
    },
    {
      schemaVersion: '1.0',
      architectureVersion: '1.0',
      moduleId: 'mod.experience',
      moduleVersion: '1.0.0',
      moduleType: 'experience',
      name: 'UI',
      responsibility: 'presentation',
      ownedConcerns: ['ui'],
      excludedConcerns: ['domain'],
      providedOperations: [],
      requiredOperations: [
        { operationId: 'op.run', acceptedContractRange: '^1', reason: 'starts run' },
      ],
      verificationSuiteIds: ['s'],
      runtimeAllocation: 'local-embedded',
      events: [],
      ownedPaths: ['capabilities/modules/mod.experience/'],
    },
  ]
}

describe('CAP-TEST-009 trace and derived graph projection', () => {
  it('fails orphans that lack workflow trace coverage', () => {
    const arch = architecture()
    arch.workflowTraces = [{ useCaseId: 'u1', moduleIds: ['mod.domain'] }]
    expect(findOrphanModules(arch)).toEqual(['mod.experience', 'mod.workflow'])
    const gate = evaluateArchitectureGate(arch, manifests())
    expect(gate.passed).toBe(false)
    expect(gate.diagnostics.some((d) => d.code === 'CAP-GATE-002-ORPHAN')).toBe(true)
  })

  it('projects a derived graph from architecture + manifests (not a stored graph record)', () => {
    const arch = architecture()
    const initial = projectDerivedGraph(arch, manifests())
    expect(initial.nodes.map((n) => n.id).sort()).toEqual([
      'mod.domain',
      'mod.experience',
      'mod.workflow',
    ])
    expect(initial.nodes.find((n) => n.id === 'mod.experience')?.moduleType).toBe('experience')
    expect(initial.edges).toEqual([
      { from: 'mod.experience', to: 'mod.workflow', reason: 'starts workflow' },
      { from: 'mod.workflow', to: 'mod.domain', reason: 'invokes domain' },
    ])
    expect(detectCycles(initial)).toEqual([])

    // Alter a manifest "edge" (required operation) and module type metadata — graph rebuilds from inputs.
    const altered = manifests()
    const workflow = altered.find((m) => m.moduleId === 'mod.workflow')!
    workflow.moduleType = 'platform'
    workflow.requiredOperations = [
      { operationId: 'op.calc', acceptedContractRange: '^1', reason: 'needs calc' },
      { operationId: 'op.extra', acceptedContractRange: '^1', reason: 'new dep' },
    ]

    const next = projectDerivedGraph(arch, altered)
    expect(next.nodes.find((n) => n.id === 'mod.workflow')?.moduleType).toBe('platform')
    // Edges remain derived from architecture dependencyEdges — no direct graph mutation API.
    expect(next.edges).toEqual(initial.edges)
    expect(next).not.toBe(initial)
  })

  it('updates derived dependency edges only when architecture edges change', () => {
    const arch = architecture()
    const before = projectDerivedGraph(arch, manifests())
    arch.dependencyEdges = [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'invokes domain' },
    ]
    const after = projectDerivedGraph(arch, manifests())
    expect(after.edges).not.toEqual(before.edges)
    expect(after.edges).toEqual([
      { from: 'mod.workflow', to: 'mod.domain', reason: 'invokes domain' },
    ])
  })

  it('evaluates full proposal with traces, operations, and dependencies', () => {
    const evaluation = evaluateArchitectureProposal(product, {
      architecture: architecture(),
      manifests: manifests(),
      moduleNeedTraces: [
        { moduleId: 'mod.domain', needIds: ['u1'] },
        { moduleId: 'mod.workflow', needIds: ['u1', 'u2'] },
        { moduleId: 'mod.experience', needIds: ['u1'] },
      ],
      moduleJustifications: [
        { moduleId: 'mod.domain', justification: 'distinct-rules' },
        { moduleId: 'mod.workflow', justification: 'independent-change' },
        { moduleId: 'mod.experience', justification: 'external-boundary' },
      ],
    })
    expect(evaluation.orphanModuleIds).toEqual([])
    expect(evaluation.cycles).toEqual([])
    expect(evaluation.passed).toBe(true)
  })
})
