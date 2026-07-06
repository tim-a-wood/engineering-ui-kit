/**
 * IPC handlers: the only place renderer requests touch the filesystem,
 * child processes, or persistence — always through @engineering-ui-kit/core.
 */

import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  Workspace,
  buildContext,
  buildPacketManifest,
  inspectOverlay,
  applyOverlay,
  runCommand,
  type OverlayInspectionSummary,
  type Project,
  type Settings,
  type VerificationResult,
} from '@engineering-ui-kit/core'
import { BRIDGE_CHANNELS, type BuildPacketResult, type PrepareContextResult, type TaskPacketFields } from './bridgeApi.js'
import {
  STANDARD_CONSTRAINTS,
  buildRecommendedPrompt,
  buildReviewPacketMarkdown,
  buildStandardPackMarkdown,
  buildTaskPacketMarkdown,
} from './standardsTemplate.js'

function requireProject(workspace: Workspace, projectId: string): Project {
  const project = workspace.getProject(projectId)
  if (!project) throw new Error(`project not found: ${projectId}`)
  return project
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null, dataDir?: string): Workspace {
  const workspace = new Workspace(dataDir ?? path.join(app.getPath('userData'), 'workspace'))

  ipcMain.handle(BRIDGE_CHANNELS.appVersion, () => app.getVersion())

  ipcMain.handle(BRIDGE_CHANNELS.getSettings, () => workspace.getSettings())
  ipcMain.handle(BRIDGE_CHANNELS.saveSettings, (_e, settings: Settings) => {
    workspace.saveSettings(settings)
  })

  ipcMain.handle(BRIDGE_CHANNELS.listProjects, () => workspace.listProjects())
  ipcMain.handle(BRIDGE_CHANNELS.createProject, (_e, input: { name: string; repoPath: string; description?: string }) => {
    if (!input.name?.trim()) throw new Error('project name is required')
    if (!input.repoPath?.trim() || !fs.existsSync(input.repoPath)) {
      throw new Error('repository path does not exist')
    }
    return workspace.createProject({
      name: input.name.trim(),
      repoPath: input.repoPath,
      status: 'active',
      ...(input.description ? { description: input.description } : {}),
      verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
    })
  })
  ipcMain.handle(BRIDGE_CHANNELS.updateProject, (_e, projectId: string, patch: Partial<Project>) =>
    workspace.updateProject(projectId, patch))

  ipcMain.handle(BRIDGE_CHANNELS.listRuns, (_e, projectId?: string) => workspace.listRuns(projectId))
  ipcMain.handle(BRIDGE_CHANNELS.createRun, (_e, projectId: string) => {
    requireProject(workspace, projectId)
    return workspace.createRun({ projectId, currentStep: 'prepare-context' })
  })
  ipcMain.handle(BRIDGE_CHANNELS.getRun, (_e, runId: string) => workspace.getRun(runId))
  ipcMain.handle(BRIDGE_CHANNELS.updateRun, (_e, runId: string, patch: Record<string, unknown>) =>
    workspace.updateRun(runId, patch))

  // Native pickers cannot be driven by automated end-to-end tests; in test
  // mode the paths come from the environment instead.
  const testMode = Boolean(process.env['EUIK_TEST_MODE'])
  ipcMain.handle(BRIDGE_CHANNELS.pickDirectory, async () => {
    if (testMode) return process.env['EUIK_TEST_PICK_DIR']
    const window = getWindow()
    if (!window) return undefined
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
    return result.canceled ? undefined : result.filePaths[0]
  })
  ipcMain.handle(BRIDGE_CHANNELS.pickZipFile, async () => {
    if (testMode) return process.env['EUIK_TEST_PICK_ZIP']
    const window = getWindow()
    if (!window) return undefined
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'Zip overlay', extensions: ['zip'] }],
    })
    return result.canceled ? undefined : result.filePaths[0]
  })

  ipcMain.handle(BRIDGE_CHANNELS.prepareContext, (_e, runId: string): PrepareContextResult => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    const result = buildContext(project.repoPath, {
      projectId: project.id,
      packetId: runId,
      sourceRepo: project.name,
    })
    const runDir = workspace.runDir(runId)
    fs.mkdirSync(runDir, { recursive: true })
    const flatfilePath = path.join(runDir, 'repo-flatfile.txt')
    fs.writeFileSync(flatfilePath, result.flatfileText)
    const inventoryPath = workspace.saveRunArtifact(runId, 'repo-inventory.json', result.inventory)
    workspace.updateRun(runId, {
      currentStep: 'create-task-packet',
      repoFlatfilePath: flatfilePath,
      repoInventoryPath: inventoryPath,
    })
    return {
      inventory: result.inventory,
      flatfilePath,
      flatfileBytes: Buffer.byteLength(result.flatfileText),
      warnings: result.inventory.contextWarnings,
    }
  })

  ipcMain.handle(BRIDGE_CHANNELS.buildPacket, (_e, runId: string, fields: TaskPacketFields): BuildPacketResult => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    if (!run.repoFlatfilePath || !fs.existsSync(run.repoFlatfilePath)) {
      throw new Error('prepare context before building the task packet')
    }
    for (const [key, value] of Object.entries(fields)) {
      if (!String(value ?? '').trim()) throw new Error(`required packet field is empty: ${key}`)
    }

    const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const runDir = workspace.runDir(runId)

    // PRD §13.5 text-only upload set: repo-flatfile.txt, task-packet.md, standard-pack.md
    const taskPacketText = buildTaskPacketMarkdown({
      packetId: runId,
      targetApplication: project.name,
      targetAppRoot: project.repoPath,
      taskTitle: fields.taskTitle,
      goal: fields.goal,
      scope: fields.scope.split('\n').filter(Boolean),
      constraints: [...fields.constraints.split('\n').filter(Boolean), ...STANDARD_CONSTRAINTS],
      acceptanceCriteria: fields.acceptanceCriteria.split('\n').filter(Boolean),
      references: fields.references.split('\n').filter(Boolean),
      generatedAt,
    })
    const standardPackText = buildStandardPackMarkdown({ standardsVersion: '0.4.0', generatedAt })

    const taskPacketPath = path.join(runDir, 'task-packet.md')
    const standardPackPath = path.join(runDir, 'standard-pack.md')
    fs.writeFileSync(taskPacketPath, taskPacketText)
    fs.writeFileSync(standardPackPath, standardPackText)

    const uploadPaths = [run.repoFlatfilePath, taskPacketPath, standardPackPath]
    const manifest = buildPacketManifest(uploadPaths)
    const recommendedPrompt = buildRecommendedPrompt({
      targetApplication: project.name,
      taskTitle: fields.taskTitle,
      goal: fields.goal,
      uploadFiles: manifest.map((m) => m.file),
    })

    workspace.updateRun(runId, {
      currentStep: 'run-in-copilot',
      taskTitle: fields.taskTitle,
      taskPacketPath,
      standardPackPath,
      uploadSetType: 'text-only',
    })
    workspace.saveRunArtifact(runId, 'packet-manifest.json', { files: manifest })

    return {
      taskPacketPath,
      standardPackPath,
      runDir,
      packBytes: Buffer.byteLength(taskPacketText) + Buffer.byteLength(standardPackText),
      uploadFiles: manifest,
      recommendedPrompt,
    }
  })

  // Read a named artifact from a run directory (basename only — no path escape).
  ipcMain.handle(BRIDGE_CHANNELS.getArtifactText, (_e, runId: string, fileName: string): string => {
    if (!workspace.getRun(runId)) throw new Error(`run not found: ${runId}`)
    if (path.basename(fileName) !== fileName) throw new Error('artifact name must be a bare filename')
    const filePath = path.join(workspace.runDir(runId), fileName)
    if (!fs.existsSync(filePath)) throw new Error(`artifact not found: ${fileName}`)
    return fs.readFileSync(filePath, 'utf8')
  })

  // PRD §13.7 step 2: Add Feedback Manually — appended, timestamped notes file.
  ipcMain.handle(BRIDGE_CHANNELS.saveFeedback, (_e, runId: string, text: string) => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    if (!text.trim()) throw new Error('feedback text is empty')
    const notesPath = path.join(workspace.runDir(runId), 'user-review-notes.md')
    const entry = `## ${new Date().toISOString()}\n\n${text.trim()}\n\n`
    fs.mkdirSync(path.dirname(notesPath), { recursive: true })
    fs.appendFileSync(notesPath, entry)
    return workspace.updateRun(runId, { userReviewNotesPath: notesPath })
  })

  // PRD §11.3 modal: Generate Copilot Review Packet (follow-up, 3-file budget).
  ipcMain.handle(BRIDGE_CHANNELS.buildReviewPacket, (_e, runId: string) => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    const feedback = run.userReviewNotesPath && fs.existsSync(run.userReviewNotesPath)
      ? fs.readFileSync(run.userReviewNotesPath, 'utf8')
      : ''
    const verification = (run.verificationResultPaths ?? [])
      .filter((p) => fs.existsSync(p))
      .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')) as { commandLabel: string; status: string; exitCode: number | null })
      .map((r) => `- ${r.commandLabel}: ${r.status} (exit ${r.exitCode ?? '—'})`)
      .join('\n') || '- No verification results recorded yet.'
    const taskPacket = run.taskPacketPath && fs.existsSync(run.taskPacketPath)
      ? fs.readFileSync(run.taskPacketPath, 'utf8')
      : ''
    const acceptance = taskPacket.split('## Acceptance Criteria')[1]?.split('##')[0]?.trim() ?? '_See task packet._'

    const text = buildReviewPacketMarkdown({
      runId,
      targetApplication: project.name,
      taskTitle: run.taskTitle ?? 'UI transformation',
      acceptanceCriteria: acceptance,
      feedback,
      verificationSummary: verification,
      generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    })
    const reviewPath = path.join(workspace.runDir(runId), 'review-packet.md')
    fs.writeFileSync(reviewPath, text)
    workspace.updateRun(runId, { reviewEvidencePackPath: reviewPath, uploadSetType: 'follow-up-text' })
    return { reviewPacketPath: reviewPath, reviewPacketText: text }
  })

  ipcMain.handle(BRIDGE_CHANNELS.inspectOverlay, (_e, runId: string, zipPath: string): OverlayInspectionSummary => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    if (!zipPath.toLowerCase().endsWith('.zip') || !fs.existsSync(zipPath)) {
      throw new Error('select an existing .zip overlay file')
    }
    const summary = inspectOverlay(zipPath, { runId, targetRoot: project.repoPath })
    const summaryPath = workspace.saveRunArtifact(runId, 'overlay-inspection-summary.json', summary)
    workspace.updateRun(runId, {
      currentStep: 'apply-zip-overlay',
      overlayZipPath: zipPath,
      overlayInspectionSummaryPath: summaryPath,
    })
    return summary
  })

  ipcMain.handle(BRIDGE_CHANNELS.applyOverlay, (_e, runId: string, acceptWarnings: boolean) => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    if (!run.overlayZipPath || !run.overlayInspectionSummaryPath) {
      throw new Error('inspect an overlay before applying')
    }
    const summary = JSON.parse(fs.readFileSync(run.overlayInspectionSummaryPath, 'utf8')) as OverlayInspectionSummary
    const applied = applyOverlay(run.overlayZipPath, summary, {
      runId,
      targetRoot: project.repoPath,
      acceptWarnings,
    })
    const appliedPath = workspace.saveRunArtifact(runId, 'applied-files.json', applied)
    workspace.updateRun(runId, { currentStep: 'verify-review', appliedFilesPath: appliedPath })
    return applied
  })

  ipcMain.handle(BRIDGE_CHANNELS.runVerification, async (_e, runId: string, labels: string[]): Promise<VerificationResult[]> => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    const commands = project.verificationCommands ?? {}
    const settings = workspace.getSettings()
    const results: VerificationResult[] = []
    const outputDir = path.join(workspace.runDir(runId), 'verification')
    for (const label of labels) {
      const commandText = commands[label as keyof typeof commands]
      if (!commandText) continue
      results.push(await runCommand({
        runId,
        commandLabel: label,
        commandText,
        workingDirectory: project.repoPath,
        timeoutMs: settings.defaultCommandTimeoutMinutes * 60 * 1000,
        outputDir,
      }))
    }
    const resultPaths = results.map((r, i) => workspace.saveRunArtifact(runId, `verification-result-${labels[i]}.json`, r))
    workspace.updateRun(runId, { verificationResultPaths: resultPaths })
    return results
  })

  ipcMain.handle(BRIDGE_CHANNELS.openExternal, async (_e, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('only http(s) URLs may be opened')
    }
    await shell.openExternal(url)
  })

  ipcMain.handle(BRIDGE_CHANNELS.showInFolder, async (_e, target: string) => {
    if (!fs.existsSync(target)) throw new Error('path does not exist')
    shell.showItemInFolder(target)
  })

  return workspace
}
