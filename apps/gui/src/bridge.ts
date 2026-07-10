/**
 * Renderer-side view of the preload bridge (`window.euik`).
 *
 * Mirrors `apps/desktop/src/bridgeApi.ts` — the desktop package owns the
 * canonical contract; this copy exists so the renderer never imports
 * Electron-typed modules. When `window.euik` is absent (plain browser dev or
 * qualitative UI validation), the in-memory mock bridge is installed instead.
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
import { installMockBridge } from './mockBridge'

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
  contactSheetPath?: string
  changesZipPath?: string
  uploadFiles: string[]
}

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
  startUploadDrag(runId: string): Promise<void>
  copyUploadSet(runId: string): Promise<{ files: number }>
  launchApp(projectId: string, options?: { open?: boolean }): Promise<{ url: string; started: boolean; rebuilt: boolean }>
  openExternal(url: string): Promise<void>
  showInFolder(path: string): Promise<void>
}

declare global {
  interface Window {
    euik?: EuikBridge
    euikMode?: 'electron' | 'mock'
  }
}

export function getBridge(): EuikBridge {
  if (!window.euik) {
    window.euik = installMockBridge()
    window.euikMode = 'mock'
  } else {
    window.euikMode = window.euikMode ?? 'electron'
  }
  return window.euik
}
