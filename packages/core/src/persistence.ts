/**
 * Project, settings, and handoff-run persistence.
 *
 * App-managed workspace layout (PRD §28, §28.8):
 *
 * ```text
 * <dataDir>/
 *   settings/app-settings.json
 *   projects/<projectId>/project.json
 *   runs/<runId>/handoff-run.json           (plus run artifacts beside it)
 * ```
 *
 * Writes are atomic (temp file + rename). Nothing here reads repo-local
 * config; settings live only in the app-managed workspace in v0.1.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  DEFAULT_SETTINGS,
  type HandoffRun,
  type Project,
  type Settings,
} from './types.js'

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

export class Workspace {
  constructor(readonly dataDir: string) {}

  private settingsPath(): string {
    return path.join(this.dataDir, 'settings', 'app-settings.json')
  }

  getSettings(): Settings {
    return readJson<Settings>(this.settingsPath()) ?? { ...DEFAULT_SETTINGS }
  }

  saveSettings(settings: Settings): void {
    atomicWriteJson(this.settingsPath(), settings)
  }

  private projectPath(projectId: string): string {
    return path.join(this.dataDir, 'projects', projectId, 'project.json')
  }

  createProject(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'settingsSchemaVersion'> & { id?: string }): Project {
    const now = new Date().toISOString()
    const project: Project = {
      settingsSchemaVersion: '1',
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    atomicWriteJson(this.projectPath(project.id), project)
    return project
  }

  getProject(projectId: string): Project | undefined {
    return readJson<Project>(this.projectPath(projectId))
  }

  updateProject(projectId: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>): Project {
    const existing = this.getProject(projectId)
    if (!existing) throw new Error(`project not found: ${projectId}`)
    const updated: Project = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
    atomicWriteJson(this.projectPath(projectId), updated)
    return updated
  }

  listProjects(): Project[] {
    const root = path.join(this.dataDir, 'projects')
    if (!fs.existsSync(root)) return []
    const projects: Project[] = []
    for (const id of fs.readdirSync(root)) {
      const project = this.getProject(id)
      if (project) projects.push(project)
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name))
  }

  private runPath(runId: string): string {
    return path.join(this.dataDir, 'runs', runId, 'handoff-run.json')
  }

  /** Directory holding all artifacts for a run. */
  runDir(runId: string): string {
    return path.join(this.dataDir, 'runs', runId)
  }

  createRun(input: Omit<HandoffRun, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): HandoffRun {
    const now = new Date().toISOString()
    const run: HandoffRun = { ...input, id: input.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now }
    atomicWriteJson(this.runPath(run.id), run)
    return run
  }

  getRun(runId: string): HandoffRun | undefined {
    return readJson<HandoffRun>(this.runPath(runId))
  }

  updateRun(runId: string, patch: Partial<Omit<HandoffRun, 'id' | 'createdAt'>>): HandoffRun {
    const existing = this.getRun(runId)
    if (!existing) throw new Error(`handoff run not found: ${runId}`)
    const updated: HandoffRun = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
    atomicWriteJson(this.runPath(runId), updated)
    return updated
  }

  listRuns(projectId?: string): HandoffRun[] {
    const root = path.join(this.dataDir, 'runs')
    if (!fs.existsSync(root)) return []
    const runs: HandoffRun[] = []
    for (const id of fs.readdirSync(root)) {
      const run = this.getRun(id)
      if (run && (!projectId || run.projectId === projectId)) runs.push(run)
    }
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** Persist an arbitrary run artifact JSON beside the run record. */
  saveRunArtifact(runId: string, fileName: string, value: unknown): string {
    const filePath = path.join(this.runDir(runId), fileName)
    atomicWriteJson(filePath, value)
    return filePath
  }
}
