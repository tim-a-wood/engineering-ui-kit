/**
 * In-memory bridge used when the renderer runs outside Electron (browser dev
 * and qualitative UI validation). Behavior mirrors the real IPC handlers
 * closely enough to exercise every view state, including warning and blocked
 * overlay verdicts.
 */

import type {
  ApplicationSpecification,
  AppliedFiles,
  ArchitectureSpecification,
  AttentionItem,
  DeployableKind,
  EvidenceCapture,
  FoundationPlan,
  FreshnessRecord,
  FrontendBinding,
  HandoffRun,
  InboundBinding,
  ModuleManifest,
  ModuleInterviewResponse,
  OverlayInspectionSummary,
  Project,
  Settings,
  VerificationResult,
  CapabilityIntegrationState,
  GenerationApplyRecord,
  GenerationPlan,
  ConnectionVerificationRecord,
} from '@engineering-ui-kit/core'
import {
  buildNeedsAttention,
  calculateFreshness,
  deltaQueueState,
  assertTargetExportable,
  evaluateBindingApprovalGate,
  proposeFoundation,
  runModuleVerification,
} from '@engineering-ui-kit/core/browser'
import type { BuildPacketResult, CapabilityDeployableSummary, InboundBindingReadRecord, EuikBridge, PrepareContextResult, RunEvidence, TaskPacketFields } from './bridge'
import { validateInboundBindingDraft } from './views/capabilities/inbound/inboundBinding'

