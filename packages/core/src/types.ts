/**
 * Persisted-artifact contracts for the Engineering UI Kit workbench.
 *
 * These interfaces implement PRD v7 §28 (Data Model) verbatim and are the
 * implementation source of truth per ARCH-FILE / PRD §22. JSON written to disk
 * must round-trip through these shapes.
 */

/** PRD §28.1 — `project.json` */
/** One capturable view of a target app, resolved against the project's launch URL. */
export type EvidenceViewSpec = {
  id: string
  label: string
  /** Route or path, e.g. `/` or `/settings`. */
  path: string
}

export type Project = {
  id: string
  name: string
  description?: string
  repoPath: string
  status: 'active' | 'archived'
  launchUrl?: string
  launchCommand?: string
  /** How the Capabilities Connect stage should handle frontend integration. */
  capabilitiesConnectDisposition?: 'connect-now' | 'no-ui' | 'deferred'
  verificationCommands?: {
    build?: string
    typecheck?: string
    test?: string
    lint?: string
    preview?: string
    dev?: string
  }
  artifactSettings?: {
    defaultRunFolder?: string
    explicitExportFolder?: string
  }
  /** Target views captured as visual evidence at Prepare (before) and Verify (after). */
  evidenceViews?: EvidenceViewSpec[]
  /** Built-in demo project seeded by the app; badged as SAMPLE in the UI. */
  isSample?: boolean
  settingsSchemaVersion: string
  createdAt: string
  updatedAt: string
}

export type HandoffStep =
  | 'prepare-context'
  | 'create-task-packet'
  | 'run-in-copilot'
  | 'apply-zip-overlay'
  | 'verify-review'
  | 'complete'

/** PRD §28.2 — `handoff-run.json` */
export type HandoffRun = {
  id: string
  projectId: string
  taskId?: string
  taskTitle?: string
  /** Selected Build & Test authoring mode, persisted so launched/resumed work opens consistently. */
  taskTemplateId?: string
  /** The packet section text as last exported — prefills packet regeneration. */
  taskPacketFields?: {
    taskTitle: string
    goal: string
    scope: string
    constraints: string
    acceptanceCriteria: string
    references: string
  }
  /** When the packet was last exported — feedback saved after this drives the iteration prefill. */
  taskPacketBuiltAt?: string
  currentStep: HandoffStep
  uploadSetType?: 'text-only' | 'visual' | 'follow-up-text' | 'follow-up-visual'
  repoFlatfilePath?: string
  repoInventoryPath?: string
  taskPacketPath?: string
  standardPackPath?: string
  taskAndStandardPackPath?: string
  visualReferencePackPath?: string
  followUpPacketPath?: string
  followUpAndStandardPackPath?: string
  reviewEvidencePackPath?: string
  /** Directories holding per-view screenshots + evidence.json for each phase. */
  evidenceBeforeDir?: string
  evidenceAfterDir?: string
  reviewContactSheetPath?: string
  changesZipPath?: string
  overlayZipPath?: string
  overlayInspectionSummaryPath?: string
  appliedFilesPath?: string
  verificationResultPaths?: string[]
  userReviewNotesPath?: string
  completionSummaryPath?: string
  completionStatus?: 'not-complete' | 'approved' | 'needs-follow-up' | 'rejected'
  createdAt: string
  updatedAt: string
  completedAt?: string
}

/** PRD §28.3 — `repo-inventory.json` */
export type RepoInventory = {
  projectId: string
  repoPath: string
  generatedAt: string
  detectedFrameworks: string[]
  detectedPackageManager?: 'npm' | 'pnpm' | 'yarn' | 'unknown'
  packageScripts: Record<string, string>
  includedFiles: string[]
  excludedPaths: {
    path: string
    reason: string
  }[]
  contextWarnings: string[]
  sourceFileCount: number
  includedFileCount: number
  excludedFileCount: number
}

