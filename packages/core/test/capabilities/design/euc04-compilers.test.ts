/**
 * EUC-04 — pure compilers from `ModuleDesignSpecification` to the current
 * module records (§26 Increment 1): `ModuleManifest`, `OperationContract`,
 * `ModuleImplementationSpecification`.
 */
import { describe, expect, it } from 'vitest'
import {
  compileModuleImplementationSpecification,
  compileModuleManifest,
  compileOperationContracts,
} from '../../../src/capabilities/design/moduleDesignCompilers.js'
import { createModuleDesignDraft } from '../../../src/capabilities/design/moduleDesign.js'
import type { ModuleDesignSpecification } from '../../../src/capabilities/design/records.js'
import type { ArchitectureSpecification, OperationContract } from '../../../src/capabilities/types.js'
import { validateContractRecord } from '../../../src/capabilities/validation.js'

function architectureFixture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: 'r1',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: 'r1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.domain'],
    moduleDefinitions: [{ moduleId: 'mod.domain', name: 'Domain module', moduleType: 'domain', responsibility: 'Own domain rules' }],
    dependencyEdges: [],
    operationAllocations: [{ operationId: 'op.calculate', moduleId: 'mod.domain' }],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
  }
}

function filledDesign(): ModuleDesignSpecification {
  const architecture = architectureFixture()
  const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
  return {
    ...draft,
    module: { ...draft.module, responsibility: 'Calculates the total', ownedConcerns: ['totals'], nonResponsibilities: ['does not persist'] },
    requiredOperations: [{ operationId: 'op.fetch', acceptedVersionRange: '^1.0.0', providerModuleId: 'mod.other', reason: 'reads source data' }],
    schemas: [
      { schemaId: 'mod.domain.input', version: '1.0.0', role: 'input', ref: 'schemas/mod.domain/input.json' },
      { schemaId: 'mod.domain.output', version: '1.0.0', role: 'output', ref: 'schemas/mod.domain/output.json' },
    ],
    rules: [{ id: 'rule.1', text: 'totals are never negative' }],
    invariants: ['total >= 0'],
    behavior: {
      ...draft.behavior,
      preconditions: ['input is a valid order'],
      postconditions: ['total is computed'],
      domainRejections: ['negative quantity is rejected'],
      technicalFailures: ['calculation overflow is reported'],
      sideEffects: [],
      idempotency: 'idempotent',
      cancellation: 'none',
      timeouts: 'short timeout',
      concurrency: 'single-threaded',
    },
    data: {
      ...draft.data,
      dataOwnership: 'this module owns the total',
      provenanceFields: ['source'],
    },
    runtime: {
      ...draft.runtime,
      configurationRefs: ['config.tax-rate'],
      secretReferenceIds: [],
      lifecycleRegistration: 'singleton',
      telemetry: 'emits calculation duration',
      healthBehavior: 'reports healthy when the last calculation succeeded',
    },
    verification: {
      ...draft.verification,
      examples: ['a simple order totals correctly'],
      edgeCases: ['a zero-quantity order'],
      acceptanceCases: [{ id: 'ac1', description: 'totals a simple order', expectedOutcome: 'the correct total is returned' }],
      configuredCommands: ['npm test'],
    },
    unresolvedItems: [{ id: 'q1', description: 'confirm rounding mode', materiality: 'nonmaterial' }],
  }
}

describe('EUC-04 compileModuleManifest', () => {
  it('maps identity, operations, and boundary fields to a ModuleManifest', () => {
    const design = filledDesign()
    const manifest = compileModuleManifest(design)

    expect(manifest.moduleId).toBe('mod.domain')
    expect(manifest.moduleType).toBe('domain')
    expect(manifest.responsibility).toBe('Calculates the total')
    expect(manifest.providedOperations).toEqual([{ operationId: 'op.calculate', contractVersion: '1.0.0' }])
    expect(manifest.requiredOperations).toEqual([{ operationId: 'op.fetch', acceptedContractRange: '^1.0.0', reason: 'reads source data' }])
    expect(manifest.runtimeAllocation).toBe('local-embedded')
    expect(manifest.ownedPaths).toEqual(design.boundary.ownedPaths)
    expect(validateContractRecord('CAP-CONTRACT-003', manifest)).toEqual([])
  })

  it('is deterministic for the same design', () => {
    const design = filledDesign()
    expect(compileModuleManifest(design)).toEqual(compileModuleManifest(design))
  })

  it('falls back to a supported runtime allocation for an unrecognized value', () => {
    const design = filledDesign()
    const withBadAllocation = { ...design, boundary: { ...design.boundary, runtimeAllocation: 'nonsense' } }
    expect(compileModuleManifest(withBadAllocation).runtimeAllocation).toBe('local-embedded')
  })
})

