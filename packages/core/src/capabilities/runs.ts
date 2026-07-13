/**
 * Capability run and evidence persistence (CAP-PKT-004).
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
  CapabilityRunScope,
  CapabilityRunTransition,
  FreshnessRecord,
  ImpactRecord,
  JobRecord,
  VerificationRecord,
} from './types.js'
import { CapabilityWorkspace } from './persistence.js'

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

export class CapabilityRunStore {
  constructor(readonly workspace: CapabilityWorkspace) {}

  private runsRoot(projectId: string): string {
    return path.join(this.workspace.root(projectId), 'runs')
  }

  private runRoot(projectId: string, runId: string): string {
    return path.join(this.runsRoot(projectId), runId)
  }

  createRun(run: CapabilityRunScope): CapabilityRunScope {
    this.workspace.ensureInitialized(run.projectId)
    const dest = path.join(this.runsRoot(run.projectId), run.runId, 'run.json')
    if (fs.existsSync(dest)) throw new Error(`capability run exists: ${run.runId}`)
    atomicWriteJson(dest, run)
    return run
  }

  getRun(projectId: string, runId: string): CapabilityRunScope | undefined {
    return readJson(path.join(this.runsRoot(projectId), runId, 'run.json'))
  }

  updateRun(
    projectId: string,
    runId: string,
    patch: Partial<CapabilityRunScope>,
  ): CapabilityRunScope {
    const existing = this.getRun(projectId, runId)
    if (!existing) throw new Error(`capability run not found: ${runId}`)
    if (patch.projectId && patch.projectId !== existing.projectId) {
      throw new Error('capability run projectId cannot be changed')
    }
    if (patch.runId && patch.runId !== existing.runId) {
      throw new Error('capability run runId cannot be changed')
    }
    const updated: CapabilityRunScope = {
      ...existing,
      ...patch,
      runId: existing.runId,
      projectId: existing.projectId,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    }
    atomicWriteJson(path.join(this.runRoot(projectId, runId), 'run.json'), updated)
    return updated
  }

  saveRunArtifact(projectId: string, runId: string, fileName: string, value: unknown): string {
    if (!/^[a-z0-9][a-z0-9._-]*\.json$/i.test(fileName)) {
      throw new Error('invalid capability artifact filename')
    }
    if (!this.getRun(projectId, runId)) throw new Error(`capability run not found: ${runId}`)
    const relativeRef = path.posix.join('runs', runId, 'artifacts', fileName)
    atomicWriteJson(path.join(this.workspace.root(projectId), ...relativeRef.split('/')), value)
    return relativeRef
  }

  getRunArtifact<T>(projectId: string, relativeRef: string): T | undefined {
    const root = path.resolve(this.workspace.root(projectId))
    const target = path.resolve(root, ...relativeRef.split('/'))
    if (!target.startsWith(root + path.sep)) throw new Error('capability artifact ref escaped workspace')
    return readJson<T>(target)
  }

  listRuns(projectId: string): CapabilityRunScope[] {
    const root = this.runsRoot(projectId)
    if (!fs.existsSync(root)) return []
    return fs
      .readdirSync(root)
      .map((id) => this.getRun(projectId, id))
      .filter((r): r is CapabilityRunScope => Boolean(r))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  appendTransition(
    projectId: string,
    runId: string,
    transition: CapabilityRunTransition,
    lifecycleState: string,
  ): CapabilityRunScope {
    const existing = this.getRun(projectId, runId)
    if (!existing) throw new Error(`capability run not found: ${runId}`)
    const updated: CapabilityRunScope = {
      ...existing,
      lifecycleState,
      transitionHistory: [...existing.transitionHistory, transition],
      updatedAt: transition.at,
      completedAt: transition.toState === 'complete' ? transition.at : existing.completedAt,
    }
    atomicWriteJson(path.join(this.runsRoot(projectId), runId, 'run.json'), updated)
    return updated
  }

  saveVerification(projectId: string, record: VerificationRecord): void {
    this.workspace.ensureInitialized(projectId)
    atomicWriteJson(
      path.join(this.workspace.root(projectId), 'evidence', 'verifications', `${record.verificationId}.json`),
      record,
    )
  }

  getVerification(projectId: string, verificationId: string): VerificationRecord | undefined {
    return readJson(
      path.join(this.workspace.root(projectId), 'evidence', 'verifications', `${verificationId}.json`),
    )
  }

  saveFreshness(projectId: string, record: FreshnessRecord): void {
    this.workspace.ensureInitialized(projectId)
    atomicWriteJson(
      path.join(this.workspace.root(projectId), 'evidence', 'freshness', `${record.moduleId}.json`),
      record,
    )
  }

  getFreshness(projectId: string, moduleId: string): FreshnessRecord | undefined {
    return readJson(path.join(this.workspace.root(projectId), 'evidence', 'freshness', `${moduleId}.json`))
  }

  saveImpact(projectId: string, record: ImpactRecord): void {
    this.workspace.ensureInitialized(projectId)
    atomicWriteJson(
      path.join(this.workspace.root(projectId), 'evidence', 'impact', `${record.changeId}.json`),
      record,
    )
  }

  getImpact(projectId: string, changeId: string): ImpactRecord | undefined {
    return readJson(path.join(this.workspace.root(projectId), 'evidence', 'impact', `${changeId}.json`))
  }

  listImpacts(projectId: string): ImpactRecord[] {
    const root = path.join(this.workspace.root(projectId), 'evidence', 'impact')
    if (!fs.existsSync(root)) return []
    return fs.readdirSync(root)
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson<ImpactRecord>(path.join(root, name)))
      .filter((record): record is ImpactRecord => Boolean(record))
      .sort((a, b) => a.changeId.localeCompare(b.changeId))
  }

  private deltaProgressPath(projectId: string, changeId: string): string {
    return path.join(this.workspace.root(projectId), 'evidence', 'impact', `${changeId}.progress.json`)
  }

  getDeltaProgress(projectId: string, changeId: string): { changeId: string; completedTargets: string[] } {
    const stored = readJson<{ changeId: string; completedTargets: string[] }>(
      this.deltaProgressPath(projectId, changeId),
    )
    return stored ?? { changeId, completedTargets: [] }
  }

  /**
   * Record a delta target as complete. The caller must have already confirmed a passing
   * verification for the target; this only persists queue advancement.
   */
  markDeltaTargetComplete(
    projectId: string,
    changeId: string,
    targetId: string,
  ): { changeId: string; completedTargets: string[] } {
    if (!this.getImpact(projectId, changeId)) throw new Error(`impact not found: ${changeId}`)
    const current = this.getDeltaProgress(projectId, changeId)
    if (current.completedTargets.includes(targetId)) return current
    const next = { changeId, completedTargets: [...current.completedTargets, targetId] }
    atomicWriteJson(this.deltaProgressPath(projectId, changeId), next)
    return next
  }

  saveJob(projectId: string, job: JobRecord): void {
    this.workspace.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.workspace.root(projectId), 'jobs', `${job.jobId}.json`), job)
  }

  getJob(projectId: string, jobId: string): JobRecord | undefined {
    return readJson(path.join(this.workspace.root(projectId), 'jobs', `${jobId}.json`))
  }
}
