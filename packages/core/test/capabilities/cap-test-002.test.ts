/**
 * CAP-TEST-002 — Deterministic validators, gates, and architecture rules.
 */
import { describe, expect, it } from 'vitest'
import { evaluateArchitectureGate, evaluateProductGate } from '../../src/capabilities/gates.js'
import {
  buildCapabilityGraph,
  detectCycles,
  evaluateArchitectureRules,
} from '../../src/capabilities/graph.js'
import { validateContractRecord } from '../../src/capabilities/validation.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleManifest,
} from '../../src/capabilities/types.js'
import { sortDiagnostics } from '../../src/capabilities/diagnostics.js'

const baseApp: ApplicationSpecification = {
  schemaVersion: '1.0',
  projectId: 'proj-1',
  id: 'app-1',
  revision: '1',
  status: 'draft',
  purpose: 'demo',
  outcomes: ['o1'],
  actors: [{ id: 'a1', text: 'user' }],
  goals: [{ id: 'g1', text: 'g' }],
  useCases: [{ id: 'u1', text: 'u' }],
  scenarios: [],
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

function arch(edges: ArchitectureSpecification['dependencyEdges']): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: '1',
    status: 'draft',
    applicationSpecId: 'app-1',
    applicationSpecRevision: '1',
    applicationSpecHash: 'h',
    capabilityProjections: [],
    moduleIds: ['mod.a', 'mod.b', 'mod.c'],
    dependencyEdges: edges,
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [
      { useCaseId: 'u1', moduleIds: ['mod.a', 'mod.b', 'mod.c'] },
    ],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] },
    contentHash: 'h',
  }
}

describe('CAP-TEST-002 validators gates and architecture rules', () => {
  it('returns byte-equivalent ordered diagnostics on repeated validation', () => {
    const bad = { schemaVersion: '1.0', projectId: 'p' }
    const first = JSON.stringify(validateContractRecord('CAP-CONTRACT-001', bad))
    const second = JSON.stringify(validateContractRecord('CAP-CONTRACT-001', bad))
    expect(first).toBe(second)
    const unsorted = [
      { code: 'B', message: 'm2', fieldPath: 'b' },
      { code: 'A', message: 'm1', fieldPath: 'a' },
    ]
    expect(JSON.stringify(sortDiagnostics(unsorted))).toBe(
      JSON.stringify([
        { code: 'A', message: 'm1', fieldPath: 'a' },
        { code: 'B', message: 'm2', fieldPath: 'b' },
      ]),
    )
  })

  it('fails product gate on unresolved questions', () => {
    const result = evaluateProductGate({
      ...baseApp,
      unresolvedQuestions: [{ id: 'q1', text: 'what?' }],
    })
    expect(result.passed).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-GATE-001-UNRESOLVED')).toBe(true)
  })

  it('detects cycles with CAP-AR-006', () => {
    const architecture = arch([
      { fromModuleId: 'mod.a', toModuleId: 'mod.b', reason: 'r' },
      { fromModuleId: 'mod.b', toModuleId: 'mod.a', reason: 'r' },
    ])
    const graph = buildCapabilityGraph(architecture)
    const cycles = detectCycles(graph)
    expect(cycles.length).toBeGreaterThan(0)
    const gate = evaluateArchitectureGate(architecture)
    expect(gate.passed).toBe(false)
    expect(gate.diagnostics.some((d) => d.ruleId === 'CAP-AR-006')).toBe(true)
  })

  it('fails missing workflow trace coverage', () => {
    const architecture = arch([])
    architecture.workflowTraces = [{ useCaseId: 'u1', moduleIds: ['mod.a'] }]
    const gate = evaluateArchitectureGate(architecture)
    expect(gate.diagnostics.some((d) => d.code === 'CAP-GATE-002-ORPHAN')).toBe(true)
  })

  it('flags forbidden experience→connection dependency and absolute owned paths', () => {
    const architecture = arch([
      { fromModuleId: 'mod.a', toModuleId: 'mod.b', reason: 'ui to tool' },
    ])
    architecture.moduleIds = ['mod.a', 'mod.b']
    architecture.workflowTraces = [{ useCaseId: 'u1', moduleIds: ['mod.a', 'mod.b'] }]
    const manifests: ModuleManifest[] = [
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.a',
        moduleVersion: '1.0.0',
        moduleType: 'experience',
        name: 'UI',
        responsibility: 'ui',
        ownedConcerns: ['ui'],
        excludedConcerns: ['domain'],
        providedOperations: [],
        requiredOperations: [{ operationId: 'missing.op', acceptedContractRange: '^1', reason: 'need' }],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['/abs/path'],
      },
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.b',
        moduleVersion: '1.0.0',
        moduleType: 'connection',
        name: 'Tool',
        responsibility: 'tool',
        ownedConcerns: ['tool'],
        excludedConcerns: ['ui'],
        providedOperations: [],
        requiredOperations: [],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'external-adapter',
        events: [],
        ownedPaths: ['capabilities/modules/mod.b/'],
      },
    ]
    const rules = evaluateArchitectureRules(architecture, manifests)
    expect(rules.some((d) => d.ruleId === 'CAP-AR-001')).toBe(true)
    expect(rules.some((d) => d.ruleId === 'CAP-AR-008')).toBe(true)
    expect(rules.some((d) => d.ruleId === 'CAP-AR-005')).toBe(true)
  })
})
