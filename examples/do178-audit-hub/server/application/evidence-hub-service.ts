import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type {
  AdapterDiagnostic,
  ArtifactDescriptor,
  EvidenceRecord,
  EvidenceSnapshot,
  FindingRecord,
  NormalizedBatch,
  OverlayEnvelope,
  RefreshResult,
  RevisionIdentity,
  ReviewRecord,
  SourceRootConfiguration,
  WorkspaceConfiguration,
} from '../domain/model.js'
import type {
  ArtifactCatalogPort,
  AuditPackageWriterPort,
  EvidenceSourcePort,
  RevisionSourcePort,
  SampleSnapshotPort,
  SnapshotStorePort,
} from '../ports/outbound.js'
import { sha256Json } from '../lib/files.js'

const PHASES = [
  'planning',
  'requirements',
  'design',
  'implementation',
  'verification',
  'cm',
  'qa',
  'certification',
] as const

const EVIDENCE_TYPES = new Set([
  'plan',
  'standard',
  'sys-requirement',
  'hlr',
  'llr',
  'derived-requirement',
  'model',
  'harness',
  'data-dictionary',
  'model-element',
  'source-file',
  'function',
  'test-case',
  'result-set',
  'result',
  'objective',
  'config-item',
])

const EVIDENCE_STATUSES = new Set([
  'approved',
  'in-review',
  'draft',
  'passed',
  'failed',
  'blocked',
  'not-run',
  'stale',
  'satisfied',
  'partial',
  'unsatisfied',
])

const SOURCE_KINDS = new Set([
  'SLREQX',
  'SLMX',
  'SLX',
  'SLDD',
  'SLDATX',
  'XLSX',
  'CSV',
  'C',
  'H',
  'REVIEW',
  'COVERAGE',
  'CONFIG',
  'NORMALIZED',
  'UNKNOWN',
])

export interface EvidenceHubDependencies {
  store: SnapshotStorePort
  sample: SampleSnapshotPort
  artifactCatalog: ArtifactCatalogPort
  revisionSource: RevisionSourcePort
  evidenceSources: EvidenceSourcePort[]
  packageWriter: AuditPackageWriterPort
}

type SelectionInput = {
  requestedWorkspaceId?: string
  requestedBaselineId?: string
  lastRealWorkspaceId?: string
  realProjectCount?: number
}

type ConfigureWorkspaceInput = {
  id?: string
  name: string
  softwareLevel: string
  do331Applicable?: boolean
  objectiveProfilePath?: string
  baselineId?: string
  comparisonBaselineId?: string
  sourceRoots: Array<Partial<SourceRootConfiguration> & Pick<SourceRootConfiguration, 'rootPath'>>
  matlab?: WorkspaceConfiguration['matlab']
}

function diagnostic(
  adapterId: string,
  severity: AdapterDiagnostic['severity'],
  code: string,
  message: string,
  sourcePath?: string,
): AdapterDiagnostic {
  return {
    id: `${adapterId}:${code}:${sourcePath ?? randomUUID()}`,
    adapterId,
    severity,
    code,
    message,
    ...(sourcePath ? { sourcePath } : {}),
    retryable: severity === 'error',
  }
}

function mergeSnapshotOverlay(snapshot: EvidenceSnapshot, overlay: OverlayEnvelope): EvidenceSnapshot {
  const overlayReviews = overlay.reviews
  const seedFindingIds = new Set(snapshot.findings.map((finding) => finding.id))
  return {
    ...snapshot,
    evidence: snapshot.evidence.map((record) => {
      const latestReview = overlayReviews.find((review) => review.subjectId === record.id)
      if (!latestReview) return record
      const reviewState = latestReview.result === 'passed'
        ? 'approved'
        : latestReview.result === 'failed'
          ? 'rejected'
          : latestReview.result === 'pending'
            ? 'pending'
            : 'in-review'
      return {
        ...record,
        reviewState: reviewState === 'in-review' ? 'pending' : reviewState,
      }
    }),
    findings: [
      ...snapshot.findings.map((finding) => overlay.findings[finding.id] ?? finding),
      ...Object.values(overlay.findings).filter((finding) => !seedFindingIds.has(finding.id)),
    ],
    reviews: [...overlayReviews, ...snapshot.reviews.filter((seed) => !overlayReviews.some((review) => review.id === seed.id))],
    packages: overlay.packages,
    activity: overlay.activity,
  }
}

function uniqueById<T extends { id: string }>(items: T[]): { items: T[]; duplicates: string[] } {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id)
      continue
    }
    seen.add(item.id)
    result.push(item)
  }
  return { items: result, duplicates: [...duplicates].sort() }
}

function materializeRelationships(
  evidence: EvidenceRecord[],
  relationships: NormalizedBatch['relationships'],
): EvidenceRecord[] {
  const byId = new Map(evidence.map((record) => [record.id, structuredClone(record)]))
  for (const relationship of relationships) {
    const from = byId.get(relationship.from)
    const to = byId.get(relationship.to)
    if (from && !from.downstream.includes(relationship.to)) from.downstream.push(relationship.to)
    if (to && !to.upstream.includes(relationship.from)) to.upstream.push(relationship.from)
  }
  return [...byId.values()].map((record) => ({
    ...record,
    upstream: [...new Set(record.upstream)].sort(),
    downstream: [...new Set(record.downstream)].sort(),
  }))
}

