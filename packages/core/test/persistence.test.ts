import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Workspace } from '../src/persistence.js'
import { DEFAULT_SETTINGS } from '../src/types.js'

let dataDir: string
let workspace: Workspace

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-ws-'))
  workspace = new Workspace(dataDir)
})

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('Workspace settings', () => {
  it('returns defaults when unset and round-trips saves', () => {
    expect(workspace.getSettings()).toEqual(DEFAULT_SETTINGS)
    const custom = { ...DEFAULT_SETTINGS, warnWhenOverlayChangesMoreThanFiles: 5 }
    workspace.saveSettings(custom)
    expect(workspace.getSettings()).toEqual(custom)
    expect(fs.existsSync(path.join(dataDir, 'settings', 'app-settings.json'))).toBe(true)
  })
})

describe('Workspace projects', () => {
  it('creates, reads, updates, and lists projects', () => {
    const project = workspace.createProject({ name: 'Fixture', repoPath: '/tmp/fixture', status: 'active' })
    expect(project.id).toBeTruthy()
    expect(project.settingsSchemaVersion).toBe('1')
    expect(workspace.getProject(project.id)?.name).toBe('Fixture')

    const updated = workspace.updateProject(project.id, { launchUrl: 'http://127.0.0.1:5199' })
    expect(updated.launchUrl).toBe('http://127.0.0.1:5199')
    expect(updated.createdAt).toBe(project.createdAt)
    expect(workspace.listProjects().length).toBe(1)
  })

  it('rejects updates to unknown projects', () => {
    expect(() => workspace.updateProject('nope', { name: 'x' })).toThrow(/not found/)
  })
})

describe('Workspace handoff runs', () => {
  it('creates and advances a run through workflow steps', () => {
    const project = workspace.createProject({ name: 'P', repoPath: '/tmp/p', status: 'active' })
    const run = workspace.createRun({ projectId: project.id, currentStep: 'prepare-context' })
    expect(workspace.getRun(run.id)?.currentStep).toBe('prepare-context')

    workspace.updateRun(run.id, { currentStep: 'create-task-packet', taskTitle: 'Refresh screen' })
    workspace.updateRun(run.id, { currentStep: 'verify-review', completionStatus: 'not-complete' })
    const final = workspace.getRun(run.id)
    expect(final?.currentStep).toBe('verify-review')
    expect(final?.taskTitle).toBe('Refresh screen')
    expect(workspace.listRuns(project.id).length).toBe(1)
  })

  it('saves run artifacts beside the run record', () => {
    const project = workspace.createProject({ name: 'P', repoPath: '/tmp/p', status: 'active' })
    const run = workspace.createRun({ projectId: project.id, currentStep: 'apply-zip-overlay' })
    const artifactPath = workspace.saveRunArtifact(run.id, 'overlay-inspection-summary.json', { canApply: true })
    expect(artifactPath).toBe(path.join(workspace.runDir(run.id), 'overlay-inspection-summary.json'))
    expect(JSON.parse(fs.readFileSync(artifactPath, 'utf8')).canApply).toBe(true)
  })
})
