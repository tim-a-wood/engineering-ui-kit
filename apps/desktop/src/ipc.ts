/**
 * IPC handlers: the only place renderer requests touch the filesystem,
 * child processes, or persistence — always through @engineering-ui-kit/core.
 */

import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell, webContents } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { buildCfHdropBuffer, buildFilenamesPboardPlist, buildUriList } from './uploadSetTransfer.js'
import {
  Workspace,
  CapabilityWorkspace,
  canonicalHash,
  buildContext,
  buildPacketManifest,
  inspectOverlay,
  applyOverlay,
  runCommand,
  captureEvidence,
  loadEvidenceCapture,
  diffCensusLosses,
  buildReviewContactSheetHtml,
  renderReviewContactSheetPdf,
  buildChangesZip,
  type AppliedFiles,
  type ApplicationSpecification,
  type EvidenceCapture,
  type OverlayInspectionSummary,
  type Project,
  type Settings,
  type SelectionEvidence,
  type VerificationResult,
} from '@engineering-ui-kit/core'
import {
  BRIDGE_CHANNELS,
  type BuildPacketResult,
  type EvidenceViewDisplay,
  type PrepareContextResult,
  type ReviewPacketResult,
  type RunEvidence,
  type TaskPacketFields,
} from './bridgeApi.js'
import {
  STANDARD_CONSTRAINTS,
  buildRecommendedPrompt,
  buildReviewPacketMarkdown,
  buildStandardPackMarkdown,
  buildTaskPacketMarkdown,
} from './standardsTemplate.js'
import { registerCapabilityIpcHandlers } from './capabilities/ipc.js'
import {
  DESKTOP_PREVIEW_PICKER_CANCEL_JS,
  DESKTOP_PREVIEW_PICKER_JS,
  DESKTOP_PREVIEW_PICKER_RESULT_JS,
} from './previewPicker.js'

function requireProject(workspace: Workspace, projectId: string): Project {
  const project = workspace.getProject(projectId)
  if (!project) throw new Error(`project not found: ${projectId}`)
  return project
}

/** 24px file-badge shown under the cursor while dragging the upload set out. */
const DRAG_BADGE = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAT0lEQVR4nGNgQAL60f//UwMzYAPUMhyrJdQ2HMUSWhkOt2R4WvDj1x+y8AiyYOhH8pTFO4jCI9iCkRPJxATVMLVgaEUyzatMulT6tGy2AAANzMpqChPiLwAAAABJRU5ErkJggg==',
)

/**
 * Locate a bundled sample app: repo layout in development
 * (apps/desktop → ../../examples), packaged resources otherwise.
 */
function resolveSampleAppPath(exampleName: string): string | undefined {
  const candidates = [
    path.resolve(app.getAppPath(), '..', '..', 'examples', exampleName),
    path.join(process.resourcesPath ?? '', 'examples', exampleName),
  ]
  return candidates.find((c) => fs.existsSync(path.join(c, 'package.json')))
}

function seedProject(workspace: Workspace, input: Parameters<Workspace['createProject']>[0]): Project {
  const existing = workspace.getProject(input.id ?? '')
    ?? workspace.listProjects().find((project) => project.isSample && project.name === input.name)
  if (existing) {
    if (existing.repoPath !== input.repoPath && !fs.existsSync(existing.repoPath)) {
      return workspace.updateProject(existing.id, { repoPath: input.repoPath })
    }
    return existing
  }
  return workspace.createProject(input)
}

