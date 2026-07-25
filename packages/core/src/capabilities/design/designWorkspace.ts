/**
 * EUC-13 — Persistence and migration adapter (workspace half).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §5, §16,
 * §19 ("Lost client session", "Concurrent edit"), §20.3, §21, §25.3
 * (EUC-13..17).
 *
 * Node-only file-system adapter. Stores design-workflow records under
 * `<dataDir>/projects/<projectId>/design/` as an ADDITIVE subtree beside the
 * legacy `capabilities/` tree written by `../persistence.ts`. This module
 * never edits, deletes, or reads that legacy tree, and never changes
 * `CURRENT_WORKSPACE_SCHEMA_VERSION`; it owns its own
 * `meta/schema-version.json` ('1.0') inside the `design/` subtree.
 *
 * Copies the atomic-write and index patterns from `../persistence.ts`
 * (`CapabilityWorkspace`) rather than importing it, so this adapter has no
 * coupling to the legacy schema version gate.
 *
 * Do NOT import this module from a browser entry (`src/index.ts` "."/
 * "./browser" exports) — it uses `node:fs` directly.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { canonicalHash } from '../hash.js'
import type { ArchitectureSpecification, ApplicationSpecification, JobRecord } from '../types.js'
import type {
  ApprovalAuthority,
  ContextManifest,
  DesignAuditEvent,
  DesignBaseline,
  DesignFeatureFlag,
  DesignImpactRecord,
  DesignOperationResult,
  DesignWorkflowPolicy,
  DeltaInspection,
  DiagramDiscussionEntry,
  ModuleDesignPacket,
  ModuleDesignSession,
  ModuleDesignSpecification,
  ModuleImplementationPacket,
  ReturnedDelta,
  ScenarioRun,
  UseCaseAnalysis,
} from './records.js'
import type { RegisteredContract } from './contractRegistry.js'

// ---------------------------------------------------------------------------
// File helpers (pattern copied from ../persistence.ts atomicWriteJson)
// ---------------------------------------------------------------------------

/**
 * File stem for a record id that may exceed OS filename limits (deep
 * `childId` chains, e.g. diagram-relationship ids). Long ids keep a readable
 * prefix plus a stable hash suffix; the full id stays inside the JSON body.
 */
function safeFileStem(id: string): string {
  const sanitized = id.replace(/[^A-Za-z0-9._-]+/g, '_')
  if (sanitized.length <= 120) return sanitized
  const digest = crypto.createHash('sha256').update(id).digest('hex').slice(0, 16)
  return `${sanitized.slice(0, 100)}.${digest}`
}

function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmp, filePath)
}

function readJson<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function listJsonRevisions(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return []
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort((a, b) => a.localeCompare(b))
}

// ---------------------------------------------------------------------------
// Path containment (§20.2 "the product shall reject symbolic-link or
// path-traversal escapes") — every identifier that becomes a filesystem path
// segment (projectId, moduleId, record ids, packet/delta/scenario/session
// ids, revision strings, contract operationId/version, actor ids used as a
// role key) is validated by this single guard *before* it reaches
// `path.join`. `safeFileStem` (below) still runs after this guard for ids
// that are otherwise safe but too long for a filename.
// ---------------------------------------------------------------------------

const MAX_PATH_SEGMENT_LENGTH = 300

/** Thrown by `assertSafeSegment` for any identifier that is not a single, safe path segment. */
export class DesignPathError extends Error {
  readonly code = 'design-path-invalid' as const
  readonly kind: string
  readonly value: string

  constructor(kind: string, value: string, reason: string) {
    super(`invalid ${kind} for a persisted path: ${reason} (received ${JSON.stringify(value)})`)
    this.name = 'DesignPathError'
    this.kind = kind
    this.value = value
  }
}

/**
 * §20.2 / §20.3 — a single path segment: no separators, no traversal, no
 * NUL, no leading dot, bounded length. Applied at the `DesignWorkspace`
 * boundary to every caller-influenced identifier that is joined into a
 * persisted file path, so a traversal attempt (`'../../escaped-project'`,
 * an embedded `'..'` segment, a symlink-style escape) throws before any
 * `fs` call runs and nothing is written outside `dataDir`.
 */
