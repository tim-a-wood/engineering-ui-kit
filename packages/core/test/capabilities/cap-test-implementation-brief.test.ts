import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildModuleImplementationBrief,
  referenceArchitectureFor,
} from '../../src/capabilities/implementationBrief.js'
import { discoverRepositoryImplementationContext } from '../../src/capabilities/repositoryContext.js'
import type {
  ArchitectureSpecification,
  ModuleManifest,
} from '../../src/capabilities/types.js'
import type { ModuleInterviewResponse } from '../../src/capabilities/moduleInterview.js'

const manifest: ModuleManifest = {
  schemaVersion: '1.0',
  architectureVersion: '1.0',
  moduleId: 'mod.orders',
  moduleVersion: '1.0.0',
  moduleType: 'domain',
  name: 'Order Rules',
  responsibility: 'Decide whether an order can be approved.',
  ownedConcerns: ['order approval policy'],
  excludedConcerns: ['persistence', 'presentation'],
  providedOperations: [{ operationId: 'op.orders.approve', contractVersion: '1.0.0' }],
  requiredOperations: [{
    operationId: 'op.credit.check', acceptedContractRange: '^1.0.0', reason: 'Approval requires credit eligibility.',
  }],
  verificationSuiteIds: ['suite.orders'],
  runtimeAllocation: 'local-embedded',
  events: ['order-approved'],
  ownedPaths: ['src/domain/orders/'],
}

const interview: ModuleInterviewResponse = {
  moduleId: manifest.moduleId,
  moduleType: manifest.moduleType,
  name: manifest.name,
  moduleVersion: manifest.moduleVersion,
  responsibility: manifest.responsibility,
  ownedConcerns: manifest.ownedConcerns,
  excludedConcerns: manifest.excludedConcerns,
  providedOperations: manifest.providedOperations,
  requiredOperations: manifest.requiredOperations,
  verificationSuiteIds: manifest.verificationSuiteIds,
  runtimeAllocation: manifest.runtimeAllocation,
  events: manifest.events,
  ownedPaths: manifest.ownedPaths,
  operationContracts: [{
    schemaVersion: '1.0', operationId: 'op.orders.approve', version: '1.0.0', behavior: 'command',
    inputSchemaRef: 'orders.approve.input', outputSchemaRef: 'orders.approve.output',
    preconditions: ['The order exists.'], postconditions: ['An approved order emits order-approved exactly once.'],
    domainRejections: ['Order total is not positive.', 'Credit is not eligible.'], technicalErrors: [],
    sideEffects: ['Emits order-approved when approved.'], idempotency: 'idempotent', timeoutClass: 'short',
    cancellable: false, artifactTypes: [], provenanceFields: [],
  }],
  dataSchemas: [
    { schemaId: 'orders.approve.input', description: 'Approval request.', fields: [
      { name: 'orderId', type: 'string', required: true, description: 'Order identifier.', constraints: ['non-empty'] },
    ] },
    { schemaId: 'orders.approve.output', description: 'Approval decision.', fields: [
      { name: 'approved', type: 'boolean', required: true, description: 'Whether approval succeeded.', constraints: [] },
    ] },
  ],
  answers: [
    { id: 'inputs-outputs', text: 'Input is an order and credit decision; output is approval or a typed rejection.', status: 'confirmed' },
    { id: 'rules-invariants', text: 'Orders with a non-positive total cannot be approved.', status: 'confirmed' },
    { id: 'preconditions-postconditions', text: 'Approved orders emit order-approved exactly once.', status: 'confirmed' },
  ],
  acceptanceCases: [{
    id: 'ac-order-positive',
    description: 'Approve an eligible order with a positive total.',
    expectedOutcome: 'The order is approved and order-approved is emitted once.',
  }],
  rules: [{ id: 'rule-positive-total', text: 'Order total must be positive.' }],
}

const architecture: ArchitectureSpecification = {
  schemaVersion: '1.0', projectId: 'project', id: 'architecture', revision: '1', status: 'approved',
  applicationSpecId: 'application', applicationSpecRevision: '1', applicationSpecHash: 'hash',
  capabilityProjections: [{ id: 'orders', name: 'Orders', moduleIds: ['mod.orders'] }],
  moduleIds: ['mod.orders', 'adapter.credit'],
  moduleDefinitions: [
    { moduleId: 'mod.orders', name: 'Order Rules', moduleType: 'domain', responsibility: manifest.responsibility },
    { moduleId: 'adapter.credit', name: 'Credit Adapter', moduleType: 'connection', responsibility: 'Checks credit.' },
  ],
  dependencyEdges: [{ fromModuleId: 'mod.orders', toModuleId: 'adapter.credit', reason: 'Checks credit through a port.' }],
  operationAllocations: [{ operationId: 'op.orders.approve', moduleId: 'mod.orders' }],
  adapterAllocations: [], workflowTraces: [{ useCaseId: 'approve-order', moduleIds: ['mod.orders'] }],
  proposals: [], unresolvedQuestions: [],
  gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] }, contentHash: 'architecture-hash',
}