function countsFor(snapshot: Pick<EvidenceSnapshot, 'evidence' | 'findings' | 'reviews'>): Record<string, number> {
  const result: Record<string, number> = {
    evidence: snapshot.evidence.length,
    findings: snapshot.findings.length,
    reviews: snapshot.reviews.length,
  }
  for (const phase of PHASES) result[phase] = snapshot.evidence.filter((record) => record.phase === phase).length
  return result
}

function deriveCanonicalChain(evidence: EvidenceRecord[]): string[] {
  const byId = new Map(evidence.map((record) => [record.id, record]))
  const memo = new Map<string, string[]>()
  const visit = (id: string, active: Set<string>): string[] => {
    if (active.has(id)) return [id]
    const cached = memo.get(id)
    if (cached) return cached
    const record = byId.get(id)
    if (!record) return []
    const nextActive = new Set(active).add(id)
    const candidates = record.downstream
      .filter((target) => byId.has(target))
      .map((target) => visit(target, nextActive))
    const best = candidates.sort((a, b) => b.length - a.length || a.join('\0').localeCompare(b.join('\0')))[0] ?? []
    const chain = [id, ...best]
    memo.set(id, chain)
    return chain
  }
  const roots = evidence
    .filter((record) => record.upstream.filter((id) => byId.has(id)).length === 0)
    .sort((a, b) => a.id.localeCompare(b.id))
  const candidates = (roots.length > 0 ? roots : evidence).map((record) => visit(record.id, new Set()))
  return candidates
    .sort((a, b) => b.length - a.length || a.join('\0').localeCompare(b.join('\0')))[0]
    ?.slice(0, 24) ?? []
}

function evidenceValidationErrors(record: EvidenceRecord): string[] {
  const errors: string[] = []
  if (typeof record.id !== 'string' || !record.id.trim()) errors.push('id is required')
  if (typeof record.title !== 'string' || !record.title.trim()) errors.push('title is required')
  if (!PHASES.includes(record.phase)) errors.push(`unknown phase ${String(record.phase)}`)
  if (!EVIDENCE_TYPES.has(record.type)) errors.push(`unknown evidence type ${String(record.type)}`)
  if (!EVIDENCE_STATUSES.has(record.status)) errors.push(`unknown status ${String(record.status)}`)
  if (!SOURCE_KINDS.has(record.sourceKind)) errors.push(`unknown source kind ${String(record.sourceKind)}`)
  if (typeof record.revision !== 'string' || !record.revision.trim()) errors.push('revision is required')
  if (typeof record.sourcePath !== 'string' || !record.sourcePath.trim()) errors.push('source path is required')
  if (typeof record.hash !== 'string' || !/^[0-9a-f]{64}$/i.test(record.hash)) errors.push('SHA-256 hash is invalid')
  if (typeof record.modified !== 'string' || Number.isNaN(Date.parse(record.modified))) errors.push('modified timestamp is invalid')
  if (typeof record.baseline !== 'string' || !record.baseline.trim()) errors.push('baseline is required')
  if (!Array.isArray(record.upstream) || record.upstream.some((id) => typeof id !== 'string')) errors.push('upstream links are invalid')
  if (!Array.isArray(record.downstream) || record.downstream.some((id) => typeof id !== 'string')) errors.push('downstream links are invalid')
  if (!['approved', 'pending', 'stale', 'rejected', 'not-reviewed'].includes(record.reviewState)) {
    errors.push(`unknown review state ${String(record.reviewState)}`)
  }
  if (!Array.isArray(record.findingIds) || record.findingIds.some((id) => typeof id !== 'string')) errors.push('finding links are invalid')
  if (typeof record.provenance !== 'string' || !record.provenance.trim()) errors.push('provenance is required')
  if (!['added', 'changed', 'stale', 'impacted', 'unchanged'].includes(record.changeMark)) {
    errors.push(`unknown change mark ${String(record.changeMark)}`)
  }
  if (!record.meta || typeof record.meta !== 'object' || Array.isArray(record.meta)) errors.push('metadata is invalid')
  return errors
}

export class EvidenceHubService {
  constructor(private readonly dependencies: EvidenceHubDependencies) {}

  private async appendActivity(
    workspaceId: string,
    kind: string,
    message: string,
  ): Promise<void> {
    const overlay = await this.dependencies.store.getOverlay(workspaceId)
    await this.dependencies.store.saveOverlay(workspaceId, {
      ...overlay,
      activity: [{
        at: new Date().toISOString(),
        kind,
        message,
      }, ...overlay.activity].slice(0, 500),
    })
  }

  async ensureSample(): Promise<EvidenceSnapshot> {
    const bundled = await this.dependencies.sample.load()
    const existing = await this.dependencies.store.getSnapshot(bundled.workspace.id, bundled.snapshotId)
    if (existing) return existing
    return this.dependencies.store.publish(bundled)
  }

  async openSample(configuredProjectCount = 0): Promise<EvidenceSnapshot> {
    if (configuredProjectCount > 0) {
      throw new DomainRuleError(
        'real-project-present',
        'A configured real project must not be replaced implicitly.',
      )
    }
    return this.ensureSample()
  }