function assertSafeSegment(kind: string, value: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DesignPathError(kind, String(value), 'must be a non-empty string')
  }
  if (value.length > MAX_PATH_SEGMENT_LENGTH) {
    throw new DesignPathError(kind, value, `must be ${MAX_PATH_SEGMENT_LENGTH} characters or fewer`)
  }
  if (value.indexOf(String.fromCharCode(0)) !== -1) {
    throw new DesignPathError(kind, value, 'must not contain a NUL byte')
  }
  if (value.includes('/') || value.includes('\\')) {
    throw new DesignPathError(kind, value, 'must not contain a path separator')
  }
  if (value === '.' || value === '..') {
    throw new DesignPathError(kind, value, 'must not be "." or ".."')
  }
  if (value.startsWith('.')) {
    throw new DesignPathError(kind, value, 'must not start with "."')
  }
}

/** `assertSafeSegment` followed by `<dirPath>/<id>.json` — the common id-file shape. */
function idFilePath(dirPath: string, kind: string, id: string): string {
  assertSafeSegment(kind, id)
  return path.join(dirPath, `${id}.json`)
}

// ---------------------------------------------------------------------------
// Conflict error (§19 "Concurrent edit")
// ---------------------------------------------------------------------------

/**
 * §19 "Concurrent edit" — thrown by a `*Draft` save when the caller's
 * `expectedRevision` does not match the revision currently on disk. Carries
 * both revisions and both full records so the caller can offer a three-way
 * comparison (on-disk base, the caller's attempted write, and — for the
 * caller to fetch separately if needed — the record the caller last read).
 */
export class DesignConflictError<T = unknown> extends Error {
  readonly code = 'stale-revision' as const
  readonly recordId: string
  readonly expectedRevision: string | undefined
  readonly actualRevision: string | undefined
  readonly onDisk: T | undefined
  readonly attempted: T

  constructor(input: {
    recordId: string
    expectedRevision: string | undefined
    actualRevision: string | undefined
    onDisk: T | undefined
    attempted: T
  }) {
    super(
      `stale save rejected for "${input.recordId}": expected revision ${JSON.stringify(
        input.expectedRevision,
      )} but found ${JSON.stringify(input.actualRevision)} on disk`,
    )
    this.name = 'DesignConflictError'
    this.recordId = input.recordId
    this.expectedRevision = input.expectedRevision
    this.actualRevision = input.actualRevision
    this.onDisk = input.onDisk
    this.attempted = input.attempted
  }
}

function checkExpectedRevision<T>(
  recordId: string,
  onDisk: T | undefined,
  onDiskRevision: string | undefined,
  expectedRevision: string | undefined,
  attempted: T,
): void {
  if (expectedRevision === undefined) return
  if (onDiskRevision === expectedRevision) return
  throw new DesignConflictError<T>({ recordId, expectedRevision, actualRevision: onDiskRevision, onDisk, attempted })
}

// ---------------------------------------------------------------------------
// Schema meta and per-project index
// ---------------------------------------------------------------------------

export type DesignSchemaMeta = {
  schemaVersion: '1.0'
  initializedAt: string
}

export const CURRENT_DESIGN_SCHEMA_VERSION = '1.0' as const

export type DesignModuleIndexEntry = {
  hasDraft: boolean
  approvedRevision?: string
  approvedRevisions: string[]
}

/** Pattern: `CapabilityIndex` (../persistence.ts) — approved-revision pointers per project. */
export type DesignIndex = {
  schemaVersion: '1.0'
  useCaseAnalysisApprovedRevision?: string
  applicationApprovedRevision?: string
  architectureApprovedRevision?: string
  baselineApprovedRevision?: string
  modules: Record<string, DesignModuleIndexEntry>
}

// ---------------------------------------------------------------------------
// DesignWorkspace
// ---------------------------------------------------------------------------

export class DesignWorkspace {
  constructor(readonly dataDir: string) {}

  /** `<dataDir>/projects/<projectId>/design` — additive sibling of `capabilities/`. */
  root(projectId: string): string {
    assertSafeSegment('projectId', projectId)
    return path.join(this.dataDir, 'projects', projectId, 'design')
  }

  private metaPath(projectId: string): string {
    return path.join(this.root(projectId), 'meta', 'schema-version.json')
  }

  ensureInitialized(projectId: string): DesignSchemaMeta {
    const metaPath = this.metaPath(projectId)
    const existing = readJson<DesignSchemaMeta>(metaPath)
    if (existing) return existing
    const meta: DesignSchemaMeta = { schemaVersion: CURRENT_DESIGN_SCHEMA_VERSION, initializedAt: new Date().toISOString() }
    atomicWriteJson(metaPath, meta)
    atomicWriteJson(this.indexPath(projectId), { schemaVersion: '1.0', modules: {} } satisfies DesignIndex)
    return meta
  }

