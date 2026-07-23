import type {
  AdapterDiagnostic,
  ArtifactDescriptor,
  EvidenceSnapshot,
  NormalizedBatch,
  OverlayEnvelope,
  RevisionIdentity,
  SourceRootConfiguration,
  WorkspaceConfiguration,
  WorkspaceState,
} from '../domain/model.js'

export interface ArtifactCatalogPort {
  readonly id: string
  discover(root: SourceRootConfiguration): Promise<{
    artifacts: ArtifactDescriptor[]
    diagnostics: AdapterDiagnostic[]
  }>
}

export interface RevisionSourcePort {
  readonly id: string
  resolve(root: SourceRootConfiguration): Promise<{
    revision?: RevisionIdentity
    diagnostics: AdapterDiagnostic[]
  }>
}

export interface ExtractionContext {
  workspace: WorkspaceConfiguration
  artifacts: ArtifactDescriptor[]
  baselineId: string
}

export type EvidenceSourcePortId =
  | 'port.requirement-source'
  | 'port.trace-source'
  | 'port.design-source'
  | 'port.verification-source'
  | 'port.tabular-evidence-source'
  | 'port.source-code-source'
  | 'port.review-evidence-source'
  | 'port.coverage-source'
  | 'port.objective-profile-source'

/**
 * Application-owned contract implemented by technology-specific driven
 * adapters. `implementedPortIds` keeps the capability architecture visible at
 * runtime without coupling orchestration to MATLAB, workbook, or parser types.
 */
export interface EvidenceSourcePort {
  readonly id: string
  readonly implementedPortIds: readonly EvidenceSourcePortId[]
  readonly sourceKinds: readonly string[]
  extract(context: ExtractionContext): Promise<NormalizedBatch>
}

export interface SnapshotStorePort {
  loadWorkspaceState(): Promise<WorkspaceState>
  saveWorkspaceState(state: WorkspaceState): Promise<void>
  saveWorkspaceConfiguration(configuration: WorkspaceConfiguration): Promise<void>
  getWorkspaceConfiguration(workspaceId: string): Promise<WorkspaceConfiguration | undefined>
  listWorkspaceConfigurations(): Promise<WorkspaceConfiguration[]>
  publish(snapshot: EvidenceSnapshot): Promise<EvidenceSnapshot>
  getSnapshot(workspaceId: string, snapshotId?: string): Promise<EvidenceSnapshot | undefined>
  listSnapshots(workspaceId: string): Promise<EvidenceSnapshot[]>
  getOverlay(workspaceId: string): Promise<OverlayEnvelope>
  saveOverlay(workspaceId: string, overlay: OverlayEnvelope, expectedRevision?: number): Promise<OverlayEnvelope>
  resetOverlay(workspaceId: string): Promise<OverlayEnvelope>
}

export interface SampleSnapshotPort {
  readonly id: string
  load(): Promise<EvidenceSnapshot>
}

export interface AuditPackageWriterPort {
  readonly id: string
  write(input: {
    workspaceId: string
    snapshot: EvidenceSnapshot
    evidenceIds: string[]
    phaseIds?: string[]
    includeFindings: boolean
    includeReviews: boolean
    requestedName?: string
  }): Promise<{
    packageId: string
    absolutePath: string
    contentHash: string
    manifest: Record<string, unknown>
  }>
  remove(packageIds: string[]): Promise<void>
}