type CapProjectState = {
  initializedAt: string
  applicationDraft?: ApplicationSpecification
  applicationApproved?: ApplicationSpecification
  architectureDraft?: ArchitectureSpecification
  architectureApproved?: ArchitectureSpecification
  moduleDrafts: Map<string, ModuleManifest>
  moduleApproved: Map<string, ModuleManifest>
  moduleInterviewDrafts: Map<string, ModuleInterviewResponse>
  moduleInterviewApproved: Map<string, ModuleInterviewResponse>
  bindingDrafts: Map<string, FrontendBinding>
  bindingApproved: Map<string, FrontendBinding>
  freshness: Map<string, FreshnessRecord>
  /** CAP-ERA-001 §5.1/§12.4 — deployables this mock synthesizes for Connect (WP5B/WP7 own real generation-time deployables). */
  deployables: Map<string, CapabilityDeployableSummary>
  inboundBindingDrafts: Map<string, InboundBinding>
  inboundBindingApproved: Map<string, InboundBinding>
  /** WP5A — the project's single foundation-planning draft/approved record (CAP-TEST-074/075). */
  foundationDraft?: FoundationPlan
  foundationApproved?: FoundationPlan
  generationPlans: Map<string, GenerationPlan>
  generationApplies: Map<string, GenerationApplyRecord>
  connectionVerifications: Map<string, ConnectionVerificationRecord>
}

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
  const capByProject = new Map<string, CapProjectState>()

  function ensureCap(projectId: string): CapProjectState {
    let state = capByProject.get(projectId)
    if (!state) {
      state = {
        initializedAt: now(),
        moduleDrafts: new Map(),
        moduleApproved: new Map(),
        moduleInterviewDrafts: new Map(),
        moduleInterviewApproved: new Map(),
        bindingDrafts: new Map(),
        bindingApproved: new Map(),
        freshness: new Map(),
        deployables: new Map(),
        inboundBindingDrafts: new Map(),
        inboundBindingApproved: new Map(),
        generationPlans: new Map(),
        generationApplies: new Map(),
        connectionVerifications: new Map(),
      }
      capByProject.set(projectId, state)
    }
    return state
  }

  /**
   * Synthesizes this project's deployables (CAP-ERA-001 §5.1) on first access.
   * The mock has no persisted `DeployableSpecification` generation pipeline
   * (that is WP5B/WP7 real-IPC scope) — it derives a defensible minimal set:
   * a `browser` UI deployable when the project has a configured application UI
   * or an approved `experience`-type module, plus always one headless deployable
   * so every project has at least one entry point that requires connecting.
   */
  function ensureDeployables(projectId: string): Map<string, CapabilityDeployableSummary> {
    const state = ensureCap(projectId)
    if (state.deployables.size > 0) return state.deployables
    const project = projects.get(projectId)
    const hasExperienceModule = [...state.moduleApproved.values()].some((m) => m.moduleType === 'experience')
    const hasUi = Boolean(project?.launchUrl) || hasExperienceModule
    if (hasUi) {
      state.deployables.set('deployable.ui', { deployableId: 'deployable.ui', kind: 'browser' as DeployableKind, name: 'Application UI' })
    }
    state.deployables.set('deployable.main', { deployableId: 'deployable.main', kind: 'http-api' as DeployableKind, name: 'Application' })
    return state.deployables
  }

  function listNeedsAttentionFor(projectId: string): AttentionItem[] {
    const state = ensureCap(projectId)
    const arch = state.architectureApproved ?? state.architectureDraft
    const moduleIds =
      arch?.moduleIds?.length
        ? arch.moduleIds
        : [...new Set([...state.moduleDrafts.keys(), ...state.moduleApproved.keys()])].sort((a, b) =>
            a.localeCompare(b),
          )
    const freshness: FreshnessRecord[] = moduleIds.map((moduleId) => {
      const existing = state.freshness.get(moduleId)
      if (existing) return existing
      const approved = state.moduleApproved.get(moduleId)
      return calculateFreshness({
        moduleId,
        moduleVersion: approved?.moduleVersion ?? '0.0.0',
        specificationHash: approved ? `spec:${approved.moduleId}@${approved.moduleVersion}` : 'pending',
        implementationHash: 'pending',
        architectureHash: arch?.contentHash ?? 'pending',
        dependencyHash: 'pending',
        adapterHash: 'pending',
        bindingHash: 'pending',
        verificationSuiteHash: 'pending',
        verification: null,
      })
    })
    return buildNeedsAttention(freshness, {
      schemaVersion: '1.0',
      changeId: `attention-${projectId}`,
      initiatingRecordId: arch?.id ?? projectId,
      initiatingRevision: arch?.revision ?? '0',
      classification: 'required-additive',
      affectedModules: [],
      unaffectedModules: [],
      proposedPacketOrder: moduleIds,
      recalculationEvidence: [],
    })
  }

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
    async getPreviewPreloadUrl() { return '' },
    async copyUploadSet(runId) {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      if (!run.repoFlatfilePath) throw new Error('no upload files for this run yet — prepare context and build the task packet first')
      return { files: 2 }
    },
    async openExternal() { /* no-op in mock */ },
    async openPath() { /* no-op in mock */ },
    async showInFolder() { /* no-op in mock */ },
    async capabilitiesEnsureInitialized(projectId) {
      const state = ensureCap(projectId)
      return { schemaVersion: '1.0', initializedAt: state.initializedAt }
    },
    async capabilitiesGetApplication(projectId) {
      const state = ensureCap(projectId)
      return { draft: state.applicationDraft, approved: state.applicationApproved }
    },
    async capabilitiesSaveApplicationDraft(projectId, draft) {
      ensureCap(projectId).applicationDraft = draft as ApplicationSpecification
      return { ok: true as const }
    },
    async capabilitiesApproveApplication(projectId, draft) {
      const state = ensureCap(projectId)
      const approved = draft as ApplicationSpecification
      state.applicationApproved = approved
      state.applicationDraft = undefined
      return { ok: true, approved, gate: { gateId: 'CAP-GATE-001', passed: true, diagnostics: [] } }
    },
    async capabilitiesEvaluateProductGate() {
      return { gateId: 'CAP-GATE-001', passed: true, diagnostics: [] }
    },
    async capabilitiesBuildInterviewPacket(input) {
      return input
    },
    async capabilitiesExportInterviewPacket(input) {
      const packet = input as { packetId?: string }
      const runId = `cap-interview-${Date.now()}`
      const files = ['capability-interview-handoff.md']
        .map((name) => ({ path: `/mock/${runId}/${name}`, bytes: 100, sha256: `mock-${name}` }))
      return { runId, packetId: packet.packetId ?? 'packet', recommendedPrompt: 'Conduct the bounded interview.', files, uploadFiles: files.map((f) => f.path) }
    },
    async capabilitiesExportImplementationPacket(input) {
      const runId = `cap-implementation-${Date.now()}`
      const files = ['capability-implementation-handoff.md']
        .map((name) => ({ path: `/mock/${runId}/${name}`, bytes: 100, sha256: `mock-${name}` }))
      return {
        runId,
        packetId: `pkt-${input.moduleId}`,
        recommendedPrompt: `Implement production source code and tests for ${input.moduleId}.`,
        files,
        uploadFiles: files.map((f) => f.path),
        readiness: { status: 'ready' as const, issues: [] },
      }
    },
    async capabilitiesStartHandoffDrag() { return { files: 1 } },
    async capabilitiesImportInterviewResponse(projectId, raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const draft = (parsed as { draft?: ApplicationSpecification }).draft ?? (parsed as ApplicationSpecification)
      ensureCap(projectId).applicationDraft = draft
      return {
        draft,
        diagnostics: [],
        gate: { gateId: 'CAP-GATE-001', passed: true, diagnostics: [] },
        delta: [],
        valid: true,
        approvedUnchanged: ensureCap(projectId).applicationApproved,
      }
    },
    async capabilitiesGetArchitecture(projectId) {
      const state = ensureCap(projectId)
      return { draft: state.architectureDraft, approved: state.architectureApproved }
    },
    async capabilitiesSaveArchitectureDraft(projectId, draft) {
      ensureCap(projectId).architectureDraft = draft as ArchitectureSpecification
      return { ok: true as const }
    },
    async capabilitiesApproveArchitecture(projectId, draft) {
      const state = ensureCap(projectId)
      const approved = { ...(draft as ArchitectureSpecification), status: 'approved' as const }
      state.architectureApproved = approved
      state.architectureDraft = undefined
      return { ok: true, approved, gate: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] } }
    },
    async capabilitiesProposeFoundation(input) {
      const state = ensureCap(input.projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('architecture must be approved before proposing a foundation')
      return proposeFoundation({ architecture, answers: input.answers })
    },
    async capabilitiesGetFoundation(projectId) {
      const state = ensureCap(projectId)
      return { draft: state.foundationDraft, approved: state.foundationApproved }
    },
    async capabilitiesSaveFoundationDraft(projectId, plan) {
      ensureCap(projectId).foundationDraft = plan
      return { ok: true as const }
    },
    async capabilitiesApproveFoundation(projectId, plan) {
      if (plan.readiness.status !== 'ready') {
        return { ok: false, reason: `cannot approve a foundation plan with readiness status "${plan.readiness.status}"` }
      }
      const state = ensureCap(projectId)
      state.foundationApproved = plan
      state.foundationDraft = undefined
      return { ok: true, approved: plan }
    },
    async capabilitiesGetIntegrationState(projectId) {
      const state = ensureCap(projectId)
      const deployables = [...ensureDeployables(projectId).values()].map((deployable) => {
        const currentPlan = state.generationPlans.get(deployable.deployableId)
        const latestApply = state.generationApplies.get(deployable.deployableId)
        return {
          deployableId: deployable.deployableId,
          status: latestApply?.status ?? (currentPlan ? (currentPlan.blockers.length ? 'blocked' : 'plan-ready') : 'ready-to-generate'),
          attention: currentPlan ? [] : ['Generate and review the reference-architecture plan.'],
          currentPlan,
          latestApply,
          connectionVerifications: [...state.connectionVerifications.values()].filter((record) => record.deployableId === deployable.deployableId),
          currentConnectionVerificationIds: [],
        }
      }) satisfies CapabilityIntegrationState['deployables']
      return { schemaVersion: '1.0', projectId, deployables, updatedAt: now() }
    },
    async capabilitiesPreviewGeneration(input) {
      const state = ensureCap(input.projectId)
      const plan: GenerationPlan = {
        schemaVersion: '1.0', planId: `mock-plan-${input.deployableId}`, projectId: input.projectId,
        inputRecords: [], generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0',
        targetRepository: { root: '.', cleanState: 'clean' }, dependencyChanges: [], fileChanges: [], commands: [],
        warnings: [], blockers: ['Browser mock cannot produce filesystem-backed generation artifacts. Open the desktop app.'],
        ambiguityQuestions: [], rollbackStrategy: 'staged-rename-with-journal', planHash: `mock-${input.deployableId}`,
      }
      state.generationPlans.set(input.deployableId, plan)
      return { plan, status: 'blocked' as const }
    },
    async capabilitiesApplyGeneration(input) {
      if (!input.explicit) throw new Error('generation apply requires explicit user action')
      const state = ensureCap(input.projectId)
      const plan = state.generationPlans.get(input.deployableId)
      if (!plan || plan.planId !== input.planId || plan.planHash !== input.planHash) throw new Error('generation plan mismatch')
      if (plan.blockers.length) throw new Error(`generation apply refused: ${plan.blockers.join(' ')}`)
      const record: GenerationApplyRecord = {
        schemaVersion: '1.0', projectId: input.projectId, deployableId: input.deployableId,
        planId: plan.planId, planHash: plan.planHash, applyRunId: `mock-apply-${input.deployableId}`,
        status: 'applied', rollbackId: `mock-apply-${input.deployableId}`,
        ownershipManifests: [], commands: [], startedAt: now(), completedAt: now(),
      }
      state.generationApplies.set(input.deployableId, record)
      return record
    },
    async capabilitiesRollbackGeneration(input) {
      if (!input.explicit) throw new Error('generation rollback requires explicit user action')
      const state = ensureCap(input.projectId)
      const current = state.generationApplies.get(input.deployableId)
      if (!current || current.rollbackId !== input.rollbackId) throw new Error('rollback mismatch')
      const record: GenerationApplyRecord = { ...current, status: 'rolled-back', ownershipManifests: [], completedAt: now() }
      state.generationApplies.set(input.deployableId, record)
      return record
    },
    async capabilitiesRunConnectionVerification() {
      throw new Error('Real connection verification requires the desktop app so it can launch and clean up the generated target.')
    },
    async capabilitiesListConnectionVerifications(input) {
      return [...ensureCap(input.projectId).connectionVerifications.values()]
        .filter((record) => !input.deployableId || record.deployableId === input.deployableId)
    },
    async capabilitiesSaveCompositionConfiguration() {
      throw new Error('Composition configuration is persisted by the desktop app against the real project workspace.')
    },
    async capabilitiesRunIntegrationCommands() {
      throw new Error('Install, build, and test commands require the desktop app and a real project repository.')
    },
    async capabilitiesSaveModuleDraft(projectId, draft, interviewResponse) {
      const manifest = draft as ModuleManifest
      const state = ensureCap(projectId)
      state.moduleDrafts.set(manifest.moduleId, manifest)
      if (interviewResponse) state.moduleInterviewDrafts.set(manifest.moduleId, interviewResponse as ModuleInterviewResponse)
      return { ok: true as const }
    },
    async capabilitiesApproveModule(projectId, draft, interviewResponse) {
      const state = ensureCap(projectId)
      const approved = draft as ModuleManifest
      state.moduleApproved.set(approved.moduleId, approved)
      const approvedInterview = interviewResponse as ModuleInterviewResponse | undefined
        ?? state.moduleInterviewDrafts.get(approved.moduleId)
      if (approvedInterview) state.moduleInterviewApproved.set(approved.moduleId, approvedInterview)
      state.moduleDrafts.delete(approved.moduleId)
      return { ok: true, approved, gate: { gateId: 'CAP-GATE-003', passed: true, diagnostics: [] } }
    },
    async capabilitiesListModules(projectId) {
      const state = ensureCap(projectId)
      const architecture = state.architectureApproved ?? state.architectureDraft
      const moduleIds = [...new Set([
        ...(architecture?.moduleIds ?? []),
        ...state.moduleDrafts.keys(),
        ...state.moduleApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return moduleIds.map((moduleId) => ({
        moduleId,
        draft: state.moduleDrafts.get(moduleId),
        approved: state.moduleApproved.get(moduleId),
        freshness: state.freshness.get(moduleId),
      }))
    },
    async capabilitiesListBindings(projectId) {
      const state = ensureCap(projectId)
      const bindingIds = [...new Set([
        ...state.bindingDrafts.keys(),
        ...state.bindingApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return bindingIds.map((bindingId) => ({
        bindingId,
        draft: state.bindingDrafts.get(bindingId),
        approved: state.bindingApproved.get(bindingId),
      }))
    },
    async capabilitiesListRuns() {
      return []
    },
    async capabilitiesCreateRun(run) {
      const record = run as { runId?: string }
      return { ...(run as object), runId: record.runId ?? `run-${Date.now()}`, createdAt: now() }
    },
    async capabilitiesInspectOverlay() {
      return {
        runId: 'mock',
        zipFilename: 'ui-overlay.zip',
        inspectedAt: now(),
        normalizedEntries: [],
        hardBlockers: [],
        warnings: [],
        canApply: false,
      }
    },
    async capabilitiesApplyOverlay(input) {
      if (!input.explicit) throw new Error('capability overlay apply requires explicit user action')
      return { runId: input.runId, appliedAt: now(), files: [] }
    },
    async capabilitiesCalculateFreshness(input) {
      return calculateFreshness(input as Parameters<typeof calculateFreshness>[0])
    },
    async capabilitiesFilesystemRead() {
      return { outcome: 'success', value: { text: '' } }
    },
    async capabilitiesFilesystemWrite(input) {
      if (!input.explicit) throw new Error('filesystem write requires explicit user action')
      return { outcome: 'success', value: { relativePath: input.relativePath, bytes: input.text.length } }
    },
    async capabilitiesSecretPut(input) {
      if (!input.explicit) throw new Error('secret write requires explicit user action')
      return { outcome: 'success', value: { opaqueId: input.opaqueId, label: input.label, stored: true } }
    },
    async capabilitiesMatlabSessionStatus(projectId) {
      return {
        schemaVersion: '1.0',
        projectId,
        sessionId: `matlab-${projectId}-stopped`,
        state: 'stopped',
        toolboxReadiness: [],
        processOwnership: 'app-owned',
      }
    },
    async capabilitiesMatlabInvoke(input) {
      if (!input.explicit) throw new Error('MATLAB operation requires explicit user action')
      return { outcome: 'success', value: { mode: 'fake-boundary' } }
    },
    async capabilitiesAzureDiscover(input) {
      if (!input.explicit) throw new Error('Azure discovery requires explicit user action')
      return {
        outcome: 'success',
        value: {
          organizations: [],
          permissionSummary: ['organization:read', 'project:read', 'work-item:read'],
          mode: 'fake-boundary',
        },
      }
    },
    async capabilitiesAzureImportWorkItem(input) {
      if (!input.explicit) throw new Error('Azure import requires explicit user action')
      return {
        outcome: 'success',
        value: {
          externalId: input.externalId,
          revision: input.revision,
          content: input.content,
          mode: 'fake-boundary',
        },
        provenance: { source: 'azure-devops', recordedAt: now() },
      }
    },
    async capabilitiesInvokeOperation(input) {
      const dataMode = input.dataMode ?? 'connected'
      if (dataMode !== 'connected') {
        return {
          outcome: 'success',
          value: { simulated: true, dataMode, operationId: input.operationId },
          provenance: { source: 'runtime-simulated', recordedAt: new Date().toISOString() },
        }
      }
      if (!input.explicit) {
        throw new Error('connected invoke requires explicit user action')
      }
      return {
        outcome: 'success',
        value: { operationId: input.operationId, dataMode: 'connected', args: input.args ?? null },
        provenance: { source: 'runtime', recordedAt: new Date().toISOString() },
      }
    },
    async capabilitiesSaveBindingDraft(projectId, draft) {
      const binding = draft as FrontendBinding
      ensureCap(projectId).bindingDrafts.set(binding.bindingId, binding)
      return { ok: true as const }
    },
    async capabilitiesApproveBinding(projectId, draft) {
      const binding = draft as FrontendBinding
      if (!binding?.selectionEvidence?.stableMarker && !binding?.selectionEvidence?.sourceTargetConfirmed) {
        return {
          ok: false,
          diagnostics: [
            {
              code: 'CAP-BIND-001',
              message: 'stable marker or explicit source-target confirmation is required',
            },
          ],
        }
      }
      const gate = evaluateBindingApprovalGate(binding)
      if (!gate.passed) {
        return { ok: false, diagnostics: gate.diagnostics }
      }
      const state = ensureCap(projectId)
      state.bindingApproved.set(binding.bindingId, binding)
      state.bindingDrafts.delete(binding.bindingId)
      return { ok: true, approved: binding }
    },
    async capabilitiesListDeployables(projectId) {
      return [...ensureDeployables(projectId).values()].sort((a, b) => a.deployableId.localeCompare(b.deployableId))
    },
    async capabilitiesListInboundBindings(projectId) {
      const state = ensureCap(projectId)
      const bindingIds = [...new Set([
        ...state.inboundBindingDrafts.keys(),
        ...state.inboundBindingApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return bindingIds.map((bindingId) => ({
        bindingId,
        draft: state.inboundBindingDrafts.get(bindingId),
        approved: state.inboundBindingApproved.get(bindingId),
      }))
    },
    async capabilitiesSaveInboundBindingDraft(projectId, draft) {
      // Missing/omitted exposure is always treated as private (§5.1) — never silently escalated.
      const binding: InboundBinding = { ...draft, exposure: draft.exposure ?? 'private' }
      ensureCap(projectId).inboundBindingDrafts.set(binding.bindingId, binding)
      return { ok: true as const }
    },
    async capabilitiesApproveInboundBinding(projectId, draft) {
      const binding: InboundBinding = { ...draft, exposure: draft.exposure ?? 'private', approvalState: 'approved' }
      const issues = validateInboundBindingDraft(binding)
      if (issues.length > 0) {
        return { ok: false, diagnostics: issues.map((message) => ({ code: 'CAP-BIND-INBOUND-001', message })) }
      }
      const state = ensureCap(projectId)
      // Multiple bindings may target the same operation — none are deduplicated (§12.4).
      state.inboundBindingApproved.set(binding.bindingId, binding)
      state.inboundBindingDrafts.delete(binding.bindingId)
      return { ok: true, approved: binding }
    },
    async capabilitiesListNeedsAttention(projectId) {
      return listNeedsAttentionFor(projectId)
    },
    async capabilitiesCalculateImpact(input) {
      const state = ensureCap(input.projectId)
      const arch = state.architectureApproved ?? state.architectureDraft
      const affected = input.changedModuleIds.map((moduleId) => ({ moduleId, reason: 'initiating-change' }))
      return {
        schemaVersion: '1.0', changeId: `impact-${Date.now()}`,
        initiatingRecordId: input.changedModuleIds[0] ?? input.projectId,
        initiatingRevision: arch?.revision ?? '0', classification: input.classification,
        affectedModules: affected,
        unaffectedModules: (arch?.moduleIds ?? []).filter((id) => !input.changedModuleIds.includes(id)).map((moduleId) => ({ moduleId, reason: 'no-dependency-path' })),
        proposedPacketOrder: input.changedModuleIds, recalculationEvidence: [],
      }
    },
    async capabilitiesApproveImpact(projectId, impact) {
      const approved = { ...impact, userApproval: { approved: true, at: now(), by: 'user' } }
      const state = ensureCap(projectId) as CapProjectState & { impacts?: Map<string, typeof approved> }
      state.impacts ??= new Map()
      state.impacts.set(approved.changeId, approved)
      return approved
    },
    async capabilitiesListImpacts(projectId) {
      const state = ensureCap(projectId) as CapProjectState & { impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord> }
      return [...(state.impacts?.values() ?? [])]
    },
    async capabilitiesRunModuleVerification(input) {
      const result = runModuleVerification(input as Parameters<typeof runModuleVerification>[0])
      const state = ensureCap(input.projectId)
      const hashes = input.inputHashes
      const freshness = calculateFreshness({
        moduleId: input.moduleId,
        moduleVersion: input.manifest?.moduleVersion ?? '1.0.0',
        specificationHash: hashes.specification ?? 'pending',
        implementationHash: hashes.implementation ?? 'pending',
        architectureHash: hashes.architecture ?? 'pending',
        dependencyHash: hashes.dependencies ?? 'pending',
        adapterHash: hashes.adapters ?? 'pending',
        bindingHash: hashes.bindings ?? 'pending',
        verificationSuiteHash: hashes.verificationSuites ?? 'pending',
        verification: result.record,
      })
      state.freshness.set(input.moduleId, freshness)
      return result
    },
    async capabilitiesVerifyApprovedModule(input) {
      if (!input.explicit) throw new Error('module verification requires explicit user action')
      const state = ensureCap(input.projectId)
      const manifest = state.moduleApproved.get(input.moduleId)
      if (!manifest) throw new Error(`approved module not found: ${input.moduleId}`)
      const hashes = {
        specification: `spec:${manifest.moduleId}@${manifest.moduleVersion}`,
        implementation: 'mock-implementation',
        architecture: state.architectureApproved?.contentHash ?? 'mock-architecture',
        dependencies: 'mock-dependencies',
        adapters: 'mock-adapters',
        bindings: 'mock-bindings',
        verificationSuites: 'mock-suites',
      }
      const result = runModuleVerification({
        verificationId: `ver-${input.moduleId}-${Date.now()}`,
        projectId: input.projectId,
        moduleId: input.moduleId,
        moduleType: manifest.moduleType,
        manifest,
        inputHashes: hashes,
        currentHashes: hashes,
        commands: [{ label: 'mock-project-check', exitCode: 0, passed: true, kind: 'technical' }],
      })
      state.freshness.set(
        input.moduleId,
        calculateFreshness({
          moduleId: input.moduleId,
          moduleVersion: manifest.moduleVersion,
          specificationHash: hashes.specification,
          implementationHash: hashes.implementation,
          architectureHash: hashes.architecture,
          dependencyHash: hashes.dependencies,
          adapterHash: hashes.adapters,
          bindingHash: hashes.bindings,
          verificationSuiteHash: hashes.verificationSuites,
          verification: result.record,
        }),
      )
      const vstate = state as CapProjectState & {
        verifications?: Map<string, import('@engineering-ui-kit/core').VerificationRecord>
      }
      vstate.verifications ??= new Map()
      vstate.verifications.set(result.record.verificationId, result.record)
      return result
    },
    async capabilitiesDeltaQueueState(input) {
      const state = ensureCap(input.projectId) as CapProjectState & {
        impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord>
        deltaProgress?: Map<string, string[]>
      }
      const impact = state.impacts?.get(input.changeId)
      if (!impact) throw new Error(`impact not found: ${input.changeId}`)
      return deltaQueueState(impact, state.deltaProgress?.get(input.changeId) ?? [])
    },
    async capabilitiesExportDeltaPacket(input) {
      const state = ensureCap(input.projectId) as CapProjectState & {
        impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord>
        deltaProgress?: Map<string, string[]>
      }
      const impact = state.impacts?.get(input.changeId)
      if (!impact) throw new Error(`impact not found: ${input.changeId}`)
      if (!impact.userApproval?.approved) {
        throw new Error('impact must be explicitly approved before delta export')
      }
      assertTargetExportable(impact, state.deltaProgress?.get(input.changeId) ?? [], input.targetId)
      const runId = `cap-delta-${input.targetId}-${Date.now()}`
      const base = `runs/${runId}/handoff`
      const files = [
        { path: `${base}/capability-delta-handoff.md`, bytes: 1152, sha256: 'mock-delta-handoff' },
      ]
      return {
        runId,
        packetId: `pkt-delta-${input.targetId}`,
        recommendedPrompt: `Apply only the delta for ${input.targetId} and return only ui-overlay.zip.`,
        files,
        uploadFiles: files.map((f) => f.path),
      }
    },
    async capabilitiesMarkDeltaTargetComplete(input) {
      if (!input.explicit) throw new Error('marking a delta target complete requires explicit user action')
      const state = ensureCap(input.projectId) as CapProjectState & {
        impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord>
        deltaProgress?: Map<string, string[]>
        verifications?: Map<string, import('@engineering-ui-kit/core').VerificationRecord>
      }
      const impact = state.impacts?.get(input.changeId)
      if (!impact) throw new Error(`impact not found: ${input.changeId}`)
      const verification = state.verifications?.get(input.verificationId)
      if (!verification) throw new Error(`verification not found: ${input.verificationId}`)
      if (verification.moduleId !== input.targetId) {
        throw new Error('verification does not match the delta target')
      }
      if (verification.outcome !== 'passed') {
        throw new Error(`cannot complete target ${input.targetId}; verification outcome is ${verification.outcome}`)
      }
      state.deltaProgress ??= new Map()
      const done = state.deltaProgress.get(input.changeId) ?? []
      if (!done.includes(input.targetId)) done.push(input.targetId)
      state.deltaProgress.set(input.changeId, done)
      return deltaQueueState(impact, done)
    },
  }
}