  /** Every project id that has an initialized `design/` subtree under `dataDir`. */
  listProjects(): string[] {
    const projectsRoot = path.join(this.dataDir, 'projects')
    if (!fs.existsSync(projectsRoot)) return []
    return fs
      .readdirSync(projectsRoot)
      .filter((projectId) => fs.existsSync(this.metaPath(projectId)))
      .sort((a, b) => a.localeCompare(b))
  }

  private indexPath(projectId: string): string {
    return path.join(this.root(projectId), 'index.json')
  }

  getIndex(projectId: string): DesignIndex {
    this.ensureInitialized(projectId)
    const index = readJson<DesignIndex>(this.indexPath(projectId)) ?? { schemaVersion: '1.0', modules: {} }
    index.modules ??= {}
    return index
  }

  private saveIndex(projectId: string, index: DesignIndex): void {
    atomicWriteJson(this.indexPath(projectId), index)
  }

  // -------------------------------------------------------------------------
  // Use-case analysis
  // -------------------------------------------------------------------------

  saveUseCaseAnalysisDraft(projectId: string, draft: UseCaseAnalysis, options: { expectedRevision?: string } = {}): void {
    this.ensureInitialized(projectId)
    const current = this.getUseCaseAnalysisDraft(projectId)
    checkExpectedRevision(draft.id, current, current?.revision, options.expectedRevision, draft)
    atomicWriteJson(path.join(this.root(projectId), 'use-case-analysis', 'drafts', 'current.json'), draft)
  }

  getUseCaseAnalysisDraft(projectId: string): UseCaseAnalysis | undefined {
    return readJson(path.join(this.root(projectId), 'use-case-analysis', 'drafts', 'current.json'))
  }

