/**
 * Typed IPC bridge surface shared by main, preload, and renderer.
 *
 * This is the narrow boundary required by PRD §9.4 and ARCH-STATE-006: no
 * generic filesystem access crosses it; every method is a specific workflow
 * operation whose arguments and results are serializable contracts.
 */

import type {
  AppliedFiles,
  AttentionItem,
  CapabilityModuleRecord,
  CapabilityBindingRecord,
  ElementLoss,
  EvidenceCapture,
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  RepoInventory,
  RunModuleVerificationInput,
  RunModuleVerificationResult,
  ImpactRecord,
  ImpactClassification,
  DeltaQueueState,
  Settings,
  VerificationResult,
} from '@engineering-ui-kit/core'

export type TaskPacketFields = {
  taskTitle: string
  goal: string
  scope: string
  constraints: string
  acceptanceCriteria: string
  references: string
}

export type PrepareContextResult = {
  inventory: RepoInventory
  flatfilePath: string
  flatfileBytes: number
  warnings: string[]
}

export type BuildPacketResult = {
  taskPacketPath: string
  standardPackPath: string
  runDir: string
  packBytes: number
  uploadFiles: { file: string; bytes: number; sha256: string }[]
  recommendedPrompt: string
}

export type ReviewPacketResult = {
  reviewPacketPath: string
  reviewPacketText: string
  /** Present when captured evidence allowed a visual contact sheet to render. */
  contactSheetPath?: string
  /** Present when applied files could be bundled for the reviewer. */
  changesZipPath?: string
  /** The recommended 3-file upload set (paths). */
  uploadFiles: string[]
}

export type CapabilityPacketExportResult = {
  runId: string
  packetId: string
  recommendedPrompt: string
  files: { path: string; bytes: number; sha256: string }[]
  uploadFiles: string[]
}

/** Per-view display model for the evidence panel (screenshots as data URIs). */
export type EvidenceViewDisplay = {
  viewId: string
  label: string
  path: string
  beforeShot?: string
  afterShot?: string
  losses: ElementLoss[]
  beforeError?: string
  afterError?: string
}

export type RunEvidence = {
  before?: { capturedAt: string; ok: boolean }
  after?: { capturedAt: string; ok: boolean }
  views: EvidenceViewDisplay[]
}