/** Seed both repo-backed examples without overwriting user-edited sample data. */
function seedSampleProjects(workspace: Workspace): void {
  const plantOpsPath = resolveSampleAppPath('work-orders-monolith')
  if (plantOpsPath) seedProject(workspace, {
    id: 'plantops-sample',
    name: 'PlantOps (sample)',
    description:
      'Built-in sample: a multi-page legacy work-order app to explore the whole workflow against. Restyle it, break it, iterate — reset any time from Settings inside the app or with git.',
    repoPath: plantOpsPath,
    status: 'active',
    isSample: true,
    launchUrl: 'http://127.0.0.1:5402',
    launchCommand: 'npx vite --port 5402 --strictPort',
    verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
    evidenceViews: [
      { id: 'dashboard', label: 'Dashboard', path: '/' },
      { id: 'orders', label: 'Work Orders', path: '#/orders' },
      { id: 'order-form', label: 'New Order Form', path: '#/orders/new' },
      { id: 'assets', label: 'Assets', path: '#/assets' },
      { id: 'reports', label: 'Reports', path: '#/reports' },
    ],
  })

  const aircraftPath = resolveSampleAppPath('aircraft-performance-sample')
  if (!aircraftPath) return
  const aircraft = seedProject(workspace, {
    id: 'aircraft-performance-sample',
    name: 'Aircraft Performance (sample)',
    description:
      'Built-in sample: define, review, and connect a generic aircraft-performance workflow using a completed, no-brand application brief.',
    repoPath: aircraftPath,
    status: 'active',
    isSample: true,
    launchUrl: 'http://127.0.0.1:5403',
    launchCommand: 'npx vite --port 5403 --strictPort',
    verificationCommands: { build: 'npm run build' },
    evidenceViews: [{ id: 'calculator', label: 'Performance calculator', path: '/' }],
  })

  const capabilities = new CapabilityWorkspace(workspace.dataDir)
  if (capabilities.getApplicationDraft(aircraft.id) || capabilities.getApprovedApplication(aircraft.id)) return

  const specificationPath = path.join(aircraftPath, 'capabilities', 'application-specification.json')
  if (!fs.existsSync(specificationPath)) return
  const source = JSON.parse(fs.readFileSync(specificationPath, 'utf8')) as ApplicationSpecification
  const draft: ApplicationSpecification = {
    ...source,
    projectId: aircraft.id,
    status: 'draft',
    contentHash: canonicalHash({ ...source, projectId: aircraft.id, status: 'draft', contentHash: undefined }),
  }
  capabilities.saveApplicationDraft(aircraft.id, draft)
}

/* Dev servers started via Launch App, keyed by project id; killed on quit. */
const launchedApps = new Map<string, ChildProcess>()

function killLaunchedApp(child: ChildProcess): void {
  if (child.pid === undefined) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch {
    try { child.kill('SIGTERM') } catch { /* already gone */ }
  }
}

async function probeUrl(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return res.status < 500
  } catch {
    return false
  }
}

async function waitUntilReachable(url: string, totalMs: number): Promise<void> {
  const deadline = Date.now() + totalMs
  while (Date.now() < deadline) {
    if (await probeUrl(url, 2_000)) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`app did not become reachable at ${url} within ${Math.round(totalMs / 1000)}s`)
}

/**
 * The build portion of a "build then serve" launch command (e.g. `npm run
 * build` from `npm run build && npm start`). A single-segment command is a
 * hot-reloading dev server with nothing to rebuild, so this returns undefined
 * — only build-and-serve apps (whose server serves a static `dist/`) need a
 * rebuild when relaunched over an already-running server.
 */
function buildStepOf(launchCommand?: string): string | undefined {
  if (!launchCommand) return undefined
  const segments = launchCommand.split('&&').map((s) => s.trim()).filter(Boolean)
  if (segments.length < 2) return undefined
  return segments.find((s) => /\bbuild\b/.test(s))
}

/** Run a one-shot command to completion; reject with tail output on non-zero exit or timeout. */
function runOnce(command: string, cwd: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { out += d.toString() })
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch { /* already gone */ }
      reject(new Error(`\`${command}\` did not finish within ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`\`${command}\` failed (exit ${code}):\n${out.trim().slice(-800)}`))
    })
  })
}