/** PRD §28.4 — `overlay-inspection-summary.json` */
export type OverlayInspectionSummary = {
  runId: string
  zipFilename: string
  inspectedAt: string
  normalizedEntries: {
    originalPath: string
    normalizedRelativePath: string
    targetPath: string
    sizeBytes?: number
    isDirectory: boolean
  }[]
  hardBlockers: {
    ruleId: string
    path?: string
    message: string
  }[]
  warnings: {
    ruleId: string
    path?: string
    message: string
  }[]
  canApply: boolean
}

/** PRD §28.5 — `verification-result.json` */
export type VerificationResult = {
  runId: string
  commandLabel: string
  commandText: string
  workingDirectory: string
  startedAt: string
  endedAt: string
  exitCode: number | null
  status: 'passed' | 'failed' | 'cancelled' | 'timed-out'
  stdoutPath?: string
  stderrPath?: string
  combinedOutputPath?: string
  wasCancelledByUser: boolean
}

/** PRD §28.6 — `applied-files.json` */
export type AppliedFiles = {
  runId: string
  appliedAt: string
  files: {
    relativePath: string
    action: 'created' | 'overwritten' | 'unchanged'
    sizeBytes?: number
  }[]
}

/** PRD §28.7 — `completion-summary.json` */
export type CompletionSummary = {
  runId: string
  projectId: string
  completedAt: string
  completionStatus: 'approved' | 'needs-follow-up' | 'rejected'
  userDecisionNote?: string
  verificationSummary?: {
    passed: number
    failed: number
    cancelled: number
    timedOut: number
  }
  artifacts: {
    copilotInputs?: string[]
    overlayInspectionSummary?: string
    appliedFiles?: string
    verificationResults?: string[]
    userReviewNotes?: string
  }
}

/** PRD §28.8 — `settings/app-settings.json` */
export type Settings = {
  defaultProjectFolder: string
  defaultOutputFolder: string
  maxCopilotUploads: 3
  preferredTemplate: string
  includeScreenshotsByDefault: boolean
  includeBuildTestResultsByDefault: boolean
  requireManualReviewBeforeApply: boolean
  confirmOverwriteExistingFiles: boolean
  warnOnDirtyRepo: boolean
  warnWhenOverlayChangesMoreThanFiles: number
  defaultCommandTimeoutMinutes: number
}

export const DEFAULT_SETTINGS: Settings = {
  defaultProjectFolder: '',
  defaultOutputFolder: '',
  maxCopilotUploads: 3,
  preferredTemplate: 'visual',
  includeScreenshotsByDefault: true,
  includeBuildTestResultsByDefault: true,
  requireManualReviewBeforeApply: true,
  confirmOverwriteExistingFiles: true,
  warnOnDirtyRepo: true,
  warnWhenOverlayChangesMoreThanFiles: 10,
  defaultCommandTimeoutMinutes: 10,
}

/** Task definition consumed by the packet builder. */
export type TaskDefinition = {
  packetId: string
  packetVersion: string
  variant: 'text-only' | 'visual'
  standardsPackage: string
  standardsVersion: string
  themePosture: 'dark-first'
  targetPackage: string
  targetApplication: string
  selectedProjectSample?: string
  selectedProjectSamplePath?: string
  targetAppRoot: string
  screen: string
  route: string
  primaryVisualReference?: string
  goal: string
  scope: string[]
  constraints: string[]
  protectedBehavior: string[]
  acceptanceCriteria: {
    id: string
    criterion: string
    evidenceMethod: string
    blocking: boolean
  }[]
  references: string[]
  expectedChangedFiles: { path: string; note?: string }[]
  forbiddenChanges: string[]
  applicableRuleIds: string[]
  applicableComponentIds: string[]
  tokenRows: { path: string; value: string; requiredUse: string }[]
  approvedGuidance: string[]
  rejectedGuidance: string[]
  accessibilityRequirements: string[]
  standardsExcerpts: { id: string; title: string; body: string; source: string }[]
}

/** One entry in a three-file upload budget manifest. */
export type PacketManifestEntry = {
  file: string
  sha256: string
  bytes: number
}