describe('EUC-04 compileOperationContracts', () => {
  it('builds a skeleton contract from behavior when no registry entry exists', () => {
    const design = filledDesign()
    const contracts = compileOperationContracts(design)
    expect(contracts).toHaveLength(1)
    const contract = contracts[0]!
    expect(contract.operationId).toBe('op.calculate')
    expect(contract.version).toBe('1.0.0')
    expect(contract.inputSchemaRef).toBe('mod.domain.input')
    expect(contract.outputSchemaRef).toBe('mod.domain.output')
    expect(contract.preconditions).toEqual(design.behavior.preconditions)
    expect(contract.idempotency).toBe('idempotent')
    expect(contract.timeoutClass).toBe('short')
    expect(contract.cancellable).toBe(false)
    expect(validateContractRecord('CAP-CONTRACT-004', contract)).toEqual([])
  })

  it('preserves version identity and full detail from an existing registry contract', () => {
    const design = filledDesign()
    const existing: OperationContract = {
      schemaVersion: '1.0',
      operationId: 'op.calculate',
      version: '1.0.0',
      behavior: 'query',
      inputSchemaRef: 'custom.input',
      outputSchemaRef: 'custom.output',
      preconditions: ['already reviewed'],
      postconditions: [],
      domainRejections: [],
      technicalErrors: [],
      sideEffects: [],
      idempotency: 'idempotent',
      timeoutClass: 'long',
      cancellable: true,
      artifactTypes: [],
      provenanceFields: [],
    }
    const contracts = compileOperationContracts(design, [existing])
    expect(contracts).toEqual([existing])
  })

  it('is deterministic for the same design and registry', () => {
    const design = filledDesign()
    expect(compileOperationContracts(design)).toEqual(compileOperationContracts(design))
  })
})

describe('EUC-04 compileModuleImplementationSpecification', () => {
  it('maps boundary, behavior, data, runtime, and verification fields', () => {
    const design = filledDesign()
    const spec = compileModuleImplementationSpecification(design)

    expect(spec.moduleId).toBe('mod.domain')
    expect(spec.moduleVersion).toBe(design.module.moduleVersion)
    expect(spec.runtimeLanguage).toBe('typescript')
    expect(spec.deployableId).toBe(design.boundary.deployableId)
    expect(spec.ownedPaths).toEqual(design.boundary.ownedPaths)
    expect(spec.responsibility).toBe(design.module.responsibility)
    expect(spec.nonResponsibilities).toEqual(design.module.nonResponsibilities)
    expect(spec.rules).toEqual(design.rules)
    expect(spec.invariants).toEqual(design.invariants)
    expect(spec.examples).toEqual(design.verification.examples)
    expect(spec.edgeCases).toEqual(design.verification.edgeCases)
    expect(spec.failureSemantics).toEqual([...design.behavior.domainRejections, ...design.behavior.technicalFailures])
    expect(spec.cancellationExpectations).toBe(design.behavior.cancellation)
    expect(spec.timeoutExpectations).toBe(design.behavior.timeouts)
    expect(spec.concurrencyExpectations).toBe(design.behavior.concurrency)
    expect(spec.lifecycleRegistration).toBe('singleton')
    expect(spec.configurationRefs).toEqual(design.runtime.configurationRefs)
    expect(spec.persistenceExpectations).toBe(design.data.dataOwnership)
    expect(spec.telemetryExpectations).toBe(design.runtime.telemetry)
    expect(spec.healthExpectations).toBe(design.runtime.healthBehavior)
    expect(spec.acceptanceCases).toEqual(design.verification.acceptanceCases)
    expect(spec.acceptanceCommands).toEqual(design.verification.configuredCommands)
    expect(spec.unresolvedItems).toEqual([{ id: 'q1', description: 'confirm rounding mode', materiality: 'non-material' }])
  })

  it('validates against the CAP-CONTRACT-031 structural validator', () => {
    const design = filledDesign()
    const spec = compileModuleImplementationSpecification(design)
    expect(validateContractRecord('CAP-CONTRACT-031', spec)).toEqual([])
  })

  it('is deterministic for the same design', () => {
    const design = filledDesign()
    expect(compileModuleImplementationSpecification(design)).toEqual(compileModuleImplementationSpecification(design))
  })

  it('maps a material unresolved item to CAP-CONTRACT-031 materiality without a hyphen collision', () => {
    const design = { ...filledDesign(), unresolvedItems: [{ id: 'q2', description: 'confirm currency', materiality: 'material' as const }] }
    const spec = compileModuleImplementationSpecification(design)
    expect(spec.unresolvedItems).toEqual([{ id: 'q2', description: 'confirm currency', materiality: 'material' }])
  })
})
