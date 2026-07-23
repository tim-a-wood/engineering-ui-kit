import type { EvidenceRecord, Finding, Phase, ReviewRecord } from './core.ts'

export interface RuntimeWorkspace {
  id: string
  name: string
  kind: 'real' | 'sample'
  softwareLevel: string
  do331Applicable: boolean
  watermark?: string
  scope?: { phases: Phase[]; evidenceIds: string[] }
}

export interface RuntimeSnapshot {
  snapshotId: string
  contentHash: string
  workspace: RuntimeWorkspace
  baselineId: string
  comparisonBaselineId?: string
  publishedAt: string
  revisionSet: Array<{ sourceId: string; revision: string; dirty: boolean; provenance: string }>
  evidence: EvidenceRecord[]
  findings: Finding[]
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
  packages?: RuntimePackageRecord[]
  activity?: Array<Record<string, unknown>>
  diagnostics?: RuntimeDiagnostic[]
}

export interface RuntimePackageManifest {
  schemaVersion: string
  packageId: string
  name: string
  createdAt: string
  snapshotId: string
  snapshotHash: string
  baselineId: string
  syntheticSample: boolean
  watermark?: string
  counts: { evidence: number; findings: number; reviews: number }
  entries: Array<{ id: string; revision: string; hash: string; sourcePath: string }>
}

export interface RuntimePackageRecord {
  packageId: string
  absolutePath: string
  contentHash: string
  createdAt: string
  manifest: RuntimePackageManifest
}

export interface RuntimeDiagnostic {
  id: string
  adapterId: string
  severity: 'info' | 'warning' | 'error' | 'fatal'
  code: string
  message: string
  sourcePath?: string
  retryable: boolean
}

type Success<T> = { kind: 'success'; value: T }
type Rejected = { kind: 'rejected'; code: string; details: unknown }
type Failed = { kind: 'failed'; code: string; safeMessage: string; retryable: boolean }
type ApiOutcome<T> = Success<T> | Rejected | Failed | { kind: 'cancelled'; reason: string } | { kind: 'timedOut'; deadline: number }

export class AuditHubApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'AuditHubApiError'
  }
}

async function post<T>(path: string, input: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new AuditHubApiError('api-unavailable', 'The Audit Hub backend is not reachable.', true)
  }
  const outcome = await response.json() as ApiOutcome<T>
  if (outcome.kind === 'success') return outcome.value
  if (outcome.kind === 'rejected') {
    const details = typeof outcome.details === 'string'
      ? outcome.details
      : outcome.details && typeof outcome.details === 'object'
        ? JSON.stringify(outcome.details)
        : String(outcome.details)
    throw new AuditHubApiError(outcome.code, details, false)
  }
  if (outcome.kind === 'failed') {
    throw new AuditHubApiError(outcome.code, outcome.safeMessage, outcome.retryable)
  }
  throw new AuditHubApiError(outcome.kind, outcome.kind === 'cancelled' ? outcome.reason : 'The operation timed out.', true)
}

export async function loadRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  const selection = await post<{
    workspaceId: string
    workspaceKind: 'real' | 'sample'
    baselineId: string
    snapshotId: string
  }>('/api/workspace/select', { realProjectCount: 0 })
  const rendered = await post<{
    content: { snapshot: RuntimeSnapshot }
  }>('/api/hub/render', {
    workspaceId: selection.workspaceId,
    baselineId: selection.baselineId,
    route: window.location.hash.slice(1) || '/overview',
  })
  return rendered.content.snapshot
}

export interface ConnectProjectInput {
  name: string
  rootPath: string
  softwareLevel: string
  do331Applicable: boolean
  baselineId: string
  comparisonBaselineId?: string
  objectiveProfilePath?: string
  matlabEnabled: boolean
  matlabExecutable?: string
}

export async function connectProject(input: ConnectProjectInput): Promise<{ workspaceId: string }> {
  const persisted = await post<{
    workspaceState: { id: string }
  }>('/api/evidence/persist', {
    workspaceId: '',
    mode: 'configure-workspace',
    payload: {
      name: input.name,
      softwareLevel: input.softwareLevel,
      do331Applicable: input.do331Applicable,
      baselineId: input.baselineId,
      ...(input.comparisonBaselineId ? { comparisonBaselineId: input.comparisonBaselineId } : {}),
      ...(input.objectiveProfilePath ? { objectiveProfilePath: input.objectiveProfilePath } : {}),
      sourceRoots: [{
        id: 'project-root',
        label: input.name,
        rootPath: input.rootPath,
        enabled: true,
      }],
      matlab: {
        enabled: input.matlabEnabled,
        ...(input.matlabExecutable ? { executable: input.matlabExecutable } : {}),
        timeoutMs: 120_000,
        normalizedSidecarSuffix: '.audit-hub.json',
      },
    },
  })
  const refresh = await runProjectRefresh(persisted.workspaceState.id)
  if (refresh.status !== 'published') {
    const fatal = refresh.diagnostics.find((diagnostic) => diagnostic.severity === 'fatal')
    throw new AuditHubApiError(
      fatal?.code ?? 'refresh-not-published',
      fatal?.message ?? 'The project was saved, but no valid evidence snapshot could be published.',
      false,
    )
  }
  return { workspaceId: persisted.workspaceState.id }
}

export async function runProjectRefresh(workspaceId: string): Promise<{
  runId: string
  status: 'published' | 'rejected' | 'failed' | 'cancelled'
  snapshotId?: string
  counts: Record<string, number>
  diagnostics: RuntimeDiagnostic[]
}> {
  return post('/api/refresh/run', {
    workspaceId,
    requestedBy: 'Audit Hub user',
    sourceConfiguration: {},
  })
}

export async function resetSampleOverlay(workspaceId: string): Promise<void> {
  await post('/api/sample/reset', { workspaceId, requestedBy: 'Audit Hub user' })
}

export interface ReviewSubmission {
  reviewer: string
  method: string
  result: string
  comments: string
  date: string
  revision: string
  independent: boolean
  phase: string
  requiresIndependence?: boolean
}

export async function recordEvidenceReview(
  workspaceId: string,
  evidenceIds: string[],
  review: ReviewSubmission,
): Promise<{ reviewRecord: ReviewRecord }> {
  return post('/api/reviews/record', { workspaceId, evidenceIds, review })
}

export async function transitionFinding(
  workspaceId: string,
  findingId: string,
  status: string,
  payload: Record<string, unknown>,
): Promise<{ finding: Finding; history: unknown[]; revision?: number }> {
  return post('/api/findings/manage', {
    workspaceId,
    findingId,
    action: status,
    payload: { ...payload, status },
  })
}

export async function buildAuditPackage(
  workspaceId: string,
  snapshotId: string,
  selection: {
    name: string
    evidenceIds: string[]
    phaseIds: Phase[]
    includeFindings: boolean
    includeReviews: boolean
  },
): Promise<{
  packageId: string
  manifest: RuntimePackageManifest
  download: { path: string; url: string; contentHash: string }
}> {
  return post('/api/packages/build', { workspaceId, snapshotId, selection })
}
