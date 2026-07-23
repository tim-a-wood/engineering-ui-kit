import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  describeMachineOperations,
  executeMachineOperation,
  MACHINE_API_VERSION,
  type MachineOperationRequest,
} from '../src/machine.js'
import { Workspace } from '../src/persistence.js'
import { CapabilityWorkspace } from '../src/capabilities/persistence.js'
import type { ArchitectureSpecification } from '../src/capabilities/types.js'

let dataDir: string
let repoDir: string
let workspace: Workspace
let capabilities: CapabilityWorkspace

const architecture: ArchitectureSpecification = {
  schemaVersion: '1.0',
  projectId: 'project-1',
  id: 'architecture-1',
  revision: '1',
  status: 'approved',
  applicationSpecId: 'application-1',
  applicationSpecRevision: '1',
  applicationSpecHash: 'application-hash',
  capabilityProjections: [],
  moduleIds: ['mod.domain', 'mod.experience'],
  moduleDefinitions: [
    { moduleId: 'mod.domain', name: 'Domain', moduleType: 'domain', responsibility: 'Own audit rules.' },
    { moduleId: 'mod.experience', name: 'Audit hub', moduleType: 'experience', responsibility: 'Present audits.' },
  ],
  dependencyEdges: [
    { fromModuleId: 'mod.experience', toModuleId: 'mod.domain', reason: 'Presents rule outcomes.' },
  ],
  operationAllocations: [
    { operationId: 'audit.evaluate', moduleId: 'mod.domain' },
    { operationId: 'audit.present', moduleId: 'mod.experience' },
  ],
  adapterAllocations: [],
  workflowTraces: [],
  proposals: [],
  unresolvedQuestions: [],
  gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
  contentHash: 'architecture-hash',
}

function request(
  operation: MachineOperationRequest['operation'],
  input: Record<string, unknown>,
  idempotencyKey?: string,
  requestId = `request-${operation}`,
): MachineOperationRequest {
  return {
    apiVersion: MACHINE_API_VERSION,
    requestId,
    operation,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    input,
  }
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-machine-'))
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-machine-repo-'))
  fs.writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }))
  workspace = new Workspace(dataDir)
  workspace.createProject({
    id: 'project-1',
    name: 'Audit hub',
    repoPath: repoDir,
    status: 'active',
    developmentScope: 'full',
  })
  capabilities = new CapabilityWorkspace(dataDir)
  capabilities.ensureInitialized('project-1')
  capabilities.approveArchitecture('project-1', architecture)
})

describe('versioned machine operations', () => {
  it('describes stable operation requirements', () => {
    const description = describeMachineOperations()
    expect(description.apiVersion).toBe('1.0')
    expect(description.operations.find((entry) => entry.operation === 'modules.batch.approve')).toMatchObject({
      mutation: true,
      requiresIdempotencyKey: true,
      requiresExplicitApproval: true,
    })
  })

  it('requires idempotency for mutations and replays the same result without duplicate writes', async () => {
    const missingKey = await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'project-1' }),
      { dataDir },
    )
    expect(missingKey.status).toBe('failed')
    expect(missingKey.diagnostics[0]?.code).toBe('MACHINE-IDEMPOTENCY-REQUIRED')

    const first = await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'project-1' }, 'propose-1', 'request-1'),
      { dataDir },
    )
    const second = await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'project-1' }, 'propose-1', 'request-2'),
      { dataDir },
    )

    expect(first.status).toBe('succeeded')
    expect(first.replayed).toBe(false)
    expect(second.status).toBe('succeeded')
    expect(second.replayed).toBe(true)
    expect(second.resultHash).toBe(first.resultHash)
    expect(capabilities.listModules('project-1', architecture.moduleIds).filter((record) => record.draft)).toHaveLength(2)
  })

  it('rejects idempotency-key reuse with different input', async () => {
    await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'project-1' }, 'shared-key'),
      { dataDir },
    )
    const conflict = await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'different-project' }, 'shared-key'),
      { dataDir },
    )
    expect(conflict.status).toBe('failed')
    expect(conflict.diagnostics[0]?.code).toBe('MACHINE-IDEMPOTENCY-CONFLICT')
  })

  it('uses explicit approval, returns result manifests, and plans dependency waves', async () => {
    await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'project-1' }, 'propose'),
      { dataDir },
    )
    const blocked = await executeMachineOperation(
      request('modules.batch.approve', {
        projectId: 'project-1',
        moduleIds: architecture.moduleIds,
        explicit: false,
      }, 'approve-blocked'),
      { dataDir },
    )
    expect(blocked.status).toBe('blocked')
    expect(blocked.diagnostics[0]?.code).toBe('MACHINE-EXPLICIT-APPROVAL')

    const approved = await executeMachineOperation(
      request('modules.batch.approve', {
        projectId: 'project-1',
        moduleIds: architecture.moduleIds,
        explicit: true,
      }, 'approve'),
      { dataDir },
    )
    expect(approved.status).toBe('succeeded')
    expect(approved.manifest.producedRecords).toHaveLength(2)
    expect(approved.manifest.nextOperations).toContain('implementation.waves.plan')

    const plan = await executeMachineOperation(
      request('implementation.waves.plan', { projectId: 'project-1' }),
      { dataDir },
    )
    expect(plan.status).toBe('succeeded')
    expect((plan.result as { waves: { targets: { moduleId: string }[] }[] }).waves
      .map((wave) => wave.targets.map((target) => target.moduleId))).toEqual([
        ['mod.domain'],
        ['mod.experience'],
      ])
  })

  it('compiles implementation/frontend briefs and creates one idempotent frontend run', async () => {
    await executeMachineOperation(
      request('modules.batch.propose', { projectId: 'project-1' }, 'propose'),
      { dataDir },
    )
    await executeMachineOperation(
      request('modules.batch.approve', {
        projectId: 'project-1',
        moduleIds: architecture.moduleIds,
        explicit: true,
      }, 'approve'),
      { dataDir },
    )

    const implementation = await executeMachineOperation(
      request('implementation.brief.compile', { projectId: 'project-1', moduleId: 'mod.domain' }),
      { dataDir },
    )
    expect(implementation.status).toBe('succeeded')
    expect((implementation.result as { target: { moduleId: string } }).target.moduleId).toBe('mod.domain')

    const frontend = await executeMachineOperation(
      request('frontend.brief.compile', { projectId: 'project-1', targetModuleIds: ['mod.experience'] }),
      { dataDir },
    )
    expect(frontend.status).toBe('succeeded')
    expect(frontend.manifest.nextOperations).toContain('frontend.build.create')

    const createInput = {
      projectId: 'project-1',
      targetModuleIds: ['mod.experience'],
      explicit: true,
    }
    const first = await executeMachineOperation(
      request('frontend.build.create', createInput, 'frontend-run', 'frontend-1'),
      { dataDir },
    )
    const retry = await executeMachineOperation(
      request('frontend.build.create', createInput, 'frontend-run', 'frontend-2'),
      { dataDir },
    )
    expect(first.status).toBe('succeeded')
    expect(retry.replayed).toBe(true)
    expect(workspace.listRuns('project-1')).toHaveLength(1)
  })
})