export type EuikBridge = {
  appVersion(): Promise<string>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  listProjects(): Promise<Project[]>
  createProject(input: { name: string; repoPath: string; description?: string }): Promise<Project>
  updateProject(projectId: string, patch: Partial<Project>): Promise<Project>

  listRuns(projectId?: string): Promise<HandoffRun[]>
  createRun(projectId: string): Promise<HandoffRun>
  getRun(runId: string): Promise<HandoffRun | undefined>
  updateRun(runId: string, patch: Partial<HandoffRun>): Promise<HandoffRun>

  pickDirectory(): Promise<string | undefined>
  pickZipFile(): Promise<string | undefined>
  addReferenceFile(runId: string, sourcePath?: string): Promise<{ path: string; name: string } | undefined>
  getDroppedFilePath(file: File): string

  prepareContext(runId: string): Promise<PrepareContextResult>
  buildPacket(runId: string, fields: TaskPacketFields): Promise<BuildPacketResult>
  getArtifactText(runId: string, fileName: string): Promise<string>
  inspectOverlay(runId: string, zipPath: string): Promise<OverlayInspectionSummary>
  applyOverlay(runId: string, acceptWarnings: boolean): Promise<AppliedFiles>
  runVerification(runId: string, labels: string[]): Promise<VerificationResult[]>
  installDependencies(runId: string): Promise<VerificationResult>
  saveFeedback(runId: string, text: string): Promise<HandoffRun>
  buildReviewPacket(runId: string): Promise<ReviewPacketResult>
  captureEvidence(runId: string, phase: 'before' | 'after'): Promise<EvidenceCapture>
  getEvidence(runId: string): Promise<RunEvidence>
  captureProjectThumbnail(projectId: string): Promise<string | undefined>
  /** Begin a native drag of the run's Copilot upload files (call from a dragstart handler). */
  startUploadDrag(runId: string): Promise<void>
  /** Put the run's Copilot upload files on the OS clipboard as real file objects. */
  copyUploadSet(runId: string): Promise<{ files: number }>
  /** Open the project's app in the browser, starting its dev server first if needed. */
  launchApp(projectId: string, options?: { open?: boolean }): Promise<{ url: string; started: boolean; rebuilt: boolean }>

  openExternal(url: string): Promise<void>
  openPath(path: string): Promise<void>
  showInFolder(path: string): Promise<void>

  /** Capabilities MVP named operations (CAP-PKT-005+). */
  capabilitiesEnsureInitialized(projectId: string): Promise<{ schemaVersion: string; initializedAt: string }>
  capabilitiesGetApplication(projectId: string): Promise<{ draft?: unknown; approved?: unknown }>
  capabilitiesSaveApplicationDraft(projectId: string, draft: unknown): Promise<{ ok: true }>
  capabilitiesApproveApplication(projectId: string, draft: unknown): Promise<{ ok: boolean; gate?: unknown; approved?: unknown }>
  capabilitiesEvaluateProductGate(spec: unknown): Promise<unknown>
  capabilitiesBuildInterviewPacket(input: unknown): Promise<unknown>
  capabilitiesExportInterviewPacket(input: unknown): Promise<CapabilityPacketExportResult>
  capabilitiesExportImplementationPacket(input: {
    projectId: string
    moduleId: string
  }): Promise<CapabilityPacketExportResult>
  capabilitiesStartHandoffDrag(input: { projectId: string; runId: string }): Promise<{ files: number }>
  capabilitiesImportInterviewResponse(
    projectId: string,
    raw: string | object,
  ): Promise<{
    draft: unknown
    diagnostics: unknown
    gate: unknown
    delta: unknown
    valid: boolean
    approvedUnchanged: unknown
  }>
  capabilitiesGetArchitecture(projectId: string): Promise<{ draft?: unknown; approved?: unknown }>
  capabilitiesSaveArchitectureDraft(projectId: string, draft: unknown): Promise<{ ok: true }>
  capabilitiesApproveArchitecture(projectId: string, draft: unknown): Promise<{ ok: boolean; gate?: unknown; approved?: unknown }>
  capabilitiesSaveModuleDraft(projectId: string, draft: unknown): Promise<{ ok: true }>
  capabilitiesApproveModule(projectId: string, draft: unknown): Promise<{ ok: boolean; gate?: unknown; approved?: unknown }>
  capabilitiesListModules(projectId: string): Promise<CapabilityModuleRecord[]>
  capabilitiesListBindings(projectId: string): Promise<CapabilityBindingRecord[]>
  capabilitiesListRuns(projectId: string): Promise<unknown[]>
  capabilitiesCreateRun(run: unknown): Promise<unknown>
  capabilitiesInspectOverlay(input: { projectId: string; runId: string; zipPath: string }): Promise<OverlayInspectionSummary>
  capabilitiesApplyOverlay(input: {
    projectId: string
    runId: string
    zipPath: string
    acceptWarnings: boolean
    explicit: boolean
  }): Promise<AppliedFiles>
  capabilitiesCalculateFreshness(input: unknown): Promise<unknown>
  capabilitiesFilesystemRead(input: { projectId: string; relativePath: string; explicit: boolean }): Promise<unknown>
  capabilitiesFilesystemWrite(input: {
    projectId: string
    relativePath: string
    text: string
    explicit: boolean
  }): Promise<unknown>
  capabilitiesSecretPut(input: {
    opaqueId: string
    label: string
    secret: string
    explicit: boolean
  }): Promise<unknown>
  capabilitiesMatlabSessionStatus(projectId: string): Promise<unknown>
  capabilitiesMatlabInvoke(input: {
    projectId: string
    operation: string
    expression?: string
    variables?: string[]
    explicit: boolean
  }): Promise<unknown>
  capabilitiesAzureDiscover(input: {
    projectId: string
    opaqueSecretId: string
    azureConfig?: { organization: string; project?: string }
    explicit: boolean
  }): Promise<unknown>
  capabilitiesAzureImportWorkItem(input: {
    projectId: string
    opaqueSecretId?: string
    azureConfig?: { organization: string; project?: string }
    externalId: string
    revision: string
    content: Record<string, string>
    explicit: boolean
  }): Promise<unknown>
  capabilitiesInvokeOperation(input: {
    projectId: string
    operationId: string
    args?: unknown
    dataMode?: string
    explicit: boolean
  }): Promise<unknown>
  capabilitiesSaveBindingDraft(projectId: string, draft: unknown): Promise<{ ok: true }>
  capabilitiesApproveBinding(projectId: string, draft: unknown): Promise<{ ok: boolean; diagnostics?: unknown; approved?: unknown }>
  capabilitiesListNeedsAttention(projectId: string): Promise<AttentionItem[]>
  capabilitiesCalculateImpact(input: {
    projectId: string
    changedModuleIds: string[]
    classification: ImpactClassification
  }): Promise<ImpactRecord>
  capabilitiesApproveImpact(projectId: string, impact: ImpactRecord): Promise<ImpactRecord>
  capabilitiesListImpacts(projectId: string): Promise<ImpactRecord[]>
  capabilitiesDeltaQueueState(input: { projectId: string; changeId: string }): Promise<DeltaQueueState>
  capabilitiesExportDeltaPacket(input: {
    projectId: string
    changeId: string
    targetId: string
  }): Promise<CapabilityPacketExportResult>
  capabilitiesMarkDeltaTargetComplete(input: {
    projectId: string
    changeId: string
    targetId: string
    verificationId: string
    explicit: boolean
  }): Promise<DeltaQueueState>
  capabilitiesRunModuleVerification(input: RunModuleVerificationInput): Promise<RunModuleVerificationResult>
  capabilitiesVerifyApprovedModule(input: {
    projectId: string
    moduleId: string
    explicit: boolean
  }): Promise<RunModuleVerificationResult>
}