describe('implementation-ready module handoff context', () => {
  it('combines reference architecture, approved interview detail, and live repository context', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-implementation-brief-'))
    fs.mkdirSync(path.join(root, 'src/domain/orders'), { recursive: true })
    fs.mkdirSync(path.join(root, 'src/domain/customers'), { recursive: true })
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { test: 'vitest run', typecheck: 'tsc --noEmit' },
      devDependencies: { typescript: '5.8.0', vitest: '3.2.0' },
    }))
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{}')
    fs.writeFileSync(path.join(root, 'src/domain/orders/index.ts'), 'export const approve = () => true\n')
    fs.writeFileSync(path.join(root, 'src/domain/orders/index.test.ts'), 'export {}\n')
    fs.writeFileSync(path.join(root, 'src/domain/customers/index.ts'), 'export {}\n')

    const repository = discoverRepositoryImplementationContext({
      repoRoot: root,
      allowedPaths: manifest.ownedPaths,
      verificationCommands: { test: 'npm test', typecheck: 'npm run typecheck' },
    })
    const brief = buildModuleImplementationBrief({
      manifest, interview, architecture, repository,
      availableOperationContracts: [{
        schemaVersion: '1.0', operationId: 'op.credit.check', version: '1.0.0', behavior: 'query',
        inputSchemaRef: 'credit.check.input', outputSchemaRef: 'credit.check.output', preconditions: [],
        postconditions: [], domainRejections: [], technicalErrors: ['Credit provider unavailable.'], sideEffects: [],
        idempotency: 'idempotent', timeoutClass: 'short', cancellable: true, artifactTypes: [], provenanceFields: [],
      }],
      availableDataSchemas: [
        { schemaId: 'credit.check.input', description: 'Credit check request.', fields: [] },
        { schemaId: 'credit.check.output', description: 'Credit eligibility.', fields: [] },
      ],
      now: () => new Date('2026-07-14T12:00:00.000Z'),
    })

    expect(brief.readiness.status).toBe('ready')
    expect(brief.referenceArchitecture.profileId).toBe('hexagonal-ports-and-adapters')
    expect(brief.referenceArchitecture.role).toContain('Domain core')
    expect(brief.approvedSpecification.detailAnswers).toEqual(interview.answers)
    expect(brief.approvedSpecification.acceptanceCases).toEqual(interview.acceptanceCases)
    expect(brief.contracts.behavioralEvidence.map((item) => item.detailId)).toContain('inputs-outputs')
    expect(brief.contracts.providedOperationContracts[0]?.operationId).toBe('op.orders.approve')
    expect(brief.contracts.requiredOperationContracts[0]?.operationId).toBe('op.credit.check')
    expect(brief.contracts.dataSchemas.map((schema) => schema.schemaId)).toContain('credit.check.input')
    expect(brief.architectureContext.dependencyEdges).toEqual(architecture.dependencyEdges)
    expect(brief.repositoryContext.detectedLanguages).toContain('TypeScript')
    expect(brief.repositoryContext.detectedFrameworks).toContain('typescript')
    expect(brief.repositoryContext.detectedPackageManager).toBe('npm')
    expect(brief.repositoryContext.existingFilesInScope).toContain('src/domain/orders/index.ts')
    expect(brief.repositoryContext.nearbyPatternFiles).toContain('src/domain/customers/index.ts')
    expect(brief.verificationPlan.commands.test).toBe('npm test')
    expect(brief.implementationPlan.join(' ')).toContain('src/domain/orders/index.ts')
  })

  it('keeps legacy approved modules usable while documenting missing detail', () => {
    const profile = referenceArchitectureFor('connection')
    expect(profile.role).toContain('Outbound external adapter')

    const brief = buildModuleImplementationBrief({
      manifest,
      architecture,
      repository: {
        repositoryName: 'legacy', detectedLanguages: ['TypeScript'], detectedFrameworks: [],
        detectedPackageManager: 'npm', manifestFiles: ['package.json'], sourceRoots: ['src'],
        packageScripts: {}, configuredVerificationCommands: {},
        ownedPaths: [{ path: 'src/domain/orders/', exists: false, kind: 'missing' }],
        existingFilesInScope: [], nearbyPatternFiles: [], testFiles: [],
      },
    })
    expect(brief.readiness.status).toBe('ready-with-gaps')
    expect(brief.readiness.issues.map((issue) => issue.code)).toContain('IMPLEMENTATION-BRIEF-INTERVIEW-DETAIL')
    expect(brief.implementationPlan[0]).toContain('Inspect the nearby repository patterns')
  })
})
