/**
 * CAP-TEST-010 — Type-specific module interviews for all five module types + CAP-GATE-003.
 */
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applicableDetailsFor,
  approveModuleIfReady,
  buildModuleInterviewPacket,
  evaluateModuleInterview,
  importModuleInterviewResponse,
  moduleInterviewOpeningGuidance,
  MODULE_APPLICABLE_DETAILS,
  type ModuleInterviewAnswer,
  type ModuleInterviewResponse,
} from '../../src/capabilities/moduleInterview.js'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { ArchitectureSpecification, ModuleType } from '../../src/capabilities/types.js'

const architecture: ArchitectureSpecification = {
  schemaVersion: '1.0',
  projectId: 'proj-1',
  id: 'arch-1',
  revision: '1',
  status: 'approved',
  applicationSpecId: 'app-1',
  applicationSpecRevision: '1',
  applicationSpecHash: 'h',
  capabilityProjections: [],
  moduleIds: ['mod.domain', 'mod.workflow', 'mod.connection', 'mod.platform', 'mod.experience'],
  dependencyEdges: [],
  operationAllocations: [],
  adapterAllocations: [],
  workflowTraces: [],
  proposals: [],
  unresolvedQuestions: [],
  gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
  contentHash: 'arch-hash',
}

function confirmedAnswers(moduleType: ModuleType): ModuleInterviewAnswer[] {
  return applicableDetailsFor(moduleType).map((id) => ({
    id,
    text: `confirmed ${id}`,
    status: 'confirmed' as const,
  }))
}

function completeResponse(moduleType: ModuleType): ModuleInterviewResponse {
  const moduleId = `mod.${moduleType}`
  return {
    moduleId,
    moduleType,
    name: `${moduleType} module`,
    moduleVersion: '1.0.0',
    responsibility: `${moduleType} responsibility`,
    ownedConcerns: [`${moduleType}-concern`],
    excludedConcerns: ['out-of-scope'],
    providedOperations: [{ operationId: `op.${moduleType}`, contractVersion: '1.0.0' }],
    requiredOperations: [],
    verificationSuiteIds: [`suite.${moduleType}`],
    runtimeAllocation: moduleType === 'connection' ? 'external-adapter' : 'local-embedded',
    events: [],
    ownedPaths: [`capabilities/modules/${moduleId}/`],
    operationContracts: [{
      schemaVersion: '1.0', operationId: `op.${moduleType}`, version: '1.0.0', behavior: 'command',
      inputSchemaRef: `${moduleId}.input`, outputSchemaRef: `${moduleId}.output`,
      preconditions: [], postconditions: ['The requested behavior is complete.'], domainRejections: [],
      technicalErrors: [], sideEffects: [], idempotency: 'unknown', timeoutClass: 'short', cancellable: false,
      artifactTypes: [], provenanceFields: [],
    }],
    dataSchemas: [
      { schemaId: `${moduleId}.input`, description: 'Operation input.', fields: [] },
      { schemaId: `${moduleId}.output`, description: 'Operation output.', fields: [] },
    ],
    answers: confirmedAnswers(moduleType),
    acceptanceCases: [
      { id: 'ac1', description: 'works', expectedOutcome: 'success' },
    ],
    rules: [{ id: 'r1', text: 'rule' }],
  }
}

