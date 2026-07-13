/**
 * In-memory bridge used when the renderer runs outside Electron (browser dev
 * and qualitative UI validation). Behavior mirrors the real IPC handlers
 * closely enough to exercise every view state, including warning and blocked
 * overlay verdicts.
 */

import type {
  AppliedFiles,
  EvidenceCapture,
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  Settings,
  VerificationResult,
} from '@engineering-ui-kit/core'
import type { BuildPacketResult, EuikBridge, PrepareContextResult, RunEvidence, TaskPacketFields } from './bridge'

/* 4x3 placeholder PNGs (blue-ish before, teal-ish after) for evidence mocks. */
const MOCK_BEFORE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgF9cCAACJAFEcS6mRAAAAAElFTkSuQmCC'
const MOCK_AFTER_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgndIBAAHbASoDVGnEAAAAAElFTkSuQmCC'

const DEFAULT_SETTINGS: Settings = {
  defaultProjectFolder: '/workspace/projects',
  defaultOutputFolder: '/workspace/output',
  maxCopilotUploads: 3,
  preferredTemplate: 'Standard Web App',
  includeScreenshotsByDefault: true,
  includeBuildTestResultsByDefault: true,
  requireManualReviewBeforeApply: true,
  confirmOverwriteExistingFiles: true,
  warnOnDirtyRepo: true,
  warnWhenOverlayChangesMoreThanFiles: 10,
  defaultCommandTimeoutMinutes: 10,
}