/** The files a run uploads to Copilot: flatfile + combined pack (legacy: split packs). */
function resolveUploadSet(run: { repoFlatfilePath?: string; taskAndStandardPackPath?: string; taskPacketPath?: string; standardPackPath?: string; visualReferencePackPath?: string }): string[] {
  const candidates = run.taskAndStandardPackPath
    ? [run.repoFlatfilePath, run.taskAndStandardPackPath, run.visualReferencePackPath]
    : [run.repoFlatfilePath, run.taskPacketPath, run.standardPackPath]
  const existing = candidates.filter((p): p is string => Boolean(p && fs.existsSync(p)))
  if (existing.length === 0) {
    throw new Error('no upload files for this run yet — prepare context and build the task packet first')
  }
  return existing
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null, dataDir?: string): Workspace {
  const workspaceRoot = dataDir ?? path.join(app.getPath('userData'), 'workspace')
  const workspace = new Workspace(workspaceRoot)
  seedSampleProjects(workspace)
  app.on('will-quit', () => {
    for (const child of launchedApps.values()) killLaunchedApp(child)
  })

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
    const usedPorts = new Set(workspace.listProjects().flatMap((project) => {
      try {
        const port = new URL(project.launchUrl ?? '').port
        return port ? [Number(port)] : []
      } catch { return [] }
    }))
    let previewPort = 4180
    while (usedPorts.has(previewPort)) previewPort += 1
    return workspace.createProject({
      name: input.name.trim(),
      repoPath: input.repoPath,
      status: 'active',
      launchUrl: `http://127.0.0.1:${previewPort}`,
      launchCommand: 'npm run build && npm start',
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
  ipcMain.handle(BRIDGE_CHANNELS.addReferenceFile, async (_event, runId: string, sourcePath?: string) => {
    if (!workspace.getRun(runId)) throw new Error(`run not found: ${runId}`)
    let selected = sourcePath
    if (!selected) {
      if (testMode) selected = process.env['EUIK_TEST_PICK_REFERENCE']
      else {
        const window = getWindow()
        if (!window) return undefined
        const result = await dialog.showOpenDialog(window, { properties: ['openFile'] })
        selected = result.canceled ? undefined : result.filePaths[0]
      }
    }
    if (!selected) return undefined
    if (!fs.existsSync(selected) || !fs.statSync(selected).isFile()) throw new Error('reference must be an existing file')
    const name = path.basename(selected)
    const target = path.join(workspace.runDir(runId), `reference-${name}`)
    fs.copyFileSync(selected, target)
    workspace.updateRun(runId, { visualReferencePackPath: target, uploadSetType: 'visual' })
    return { path: target, name }
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
      if (key === 'references') continue
      if (!String(value ?? '').trim()) throw new Error(`required packet field is empty: ${key}`)
    }

    const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const runDir = workspace.runDir(runId)

    // Saved reviewer notes ride along on regenerated packets so the next
    // Copilot iteration actually sees the feedback (Verify-step promise).
    const reviewerFeedback = run.userReviewNotesPath && fs.existsSync(run.userReviewNotesPath)
      ? fs.readFileSync(run.userReviewNotesPath, 'utf8').trim()
      : undefined

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
      ...(reviewerFeedback ? { reviewerFeedback } : {}),
    })
    const standardPackText = buildStandardPackMarkdown({ standardsVersion: '0.5.0', generatedAt })

    const taskPacketPath = path.join(runDir, 'task-packet.md')
    const standardPackPath = path.join(runDir, 'standard-pack.md')
    fs.writeFileSync(taskPacketPath, taskPacketText)
    fs.writeFileSync(standardPackPath, standardPackText)

    // Combined upload file: one drag/copy fewer, same content, and the third
    // Copilot slot stays free for a visual reference pack.
    const taskAndStandardPackPath = path.join(runDir, 'task-and-standard-pack.md')
    fs.writeFileSync(taskAndStandardPackPath, `${taskPacketText}\n\n---\n\n${standardPackText}`)

    const uploadPaths = [run.repoFlatfilePath, taskAndStandardPackPath, run.visualReferencePackPath]
      .filter((filePath): filePath is string => Boolean(filePath))
    const manifest = buildPacketManifest(uploadPaths)
    const recommendedPrompt = buildRecommendedPrompt({
      targetApplication: project.name,
      taskTitle: fields.taskTitle,
      goal: fields.goal,
      uploadFiles: manifest.map((m) => m.file),
    })
    // Persisted so Open-Copilot can auto-copy the prompt on a revisit of this step.
    fs.writeFileSync(path.join(runDir, 'recommended-prompt.txt'), recommendedPrompt)

    workspace.updateRun(runId, {
      currentStep: 'run-in-copilot',
      taskTitle: fields.taskTitle,
      // Kept on the run so "Generate New Task Packet" starts from the last
      // exported sections instead of a blank form.
      taskPacketFields: { ...fields },
      taskPacketBuiltAt: generatedAt,
      taskPacketPath,
      standardPackPath,
      taskAndStandardPackPath,
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

  // Read a run artifact, including safe nested verification logs.
  ipcMain.handle(BRIDGE_CHANNELS.getArtifactText, (_e, runId: string, fileName: string): string => {
    if (!workspace.getRun(runId)) throw new Error(`run not found: ${runId}`)
    const normalized = path.normalize(fileName)
    if (path.isAbsolute(normalized) || normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) {
      throw new Error('artifact path must stay inside the run directory')
    }
    const filePath = path.join(workspace.runDir(runId), normalized)
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
  // With captured evidence this produces the full visual set:
  // review-packet.md + review-evidence.pdf (before/after contact sheet) + changes.zip.
  ipcMain.handle(BRIDGE_CHANNELS.buildReviewPacket, async (_e, runId: string): Promise<ReviewPacketResult> => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    const runDir = workspace.runDir(runId)
    const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
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
      generatedAt,
    })
    const reviewPath = path.join(runDir, 'review-packet.md')
    fs.writeFileSync(reviewPath, text)

    // Changed-file bundle for the reviewer.
    const applied = run.appliedFilesPath && fs.existsSync(run.appliedFilesPath)
      ? (JSON.parse(fs.readFileSync(run.appliedFilesPath, 'utf8')) as AppliedFiles)
      : null
    const changedFiles = (applied?.files ?? []).filter((f) => f.action !== 'unchanged')
    let changesZipPath: string | undefined
    if (changedFiles.length > 0) {
      changesZipPath = path.join(runDir, 'changes.zip')
      buildChangesZip(project.repoPath, changedFiles, changesZipPath)
    }

    // Visual contact sheet when evidence was captured for this run.
    const before = run.evidenceBeforeDir ? loadEvidenceCapture(run.evidenceBeforeDir) : null
    const after = run.evidenceAfterDir ? loadEvidenceCapture(run.evidenceAfterDir) : null
    let contactSheetPath: string | undefined
    if (before || after) {
      const viewIds = new Map<string, { id: string; label: string; path: string }>()
      for (const capture of [before, after]) {
        for (const v of capture?.views ?? []) {
          if (!viewIds.has(v.viewId)) viewIds.set(v.viewId, { id: v.viewId, label: v.label, path: v.path })
        }
      }
      const sheetViews = [...viewIds.values()].map((meta) => {
        const b = before?.views.find((v) => v.viewId === meta.id)
        const a = after?.views.find((v) => v.viewId === meta.id)
        const abs = (dir: string | undefined, file: string | undefined) =>
          dir && file && fs.existsSync(path.join(dir, file)) ? path.join(dir, file) : undefined
        const captureError = [b?.error && `before: ${b.error}`, a?.error && `after: ${a.error}`]
          .filter(Boolean)
          .join('; ')
        return {
          ...meta,
          ...(abs(run.evidenceBeforeDir, b?.screenshotFile) ? { beforePng: abs(run.evidenceBeforeDir, b?.screenshotFile) } : {}),
          ...(abs(run.evidenceAfterDir, a?.screenshotFile) ? { afterPng: abs(run.evidenceAfterDir, a?.screenshotFile) } : {}),
          ...(b?.census && a?.census ? { losses: diffCensusLosses(b.census, a.census) } : {}),
          ...(captureError ? { captureError } : {}),
        }
      })
      const html = buildReviewContactSheetHtml({
        runId,
        projectName: project.name,
        taskTitle: run.taskTitle ?? 'UI transformation',
        acceptanceCriteria: acceptance,
        standardsPackage: 'engineering-ui-kit',
        standardsVersion: '0.5.0',
        generatedAt,
        views: sheetViews,
        changedFiles: changedFiles.map((f) => ({ relativePath: f.relativePath, action: f.action, sizeBytes: f.sizeBytes })),
        verificationSummary: verification,
        ...(feedback ? { reviewerNotes: feedback } : {}),
      })
      fs.writeFileSync(path.join(runDir, 'review-evidence.html'), html)
      contactSheetPath = path.join(runDir, 'review-evidence.pdf')
      await renderReviewContactSheetPdf(html, contactSheetPath)
    }

    workspace.updateRun(runId, {
      reviewEvidencePackPath: reviewPath,
      ...(contactSheetPath ? { reviewContactSheetPath: contactSheetPath } : {}),
      ...(changesZipPath ? { changesZipPath } : {}),
      uploadSetType: contactSheetPath ? 'follow-up-visual' : 'follow-up-text',
    })
    return {
      reviewPacketPath: reviewPath,
      reviewPacketText: text,
      ...(contactSheetPath ? { contactSheetPath } : {}),
      ...(changesZipPath ? { changesZipPath } : {}),
      uploadFiles: [reviewPath, contactSheetPath, changesZipPath].filter((p): p is string => Boolean(p)),
    }
  })

  // Visual evidence: per-view screenshots + rendered element census, captured
  // at Prepare (before) and Verify (after). Playwright is an optional install;
  // the error message tells the user how to enable it.
  ipcMain.handle(BRIDGE_CHANNELS.captureEvidence, async (_e, runId: string, phase: 'before' | 'after'): Promise<EvidenceCapture> => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    const views = project.evidenceViews ?? []
    if (views.length === 0) {
      throw new Error('no target views configured; add evidence views in the project settings first')
    }
    if (!project.launchUrl) {
      throw new Error('set the project launch URL (e.g. http://localhost:5173) so views can be captured')
    }
    const outputDir = path.join(workspace.runDir(runId), 'evidence', phase)
    const capture = await captureEvidence({
      runId,
      phase,
      outputDir,
      views,
      baseUrl: project.launchUrl,
      ...(project.launchCommand ? { serveCommand: project.launchCommand, serveCwd: project.repoPath } : {}),
    })
    workspace.updateRun(runId, phase === 'before' ? { evidenceBeforeDir: outputDir } : { evidenceAfterDir: outputDir })
    return capture
  })

  // Evidence display model: screenshots come back as bounded data URIs so the
  // renderer keeps zero filesystem access (ARCH-STATE-006).
  ipcMain.handle(BRIDGE_CHANNELS.getEvidence, (_e, runId: string): RunEvidence => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const before = run.evidenceBeforeDir ? loadEvidenceCapture(run.evidenceBeforeDir) : null
    const after = run.evidenceAfterDir ? loadEvidenceCapture(run.evidenceAfterDir) : null
    const shotUri = (dir: string | undefined, file: string | undefined): string | undefined => {
      if (!dir || !file) return undefined
      const p = path.join(dir, file)
      if (!fs.existsSync(p)) return undefined
      return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    }
    const ids = new Map<string, EvidenceViewDisplay>()
    for (const capture of [before, after]) {
      for (const view of capture?.views ?? []) {
        if (!ids.has(view.viewId)) {
          ids.set(view.viewId, { viewId: view.viewId, label: view.label, path: view.path, losses: [] })
        }
      }
    }
    for (const display of ids.values()) {
      const b = before?.views.find((v) => v.viewId === display.viewId)
      const a = after?.views.find((v) => v.viewId === display.viewId)
      display.beforeShot = shotUri(run.evidenceBeforeDir, b?.screenshotFile)
      display.afterShot = shotUri(run.evidenceAfterDir, a?.screenshotFile)
      if (b?.error) display.beforeError = b.error
      if (a?.error) display.afterError = a.error
      if (b?.census && a?.census) display.losses = diffCensusLosses(b.census, a.census)
    }
    return {
      ...(before ? { before: { capturedAt: before.capturedAt, ok: before.ok } } : {}),
      ...(after ? { after: { capturedAt: after.capturedAt, ok: after.ok } } : {}),
      views: [...ids.values()],
    }
  })

  ipcMain.handle(BRIDGE_CHANNELS.captureProjectThumbnail, async (_e, projectId: string): Promise<string | undefined> => {
    const project = requireProject(workspace, projectId)
    if (!project.launchUrl) return undefined
    const thumbnailDir = path.join(workspaceRoot, 'thumbnails')
    const thumbnailPath = path.join(thumbnailDir, `${projectId}.png`)
    const cached = (): string | undefined => fs.existsSync(thumbnailPath)
      ? `data:image/png;base64,${fs.readFileSync(thumbnailPath).toString('base64')}`
      : undefined
    try {
      const fresh = fs.existsSync(thumbnailPath) && Date.now() - fs.statSync(thumbnailPath).mtimeMs < 30 * 60 * 1000
      if (fresh) return cached()
      if (!(await probeUrl(project.launchUrl, 1_500))) return cached()
      const previewWindow = new BrowserWindow({
        show: false,
        width: 960,
        height: 600,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      })
      try {
        await previewWindow.loadURL(project.launchUrl)
        await new Promise((resolve) => setTimeout(resolve, 600))
        const image = await previewWindow.webContents.capturePage()
        const resized = image.resize({ width: 480, height: 300, quality: 'good' })
        fs.mkdirSync(thumbnailDir, { recursive: true })
        fs.writeFileSync(thumbnailPath, resized.toPNG())
        return `data:image/png;base64,${resized.toPNG().toString('base64')}`
      } finally {
        previewWindow.destroy()
      }
    } catch {
      return cached()
    }
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
    // Verification results describe the tree before this apply — invalidate
    // them so the Verify step demands a fresh run instead of showing a stale
    // green verdict (F10).
    workspace.updateRun(runId, {
      currentStep: 'verify-review',
      appliedFilesPath: appliedPath,
      verificationResultPaths: [],
    })
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
    fs.mkdirSync(outputDir, { recursive: true })
    const packagePath = path.join(project.repoPath, 'package.json')
    const nodeModulesPath = path.join(project.repoPath, 'node_modules')
    const readinessIssues: string[] = []
    if (!fs.existsSync(packagePath)) readinessIssues.push('package.json is missing from the selected project folder.')
    if (fs.existsSync(packagePath) && !fs.existsSync(nodeModulesPath)) readinessIssues.push('Project dependencies are not installed (node_modules is missing).')
    if (readinessIssues.length > 0) {
      const now = new Date().toISOString()
      const logPath = path.join(outputDir, 'project-setup.combined.log')
      fs.writeFileSync(logPath, [
        'Project setup required',
        '',
        ...readinessIssues.map((issue) => `- ${issue}`),
        '',
        fs.existsSync(packagePath)
          ? 'Install dependencies with the package manager for this project, then run the checks again.'
          : 'Choose the application project folder rather than an extracted overlay or archive folder.',
      ].join('\n'))
      results.push({
        runId,
        commandLabel: 'project-setup',
        commandText: 'Project readiness check',
        workingDirectory: project.repoPath,
        startedAt: now,
        endedAt: now,
        exitCode: null,
        status: 'failed',
        combinedOutputPath: logPath,
        wasCancelledByUser: false,
      })
    }
    for (const label of readinessIssues.length > 0 ? [] : labels) {
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
    const resultPaths = results.map((r) => workspace.saveRunArtifact(runId, `verification-result-${r.commandLabel}.json`, r))
    workspace.updateRun(runId, { verificationResultPaths: resultPaths })
    return results
  })

  ipcMain.handle(BRIDGE_CHANNELS.installDependencies, async (_e, runId: string): Promise<VerificationResult> => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const project = requireProject(workspace, run.projectId)
    if (!fs.existsSync(path.join(project.repoPath, 'package.json'))) {
      throw new Error('Cannot install dependencies because package.json is missing from the selected project folder.')
    }
    const commandText = fs.existsSync(path.join(project.repoPath, 'pnpm-lock.yaml'))
      ? 'pnpm install --frozen-lockfile'
      : fs.existsSync(path.join(project.repoPath, 'yarn.lock'))
        ? 'yarn install --frozen-lockfile'
        : fs.existsSync(path.join(project.repoPath, 'package-lock.json'))
          ? 'npm ci'
          : 'npm install'
    const result = await runCommand({
      runId,
      commandLabel: 'install-dependencies',
      commandText,
      workingDirectory: project.repoPath,
      timeoutMs: workspace.getSettings().defaultCommandTimeoutMinutes * 60 * 1000,
      outputDir: path.join(workspace.runDir(runId), 'verification'),
    })
    workspace.saveRunArtifact(runId, 'dependency-install-result.json', result)
    return result
  })

  // A: native drag-out — the renderer's dragstart hands the drag session to
  // the OS with the real files attached; drop lands in the Copilot chat.
  ipcMain.handle(BRIDGE_CHANNELS.startUploadDrag, (event, runId: string) => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const files = resolveUploadSet(run)
    event.sender.startDrag({ file: files[0]!, files, icon: DRAG_BADGE })
  })

  // B: put the actual files (not paths-as-text) on the OS clipboard.
  ipcMain.handle(BRIDGE_CHANNELS.copyUploadSet, (_e, runId: string): { files: number } => {
    const run = workspace.getRun(runId)
    if (!run) throw new Error(`run not found: ${runId}`)
    const files = resolveUploadSet(run)
    clipboard.clear()
    if (process.platform === 'darwin') {
      clipboard.writeBuffer('NSFilenamesPboardType', buildFilenamesPboardPlist(files))
    } else if (process.platform === 'win32') {
      clipboard.writeBuffer('CF_HDROP', buildCfHdropBuffer(files))
    } else {
      clipboard.writeBuffer('text/uri-list', buildUriList(files))
    }
    return { files: files.length }
  })

  // Open the project's running app in the browser; if it isn't running and a
  // launch command is configured, start the dev server first (tracked, killed
  // on app quit).
  ipcMain.handle(BRIDGE_CHANNELS.launchApp, async (_e, projectId: string, options?: { open?: boolean }): Promise<{ url: string; started: boolean; rebuilt: boolean }> => {
    const project = requireProject(workspace, projectId)
    if (!project.launchUrl) throw new Error('no launch URL configured for this project')
    if (fs.existsSync(path.join(project.repoPath, 'package.json')) && !fs.existsSync(path.join(project.repoPath, 'node_modules'))) {
      throw new Error('Project setup required: dependencies are not installed. Install them with the project package manager, then retry the preview.')
    }
    let started = false
    let rebuilt = false
    let launchUrl = project.launchUrl
    const managedProcess = launchedApps.get(projectId)
    const sharesUrl = workspace.listProjects().some((candidate) => candidate.id !== projectId && candidate.launchUrl === launchUrl)
    const defaultManagedLaunch = project.launchCommand === 'npm run build && npm start'
    if (defaultManagedLaunch && sharesUrl && (!managedProcess || managedProcess.exitCode !== null)) {
      const configuredPorts = new Set(workspace.listProjects().flatMap((candidate) => {
        try {
          const port = new URL(candidate.launchUrl ?? '').port
          return port ? [Number(port)] : []
        } catch { return [] }
      }))
      let port = 4180
      while (configuredPorts.has(port) || await probeUrl(`http://127.0.0.1:${port}`, 250)) port += 1
      launchUrl = `http://127.0.0.1:${port}`
      workspace.updateProject(projectId, { launchUrl })
    }
    if (!(await probeUrl(launchUrl, 1_500))) {
      if (!project.launchCommand) {
        throw new Error(`nothing is serving ${project.launchUrl} and no launch command is configured — start your dev server first`)
      }
      const existing = launchedApps.get(projectId)
      if (!existing || existing.exitCode !== null) {
        const launchPort = new URL(launchUrl).port
        launchedApps.set(projectId, spawn(project.launchCommand, {
          cwd: project.repoPath,
          shell: true,
          detached: process.platform !== 'win32',
          stdio: 'ignore',
          env: { ...process.env, ...(launchPort ? { PORT: launchPort } : {}) },
        }))
      }
      await waitUntilReachable(launchUrl, 45_000)
      started = true
    } else {
      // Server already running. A build-and-serve app serves a static dist/,
      // so after an overlay apply the running server is stale — rebuild the
      // build step (the server picks it up from disk) instead of silently
      // reopening the old build. Dev servers (no build step) hot-reload.
      const build = buildStepOf(project.launchCommand)
      if (build) {
        const timeoutMs = workspace.getSettings().defaultCommandTimeoutMinutes * 60 * 1000
        await runOnce(build, project.repoPath, timeoutMs)
        rebuilt = true
      }
    }
    // The embedded Verify-step preview renders in-window; only open the
    // system browser when asked (the default, and the legacy behavior).
    if (options?.open !== false) await shell.openExternal(launchUrl)
    return { url: launchUrl, started, rebuilt }
  })

  ipcMain.handle(BRIDGE_CHANNELS.pickPreviewElement, async (event, guestId: number): Promise<SelectionEvidence | null> => {
    if (!Number.isSafeInteger(guestId) || guestId <= 0) throw new Error('invalid target-app Preview guest')
    const guest = webContents.fromId(guestId)
    if (!guest || guest.isDestroyed() || guest.getType() !== 'webview' || guest.hostWebContents?.id !== event.sender.id) {
      throw new Error('the target-app Preview guest is unavailable or does not belong to this window')
    }
    const target = new URL(guest.getURL())
    if (!['http:', 'https:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
      throw new Error('element selection is limited to the configured local application Preview')
    }
    if (!guest.debugger.isAttached()) guest.debugger.attach('1.3')
    try {
      await guest.debugger.sendCommand('Runtime.evaluate', {
        expression: DESKTOP_PREVIEW_PICKER_JS,
        returnByValue: true,
        userGesture: true,
      })
      const deadline = Date.now() + 5 * 60 * 1000
      let value: unknown
      for (;;) {
        if (guest.isDestroyed()) throw new Error('the target-app Preview closed during element selection')
        const evaluated = await guest.debugger.sendCommand('Runtime.evaluate', {
          expression: DESKTOP_PREVIEW_PICKER_RESULT_JS,
          returnByValue: true,
        }) as { result?: { value?: unknown } }
        const state = evaluated.result?.value as { done?: unknown; value?: unknown } | undefined
        if (state?.done === true) {
          value = state.value
          break
        }
        if (Date.now() >= deadline) throw new Error('element selection timed out; try again')
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (value === null || value === undefined) return null
      if (!value || typeof value !== 'object') throw new Error('the target-app Preview returned invalid selection evidence')
      return value as SelectionEvidence
    } finally {
      if (!guest.isDestroyed()) {
        await guest.debugger.sendCommand('Runtime.evaluate', {
          expression: DESKTOP_PREVIEW_PICKER_CANCEL_JS,
          returnByValue: true,
        }).catch(() => undefined)
      }
    }
  })

  ipcMain.handle(BRIDGE_CHANNELS.openExternal, async (_e, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('only http(s) URLs may be opened')
    }
    await shell.openExternal(url)
  })

  ipcMain.handle(BRIDGE_CHANNELS.openPath, async (_e, target: string) => {
    if (!path.isAbsolute(target) || !fs.existsSync(target)) throw new Error('file does not exist')
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  })

  ipcMain.handle(BRIDGE_CHANNELS.showInFolder, async (_e, target: string) => {
    if (!fs.existsSync(target)) throw new Error('path does not exist')
    shell.showItemInFolder(target)
  })

  registerCapabilityIpcHandlers(workspace, workspaceRoot)

  return workspace
}
