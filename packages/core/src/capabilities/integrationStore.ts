/** Node-only durable state for the production reference-architecture workflow. */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type {
  CompositionManifest,
  ConnectionVerificationRecord,
  ModuleImplementationSpecification,
} from './types.js'
import type {
  CapabilityIntegrationState,
  DeployableIntegrationState,
  GenerationApplyRecord,
  IntegrationCommandRun,
  PersistedGenerationBundle,
} from './integrationState.js'
import { CapabilityWorkspace } from './persistence.js'

type IntegrationIndex = {
  schemaVersion: '1.0'
  currentPlanByDeployable: Record<string, string>
  latestApplyByDeployable: Record<string, string>
  latestCommandRunByDeployable: Record<string, string>
}

function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmp, filePath)
}

function readJson<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function safeId(value: string, label: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) throw new Error(`invalid ${label}`)
  return value
}

export class CapabilityIntegrationStore {
  constructor(readonly workspace: CapabilityWorkspace) {}

  private root(projectId: string): string {
    return path.join(this.workspace.root(projectId), 'integration')
  }

  private indexPath(projectId: string): string {
    return path.join(this.root(projectId), 'index.json')
  }

  private getIndex(projectId: string): IntegrationIndex {
    return readJson<IntegrationIndex>(this.indexPath(projectId)) ?? {
      schemaVersion: '1.0',
      currentPlanByDeployable: {},
      latestApplyByDeployable: {},
      latestCommandRunByDeployable: {},
    }
  }

  private saveIndex(projectId: string, index: IntegrationIndex): void {
    atomicWriteJson(this.indexPath(projectId), index)
  }

  saveGenerationBundle(bundle: PersistedGenerationBundle): void {
    if (bundle.projectId !== bundle.plan.projectId) throw new Error('generation bundle project does not match plan')
    const planId = safeId(bundle.plan.planId, 'planId')
    const deployableId = safeId(bundle.deployableId, 'deployableId')
    this.workspace.ensureInitialized(bundle.projectId)
    const destination = path.join(this.root(bundle.projectId), 'plans', `${planId}.json`)
    const existing = readJson<PersistedGenerationBundle>(destination)
    if (existing && existing.plan.planHash !== bundle.plan.planHash) {
      throw new Error(`generation plan id collision: ${planId}`)
    }
    atomicWriteJson(destination, bundle)
    const index = this.getIndex(bundle.projectId)
    index.currentPlanByDeployable[deployableId] = planId
    this.saveIndex(bundle.projectId, index)
  }

  getGenerationBundle(projectId: string, planId: string): PersistedGenerationBundle | undefined {
    return readJson(path.join(this.root(projectId), 'plans', `${safeId(planId, 'planId')}.json`))
  }

  getCurrentGenerationBundle(projectId: string, deployableId: string): PersistedGenerationBundle | undefined {
    const id = this.getIndex(projectId).currentPlanByDeployable[safeId(deployableId, 'deployableId')]
    return id ? this.getGenerationBundle(projectId, id) : undefined
  }

  saveApplyRecord(record: GenerationApplyRecord): void {
    const applyRunId = safeId(record.applyRunId, 'applyRunId')
    const deployableId = safeId(record.deployableId, 'deployableId')
    this.workspace.ensureInitialized(record.projectId)
    atomicWriteJson(path.join(this.root(record.projectId), 'applies', `${applyRunId}.json`), record)
    const index = this.getIndex(record.projectId)
    index.latestApplyByDeployable[deployableId] = applyRunId
    this.saveIndex(record.projectId, index)
  }

  getApplyRecord(projectId: string, applyRunId: string): GenerationApplyRecord | undefined {
    return readJson(path.join(this.root(projectId), 'applies', `${safeId(applyRunId, 'applyRunId')}.json`))
  }

  getLatestApplyRecord(projectId: string, deployableId: string): GenerationApplyRecord | undefined {
    const id = this.getIndex(projectId).latestApplyByDeployable[safeId(deployableId, 'deployableId')]
    return id ? this.getApplyRecord(projectId, id) : undefined
  }

  saveCommandRun(record: IntegrationCommandRun): void {
    const commandRunId = safeId(record.commandRunId, 'commandRunId')
    const deployableId = safeId(record.deployableId, 'deployableId')
    this.workspace.ensureInitialized(record.projectId)
    atomicWriteJson(path.join(this.root(record.projectId), 'command-runs', `${commandRunId}.json`), record)
    const index = this.getIndex(record.projectId)
    index.latestCommandRunByDeployable ??= {}
    index.latestCommandRunByDeployable[deployableId] = commandRunId
    this.saveIndex(record.projectId, index)
  }