  approveUseCaseAnalysis(projectId: string, approved: UseCaseAnalysis): UseCaseAnalysis {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'use-case-analysis', 'approved'), 'revision', approved.revision)
    if (fs.existsSync(dest)) {
      throw new Error(`approved use-case analysis revision already exists: ${approved.revision}`)
    }
    atomicWriteJson(dest, approved)
    const index = this.getIndex(projectId)
    index.useCaseAnalysisApprovedRevision = approved.revision
    this.saveIndex(projectId, index)
    return approved
  }

  getApprovedUseCaseAnalysis(projectId: string, revision?: string): UseCaseAnalysis | undefined {
    const rev = revision ?? this.getIndex(projectId).useCaseAnalysisApprovedRevision
    if (!rev) return undefined
    return readJson(idFilePath(path.join(this.root(projectId), 'use-case-analysis', 'approved'), 'revision', rev))
  }

  listApprovedUseCaseAnalysisRevisions(projectId: string): string[] {
    return listJsonRevisions(path.join(this.root(projectId), 'use-case-analysis', 'approved'))
  }

  // -------------------------------------------------------------------------
  // Compiled ApplicationSpecification (EUC-02 output)
  // -------------------------------------------------------------------------

  saveApplicationDraft(
    projectId: string,
    draft: ApplicationSpecification,
    options: { expectedRevision?: string } = {},
  ): void {
    this.ensureInitialized(projectId)
    const current = this.getApplicationDraft(projectId)
    checkExpectedRevision(draft.id, current, current?.revision, options.expectedRevision, draft)
    atomicWriteJson(path.join(this.root(projectId), 'application', 'drafts', 'current.json'), draft)
  }

  getApplicationDraft(projectId: string): ApplicationSpecification | undefined {
    return readJson(path.join(this.root(projectId), 'application', 'drafts', 'current.json'))
  }

  approveApplication(projectId: string, approved: ApplicationSpecification): ApplicationSpecification {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'application', 'approved'), 'revision', approved.revision)
    if (fs.existsSync(dest)) {
      throw new Error(`approved application revision already exists: ${approved.revision}`)
    }
    atomicWriteJson(dest, approved)
    const index = this.getIndex(projectId)
    index.applicationApprovedRevision = approved.revision
    this.saveIndex(projectId, index)
    return approved
  }

  getApprovedApplication(projectId: string, revision?: string): ApplicationSpecification | undefined {
    const rev = revision ?? this.getIndex(projectId).applicationApprovedRevision
    if (!rev) return undefined
    return readJson(idFilePath(path.join(this.root(projectId), 'application', 'approved'), 'revision', rev))
  }

  listApprovedApplicationRevisions(projectId: string): string[] {
    return listJsonRevisions(path.join(this.root(projectId), 'application', 'approved'))
  }

  // -------------------------------------------------------------------------
  // System structure / architecture (EUC-03 output). Own subtree — never
  // reads or writes the legacy `capabilities/architecture/` tree.
  // -------------------------------------------------------------------------

  saveArchitectureDraft(
    projectId: string,
    draft: ArchitectureSpecification,
    options: { expectedRevision?: string } = {},
  ): void {
    this.ensureInitialized(projectId)
    const current = this.getArchitectureDraft(projectId)
    checkExpectedRevision(draft.id, current, current?.revision, options.expectedRevision, draft)
    atomicWriteJson(path.join(this.root(projectId), 'architecture', 'drafts', 'current.json'), draft)
  }

  getArchitectureDraft(projectId: string): ArchitectureSpecification | undefined {
    return readJson(path.join(this.root(projectId), 'architecture', 'drafts', 'current.json'))
  }

  approveArchitecture(projectId: string, approved: ArchitectureSpecification): ArchitectureSpecification {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'architecture', 'approved'), 'revision', approved.revision)
    if (fs.existsSync(dest)) {
      throw new Error(`approved architecture revision already exists: ${approved.revision}`)
    }
    atomicWriteJson(dest, approved)
    const index = this.getIndex(projectId)
    index.architectureApprovedRevision = approved.revision
    this.saveIndex(projectId, index)
    return approved
  }

  getApprovedArchitecture(projectId: string, revision?: string): ArchitectureSpecification | undefined {
    const rev = revision ?? this.getIndex(projectId).architectureApprovedRevision
    if (!rev) return undefined
    return readJson(idFilePath(path.join(this.root(projectId), 'architecture', 'approved'), 'revision', rev))
  }

  listApprovedArchitectureRevisions(projectId: string): string[] {
    return listJsonRevisions(path.join(this.root(projectId), 'architecture', 'approved'))
  }

  // -------------------------------------------------------------------------
  // ModuleDesignSpecification — draft + immutable approved revision history.
  // -------------------------------------------------------------------------

  private moduleDir(projectId: string, moduleId: string): string {
    assertSafeSegment('moduleId', moduleId)
    return path.join(this.root(projectId), 'modules', moduleId)
  }

  saveModuleDesignDraft(
    projectId: string,
    moduleId: string,
    draft: ModuleDesignSpecification,
    options: { expectedRevision?: string } = {},
  ): void {
    this.ensureInitialized(projectId)
    const current = this.getModuleDesignDraft(projectId, moduleId)
    checkExpectedRevision(draft.id, current, current?.revision, options.expectedRevision, draft)
    atomicWriteJson(path.join(this.moduleDir(projectId, moduleId), 'drafts', 'current.json'), draft)
    const index = this.getIndex(projectId)
    index.modules[moduleId] = {
      ...(index.modules[moduleId] ?? { approvedRevisions: [] }),
      hasDraft: true,
    }
    this.saveIndex(projectId, index)
  }

  getModuleDesignDraft(projectId: string, moduleId: string): ModuleDesignSpecification | undefined {
    return readJson(path.join(this.moduleDir(projectId, moduleId), 'drafts', 'current.json'))
  }

  /**
   * §5.3 "a new revision shall not change the content of an approved
   * revision" / §2.2 "never overwrite an earlier approval" — throws if this
   * exact revision was already approved. Keeps full history: every approved
   * revision file is retained (never deleted or replaced) under
   * `approved/<revision>.json`.
   */
  approveModuleDesign(projectId: string, moduleId: string, approved: ModuleDesignSpecification): ModuleDesignSpecification {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.moduleDir(projectId, moduleId), 'approved'), 'revision', approved.revision)
    if (fs.existsSync(dest)) {
      throw new Error(`approved module-design revision already exists: ${moduleId}@${approved.revision}`)
    }
    atomicWriteJson(dest, approved)
    const index = this.getIndex(projectId)
    const entry = index.modules[moduleId] ?? { hasDraft: false, approvedRevisions: [] }
    index.modules[moduleId] = {
      ...entry,
      approvedRevision: approved.revision,
      approvedRevisions: [...entry.approvedRevisions, approved.revision].sort((a, b) => a.localeCompare(b)),
    }
    this.saveIndex(projectId, index)
    return approved
  }

  getApprovedModuleDesign(projectId: string, moduleId: string, revision?: string): ModuleDesignSpecification | undefined {
    const rev = revision ?? this.getIndex(projectId).modules[moduleId]?.approvedRevision
    if (!rev) return undefined
    return readJson(idFilePath(path.join(this.moduleDir(projectId, moduleId), 'approved'), 'revision', rev))
  }

  /** Full approved revision history for one module, oldest first (stable sort by revision id). */
  listModuleDesignRevisions(projectId: string, moduleId: string): ModuleDesignSpecification[] {
    return listJsonRevisions(path.join(this.moduleDir(projectId, moduleId), 'approved')).map(
      (revision) => this.getApprovedModuleDesign(projectId, moduleId, revision)!,
    )
  }

  listModuleIds(projectId: string): string[] {
    return Object.keys(this.getIndex(projectId).modules).sort((a, b) => a.localeCompare(b))
  }

  // -------------------------------------------------------------------------
  // ModuleDesignSession — one resumable session per module (§16.3, §18.3).
  // §19 "Lost client session" / §25.3 "restart restores the module session
  // and selected module": persisted at every step transition so a fresh
  // `DesignWorkspace` instance (new process) resumes at the exact step.
  // -------------------------------------------------------------------------

  saveModuleDesignSession(projectId: string, session: ModuleDesignSession): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.moduleDir(projectId, session.moduleId), 'session', 'current.json'), session)
  }

  getModuleDesignSession(projectId: string, moduleId: string): ModuleDesignSession | undefined {
    return readJson(path.join(this.moduleDir(projectId, moduleId), 'session', 'current.json'))
  }

  // -------------------------------------------------------------------------
  // DesignBaseline — draft + immutable approved revisions.
  // -------------------------------------------------------------------------

  saveDesignBaselineDraft(projectId: string, draft: DesignBaseline, options: { expectedRevision?: string } = {}): void {
    this.ensureInitialized(projectId)
    const current = this.getDesignBaselineDraft(projectId)
    checkExpectedRevision(draft.id, current, current?.revision, options.expectedRevision, draft)
    atomicWriteJson(path.join(this.root(projectId), 'baseline', 'drafts', 'current.json'), draft)
  }

  getDesignBaselineDraft(projectId: string): DesignBaseline | undefined {
    return readJson(path.join(this.root(projectId), 'baseline', 'drafts', 'current.json'))
  }

  approveDesignBaseline(projectId: string, approved: DesignBaseline): DesignBaseline {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'baseline', 'approved'), 'revision', approved.revision)
    if (fs.existsSync(dest)) {
      throw new Error(`approved design baseline revision already exists: ${approved.revision}`)
    }
    atomicWriteJson(dest, approved)
    const index = this.getIndex(projectId)
    index.baselineApprovedRevision = approved.revision
    this.saveIndex(projectId, index)
    return approved
  }

  getApprovedDesignBaseline(projectId: string, revision?: string): DesignBaseline | undefined {
    const rev = revision ?? this.getIndex(projectId).baselineApprovedRevision
    if (!rev) return undefined
    return readJson(idFilePath(path.join(this.root(projectId), 'baseline', 'approved'), 'revision', rev))
  }

  listApprovedDesignBaselineRevisions(projectId: string): string[] {
    return listJsonRevisions(path.join(this.root(projectId), 'baseline', 'approved'))
  }

  // -------------------------------------------------------------------------
  // DesignWorkflowPolicy (§16.7) — single current record per project.
  // -------------------------------------------------------------------------

  saveDesignWorkflowPolicy(projectId: string, policy: DesignWorkflowPolicy): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'policy.json'), policy)
  }

  getDesignWorkflowPolicy(projectId: string): DesignWorkflowPolicy | undefined {
    return readJson(path.join(this.root(projectId), 'policy.json'))
  }

  // -------------------------------------------------------------------------
  // DesignFeatureFlag (§23.3) — single current record per project. Disabling
  // never deletes any other file in this workspace; only this flag record
  // is overwritten.
  // -------------------------------------------------------------------------

  saveFeatureFlag(projectId: string, flag: DesignFeatureFlag): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'feature-flag.json'), flag)
  }

  getFeatureFlag(projectId: string): DesignFeatureFlag | undefined {
    return readJson(path.join(this.root(projectId), 'feature-flag.json'))
  }

  // -------------------------------------------------------------------------
  // ContextManifest (§16.4)
  // -------------------------------------------------------------------------

  saveContextManifest(projectId: string, manifest: ContextManifest): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(idFilePath(path.join(this.root(projectId), 'context-manifests'), 'contextManifestId', manifest.id), manifest)
  }

  getContextManifest(projectId: string, id: string): ContextManifest | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'context-manifests'), 'contextManifestId', id))
  }

  listContextManifests(projectId: string): ContextManifest[] {
    return listJsonRevisions(path.join(this.root(projectId), 'context-manifests')).map(
      (id) => this.getContextManifest(projectId, id)!,
    )
  }

  // -------------------------------------------------------------------------
  // Packets (§11.2, §11.3) — immutable once written.
  // -------------------------------------------------------------------------

  saveModuleDesignPacket(projectId: string, packet: ModuleDesignPacket): void {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'packets', 'module-design'), 'packetId', packet.packetId)
    if (fs.existsSync(dest)) {
      throw new Error(`module-design packet is immutable and already exists: ${packet.packetId}`)
    }
    atomicWriteJson(dest, packet)
  }

  getModuleDesignPacket(projectId: string, packetId: string): ModuleDesignPacket | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'packets', 'module-design'), 'packetId', packetId))
  }

  saveModuleImplementationPacket(projectId: string, packet: ModuleImplementationPacket): void {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'packets', 'module-implementation'), 'packetId', packet.packetId)
    if (fs.existsSync(dest)) {
      throw new Error(`module-implementation packet is immutable and already exists: ${packet.packetId}`)
    }
    atomicWriteJson(dest, packet)
  }

  getModuleImplementationPacket(projectId: string, packetId: string): ModuleImplementationPacket | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'packets', 'module-implementation'), 'packetId', packetId))
  }

  // -------------------------------------------------------------------------
  // Returned deltas + inspections (§11.5, §11.6, §19 "Stale response").
  // A delta is preserved as evidence even when its inspection later rejects
  // it — the delta itself is never conditionally written.
  // -------------------------------------------------------------------------

  saveReturnedDelta(projectId: string, delta: ReturnedDelta): void {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'deltas'), 'deltaId', delta.deltaId)
    if (fs.existsSync(dest)) {
      throw new Error(`returned delta is immutable and already exists: ${delta.deltaId}`)
    }
    atomicWriteJson(dest, delta)
  }

  getReturnedDelta(projectId: string, deltaId: string): ReturnedDelta | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'deltas'), 'deltaId', deltaId))
  }

  saveDeltaInspection(projectId: string, inspection: DeltaInspection): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(
      idFilePath(path.join(this.root(projectId), 'delta-inspections'), 'inspectionId', inspection.inspectionId),
      inspection,
    )
  }

  getDeltaInspection(projectId: string, inspectionId: string): DeltaInspection | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'delta-inspections'), 'inspectionId', inspectionId))
  }

  // -------------------------------------------------------------------------
  // DesignImpactRecord (§10)
  // -------------------------------------------------------------------------

  saveDesignImpactRecord(projectId: string, record: DesignImpactRecord): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(idFilePath(path.join(this.root(projectId), 'impacts'), 'impactId', record.impactId), record)
  }

  getDesignImpactRecord(projectId: string, impactId: string): DesignImpactRecord | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'impacts'), 'impactId', impactId))
  }

  listDesignImpactRecords(projectId: string): DesignImpactRecord[] {
    return listJsonRevisions(path.join(this.root(projectId), 'impacts')).map(
      (id) => this.getDesignImpactRecord(projectId, id)!,
    )
  }

  // -------------------------------------------------------------------------
  // ScenarioRun (§14.3) — immutable once written.
  // -------------------------------------------------------------------------

  saveScenarioRun(projectId: string, run: ScenarioRun): void {
    this.ensureInitialized(projectId)
    const dest = idFilePath(path.join(this.root(projectId), 'scenario-runs'), 'runId', run.runId)
    if (fs.existsSync(dest)) {
      throw new Error(`scenario run is immutable and already exists: ${run.runId}`)
    }
    atomicWriteJson(dest, run)
  }

  getScenarioRun(projectId: string, runId: string): ScenarioRun | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'scenario-runs'), 'runId', runId))
  }

  listScenarioRuns(projectId: string): ScenarioRun[] {
    return listJsonRevisions(path.join(this.root(projectId), 'scenario-runs')).map(
      (id) => this.getScenarioRun(projectId, id)!,
    )
  }

  // -------------------------------------------------------------------------
  // Audit events (§20.3) — append-only `audit/events.jsonl`, one JSON object
  // per line. §5.3 / §17.3 idempotency: a retry with the same
  // `idempotencyKey` returns the first committed event rather than
  // appending a duplicate.
  // -------------------------------------------------------------------------

  private auditLogPath(projectId: string): string {
    return path.join(this.root(projectId), 'audit', 'events.jsonl')
  }

  findAuditEventByIdempotencyKey(projectId: string, idempotencyKey: string): DesignAuditEvent | undefined {
    return this.listAuditEvents(projectId).find((event) => event.idempotencyKey === idempotencyKey)
  }

  /**
   * Appends `event` to the append-only audit log. If `event.idempotencyKey`
   * is set and a prior event already committed with that key, this is a
   * no-op that returns the first committed event unchanged (§5.3, §17.3).
   */
  appendAuditEvent(projectId: string, event: DesignAuditEvent): DesignAuditEvent {
    this.ensureInitialized(projectId)
    if (event.idempotencyKey) {
      const existing = this.findAuditEventByIdempotencyKey(projectId, event.idempotencyKey)
      if (existing) return existing
    }
    const logPath = this.auditLogPath(projectId)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.appendFileSync(logPath, JSON.stringify(event) + '\n')
    return event
  }

  listAuditEvents(projectId: string): DesignAuditEvent[] {
    const logPath = this.auditLogPath(projectId)
    if (!fs.existsSync(logPath)) return []
    const raw = fs.readFileSync(logPath, 'utf8')
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as DesignAuditEvent)
  }

  // -------------------------------------------------------------------------
  // DiagramDiscussionEntry (§9.8)
  // -------------------------------------------------------------------------

  saveDiagramDiscussionEntry(projectId: string, entry: DiagramDiscussionEntry): void {
    this.ensureInitialized(projectId)
    assertSafeSegment('diagramDiscussionEntryId', entry.id)
    atomicWriteJson(path.join(this.root(projectId), 'diagram-discussions', `${safeFileStem(entry.id)}.json`), entry)
  }

  listDiagramDiscussionEntries(projectId: string, diagramId?: string): DiagramDiscussionEntry[] {
    const entries = listJsonRevisions(path.join(this.root(projectId), 'diagram-discussions')).map(
      (id) => readJson<DiagramDiscussionEntry>(path.join(this.root(projectId), 'diagram-discussions', `${id}.json`))!,
    )
    return diagramId ? entries.filter((entry) => entry.diagramId === diagramId) : entries
  }

  // -------------------------------------------------------------------------
  // Jobs (§21 "a long operation shall preserve its job record across
  // application restart").
  // -------------------------------------------------------------------------

  saveJobRecord(projectId: string, job: JobRecord): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(idFilePath(path.join(this.root(projectId), 'jobs'), 'jobId', job.jobId), job)
  }

  getJobRecord(projectId: string, jobId: string): JobRecord | undefined {
    return readJson(idFilePath(path.join(this.root(projectId), 'jobs'), 'jobId', jobId))
  }

  loadJobRecords(projectId: string): JobRecord[] {
    return listJsonRevisions(path.join(this.root(projectId), 'jobs')).map(
      (jobId) => this.getJobRecord(projectId, jobId)!,
    )
  }

  // -------------------------------------------------------------------------
  // Workspace UI-resume state (§19 "Lost client session" — "Restore
  // persisted draft and last selected module").
  // -------------------------------------------------------------------------

  saveWorkspaceState(projectId: string, state: { selectedModuleId?: string; lastRoute?: string }): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'workspace-state.json'), state)
  }

  getWorkspaceState(projectId: string): { selectedModuleId?: string; lastRoute?: string } | undefined {
    return readJson(path.join(this.root(projectId), 'workspace-state.json'))
  }

  // -------------------------------------------------------------------------
  // Project roles (§4) — actorId -> held authorities. Authority is never
  // caller-asserted alone: an approval operation checks the acting user's
  // authority against this persisted configuration, not against a claim in
  // the request. Single current record per project.
  // -------------------------------------------------------------------------

  saveProjectRoles(projectId: string, roles: ProjectRoles): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'roles.json'), roles)
  }

  getProjectRoles(projectId: string): ProjectRoles | undefined {
    return readJson(path.join(this.root(projectId), 'roles.json'))
  }

  // -------------------------------------------------------------------------
  // Operation results (§5.3, §17.3) — the FULL result of a change operation,
  // persisted by projectId + operation + idempotencyKey so a retry replays
  // the first committed result (value included) even after a process
  // restart, and so the same idempotencyKey used for a different operation
  // or a different project is never treated as a replay. First write wins:
  // a second save for the same key is a silent no-op, never an overwrite.
  // -------------------------------------------------------------------------

  private operationResultPath(projectId: string, operation: string, idempotencyKey: string): string {
    assertSafeSegment('operation', operation)
    return idFilePath(path.join(this.root(projectId), 'operation-results', operation), 'idempotencyKey', idempotencyKey)
  }

  saveOperationResult(projectId: string, operation: string, idempotencyKey: string, result: DesignOperationResult<unknown>): void {
    this.ensureInitialized(projectId)
    const dest = this.operationResultPath(projectId, operation, idempotencyKey)
    if (fs.existsSync(dest)) return
    atomicWriteJson(dest, result)
  }

  findOperationResult(projectId: string, operation: string, idempotencyKey: string): DesignOperationResult<unknown> | undefined {
    return readJson(this.operationResultPath(projectId, operation, idempotencyKey))
  }

  // -------------------------------------------------------------------------
  // Contract registry persistence (§9.7, EUC-05) — `RegisteredContract`
  // records keyed by operationId + version. An approved version is
  // immutable: `saveContract` refuses to change the content of a version
  // already on disk with `status: 'approved'`.
  // -------------------------------------------------------------------------

  private contractPath(projectId: string, operationId: string, version: string): string {
    assertSafeSegment('operationId', operationId)
    return idFilePath(path.join(this.root(projectId), 'contracts', operationId), 'version', version)
  }

  saveContract(projectId: string, contract: RegisteredContract): void {
    this.ensureInitialized(projectId)
    const dest = this.contractPath(projectId, contract.operationId, contract.version)
    const existing = readJson<RegisteredContract>(dest)
    if (existing?.status === 'approved') {
      if (existing.contentHash === contract.contentHash && existing.status === contract.status) return
      throw new Error(
        `approved contract ${contract.operationId}@${contract.version} is immutable and cannot be changed`,
      )
    }
    atomicWriteJson(dest, contract)
  }

  getContract(projectId: string, operationId: string, version: string): RegisteredContract | undefined {
    return readJson(this.contractPath(projectId, operationId, version))
  }

  listContracts(projectId: string): RegisteredContract[] {
    const contractsRoot = path.join(this.root(projectId), 'contracts')
    if (!fs.existsSync(contractsRoot)) return []
    const contracts: RegisteredContract[] = []
    for (const operationId of fs.readdirSync(contractsRoot).sort((a, b) => a.localeCompare(b))) {
      const dir = path.join(contractsRoot, operationId)
      if (!fs.statSync(dir).isDirectory()) continue
      for (const version of listJsonRevisions(dir)) {
        const contract = readJson<RegisteredContract>(path.join(dir, `${version}.json`))
        if (contract) contracts.push(contract)
      }
    }
    return contracts
  }

  // -------------------------------------------------------------------------
  // Contract consumer acknowledgements (§9.7 "the provider and every known
  // consumer shall review a changed contract") — recorded per contract
  // version + consumer module, either implicitly (a consumer module's
  // `analyzeModuleDesign` run against the current contract version) or
  // explicitly (an ack recorded by `updateModuleDesignItem`).
  // -------------------------------------------------------------------------

  private consumerAckPath(projectId: string, operationId: string, version: string, consumerModuleId: string): string {
    assertSafeSegment('operationId', operationId)
    assertSafeSegment('version', version)
    return idFilePath(
      path.join(this.root(projectId), 'contracts', operationId, version, 'acks'),
      'consumerModuleId',
      consumerModuleId,
    )
  }

  saveConsumerAck(projectId: string, ack: ConsumerContractAck): void {
    this.ensureInitialized(projectId)
    atomicWriteJson(this.consumerAckPath(projectId, ack.operationId, ack.version, ack.consumerModuleId), ack)
  }

  listConsumerAcks(projectId: string, operationId: string, version: string): ConsumerContractAck[] {
    assertSafeSegment('operationId', operationId)
    assertSafeSegment('version', version)
    const dir = path.join(this.root(projectId), 'contracts', operationId, version, 'acks')
    return listJsonRevisions(dir).map((id) => readJson<ConsumerContractAck>(path.join(dir, `${id}.json`))!)
  }
}

export { canonicalHash }

/** §4 — actorId -> the approval authorities that actor holds for this project. */
export type ProjectRoles = Record<string, ApprovalAuthority[]>

/** §9.7 — a consumer module's recorded review of one contract version. */
export type ConsumerContractAck = {
  operationId: string
  version: string
  consumerModuleId: string
  ackedAt: string
  source: 'analyze' | 'explicit'
}