export function installMockBridge(): EuikBridge {
  let settings = { ...DEFAULT_SETTINGS }
  const now = () => new Date().toISOString()
  const projects = new Map<string, Project>()
  const runs = new Map<string, HandoffRun>()
  let lastPacketFields: TaskPacketFields | null = null
  const mockFeedback: { at: string; text: string }[] = []

  const evidenceCaptured = new Map<string, { before?: string; after?: string }>()

  const seed = (name: string, repoPath: string, description: string, daysAgo: number, status: Project['status'] = 'active') => {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    const at = new Date(Date.now() - daysAgo * 864e5).toISOString()
    projects.set(id, {
      id, name, description, repoPath, status,
      verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
      launchUrl: 'http://localhost:5173',
      evidenceViews: [
        { id: 'home', label: 'Dashboard', path: '/' },
        { id: 'settings', label: 'Settings', path: '/settings' },
      ],
      settingsSchemaVersion: '1', createdAt: at, updatedAt: at,
    })
  }
  seed('sample-analytics-app', 'C:\\work\\sample-analytics-app', 'Real-time metrics and analytics dashboard', 2)
  seed('sample-design-system', 'C:\\work\\sample-design-system', 'Shared UI components and style guide', 5)
  seed('sample-integrations', 'C:\\work\\sample-integrations', 'Manage third-party integrations', 8, 'archived')
  // Built-in sample, mirroring the real bridge's seeded PlantOps project.
  projects.set('plantops-sample', {
    id: 'plantops-sample',
    name: 'PlantOps (sample)',
    description: 'Built-in sample: a multi-page legacy work-order app to explore the whole workflow against.',
    repoPath: 'examples/work-orders-monolith',
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
    settingsSchemaVersion: '1',
    createdAt: new Date(Date.now() - 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 864e5).toISOString(),
  })

  let counter = 0
  const newId = (prefix: string) => `${prefix}-${++counter}`

  return {
    async appVersion() { return '0.1.0 (mock)' },
    async getSettings() { return { ...settings } },
    async saveSettings(next) { settings = { ...next } },
    async listProjects() { return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name)) },
    async createProject(input) {
      if (!input.name.trim()) throw new Error('project name is required')
      if (!input.repoPath.trim()) throw new Error('repository path does not exist')
      const project: Project = {
        id: newId('project'), name: input.name.trim(), repoPath: input.repoPath, status: 'active',
        launchUrl: 'http://127.0.0.1:4180', launchCommand: 'npm run build && npm start',
        ...(input.description ? { description: input.description } : {}),
        verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
        settingsSchemaVersion: '1', createdAt: now(), updatedAt: now(),
      }
      projects.set(project.id, project)
      return project
    },
    async updateProject(projectId, patch) {
      const existing = projects.get(projectId)
      if (!existing) throw new Error(`project not found: ${projectId}`)
      const updated = { ...existing, ...patch, id: existing.id, updatedAt: now() }
      projects.set(projectId, updated)
      return updated
    },
    async listRuns(projectId) {
      return [...runs.values()].filter((r) => !projectId || r.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async createRun(projectId) {
      const run: HandoffRun = { id: newId('run'), projectId, currentStep: 'prepare-context', createdAt: now(), updatedAt: now() }
      runs.set(run.id, run)
      return run
    },
    async getRun(runId) { return runs.get(runId) },
    async updateRun(runId, patch) {
      const existing = runs.get(runId)
      if (!existing) throw new Error(`run not found: ${runId}`)
      const updated = { ...existing, ...patch, id: existing.id, updatedAt: now() }
      runs.set(runId, updated)
      return updated
    },
    async pickDirectory() { return 'C:\\work\\picked-repo' },
    async pickZipFile() { return 'C:\\work\\Downloads\\ui-overlay.zip' },
    async addReferenceFile() { return { path: '/tmp/reference-example.pdf', name: 'example.pdf' } },
    getDroppedFilePath(file) { return file.name },
    async prepareContext(runId): Promise<PrepareContextResult> {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      await this.updateRun(runId, { currentStep: 'create-task-packet', repoFlatfilePath: '/mock/repo-flatfile.txt' })
      return {
        inventory: {
          projectId: run.projectId, repoPath: projects.get(run.projectId)?.repoPath ?? '', generatedAt: now(),
          detectedFrameworks: ['react', 'vite', 'typescript'], detectedPackageManager: 'npm',
          packageScripts: { dev: 'vite', build: 'tsc -b && vite build', typecheck: 'tsc -b --pretty false' },
          includedFiles: ['index.html', 'package.json', 'src/App.tsx', 'src/styles.css', 'src/main.tsx'],
          excludedPaths: [
            { path: 'node_modules/**', reason: "directory 'node_modules' is excluded (dependencies)" },
            { path: 'dist/**', reason: "directory 'dist' is excluded (build output)" },
            { path: '.env', reason: 'likely environment file' },
          ],
          contextWarnings: ['src/config.ts: possible assigned secret-like literal matched pattern review'],
          sourceFileCount: 42, includedFileCount: 11, excludedFileCount: 31,
        },
        flatfilePath: '/mock/repo-flatfile.txt',
        flatfileBytes: 2_460_000,
        warnings: ['src/config.ts: possible assigned secret-like literal matched pattern review'],
      }
    },
    async buildPacket(runId, fields: TaskPacketFields): Promise<BuildPacketResult> {
      for (const [key, value] of Object.entries(fields)) {
        if (!String(value ?? '').trim()) throw new Error(`required packet field is empty: ${key}`)
      }
      await this.updateRun(runId, {
        currentStep: 'run-in-copilot',
        taskTitle: fields.taskTitle,
        taskPacketPath: '/mock/task-packet.md',
        standardPackPath: '/mock/standard-pack.md',
        taskAndStandardPackPath: '/mock/task-and-standard-pack.md',
        uploadSetType: 'text-only',
      })
      lastPacketFields = { ...fields }
      return {
        taskPacketPath: '/mock/task-packet.md',
        standardPackPath: '/mock/standard-pack.md',
        runDir: '/mock',
        packBytes: 73_000,
        uploadFiles: [
          { file: 'repo-flatfile.txt', bytes: 2_460_000, sha256: 'a'.repeat(64) },
          { file: 'task-and-standard-pack.md', bytes: 73_000, sha256: 'b'.repeat(64) },
        ],
        recommendedPrompt: `You are implementing a focused UI transformation.\n\nTask goal:\n\n${fields.goal}\n\nReturn only ui-overlay.zip containing changed and new files.`,
      }
    },
    async getArtifactText(_runId, fileName): Promise<string> {
      if (fileName === 'task-packet.md') {
        return [
          '# Task Packet', '',
          `- task: ${lastPacketFields?.taskTitle ?? 'Sample task'}`,
          '- expectedOutput: `ui-overlay.zip`', '',
          '## Goal', '', lastPacketFields?.goal ?? 'Sample goal.', '',
          '## Scope', '', ...(lastPacketFields?.scope ?? 'Sample scope.').split('\n').map((s) => `- ${s}`), '',
          '## Constraints', '', ...(lastPacketFields?.constraints ?? 'Sample constraint.').split('\n').map((s) => `- ${s}`), '',
          '## Acceptance Criteria', '', ...(lastPacketFields?.acceptanceCriteria ?? 'Builds.').split('\n').map((s, i) => `${i + 1}. ${s}`), '',
          '## References', '', ...(lastPacketFields?.references ?? 'Mockups.').split('\n').map((s) => `- ${s}`), '',
        ].join('\n')
      }
      return `# ${fileName}\n\nMock artifact content.`
    },
    async saveFeedback(runId, text) {
      if (!text.trim()) throw new Error('feedback text is empty')
      mockFeedback.push({ at: now(), text: text.trim() })
      return this.updateRun(runId, { userReviewNotesPath: '/mock/user-review-notes.md' })
    },
    async buildReviewPacket(runId) {
      const captured = evidenceCaptured.get(runId)
      const visual = Boolean(captured?.before || captured?.after)
      await this.updateRun(runId, {
        reviewEvidencePackPath: '/mock/review-packet.md',
        uploadSetType: visual ? 'follow-up-visual' : 'follow-up-text',
      })
      return {
        reviewPacketPath: '/mock/review-packet.md',
        reviewPacketText: `# Copilot Review Packet\n\n- runId: \`${runId}\`\n\n## Reviewer Feedback\n\n${mockFeedback.map((f) => f.text).join('\n\n') || '_No manual feedback captured yet._'}\n`,
        ...(visual ? { contactSheetPath: '/mock/review-evidence.pdf' } : {}),
        changesZipPath: '/mock/changes.zip',
        uploadFiles: visual
          ? ['/mock/review-packet.md', '/mock/review-evidence.pdf', '/mock/changes.zip']
          : ['/mock/review-packet.md', '/mock/changes.zip'],
      }
    },
    async captureEvidence(runId, phase): Promise<EvidenceCapture> {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      const project = projects.get(run.projectId)
      const views = project?.evidenceViews ?? []
      if (views.length === 0) throw new Error('no target views configured; add evidence views in the project settings first')
      const record = evidenceCaptured.get(runId) ?? {}
      record[phase] = now()
      evidenceCaptured.set(runId, record)
      return {
        runId, phase, capturedAt: now(), baseUrl: project?.launchUrl ?? 'http://localhost:5173',
        viewport: { width: 1440, height: 960 },
        views: views.map((v) => ({
          viewId: v.id, label: v.label, path: v.path,
          screenshotFile: `${v.id}.png`,
          census: phase === 'before' ? { svg: 4, img: 1, button: 6, input: 2 } : { svg: 0, img: 1, button: 6, input: 2 },
          ok: true,
        })),
        ok: true,
      }
    },
    async getEvidence(runId): Promise<RunEvidence> {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      const project = projects.get(run.projectId)
      const captured = evidenceCaptured.get(runId) ?? {}
      const views = (project?.evidenceViews ?? []).map((v, index) => ({
        viewId: v.id, label: v.label, path: v.path,
        ...(captured.before ? { beforeShot: MOCK_BEFORE_PNG } : {}),
        ...(captured.after ? { afterShot: MOCK_AFTER_PNG } : {}),
        // First view demonstrates the loss badge once both phases exist.
        losses: captured.before && captured.after && index === 0 ? [{ element: 'svg', before: 4, after: 0 }] : [],
      }))
      return {
        ...(captured.before ? { before: { capturedAt: captured.before, ok: true } } : {}),
        ...(captured.after ? { after: { capturedAt: captured.after, ok: true } } : {}),
        views,
      }
    },
    async captureProjectThumbnail() { return undefined },
    async inspectOverlay(runId, zipPath): Promise<OverlayInspectionSummary> {
      const blocked = zipPath.toLowerCase().includes('blocked')
      const summary: OverlayInspectionSummary = {
        runId, zipFilename: zipPath.split(/[\\/]/).pop() ?? 'ui-overlay.zip', inspectedAt: now(),
        normalizedEntries: [
          { originalPath: 'src/App.tsx', normalizedRelativePath: 'src/App.tsx', targetPath: 'src/App.tsx', sizeBytes: 14272, isDirectory: false },
          { originalPath: 'src/styles.css', normalizedRelativePath: 'src/styles.css', targetPath: 'src/styles.css', sizeBytes: 17489, isDirectory: false },
          { originalPath: 'src/tokens.css', normalizedRelativePath: 'src/tokens.css', targetPath: 'src/tokens.css', sizeBytes: 2487, isDirectory: false },
        ],
        hardBlockers: blocked ? [{ ruleId: 'AI-HANDOFF-035', path: '.git/config', message: 'git metadata entry' }] : [],
        warnings: [
          { ruleId: 'AI-HANDOFF-040', path: 'src/App.tsx', message: 'overwrites existing source file' },
          { ruleId: 'AI-HANDOFF-040', path: 'src/styles.css', message: 'overwrites existing source file' },
        ],
        canApply: !blocked,
      }
      await this.updateRun(runId, { currentStep: 'apply-zip-overlay', overlayZipPath: zipPath })
      return summary
    },
    async applyOverlay(runId, acceptWarnings): Promise<AppliedFiles> {
      if (!acceptWarnings) throw new Error('refusing to apply: warnings present and not explicitly accepted')
      await this.updateRun(runId, { currentStep: 'verify-review' })
      return {
        runId, appliedAt: now(),
        files: [
          { relativePath: 'src/App.tsx', action: 'overwritten', sizeBytes: 14272 },
          { relativePath: 'src/styles.css', action: 'overwritten', sizeBytes: 17489 },
          { relativePath: 'src/tokens.css', action: 'created', sizeBytes: 2487 },
        ],
      }
    },
    async runVerification(runId, labels): Promise<VerificationResult[]> {
      return labels.map((label) => ({
        runId, commandLabel: label, commandText: `npm run ${label}`, workingDirectory: '/mock',
        startedAt: now(), endedAt: now(), exitCode: 0, status: 'passed' as const, wasCancelledByUser: false,
      }))
    },
    async installDependencies(runId): Promise<VerificationResult> {
      return {
        runId, commandLabel: 'install-dependencies', commandText: 'npm install', workingDirectory: '/mock',
        startedAt: now(), endedAt: now(), exitCode: 0, status: 'passed', wasCancelledByUser: false,
      }
    },
    async startUploadDrag() { /* native drag needs Electron; no-op in mock */ },
    async launchApp(projectId, _options) {
      const project = projects.get(projectId)
      if (!project?.launchUrl) throw new Error('no launch URL configured for this project')
      return { url: project.launchUrl, started: false, rebuilt: false }
    },
    async copyUploadSet(runId) {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      if (!run.repoFlatfilePath) throw new Error('no upload files for this run yet — prepare context and build the task packet first')
      return { files: 2 }
    },
    async openExternal() { /* no-op in mock */ },
    async openPath() { /* no-op in mock */ },
    async showInFolder() { /* no-op in mock */ },
  }
}