  async configureWorkspace(input: ConfigureWorkspaceInput): Promise<WorkspaceConfiguration> {
    if (!input.name?.trim()) throw new DomainRuleError('workspace-name-required', 'Workspace name is required.')
    if (!Array.isArray(input.sourceRoots) || input.sourceRoots.length === 0) {
      throw new DomainRuleError('source-root-required', 'At least one source root is required.')
    }
    for (const root of input.sourceRoots) {
      if (!isAbsolute(root.rootPath)) {
        throw new DomainRuleError('source-root-not-absolute', `Source root must be an absolute path: ${root.rootPath}`)
      }
      try {
        await access(root.rootPath)
      } catch {
        throw new DomainRuleError('source-root-unreadable', `Source root is not readable: ${root.rootPath}`)
      }
    }
    if (input.objectiveProfilePath) {
      if (!isAbsolute(input.objectiveProfilePath)) {
        throw new DomainRuleError(
          'objective-profile-not-absolute',
          `Objective profile must be an absolute path: ${input.objectiveProfilePath}`,
        )
      }
      try {
        await access(input.objectiveProfilePath)
      } catch {
        throw new DomainRuleError(
          'objective-profile-unreadable',
          `Objective profile is not readable: ${input.objectiveProfilePath}`,
        )
      }
    }
    const now = new Date().toISOString()
    const existing = input.id ? await this.dependencies.store.getWorkspaceConfiguration(input.id) : undefined
    const id = input.id ?? `workspace-${randomUUID()}`
    const configuration: WorkspaceConfiguration = {
      id,
      name: input.name.trim(),
      kind: 'real',
      softwareLevel: input.softwareLevel?.trim() || 'Unspecified',
      do331Applicable: input.do331Applicable ?? false,
      ...(input.objectiveProfilePath?.trim() ? { objectiveProfilePath: input.objectiveProfilePath.trim() } : {}),
      baselineId: input.baselineId?.trim() || 'working',
      ...(input.comparisonBaselineId?.trim() ? { comparisonBaselineId: input.comparisonBaselineId.trim() } : {}),
      sourceRoots: input.sourceRoots.map((root, index) => ({
        id: root.id?.trim() || `source-${index + 1}`,
        label: root.label?.trim() || `Source ${index + 1}`,
        rootPath: root.rootPath,
        enabled: root.enabled ?? true,
        ...(root.includeExtensions ? { includeExtensions: root.includeExtensions } : {}),
        ...(root.adapterIds ? { adapterIds: root.adapterIds } : {}),
      })),
      ...(input.matlab ? { matlab: input.matlab } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await this.dependencies.store.saveWorkspaceConfiguration(configuration)
    return configuration
  }

  async selectWorkspace(input: SelectionInput): Promise<{
    workspaceId: string
    workspaceKind: 'real' | 'sample'
    baselineId: string
    snapshotId: string
    revisionSet: EvidenceSnapshot['revisionSet']
    showConnectAction: boolean
  }> {
    if (input.requestedWorkspaceId === 'sample-aeronav') {
      const sample = await this.ensureSample()
      return {
        workspaceId: sample.workspace.id,
        workspaceKind: 'sample',
        baselineId: input.requestedBaselineId ?? sample.baselineId,
        snapshotId: sample.snapshotId,
        revisionSet: sample.revisionSet,
        showConnectAction: true,
      }
    }
    const real = await this.dependencies.store.listWorkspaceConfigurations()
    const state = await this.dependencies.store.loadWorkspaceState()
    const preferredIds = [
      input.requestedWorkspaceId,
      input.lastRealWorkspaceId,
      state.lastRealWorkspaceId,
      ...real.map((candidate) => candidate.id),
    ].filter((id): id is string => Boolean(id))
    const candidates = [...new Set(preferredIds)]
      .map((id) => real.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is WorkspaceConfiguration => Boolean(candidate))

    for (const selected of candidates) {
      let snapshot = await this.dependencies.store.getSnapshot(selected.id)
      if (!snapshot) {
        const refresh = await this.refresh(selected.id, 'workspace-selection')
        if (refresh.snapshotId) {
          snapshot = await this.dependencies.store.getSnapshot(selected.id, refresh.snapshotId)
        }
      }
      if (!snapshot) {
        if (selected.id === input.requestedWorkspaceId) {
          throw new DomainRuleError('workspace-not-published', 'The selected workspace has no valid published snapshot.')
        }
        continue
      }
      return {
        workspaceId: selected.id,
        workspaceKind: 'real',
        baselineId: input.requestedBaselineId ?? snapshot.baselineId,
        snapshotId: snapshot.snapshotId,
        revisionSet: snapshot.revisionSet,
        showConnectAction: false,
      }
    }

    const sample = await this.ensureSample()
    return {
      workspaceId: sample.workspace.id,
      workspaceKind: 'sample',
      baselineId: input.requestedBaselineId ?? sample.baselineId,
      snapshotId: sample.snapshotId,
      revisionSet: sample.revisionSet,
      showConnectAction: true,
    }
  }

  async currentSnapshot(workspaceId?: string, snapshotId?: string): Promise<EvidenceSnapshot> {
    const state = await this.dependencies.store.loadWorkspaceState()
    const resolvedWorkspace = workspaceId ?? state.selectedWorkspaceId
    if (!resolvedWorkspace || resolvedWorkspace === 'sample-aeronav') return this.ensureSample()
    const snapshot = await this.dependencies.store.getSnapshot(resolvedWorkspace, snapshotId)
    if (!snapshot) throw new DomainRuleError('snapshot-not-found', 'Requested workspace or snapshot is not published.')
    return snapshot
  }

  async mergedSnapshot(workspaceId?: string, snapshotId?: string): Promise<EvidenceSnapshot> {
    const snapshot = await this.currentSnapshot(workspaceId, snapshotId)
    const overlay = await this.dependencies.store.getOverlay(snapshot.workspace.id)
    return mergeSnapshotOverlay(snapshot, overlay)
  }

  async refresh(workspaceId: string, requestedBy: string): Promise<RefreshResult> {
    const configuration = await this.dependencies.store.getWorkspaceConfiguration(workspaceId)
    if (!configuration) {
      throw new DomainRuleError('workspace-unknown', `Workspace is not configured: ${workspaceId}`)
    }
    const runId = `refresh-${randomUUID()}`
    const diagnostics: AdapterDiagnostic[] = []
    const artifacts: ArtifactDescriptor[] = []
    const revisionSet: RevisionIdentity[] = []
    for (const root of configuration.sourceRoots.filter((candidate) => candidate.enabled)) {
      const [catalog, revision] = await Promise.all([
        this.dependencies.artifactCatalog.discover(root),
        this.dependencies.revisionSource.resolve(root),
      ])
      artifacts.push(...catalog.artifacts)
      diagnostics.push(...catalog.diagnostics, ...revision.diagnostics)
      if (revision.revision) revisionSet.push(revision.revision)
    }
    if (diagnostics.some((item) => item.severity === 'fatal')) {
      await this.appendActivity(
        workspaceId,
        'refresh-rejected',
        `Refresh rejected before extraction; ${artifacts.length} artifacts discovered and the previous snapshot retained.`,
      )
      return { runId, status: 'rejected', counts: { artifacts: artifacts.length }, diagnostics }
    }

    const batches = await Promise.all(this.dependencies.evidenceSources.map((adapter) =>
      adapter.extract({
        workspace: configuration,
        artifacts: artifacts.filter((artifact) => {
          if (adapter.sourceKinds.length > 0 && !adapter.sourceKinds.includes(artifact.sourceKind)) return false
          const sourceRoot = configuration.sourceRoots.find((root) => root.id === artifact.sourceRootId)
          return !sourceRoot?.adapterIds?.length || sourceRoot.adapterIds.includes(adapter.id)
        }),
        baselineId: configuration.baselineId,
      })))
    for (const batch of batches) diagnostics.push(...batch.diagnostics)

    const extractedPaths = new Set(batches.flatMap((batch) => batch.provenance.map((item) => item.sourcePath)))
    for (const artifact of artifacts) {
      if (!extractedPaths.has(artifact.relativePath)) {
        diagnostics.push(diagnostic(
          'mod.ingestion-publication',
          'fatal',
          'artifact-unextracted',
          `No configured adapter produced normalized evidence for ${artifact.relativePath}.`,
          artifact.relativePath,
        ))
      }
    }

    const uniqueEvidence = uniqueById(batches.flatMap((batch) => batch.evidence))
    if (uniqueEvidence.duplicates.length > 0) {
      diagnostics.push(diagnostic(
        'mod.ingestion-publication',
        'fatal',
        'duplicate-evidence-identity',
        `Duplicate stable evidence identities: ${uniqueEvidence.duplicates.join(', ')}`,
      ))
    }
    if (uniqueEvidence.items.length === 0) {
      diagnostics.push(diagnostic(
        'mod.ingestion-publication',
        'fatal',
        'empty-normalized-snapshot',
        'No normalized evidence was produced; the last published snapshot remains active.',
      ))
    }
    let invalidEvidenceCount = 0
    for (const [index, record] of uniqueEvidence.items.entries()) {
      const errors = evidenceValidationErrors(record)
      if (errors.length === 0) continue
      invalidEvidenceCount++
      if (invalidEvidenceCount <= 50) {
        diagnostics.push(diagnostic(
          'mod.ingestion-publication',
          'fatal',
          'invalid-normalized-evidence',
          `Normalized evidence ${record.id || `at index ${index}`} is invalid: ${errors.join('; ')}.`,
          record.sourcePath,
        ))
      }
    }
    if (invalidEvidenceCount > 50) {
      diagnostics.push(diagnostic(
        'mod.ingestion-publication',
        'fatal',
        'invalid-normalized-evidence-truncated',
        `${invalidEvidenceCount - 50} additional invalid normalized evidence records were omitted from diagnostics.`,
      ))
    }
    if (diagnostics.some((item) => item.severity === 'fatal')) {
      await this.appendActivity(
        workspaceId,
        'refresh-rejected',
        `Refresh rejected after normalization; ${uniqueEvidence.items.length} evidence records staged and the previous snapshot retained.`,
      )
      return {
        runId,
        status: 'rejected',
        counts: { artifacts: artifacts.length, evidence: uniqueEvidence.items.length },
        diagnostics,
      }
    }

    const relationships = batches.flatMap((batch) => batch.relationships)
    const evidence = materializeRelationships(uniqueEvidence.items, relationships)
    const findings = uniqueById(batches.flatMap((batch) => batch.findings)).items
    const reviews = uniqueById(batches.flatMap((batch) => batch.reviews)).items.map((review) => {
      const subject = evidence.find((record) => record.id === review.subjectId)
      return subject ? { ...review, phase: subject.phase } : review
    })
    const snapshotWithoutHash: Omit<EvidenceSnapshot, 'contentHash'> = {
      schemaVersion: '1.0',
      snapshotId: `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
      workspace: {
        id: configuration.id,
        name: configuration.name,
        kind: 'real',
        softwareLevel: configuration.softwareLevel,
        do331Applicable: configuration.do331Applicable,
      },
      baselineId: configuration.baselineId,
      ...(configuration.comparisonBaselineId ? { comparisonBaselineId: configuration.comparisonBaselineId } : {}),
      publishedAt: new Date().toISOString(),
      revisionSet,
      evidence,
      findings,
      reviews,
      baselines: [{
        id: configuration.baselineId,
        label: configuration.baselineId,
        published: new Date().toISOString(),
        itemCount: evidence.length,
        status: 'active',
        notes: 'Published from configured authoritative sources.',
      }],
      changes: batches.flatMap((batch) => batch.changes),
      coverage: batches.flatMap((batch) => batch.coverage),
      audits: [],
      openActions: [],
      reproducibilityChecks: revisionSet.map((revision) => ({
        id: revision.sourceId,
        check: 'Revision identity',
        result: revision.dirty ? 'warning' : 'passed',
        detail: revision.provenance,
      })),
      deviations: [],
      removedEvidence: [],
      canonicalChain: deriveCanonicalChain(evidence),
      refreshSources: batches.map((batch) => ({
        source: batch.adapterId,
        kind: batch.adapterId.replace('adapter.', ''),
        count: batch.evidence.length
          + batch.reviews.length
          + batch.findings.length
          + batch.coverage.length
          + batch.changes.length,
        adapterId: batch.adapterId,
        diagnostics: batch.diagnostics.length,
      })),
      counts: countsFor({ evidence, findings, reviews }),
      diagnostics,
    }
    const snapshot: EvidenceSnapshot = {
      ...snapshotWithoutHash,
      contentHash: sha256Json(snapshotWithoutHash),
    }
    await this.dependencies.store.publish(snapshot)
    await this.appendActivity(
      workspaceId,
      'refresh-published',
      `Snapshot ${snapshot.snapshotId} published with ${evidence.length} evidence records and ${diagnostics.length} diagnostics.`,
    )
    return {
      runId,
      status: 'published',
      snapshotId: snapshot.snapshotId,
      counts: { artifacts: artifacts.length, evidence: evidence.length, findings: findings.length, reviews: reviews.length },
      diagnostics,
    }
  }

  async render(input: {
    workspaceId?: string
    snapshotId?: string
    route?: string
    baselineId?: string
    selectedEvidenceId?: string
  }): Promise<Record<string, unknown>> {
    const snapshot = await this.mergedSnapshot(input.workspaceId, input.snapshotId)
    const selected = input.selectedEvidenceId
      ? snapshot.evidence.find((record) => record.id === input.selectedEvidenceId)
      : undefined
    if (input.selectedEvidenceId && !selected) {
      throw new DomainRuleError('evidence-unknown', 'The selected evidence item is not part of the selected snapshot.')
    }
    return {
      workspace: snapshot.workspace,
      navigation: ['overview', ...PHASES],
      content: { snapshot },
      findings: snapshot.findings,
      ...(selected ? { inspector: await this.dossier(snapshot.workspace.id, selected.id, snapshot.snapshotId) } : {}),
      diagnostics: snapshot.diagnostics ?? [],
    }
  }

  async lifecycle(input: {
    workspaceId: string
    baselineId?: string
    compareBaselineId?: string
    phase: string
    subview?: string
    filters?: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    if (!PHASES.includes(input.phase as typeof PHASES[number])) {
      throw new DomainRuleError('phase-unknown', 'Unknown lifecycle phase or subview.')
    }
    const snapshot = await this.mergedSnapshot(input.workspaceId)
    const rows = snapshot.evidence.filter((record) => record.phase === input.phase)
    const openFindings = snapshot.findings.filter((finding) =>
      finding.phase === input.phase && finding.status !== 'closed')
    const approved = rows.filter((record) => ['approved', 'passed', 'satisfied'].includes(record.status)).length
    return {
      header: {
        phase: input.phase,
        baselineId: input.baselineId ?? snapshot.baselineId,
        evidenceCount: rows.length,
        readiness: rows.length === 0 ? 0 : Math.round((approved / rows.length) * 100),
      },
      subviews: ['evidence', 'traceability', 'reviews', 'findings', 'compare'],
      visualization: {
        statuses: Object.fromEntries([...new Set(rows.map((record) => record.status))]
          .map((status) => [status, rows.filter((record) => record.status === status).length])),
      },
      evidenceRows: rows,
      findings: openFindings,
      ...(input.compareBaselineId ? { compare: this.compare(snapshot, input.phase) } : {}),
    }
  }

  private compare(snapshot: EvidenceSnapshot, phase?: string): Record<string, EvidenceRecord[]> {
    const rows = phase ? snapshot.evidence.filter((record) => record.phase === phase) : snapshot.evidence
    return {
      added: rows.filter((record) => record.changeMark === 'added'),
      removed: snapshot.removedEvidence.filter((record) => !phase || record.phase === phase),
      changed: rows.filter((record) => record.changeMark === 'changed'),
      stale: rows.filter((record) => record.changeMark === 'stale' || record.status === 'stale'),
      impacted: rows.filter((record) => record.changeMark === 'impacted'),
    }
  }

  async dossier(workspaceId: string, evidenceId: string, snapshotId?: string): Promise<Record<string, unknown>> {
    const snapshot = await this.mergedSnapshot(workspaceId, snapshotId)
    const evidence = snapshot.evidence.find((record) => record.id === evidenceId)
    if (!evidence) {
      throw new DomainRuleError('evidence-unknown', 'Evidence identity is unknown in the selected snapshot.')
    }
    return {
      evidence,
      provenance: {
        sourcePath: evidence.sourcePath,
        sourceKind: evidence.sourceKind,
        revision: evidence.revision,
        hash: evidence.hash,
        adapter: evidence.provenance,
      },
      relationships: [
        ...evidence.upstream.map((id) => ({ from: id, to: evidence.id, direction: 'upstream' })),
        ...evidence.downstream.map((id) => ({ from: evidence.id, to: id, direction: 'downstream' })),
      ],
      reviews: snapshot.reviews.filter((review) => review.subjectId === evidence.id),
      findings: snapshot.findings.filter((finding) => finding.evidenceIds.includes(evidence.id)),
    }
  }

  async search(input: {
    workspaceId: string
    snapshotId?: string
    query?: string
    filters?: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    const snapshot = await this.mergedSnapshot(input.workspaceId, input.snapshotId)
    const query = input.query?.trim().toLowerCase() ?? ''
    const phase = typeof input.filters?.phase === 'string' ? input.filters.phase : undefined
    const sourceKind = typeof input.filters?.sourceKind === 'string' ? input.filters.sourceKind : undefined
    const results = snapshot.evidence.filter((record) => {
      if (phase && record.phase !== phase) return false
      if (sourceKind && record.sourceKind !== sourceKind) return false
      if (!query) return true
      return [
        record.id,
        record.title,
        record.type,
        record.sourcePath,
        record.provenance,
        ...Object.values(record.meta).map(String),
      ].some((value) => value.toLowerCase().includes(query))
    }).slice(0, 200)
    return {
      results,
      facets: {
        phase: Object.fromEntries(PHASES.map((item) => [item, results.filter((record) => record.phase === item).length])),
        sourceKind: Object.fromEntries([...new Set(results.map((record) => record.sourceKind))]
          .map((kind) => [kind, results.filter((record) => record.sourceKind === kind).length])),
      },
      coverage: { returned: results.length, total: snapshot.evidence.length },
    }
  }

  async traverse(input: {
    workspaceId: string
    snapshotId?: string
    startEvidenceId: string
    direction?: string
  }): Promise<Record<string, unknown>> {
    const snapshot = await this.mergedSnapshot(input.workspaceId, input.snapshotId)
    const byId = new Map(snapshot.evidence.map((record) => [record.id, record]))
    if (!byId.has(input.startEvidenceId)) {
      throw new DomainRuleError('origin-unknown', 'Traversal origin is unknown.')
    }
    const queue = [input.startEvidenceId]
    const visited = new Set<string>()
    const edges: Array<{ from: string; to: string }> = []
    const gaps: Array<{ from: string; missing: string }> = []
    while (queue.length > 0 && visited.size < 500) {
      const id = queue.shift()
      if (!id || visited.has(id)) continue
      visited.add(id)
      const record = byId.get(id)
      if (!record) continue
      const targets = input.direction === 'upstream'
        ? record.upstream
        : input.direction === 'downstream'
          ? record.downstream
          : [...record.upstream, ...record.downstream]
      for (const target of targets) {
        const forward = record.downstream.includes(target)
        edges.push({ from: forward ? id : target, to: forward ? target : id })
        if (byId.has(target)) queue.push(target)
        else gaps.push({ from: id, missing: target })
      }
    }
    const nodes = [...visited].map((id) => byId.get(id)).filter(Boolean)
    return {
      nodes,
      edges,
      gaps,
      impacts: nodes.filter((record) => record?.changeMark !== 'unchanged'),
    }
  }

  async manageFinding(input: {
    workspaceId: string
    action: string
    findingId?: string
    expectedRevision?: number
    payload?: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    const snapshot = await this.currentSnapshot(input.workspaceId)
    const overlay = await this.dependencies.store.getOverlay(input.workspaceId)
    if (input.expectedRevision !== undefined && input.expectedRevision !== overlay.revision) {
      throw new DomainRuleError('stale-revision', 'Expected revision is stale.')
    }
    const current = input.findingId
      ? overlay.findings[input.findingId] ?? snapshot.findings.find((finding) => finding.id === input.findingId)
      : undefined
    if (input.action === 'create') {
      const payload = input.payload ?? {}
      const created: FindingRecord = {
        id: `FND-LOCAL-${randomUUID().slice(0, 8)}`,
        title: String(payload.title ?? 'Untitled finding'),
        detail: String(payload.detail ?? ''),
        severity: (payload.severity === 'high' || payload.severity === 'low') ? payload.severity : 'medium',
        phase: PHASES.includes(payload.phase as typeof PHASES[number]) ? payload.phase as FindingRecord['phase'] : 'qa',
        owner: String(payload.owner ?? 'Unassigned'),
        status: 'open',
        due: String(payload.due ?? ''),
        evidenceIds: Array.isArray(payload.evidenceIds) ? payload.evidenceIds.map(String) : [],
        history: [{ at: new Date().toISOString(), actor: String(payload.actor ?? 'Audit Hub user'), action: 'Created' }],
      }
      const saved = await this.dependencies.store.saveOverlay(input.workspaceId, {
        ...overlay,
        findings: { ...overlay.findings, [created.id]: created },
        activity: [{
          at: new Date().toISOString(),
          kind: 'finding-created',
          message: `Finding ${created.id} created.`,
        }, ...overlay.activity],
      }, input.expectedRevision)
      return { finding: created, history: created.history, revision: saved.revision }
    }
    if (!current || !input.findingId) throw new DomainRuleError('finding-unknown', 'Finding is unknown.')
    const target = String(input.payload?.status ?? input.action)
    const flow = ['open', 'assigned', 'dispositioned', 'corrective-action', 'ready-for-closure', 'reverified', 'closed']
    const currentIndex = flow.indexOf(current.status)
    const targetIndex = flow.indexOf(target)
    if (targetIndex !== currentIndex + 1) throw new DomainRuleError('transition-invalid', 'Transition is invalid.')
    if (target === 'reverified') {
      const evidence = input.payload?.reverificationEvidence
      const verifier = String(input.payload?.independentVerifier ?? '')
      if (!Array.isArray(evidence) || evidence.length === 0 || !verifier || verifier === current.owner) {
        throw new DomainRuleError('closure-evidence-missing', 'Closure evidence or required independence is missing.')
      }
    }
    const updated: FindingRecord = {
      ...current,
      status: target,
      history: [...current.history, {
        at: new Date().toISOString(),
        actor: String(input.payload?.actor ?? 'Audit Hub user'),
        action: target,
        ...(input.payload?.note ? { note: String(input.payload.note) } : {}),
      }],
    }
    const saved = await this.dependencies.store.saveOverlay(input.workspaceId, {
      ...overlay,
      findings: { ...overlay.findings, [updated.id]: updated },
      activity: [{
        at: new Date().toISOString(),
        kind: 'finding-transition',
        message: `${updated.id} moved to ${updated.status}.`,
      }, ...overlay.activity],
    }, input.expectedRevision)
    return { finding: updated, history: updated.history, revision: saved.revision }
  }

  async recordReview(input: {
    workspaceId: string
    evidenceIds: string[]
    review: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    if (!input.evidenceIds?.length) throw new DomainRuleError('selection-empty', 'Evidence selection is empty.')
    const snapshot = await this.currentSnapshot(input.workspaceId)
    const unknown = input.evidenceIds.filter((id) => !snapshot.evidence.some((record) => record.id === id))
    if (unknown.length > 0) {
      throw new DomainRuleError('evidence-unknown', `Review evidence selection is unknown: ${unknown.join(', ')}`)
    }
    const requiresIndependence = (
      snapshot.workspace.softwareLevel === 'Level A'
      || snapshot.workspace.softwareLevel === 'Level B'
    ) && input.evidenceIds.some((id) =>
      snapshot.evidence.find((record) => record.id === id)?.type === 'llr')
    if (input.review.independent === false && (input.review.requiresIndependence === true || requiresIndependence)) {
      throw new DomainRuleError('independence-required', 'Required independence is not demonstrated.')
    }
    const overlay = await this.dependencies.store.getOverlay(input.workspaceId)
    const review: ReviewRecord = {
      id: `REV-LOCAL-${randomUUID().slice(0, 8)}`,
      reviewType: String(input.review.reviewType ?? 'Audit Hub review'),
      subjectId: input.evidenceIds[0] ?? '',
      phase: PHASES.includes(input.review.phase as typeof PHASES[number])
        ? input.review.phase as ReviewRecord['phase']
        : 'qa',
      reviewer: String(input.review.reviewer ?? 'Audit Hub user'),
      method: ['inspection', 'walkthrough', 'analysis', 'checklist'].includes(String(input.review.method))
        ? String(input.review.method)
        : 'checklist',
      date: String(input.review.date ?? new Date().toISOString().slice(0, 10)),
      revision: String(input.review.revision ?? 'local'),
      result: ['passed', 'passed-with-actions', 'failed', 'pending'].includes(String(input.review.result))
        ? String(input.review.result)
        : 'pending',
      independent: Boolean(input.review.independent),
      openActions: Number(input.review.openActions ?? 0),
      comments: String(input.review.comments ?? ''),
      findingIds: Array.isArray(input.review.findingIds) ? input.review.findingIds.map(String) : [],
    }
    await this.dependencies.store.saveOverlay(input.workspaceId, {
      ...overlay,
      reviews: [review, ...overlay.reviews],
      activity: [{
        at: new Date().toISOString(),
        kind: 'review-recorded',
        message: `Review ${review.id} recorded for ${input.evidenceIds.join(', ')}.`,
      }, ...overlay.activity],
    })
    return { reviewRecord: review, coverageImpact: { evidenceIds: input.evidenceIds } }
  }

  async buildPackage(input: {
    workspaceId: string
    snapshotId?: string
    selection?: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    const snapshot = await this.mergedSnapshot(input.workspaceId, input.snapshotId)
    const selectionIds = Array.isArray(input.selection?.evidenceIds)
      ? input.selection.evidenceIds.map(String)
      : snapshot.evidence.map((record) => record.id)
    const selectedPhaseIds = Array.isArray(input.selection?.phaseIds)
      ? input.selection.phaseIds.map(String)
      : undefined
    const invalidPhases = selectedPhaseIds?.filter((phase) => !PHASES.includes(phase as typeof PHASES[number])) ?? []
    if (invalidPhases.length > 0) {
      throw new DomainRuleError('phase-unknown', `Unknown lifecycle phase in package scope: ${invalidPhases.join(', ')}`)
    }
    const unresolved = selectionIds.filter((id) => !snapshot.evidence.some((record) => record.id === id))
    if (unresolved.length > 0) throw new DomainRuleError('evidence-unresolved', 'Selected evidence is unresolved.')
    if (snapshot.evidence.some((record) => selectionIds.includes(record.id) && (!record.hash || !record.revision))) {
      throw new DomainRuleError('revision-missing', 'A required hash or revision is missing.')
    }
    const result = await this.dependencies.packageWriter.write({
      workspaceId: input.workspaceId,
      snapshot,
      evidenceIds: selectionIds,
      ...(selectedPhaseIds ? { phaseIds: selectedPhaseIds } : {}),
      includeFindings: input.selection?.includeFindings !== false,
      includeReviews: input.selection?.includeReviews !== false,
      ...(typeof input.selection?.name === 'string' ? { requestedName: input.selection.name } : {}),
    })
    const overlay = await this.dependencies.store.getOverlay(input.workspaceId)
    const packageCreatedAt = typeof result.manifest.createdAt === 'string'
      ? result.manifest.createdAt
      : new Date().toISOString()
    const previousPackages = overlay.packages.filter((entry) =>
      !entry
      || typeof entry !== 'object'
      || !('packageId' in entry)
      || entry.packageId !== result.packageId)
    await this.dependencies.store.saveOverlay(input.workspaceId, {
      ...overlay,
      packages: [{ ...result, createdAt: packageCreatedAt }, ...previousPackages],
      activity: [{
        at: new Date().toISOString(),
        kind: 'package-created',
        message: `Audit package ${result.packageId} created with ${selectionIds.length} evidence records.`,
      }, ...overlay.activity],
    })
    return {
      packageId: result.packageId,
      manifest: result.manifest,
      download: {
        path: result.absolutePath,
        url: `/api/packages/download/${encodeURIComponent(result.packageId)}.zip`,
        contentHash: result.contentHash,
      },
    }
  }

  async resetSample(workspaceId: string): Promise<Record<string, unknown>> {
    const snapshot = await this.currentSnapshot(workspaceId)
    if (snapshot.workspace.kind !== 'sample') {
      throw new DomainRuleError('not-sample', 'Reset is requested for a real project.')
    }
    const currentOverlay = await this.dependencies.store.getOverlay(workspaceId)
    const packageIds = currentOverlay.packages.flatMap((entry) => (
      entry
      && typeof entry === 'object'
      && 'packageId' in entry
      && typeof entry.packageId === 'string'
        ? [entry.packageId]
        : []
    ))
    await this.dependencies.packageWriter.remove(packageIds)
    const overlay = await this.dependencies.store.resetOverlay(workspaceId)
    return {
      overlayRevision: overlay.revision,
      restoredCounts: countsFor(snapshot),
    }
  }

  async persist(input: {
    workspaceId?: string
    mode: string
    payload?: unknown
  }): Promise<Record<string, unknown>> {
    if (input.mode === 'configure-workspace') {
      const configuration = await this.configureWorkspace(input.payload as ConfigureWorkspaceInput)
      return {
        committedRevision: 1,
        contentHashes: { configuration: sha256Json(configuration) },
        workspaceState: configuration,
      }
    }
    if (!input.workspaceId) throw new DomainRuleError('workspace-required', 'Workspace identity is required.')
    if (input.mode === 'overlay') {
      const payload = input.payload as Partial<OverlayEnvelope>
      const overlay = await this.dependencies.store.getOverlay(input.workspaceId)
      const saved = await this.dependencies.store.saveOverlay(input.workspaceId, {
        ...overlay,
        ...payload,
        workspaceId: input.workspaceId,
      }, payload.revision)
      return {
        committedRevision: saved.revision,
        contentHashes: { overlay: sha256Json(saved) },
        workspaceState: saved,
      }
    }
    throw new DomainRuleError('mode-unsupported', `Unsupported persistence mode: ${input.mode}`)
  }

  async accessExternalArtifacts(source: unknown): Promise<Record<string, unknown>> {
    const root = source as SourceRootConfiguration
    const catalog = await this.dependencies.artifactCatalog.discover(root)
    return {
      adapter: this.dependencies.artifactCatalog.id,
      records: catalog.artifacts,
      diagnostics: catalog.diagnostics,
      provenance: catalog.artifacts.map((artifact) => ({
        sourcePath: artifact.relativePath,
        hash: artifact.hash,
        adapterId: this.dependencies.artifactCatalog.id,
      })),
    }
  }
}

export class DomainRuleError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'DomainRuleError'
  }
}
