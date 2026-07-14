/**
 * CAP-TEST-008 — Architecture proposals: only need-traced minimal acyclic pass CAP-GATE-002.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  approveArchitectureIfReady,
  buildArchitectureInterviewPacket,
  evaluateArchitectureProposal,
  importArchitectureProposal,
  type ArchitectureProposalInput,
} from '../../src/capabilities/architectureInterview.js'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
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
  outcomes: ['ship inventory'],
  actors: [{ id: 'a1', text: 'operator' }],
  goals: [{ id: 'g1', text: 'track stock' }],
  useCases: [{ id: 'u1', text: 'receive stock' }],
  scenarios: [{ id: 's1', text: 'happy path' }],
  information: [],
  rules: [],
  externalSystems: [],
  constraints: [],
  scope: { inScope: ['inventory'], outOfScope: ['payroll'] },
  acceptanceCases: [{ id: 'ac1', description: 'receive works', expectedOutcome: 'ok' }],
  sources: [],
  unresolvedQuestions: [],
  contentHash: 'app-hash',
}

function baseArch(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: '1',
    status: 'proposed',
    applicationSpecId: product.id,
    applicationSpecRevision: product.revision,
    applicationSpecHash: product.contentHash,
    capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.domain'] }],
    moduleIds: ['mod.domain'],
    dependencyEdges: [],
    operationAllocations: [{ operationId: 'op.receive', moduleId: 'mod.domain' }],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.domain'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] },
    contentHash: 'pending',
    ...overrides,
  }
}

function domainManifest(id = 'mod.domain'): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: id,
    moduleVersion: '1.0.0',
    moduleType: 'domain',
    name: 'Domain',
    responsibility: 'inventory rules',
    ownedConcerns: ['inventory-rules'],
    excludedConcerns: ['ui'],
    providedOperations: [{ operationId: 'op.receive', contractVersion: '1.0.0' }],
    requiredOperations: [],
    verificationSuiteIds: ['suite.domain'],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [`capabilities/modules/${id}/`],
  }
}

function minimalProposal(): ArchitectureProposalInput {
  return {
    architecture: baseArch(),
    manifests: [domainManifest()],
    moduleNeedTraces: [{ moduleId: 'mod.domain', needIds: ['u1'] }],
    moduleJustifications: [{ moduleId: 'mod.domain', justification: 'distinct-rules' }],
  }
}

describe('CAP-TEST-008 architecture proposal gate', () => {
  it('exports a bounded architecture interview packet', () => {
    const packet = buildArchitectureInterviewPacket({
      packetId: 'pkt-arch-1',
      projectId: 'proj-1',
      application: product,
    })
    expect(packet.interviewKind).toBe('architecture')
    expect(packet.gateId).toBe('CAP-GATE-002')
    expect(packet.outputSchemaRef).toBe('CAP-CONTRACT-002')
    expect(packet.safetyNotes.length).toBeGreaterThan(0)
  })

  it('passes only a need-traced minimal acyclic proposal', () => {
    const evaluation = evaluateArchitectureProposal(product, minimalProposal())
    expect(evaluation.passed).toBe(true)
    expect(evaluation.cycles).toEqual([])
    expect(evaluation.unsupportedModuleIds).toEqual([])
    expect(evaluation.redundantModuleIds).toEqual([])
    expect(evaluation.orphanModuleIds).toEqual([])
  })

  it('rejects unsupported modules that do not support a product need', () => {
    const proposal = minimalProposal()
    proposal.architecture = baseArch({
      moduleIds: ['mod.domain', 'mod.orphan'],
      workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.domain', 'mod.orphan'] }],
      capabilityProjections: [
        { id: 'cap1', name: 'Primary', moduleIds: ['mod.domain', 'mod.orphan'] },
      ],
    })
    proposal.manifests = [
      domainManifest(),
      { ...domainManifest('mod.orphan'), responsibility: 'unrelated payroll', ownedConcerns: ['payroll'] },
    ]
    proposal.moduleNeedTraces = [{ moduleId: 'mod.domain', needIds: ['u1'] }]
    proposal.moduleJustifications = [
      { moduleId: 'mod.domain', justification: 'distinct-rules' },
      { moduleId: 'mod.orphan', justification: 'distinct-rules' },
    ]
    const evaluation = evaluateArchitectureProposal(product, proposal)
    expect(evaluation.passed).toBe(false)
    expect(evaluation.unsupportedModuleIds).toContain('mod.orphan')
    expect(evaluation.diagnostics.some((d) => d.code === 'CAP-GATE-002-UNSUPPORTED')).toBe(true)
  })

  it('rejects redundant decomposition', () => {
    const proposal = minimalProposal()
    proposal.architecture = baseArch({
      moduleIds: ['mod.domain', 'mod.domain2'],
      workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.domain', 'mod.domain2'] }],
      capabilityProjections: [
        { id: 'cap1', name: 'Primary', moduleIds: ['mod.domain', 'mod.domain2'] },
      ],
    })
    proposal.manifests = [
      domainManifest('mod.domain'),
      {
        ...domainManifest('mod.domain2'),
        responsibility: 'inventory rules',
        ownedConcerns: ['inventory-rules'],
      },
    ]
    proposal.moduleNeedTraces = [
      { moduleId: 'mod.domain', needIds: ['u1'] },
      { moduleId: 'mod.domain2', needIds: ['u1'] },
    ]
    proposal.moduleJustifications = []
    const evaluation = evaluateArchitectureProposal(product, proposal)
    expect(evaluation.passed).toBe(false)
    expect(evaluation.redundantModuleIds.length).toBeGreaterThan(0)
    expect(evaluation.diagnostics.some((d) => d.code === 'CAP-GATE-002-REDUNDANT')).toBe(true)
  })

  it('rejects cyclic proposals via detectCycles / CAP-AR-006', () => {
    const proposal = minimalProposal()
    proposal.architecture = baseArch({
      moduleIds: ['mod.a', 'mod.b'],
      dependencyEdges: [
        { fromModuleId: 'mod.a', toModuleId: 'mod.b', reason: 'uses' },
        { fromModuleId: 'mod.b', toModuleId: 'mod.a', reason: 'uses' },
      ],
      workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.a', 'mod.b'] }],
      capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.a', 'mod.b'] }],
    })
    proposal.manifests = [
      { ...domainManifest('mod.a'), responsibility: 'a', ownedConcerns: ['a'] },
      { ...domainManifest('mod.b'), responsibility: 'b', ownedConcerns: ['b'] },
    ]
    proposal.moduleNeedTraces = [
      { moduleId: 'mod.a', needIds: ['u1'] },
      { moduleId: 'mod.b', needIds: ['u1'] },
    ]
    proposal.moduleJustifications = [
      { moduleId: 'mod.a', justification: 'distinct-rules' },
      { moduleId: 'mod.b', justification: 'independent-change' },
    ]
    const evaluation = evaluateArchitectureProposal(product, proposal)
    expect(evaluation.passed).toBe(false)
    expect(evaluation.cycles.length).toBeGreaterThan(0)
    expect(evaluation.diagnostics.some((d) => d.ruleId === 'CAP-AR-006' || d.code === 'CAP-AR-006')).toBe(
      true,
    )
  })

  it('repairs common Copilot omissions so a completed interview is approval-ready', () => {
    const incomplete = minimalProposal()
    incomplete.architecture = baseArch({
      moduleIds: ['mod.domain', 'mod.workflow'],
      dependencyEdges: [
        {
          fromModuleId: 'mod.workflow',
          toModuleId: 'mod.domain',
          reason: undefined as unknown as string,
        },
      ],
      workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.workflow'] }],
      capabilityProjections: [
        { id: 'cap1', name: 'Primary', moduleIds: ['mod.workflow', 'mod.domain'] },
      ],
    })
    incomplete.moduleNeedTraces = [
      { moduleId: 'mod.domain', needIds: ['u1'] },
      { moduleId: 'mod.workflow', needIds: ['u1'] },
    ]

    expect(() => importArchitectureProposal(product, incomplete)).not.toThrow()
    const imported = importArchitectureProposal(product, incomplete)
    expect(imported.ok).toBe(true)
    expect(imported.draft).toBeDefined()
    expect(imported.diagnostics).toEqual([])
    expect(imported.draft?.dependencyEdges[0]?.reason).toContain('Workflow uses Domain')
    expect(imported.draft?.workflowTraces[0]?.moduleIds).toEqual(['mod.workflow', 'mod.domain'])
    expect(imported.draft?.moduleDefinitions).toEqual([
      expect.objectContaining({ moduleId: 'mod.domain', moduleType: 'domain', name: 'Domain' }),
      expect.objectContaining({ moduleId: 'mod.workflow', moduleType: 'workflow', name: 'Workflow' }),
    ])
  })

  it('still reports unsafe partial manifests without throwing', () => {
    const incomplete = minimalProposal()
    incomplete.manifests = [{
      ...domainManifest(),
      responsibility: undefined as unknown as string,
      excludedConcerns: undefined as unknown as string[],
    }]
    const imported = importArchitectureProposal(product, incomplete)
    expect(imported.ok).toBe(false)
    expect(imported.draft).toBeDefined()
    expect(imported.diagnostics.map((diagnostic) => diagnostic.code)).toContain('CAP-GATE-002-RESP')
  })

  it('imports response and approves only when gate passes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-008-'))
    const ws = new CapabilityWorkspace(dir)
    ws.ensureInitialized('proj-1')

    const bad = importArchitectureProposal(product, {
      architecture: baseArch({
        moduleIds: ['mod.a', 'mod.b'],
        dependencyEdges: [
          { fromModuleId: 'mod.a', toModuleId: 'mod.b', reason: 'x' },
          { fromModuleId: 'mod.b', toModuleId: 'mod.a', reason: 'y' },
        ],
        workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.a', 'mod.b'] }],
      }),
      moduleNeedTraces: [
        { moduleId: 'mod.a', needIds: ['u1'] },
        { moduleId: 'mod.b', needIds: ['u1'] },
      ],
    })
    expect(bad.ok).toBe(false)

    const good = importArchitectureProposal(product, {
      ...minimalProposal(),
      architecture: minimalProposal().architecture,
    })
    expect(good.ok).toBe(true)
    expect(good.draft?.status).toBe('proposed')

    const approved = approveArchitectureIfReady(ws, 'proj-1', product, minimalProposal())
    expect(approved.ok).toBe(true)
    if (approved.ok) {
      expect(approved.approved.status).toBe('approved')
      expect(ws.getApprovedArchitecture('proj-1')?.revision).toBe('1')
    }
  })
})
