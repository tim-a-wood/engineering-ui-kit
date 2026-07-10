/**
 * Typed IPC bridge surface shared by main, preload, and renderer.
 *
 * This is the narrow boundary required by PRD §9.4 and ARCH-STATE-006: no
 * generic filesystem access crosses it; every method is a specific workflow
 * operation whose arguments and results are serializable contracts.
 */

import type {
  AppliedFiles,
  ElementLoss,
  EvidenceCapture,
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  RepoInventory,
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

  prepareContext(runId: string): Promise<PrepareContextResult>
  buildPacket(runId: string, fields: TaskPacketFields): Promise<BuildPacketResult>
  getArtifactText(runId: string, fileName: string): Promise<string>
  inspectOverlay(runId: string, zipPath: string): Promise<OverlayInspectionSummary>
  applyOverlay(runId: string, acceptWarnings: boolean): Promise<AppliedFiles>
  runVerification(runId: string, labels: string[]): Promise<VerificationResult[]>
  saveFeedback(runId: string, text: string): Promise<HandoffRun>
  buildReviewPacket(runId: string): Promise<ReviewPacketResult>
  captureEvidence(runId: string, phase: 'before' | 'after'): Promise<EvidenceCapture>
  getEvidence(runId: string): Promise<RunEvidence>
  /** Begin a native drag of the run's Copilot upload files (call from a dragstart handler). */
  startUploadDrag(runId: string): Promise<void>
  /** Put the run's Copilot upload files on the OS clipboard as real file objects. */
  copyUploadSet(runId: string): Promise<{ files: number }>
  /** Open the project's app in the browser, starting its dev server first if needed. */
  launchApp(projectId: string, options?: { open?: boolean }): Promise<{ url: string; started: boolean; rebuilt: boolean }>

  openExternal(url: string): Promise<void>
  showInFolder(path: string): Promise<void>
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
  prepareContext: 'workflow:prepare-context',
  buildPacket: 'workflow:build-packet',
  getArtifactText: 'workflow:get-artifact-text',
  inspectOverlay: 'overlay:inspect',
  applyOverlay: 'overlay:apply',
  runVerification: 'verify:run',
  saveFeedback: 'review:save-feedback',
  buildReviewPacket: 'review:build-packet',
  captureEvidence: 'evidence:capture',
  getEvidence: 'evidence:get',
  startUploadDrag: 'dnd:start-upload-drag',
  copyUploadSet: 'clipboard:copy-upload-set',
  launchApp: 'app:launch-target',
  openExternal: 'shell:open-external',
  showInFolder: 'shell:show-in-folder',
}