export const BRIDGE_CHANNELS: Record<keyof EuikBridge, string> = {
  appVersion: 'app:version',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  listProjects: 'projects:list',
  createProject: 'projects:create',
  updateProject: 'projects:update',
  listRuns: 'runs:list',
  createRun: 'runs:create',
  getRun: 'runs:get',
  updateRun: 'runs:update',
  pickDirectory: 'dialog:pick-directory',
  pickZipFile: 'dialog:pick-zip',
  addReferenceFile: 'workflow:add-reference-file',
  getDroppedFilePath: 'file:get-dropped-path',
  prepareContext: 'workflow:prepare-context',
  buildPacket: 'workflow:build-packet',
  getArtifactText: 'workflow:get-artifact-text',
  inspectOverlay: 'overlay:inspect',
  applyOverlay: 'overlay:apply',
  runVerification: 'verify:run',
  installDependencies: 'project:install-dependencies',
  saveFeedback: 'review:save-feedback',
  buildReviewPacket: 'review:build-packet',
  captureEvidence: 'evidence:capture',
  getEvidence: 'evidence:get',
  captureProjectThumbnail: 'project:capture-thumbnail',
  startUploadDrag: 'dnd:start-upload-drag',
  copyUploadSet: 'clipboard:copy-upload-set',
  launchApp: 'app:launch-target',
  openExternal: 'shell:open-external',
  openPath: 'shell:open-path',
  showInFolder: 'shell:show-in-folder',
  capabilitiesEnsureInitialized: 'capabilities:ensure-initialized',
  capabilitiesGetApplication: 'capabilities:get-application',
  capabilitiesSaveApplicationDraft: 'capabilities:save-application-draft',
  capabilitiesApproveApplication: 'capabilities:approve-application',
  capabilitiesEvaluateProductGate: 'capabilities:evaluate-product-gate',
  capabilitiesBuildInterviewPacket: 'capabilities:build-interview-packet',
  capabilitiesExportInterviewPacket: 'capabilities:export-interview-packet',
  capabilitiesExportImplementationPacket: 'capabilities:export-implementation-packet',
  capabilitiesStartHandoffDrag: 'capabilities:start-handoff-drag',
  capabilitiesImportInterviewResponse: 'capabilities:import-interview-response',
  capabilitiesGetArchitecture: 'capabilities:get-architecture',
  capabilitiesSaveArchitectureDraft: 'capabilities:save-architecture-draft',
  capabilitiesApproveArchitecture: 'capabilities:approve-architecture',
  capabilitiesSaveModuleDraft: 'capabilities:save-module-draft',
  capabilitiesApproveModule: 'capabilities:approve-module',
  capabilitiesListModules: 'capabilities:list-modules',
  capabilitiesListBindings: 'capabilities:list-bindings',
  capabilitiesListRuns: 'capabilities:list-runs',
  capabilitiesCreateRun: 'capabilities:create-run',
  capabilitiesInspectOverlay: 'capabilities:inspect-overlay',
  capabilitiesApplyOverlay: 'capabilities:apply-overlay',
  capabilitiesCalculateFreshness: 'capabilities:calculate-freshness',
  capabilitiesFilesystemRead: 'capabilities:filesystem-read',
  capabilitiesFilesystemWrite: 'capabilities:filesystem-write',
  capabilitiesSecretPut: 'capabilities:secret-put',
  capabilitiesMatlabSessionStatus: 'capabilities:matlab-session-status',
  capabilitiesMatlabInvoke: 'capabilities:matlab-invoke',
  capabilitiesAzureDiscover: 'capabilities:azure-discover',
  capabilitiesAzureImportWorkItem: 'capabilities:azure-import-work-item',
  capabilitiesInvokeOperation: 'capabilities:invoke-operation',
  capabilitiesSaveBindingDraft: 'capabilities:save-binding-draft',
  capabilitiesApproveBinding: 'capabilities:approve-binding',
  capabilitiesListNeedsAttention: 'capabilities:list-needs-attention',
  capabilitiesCalculateImpact: 'capabilities:calculate-impact',
  capabilitiesApproveImpact: 'capabilities:approve-impact',
  capabilitiesListImpacts: 'capabilities:list-impacts',
  capabilitiesDeltaQueueState: 'capabilities:delta-queue-state',
  capabilitiesExportDeltaPacket: 'capabilities:export-delta-packet',
  capabilitiesMarkDeltaTargetComplete: 'capabilities:mark-delta-target-complete',
  capabilitiesRunModuleVerification: 'capabilities:run-module-verification',
  capabilitiesVerifyApprovedModule: 'capabilities:verify-approved-module',
}