  getLatestCommandRun(projectId: string, deployableId: string): IntegrationCommandRun | undefined {
    const id = this.getIndex(projectId).latestCommandRunByDeployable?.[safeId(deployableId, 'deployableId')]
    return id ? readJson(path.join(this.root(projectId), 'command-runs', `${safeId(id, 'commandRunId')}.json`)) : undefined
  }

  commandOutputDirectory(projectId: string, commandRunId: string): string {
    return path.join(this.root(projectId), 'command-output', safeId(commandRunId, 'commandRunId'))
  }

  saveConnectionVerification(record: ConnectionVerificationRecord): void {
    this.workspace.ensureInitialized(record.projectId)
    atomicWriteJson(
      path.join(this.root(record.projectId), 'connection-verifications', `${safeId(record.verificationId, 'verificationId')}.json`),
      record,
    )
  }

  saveModuleSpecification(specification: ModuleImplementationSpecification): void {
    this.workspace.ensureInitialized(specification.projectId)
    atomicWriteJson(
      path.join(this.root(specification.projectId), 'module-specifications', `${safeId(specification.moduleId, 'moduleId')}.json`),
      specification,
    )
  }

  getModuleSpecification(projectId: string, moduleId: string): ModuleImplementationSpecification | undefined {
    return readJson(
      path.join(this.root(projectId), 'module-specifications', `${safeId(moduleId, 'moduleId')}.json`),
    )
  }

  saveCompositionManifest(manifest: CompositionManifest): void {
    this.workspace.ensureInitialized(manifest.projectId)
    const deployableId = manifest.deployableIds.length === 1 ? manifest.deployableIds[0] : undefined
    if (!deployableId) throw new Error('production composition manifest must identify exactly one deployable')
    atomicWriteJson(
      path.join(this.root(manifest.projectId), 'compositions', `${safeId(deployableId, 'deployableId')}.json`),
      manifest,
    )
  }

  getCompositionManifest(projectId: string, deployableId: string): CompositionManifest | undefined {
    return readJson(
      path.join(this.root(projectId), 'compositions', `${safeId(deployableId, 'deployableId')}.json`),
    )
  }

  listConnectionVerifications(projectId: string, deployableId?: string): ConnectionVerificationRecord[] {
    const root = path.join(this.root(projectId), 'connection-verifications')
    if (!fs.existsSync(root)) return []
    return fs.readdirSync(root)
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson<ConnectionVerificationRecord>(path.join(root, name)))
      .filter((record): record is ConnectionVerificationRecord => Boolean(record))
      .filter((record) => !deployableId || record.deployableId === deployableId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  }

  buildState(projectId: string, deployableIds: readonly string[], inputHashes: Readonly<Record<string, string>> = {}): CapabilityIntegrationState {
    const deployables: DeployableIntegrationState[] = [...deployableIds].sort().map((deployableId) => {
      const bundle = this.getCurrentGenerationBundle(projectId, deployableId)
      const latestApply = this.getLatestApplyRecord(projectId, deployableId)
      const latestCommandRun = this.getLatestCommandRun(projectId, deployableId)
      const attention: string[] = []
      let status: DeployableIntegrationState['status'] = 'ready-to-generate'
      if (bundle) {
        if (bundle.plan.blockers.length || bundle.plan.ambiguityQuestions.length) status = 'blocked'
        else status = 'plan-ready'
        if (inputHashes[deployableId] && inputHashes[deployableId] !== bundle.inputHash) {
          status = 'stale'
          attention.push('Approved inputs changed after this generation plan was created.')
        }
      }
      // A newly generated plan must never inherit the lifecycle state of an
      // older apply.  The prior apply is still useful as proof that the base
      // deployable has been generated once, but only an apply of the current
      // plan may make the current integration state `applied`.
      const applyMatchesCurrentPlan = Boolean(
        bundle
        && latestApply
        && latestApply.planId === bundle.plan.planId
        && latestApply.planHash === bundle.plan.planHash,
      )
      if (latestApply && applyMatchesCurrentPlan && status !== 'stale') status = latestApply.status
      if (latestApply && bundle && !applyMatchesCurrentPlan) {
        attention.push('The current generation plan has not been applied.')
      }
      if (!bundle) attention.push('Generate and review the reference-architecture plan.')
      return {
        deployableId,
        status,
        attention,
        currentPlan: bundle?.plan,
        latestApply,
        latestCommandRun,
        connectionVerifications: this.listConnectionVerifications(projectId, deployableId),
        currentConnectionVerificationIds: [],
      }
    })
    return { schemaVersion: '1.0', projectId, deployables, updatedAt: new Date().toISOString() }
  }
}
