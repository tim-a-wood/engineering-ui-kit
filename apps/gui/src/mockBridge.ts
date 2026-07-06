/**
 * In-memory bridge used when the renderer runs outside Electron (browser dev
 * and qualitative UI validation). Behavior mirrors the real IPC handlers
 * closely enough to exercise every view state, including warning and blocked
 * overlay verdicts.
 */

import type {
  AppliedFiles,
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  Settings,
  VerificationResult,
} from '@engineering-ui-kit/core'
import type { BuildPacketResult, EuikBridge, PrepareContextResult, TaskPacketFields } from './bridge'

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

  const seed = (name: string, repoPath: string, description: string, daysAgo: number, status: Project['status'] = 'active') => {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    const at = new Date(Date.now() - daysAgo * 864e5).toISOString()
    projects.set(id, {
      id, name, description, repoPath, status,
      verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
      settingsSchemaVersion: '1', createdAt: at, updatedAt: at,
    })
  }
  seed('sample-analytics-app', 'C:\\work\\sample-analytics-app', 'Real-time metrics and analytics dashboard', 2)
  seed('sample-design-system', 'C:\\work\\sample-design-system', 'Shared UI components and style guide', 5)
  seed('sample-integrations', 'C:\\work\\sample-integrations', 'Manage third-party integrations', 8, 'archived')

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
          { file: 'task-packet.md', bytes: 45_000, sha256: 'b'.repeat(64) },
          { file: 'standard-pack.md', bytes: 28_000, sha256: 'c'.repeat(64) },
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
      await this.updateRun(runId, { reviewEvidencePackPath: '/mock/review-packet.md', uploadSetType: 'follow-up-text' })
      return {
        reviewPacketPath: '/mock/review-packet.md',
        reviewPacketText: `# Copilot Review Packet\n\n- runId: \`${runId}\`\n\n## Reviewer Feedback\n\n${mockFeedback.map((f) => f.text).join('\n\n') || '_No manual feedback captured yet._'}\n`,
      }
    },
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
    async openExternal() { /* no-op in mock */ },
    async showInFolder() { /* no-op in mock */ },
  }
}