describe('CAP-TEST-010 module interviews and CAP-GATE-003', () => {
  it('exposes one interview depth with applicable details for all five module types', () => {
    const types: ModuleType[] = ['domain', 'workflow', 'connection', 'platform', 'experience']
    expect(Object.keys(MODULE_APPLICABLE_DETAILS).sort()).toEqual([...types].sort())
    for (const type of types) {
      expect(applicableDetailsFor(type).length).toBeGreaterThan(0)
      const packet = buildModuleInterviewPacket({
        packetId: `pkt-${type}`,
        projectId: 'proj-1',
        architecture,
        moduleId: `mod.${type}`,
        moduleType: type,
      })
      expect(packet.interviewKind).toBe('module')
      expect(packet.gateId).toBe('CAP-GATE-003')
      expect(packet.interviewBoundary).toBe(`module:${type}`)
      expect(packet.outputSchemaRef).toBe('CAP-CONTRACT-003')
      expect(moduleInterviewOpeningGuidance(packet)).toMatch(/suggest/i)
    }
  })

  it('requires applicable details and blocks unresolved domain questions', () => {
    const incomplete: ModuleInterviewResponse = {
      ...completeResponse('domain'),
      answers: [
        { id: 'responsibility', text: 'ok', status: 'confirmed' },
        { id: 'vocabulary', text: 'what units?', status: 'unresolved' },
      ],
    }
    const evaluation = evaluateModuleInterview(incomplete)
    expect(evaluation.passed).toBe(false)
    expect(evaluation.unresolvedDomainQuestionIds).toContain('vocabulary')
    expect(evaluation.missingApplicableDetailIds.length).toBeGreaterThan(0)
    expect(evaluation.diagnostics.some((d) => d.code === 'CAP-GATE-003-UNRESOLVED')).toBe(true)
    expect(evaluation.diagnostics.some((d) => d.code === 'CAP-GATE-003-APPLICABLE')).toBe(true)
  })

  it('requires implementation-ready contracts and concrete payload schemas for provided operations', () => {
    const withoutContract = importModuleInterviewResponse({
      ...completeResponse('domain'),
      operationContracts: [],
      dataSchemas: [],
    })
    expect(withoutContract.ok).toBe(false)
    expect(withoutContract.diagnostics.some((item) => item.code === 'CAP-GATE-003-CONTRACT')).toBe(true)

    const unresolvedSchema = completeResponse('domain')
    unresolvedSchema.dataSchemas = []
    const withoutSchema = importModuleInterviewResponse(unresolvedSchema)
    expect(withoutSchema.ok).toBe(false)
    expect(withoutSchema.diagnostics.some((item) => item.code === 'CAP-GATE-003-SCHEMA')).toBe(true)
  })

  it('grounds the opening questions in architecture context and offers type-specific suggestions', () => {
    const contextualArchitecture: ArchitectureSpecification = {
      ...architecture,
      capabilityProjections: [{ id: 'cap.work', name: 'Work management', moduleIds: ['mod.workflow', 'mod.domain'] }],
      moduleDefinitions: [
        { moduleId: 'mod.workflow', name: 'Work Order Workflow', moduleType: 'workflow', responsibility: 'Coordinates work-order completion.' },
        { moduleId: 'mod.domain', name: 'Work Order Domain', moduleType: 'domain', responsibility: 'Owns work-order lifecycle rules.' },
      ],
      dependencyEdges: [{
        fromModuleId: 'mod.workflow', toModuleId: 'mod.domain',
        reason: 'The workflow delegates lifecycle decisions to the domain.',
      }],
      workflowTraces: [{ useCaseId: 'usecase.complete-work', moduleIds: ['mod.workflow', 'mod.domain'] }],
    }
    const packet = buildModuleInterviewPacket({
      packetId: 'pkt-contextual-domain', projectId: 'proj-1', architecture: contextualArchitecture,
      moduleId: 'mod.domain', moduleType: 'domain',
    })

    expect(packet.inputContext.facts).toContain('moduleName:Work Order Domain')
    expect(packet.inputContext.facts).toContain('moduleResponsibility:Owns work-order lifecycle rules.')
    expect(packet.inputContext.facts).toContain('capabilityGroup:Work management')
    expect(packet.inputContext.facts).toContain('workflowTrace:usecase.complete-work')
    expect(packet.inputContext.facts.some((fact) => fact.startsWith('usedByModule:mod.workflow | Work Order Workflow'))).toBe(true)

    const guidance = moduleInterviewOpeningGuidance(packet)
    expect(guidance).toContain('Work Order Domain (domain; architecture role: domain core)')
    expect(guidance).toContain('Do not begin by asking the user to restate them')
    expect(guidance).toContain('Include a plausible suggestion or default')
    expect(guidance).toContain('Suggest likely domain vocabulary and invariants')
  })

  it('passes CAP-GATE-003 and produces valid manifests for each module type', () => {
    const types: ModuleType[] = ['domain', 'workflow', 'connection', 'platform', 'experience']
    const dir = mkdtempSync(path.join(os.tmpdir(), 'euik-cap-010-'))
    const ws = new CapabilityWorkspace(dir)
    ws.ensureInitialized('proj-1')

    for (const type of types) {
      const response = completeResponse(type)
      const imported = importModuleInterviewResponse(response)
      expect(imported.ok, type).toBe(true)
      expect(imported.manifest?.moduleType).toBe(type)
      expect(imported.evaluation?.passed).toBe(true)

      const approved = approveModuleIfReady(ws, 'proj-1', response)
      expect(approved.ok, type).toBe(true)
      if (approved.ok) {
        expect(approved.approved.moduleId).toBe(`mod.${type}`)
        expect(ws.getApprovedModule('proj-1', `mod.${type}`)?.moduleVersion).toBe('1.0.0')
        expect(ws.getApprovedModuleInterview('proj-1', `mod.${type}`)?.answers).toEqual(response.answers)
        expect(ws.getApprovedModuleInterview('proj-1', `mod.${type}`)?.acceptanceCases).toEqual(response.acceptanceCases)
      }
    }

    const records = ws.listModules('proj-1', [...architecture.moduleIds, 'mod.allocated-only'])
    expect(records.map((record) => record.moduleId)).toContain('mod.allocated-only')
    expect(records.filter((record) => record.approved).map((record) => record.moduleId).sort()).toEqual(
      types.map((type) => `mod.${type}`).sort(),
    )
  })

  it('does not offer multiple interview depths', () => {
    // MVP: single applicable-detail set per type — no quick/standard/detailed variants.
    expect(Object.keys(MODULE_APPLICABLE_DETAILS)).not.toContain('domain.quick')
    expect(Object.keys(MODULE_APPLICABLE_DETAILS)).not.toContain('domain.detailed')
  })

  it('promotes the persisted draft interview when approval happens after a reload', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'euik-cap-010-reload-'))
    const ws = new CapabilityWorkspace(dir)
    const response = completeResponse('domain')
    const imported = importModuleInterviewResponse(response)
    expect(imported.manifest).toBeDefined()
    ws.saveModuleDraft('proj-1', imported.manifest!, response)

    const reopened = new CapabilityWorkspace(dir)
    reopened.approveModule('proj-1', imported.manifest!)
    expect(reopened.getApprovedModuleInterview('proj-1', response.moduleId)).toEqual(response)
  })
})
