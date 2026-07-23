export type LifecyclePhase =
  | 'planning'
  | 'requirements'
  | 'design'
  | 'implementation'
  | 'verification'
  | 'cm'
  | 'qa'
  | 'certification'

export type SourceKind =
  | 'SLREQX'
  | 'SLMX'
  | 'SLX'
  | 'SLDD'
  | 'SLDATX'
  | 'XLSX'
  | 'CSV'
  | 'C'
  | 'H'
  | 'REVIEW'
  | 'COVERAGE'
  | 'CONFIG'
  | 'NORMALIZED'
  | 'UNKNOWN'

export type EvidenceStatus =
  | 'approved'
  | 'in-review'
  | 'draft'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'not-run'
  | 'stale'
  | 'satisfied'
  | 'partial'
  | 'unsatisfied'

export interface EvidenceRecord {
  id: string
  title: string
  type: string
  phase: LifecyclePhase
  status: EvidenceStatus
  revision: string
  sourcePath: string
  sourceKind: SourceKind
  hash: string
  modified: string
  baseline: string
  upstream: string[]
  downstream: string[]
  reviewState: 'approved' | 'pending' | 'stale' | 'rejected' | 'not-reviewed'
  findingIds: string[]
  provenance: string
  changeMark: 'added' | 'changed' | 'stale' | 'impacted' | 'unchanged'
  meta: Record<string, string | number>
}

export interface FindingRecord {
  id: string
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
  phase: LifecyclePhase
  owner: string
  status: string
  due: string
  evidenceIds: string[]
  disposition?: string
  correctiveAction?: string
  reverificationPlan?: string
  history: Array<{ at: string; actor: string; action: string; note?: string }>
  revision?: number
}

export interface ReviewRecord {
  id: string
  reviewType: string
  subjectId: string
  phase: LifecyclePhase
  reviewer: string
  method: string
  date: string
  revision: string
  result: string
  independent: boolean
  openActions: number
  comments: string
  findingIds: string[]
}

export interface RevisionIdentity {
  sourceId: string
  revision: string
  dirty: boolean
  provenance: string
}

export interface SourceRootConfiguration {
  id: string
  label: string
  rootPath: string
  enabled: boolean
  includeExtensions?: string[]
  adapterIds?: string[]
}

export interface MatlabConfiguration {
  enabled: boolean
  executable?: string
  timeoutMs?: number
  normalizedSidecarSuffix?: string
}

export interface WorkspaceConfiguration {
  id: string
  name: string
  kind: 'real' | 'sample'
  softwareLevel: string
  do331Applicable: boolean
  objectiveProfilePath?: string
  baselineId: string
  comparisonBaselineId?: string
  sourceRoots: SourceRootConfiguration[]
  matlab?: MatlabConfiguration
  createdAt: string
  updatedAt: string
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal'

export interface AdapterDiagnostic {
  id: string
  adapterId: string
  severity: DiagnosticSeverity
  code: string
  message: string
  sourcePath?: string
  retryable: boolean
  detail?: Record<string, string | number | boolean>
}

export interface ArtifactDescriptor {
  absolutePath: string
  relativePath: string
  sourceRootId: string
  sourceKind: SourceKind
  size: number
  modifiedAt: string
  hash: string
}

export interface NormalizedBatch {
  adapterId: string
  evidence: EvidenceRecord[]
  relationships: Array<{ from: string; to: string; type: string; sourcePath: string }>
  reviews: ReviewRecord[]
  findings: FindingRecord[]
  coverage: unknown[]
  changes: unknown[]
  diagnostics: AdapterDiagnostic[]
  provenance: Array<{ sourcePath: string; hash: string; adapterId: string; toolVersion: string }>
}

export interface EvidenceSnapshot {
  schemaVersion: '1.0'
  snapshotId: string
  contentHash: string
  workspace: {
    id: string
    name: string
    kind: 'real' | 'sample'
    softwareLevel: string
    do331Applicable: boolean
    watermark?: string
  }
  baselineId: string
  comparisonBaselineId?: string
  publishedAt: string
  revisionSet: RevisionIdentity[]
  evidence: EvidenceRecord[]
  findings: FindingRecord[]
  reviews: ReviewRecord[]
  baselines: unknown[]
  changes: unknown[]
  coverage: unknown[]
  audits: unknown[]
  openActions: unknown[]
  reproducibilityChecks: unknown[]
  deviations: unknown[]
  removedEvidence: EvidenceRecord[]
  canonicalChain: string[]
  refreshSources: Array<{ source: string; kind: string; count: number; adapterId?: string; diagnostics?: number }>
  counts: Record<string, number | string>
  seedPackage?: unknown
  packages?: unknown[]
  activity?: Array<Record<string, unknown>>
  diagnostics?: AdapterDiagnostic[]
}

export interface WorkspaceState {
  configurations: WorkspaceConfiguration[]
  lastRealWorkspaceId?: string
  selectedWorkspaceId?: string
  selectedSnapshotId?: string
}

export interface OverlayEnvelope {
  workspaceId: string
  revision: number
  updatedAt: string
  findings: Record<string, FindingRecord>
  reviews: ReviewRecord[]
  packages: unknown[]
  preferences: Record<string, unknown>
  activity: Array<Record<string, unknown>>
}

export interface RefreshResult {
  runId: string
  status: 'published' | 'rejected' | 'failed' | 'cancelled'
  snapshotId?: string
  counts: Record<string, number>
  diagnostics: AdapterDiagnostic[]
}

export const EMPTY_BATCH = (adapterId: string): NormalizedBatch => ({
  adapterId,
  evidence: [],
  relationships: [],
  reviews: [],
  findings: [],
  coverage: [],
  changes: [],
  diagnostics: [],
  provenance: [],
})
