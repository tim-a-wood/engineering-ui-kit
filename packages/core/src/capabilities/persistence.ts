/**
 * App-managed capability definition persistence (CAP-PKT-003).
 * Layout: <dataDir>/projects/<projectId>/capabilities/...
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ArtifactReference,
  DeployableSpecification,
  FrontendBinding,
  InboundBinding,
  ModuleDesignSession,
  ModuleDesignSpecification,
  ModuleManifest,
  ScenarioRunRecord,
} from './types.js'
import type { ModuleInterviewResponse } from './moduleInterview.js'
import type { FoundationPlan } from './foundation.js'
import { withDefaultExposure } from './journeys.js'
import {
  evaluateApplicationSte,
  evaluateArchitectureSte,
  evaluateFoundationSte,
  evaluateFrontendBindingSte,
  evaluateInboundBindingSte,
  evaluateModuleDesignSte,
  evaluateModuleInterviewSte,
  evaluateModuleSte,
  createProjectSteLexicon,
  validateProjectSteLexicon,
  type ProjectSteLexicon,
  type SteLexicon,
  type SteRecordEvaluation,
} from './simplifiedTechnicalEnglish.js'

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

function assertSteApproval(recordName: string, evaluation: SteRecordEvaluation): void {
  if (evaluation.passed) return
  const details = evaluation.diagnostics
    .slice(0, 5)
    .map((item) => `${item.code}${item.fieldPath ? ` at ${item.fieldPath}` : ''}`)
    .join(', ')
  const remainder = Math.max(0, evaluation.diagnostics.length - 5)
  throw new Error(
    `cannot approve ${recordName}: STE check failed (${details}${remainder ? `, and ${remainder} more` : ''})`,
  )
}

import { canonicalHash } from './hash.js'
export { canonicalHash }

export type CapabilityIndex = {
  schemaVersion: string
  behaviorModelVersion?: '1.0'
  applicationDraftId?: string
  applicationApprovedRevision?: string
  architectureDraftId?: string
  architectureApprovedRevision?: string
  modules: Record<string, { draft?: boolean; approvedRevision?: string }>
  moduleDesigns?: Record<string, { draft?: boolean; approvedRevision?: string; activeSessionId?: string }>
  scenarioRuns?: Record<string, { scenarioId: string; outcome: string; startedAt: string }>
  bindings: Record<string, { draft?: boolean; approvedRevision?: string }>
  deployables: Record<string, { draft?: boolean; approvedRevision?: string }>
  inboundBindings: Record<string, { draft?: boolean; approvedRevision?: string; removedAt?: string }>
  /** WP5A-core: approved-revision key (the plan's own `contentHash`) for the project's single `FoundationPlan`. */
  foundationApprovedRevision?: string
}

export type SchemaMeta = {
  schemaVersion: string
  initializedAt: string
}

/** The workspace schema version this build writes for new records. */
export const CURRENT_WORKSPACE_SCHEMA_VERSION = '2.0' as const
/** Versions this build can read and write. Anything else is future/read-only. */
export const SUPPORTED_WORKSPACE_SCHEMA_VERSIONS = ['1.0', '2.0'] as const
export type WorkspaceSchemaVersion = (typeof SUPPORTED_WORKSPACE_SCHEMA_VERSIONS)[number]

export class CapabilityWorkspace {
  constructor(readonly dataDir: string) {}

  root(projectId: string): string {
    return path.join(this.dataDir, 'projects', projectId, 'capabilities')
  }

  ensureInitialized(projectId: string): SchemaMeta {
    const root = this.root(projectId)
    const metaPath = path.join(root, 'meta', 'schema-version.json')
    const existing = readJson<SchemaMeta>(metaPath)
    if (existing) return existing
    const meta: SchemaMeta = { schemaVersion: '1.0', initializedAt: new Date().toISOString() }
    atomicWriteJson(metaPath, meta)
    atomicWriteJson(path.join(root, 'index.json'), {
      schemaVersion: '1.0',
      behaviorModelVersion: '1.0',
      modules: {},
      moduleDesigns: {},
      scenarioRuns: {},
      bindings: {},
      deployables: {},
      inboundBindings: {},
    } satisfies CapabilityIndex)
    for (const dir of [
      'application/drafts',
      'application/approved',
      'architecture/drafts',
      'architecture/approved',
      'modules',
      'module-designs',
      'scenario-runs',
      'evidence/scenarios',
      'bindings',
      'deployables',
      'inbound-bindings',
      'meta/migrations',
    ]) {
      fs.mkdirSync(path.join(root, dir), { recursive: true })
    }
    return meta
  }

  isFutureSchemaVersion(projectId: string): boolean {
    const meta = readJson<SchemaMeta>(path.join(this.root(projectId), 'meta', 'schema-version.json'))
    if (!meta) return false
    return !(SUPPORTED_WORKSPACE_SCHEMA_VERSIONS as readonly string[]).includes(meta.schemaVersion)
  }

  saveSteLexicon(
    projectId: string,
    lexicon: SteLexicon,
    source: string,
    reviewedAt?: string,
  ): ProjectSteLexicon {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const record = createProjectSteLexicon({
      source,
      reviewedAt,
      generalWords: lexicon.generalWords ?? [],
      technicalTerms: lexicon.technicalTerms,
      prohibitedAliases: lexicon.prohibitedAliases,
    })
    atomicWriteJson(path.join(this.root(projectId), 'meta', 'ste-lexicon.json'), record)
    return record
  }

  getSteLexicon(projectId: string): ProjectSteLexicon | undefined {
    const stored = readJson<unknown>(
      path.join(this.root(projectId), 'meta', 'ste-lexicon.json'),
    )
    return stored === undefined ? undefined : validateProjectSteLexicon(stored)
  }

  private indexPath(projectId: string): string {
    return path.join(this.root(projectId), 'index.json')
  }

  getIndex(projectId: string): CapabilityIndex {
    this.ensureInitialized(projectId)
    const index = readJson<CapabilityIndex>(this.indexPath(projectId)) ?? {
      schemaVersion: '1.0',
      behaviorModelVersion: '1.0',
      modules: {},
      moduleDesigns: {},
      scenarioRuns: {},
      bindings: {},
      deployables: {},
      inboundBindings: {},
    }
    // Back-compat: a workspace created before deployables/inboundBindings existed
    // may be missing these maps on disk.
    index.deployables ??= {}
    index.inboundBindings ??= {}
    index.moduleDesigns ??= {}
    index.scenarioRuns ??= {}
    index.behaviorModelVersion ??= '1.0'
    return index
  }

  private saveIndex(projectId: string, index: CapabilityIndex): void {
    atomicWriteJson(this.indexPath(projectId), index)
  }

  saveApplicationDraft(projectId: string, draft: ApplicationSpecification): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'application', 'drafts', 'current.json'), draft)
    const index = this.getIndex(projectId)
    index.applicationDraftId = draft.id
    this.saveIndex(projectId, index)
  }

  getApplicationDraft(projectId: string): ApplicationSpecification | undefined {
    return readJson(path.join(this.root(projectId), 'application', 'drafts', 'current.json'))
  }

  approveApplication(projectId: string, draft: ApplicationSpecification): ApplicationSpecification {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    assertSteApproval('application', evaluateApplicationSte(draft, this.getSteLexicon(projectId)))
    const approved: ApplicationSpecification = {
      ...draft,
      status: 'approved',
      contentHash: canonicalHash({ ...draft, status: 'approved', contentHash: undefined }),
      approvedAt: draft.approvedAt ?? new Date().toISOString(),
    }
    const dest = path.join(this.root(projectId), 'application', 'approved', `${approved.revision}.json`)
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
    return readJson(path.join(this.root(projectId), 'application', 'approved', `${rev}.json`))
  }

  saveArchitectureDraft(projectId: string, draft: ArchitectureSpecification): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'architecture', 'drafts', 'current.json'), draft)
    const index = this.getIndex(projectId)
    index.architectureDraftId = draft.id
    this.saveIndex(projectId, index)
  }

  getArchitectureDraft(projectId: string): ArchitectureSpecification | undefined {
    return readJson(path.join(this.root(projectId), 'architecture', 'drafts', 'current.json'))
  }

  approveArchitecture(projectId: string, draft: ArchitectureSpecification): ArchitectureSpecification {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    assertSteApproval('architecture', evaluateArchitectureSte(draft, this.getSteLexicon(projectId)))
    const approved: ArchitectureSpecification = {
      ...draft,
      status: 'approved',
      contentHash: canonicalHash({ ...draft, status: 'approved', contentHash: undefined }),
      approvedAt: draft.approvedAt ?? new Date().toISOString(),
    }
    const dest = path.join(this.root(projectId), 'architecture', 'approved', `${approved.revision}.json`)
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
    return readJson(path.join(this.root(projectId), 'architecture', 'approved', `${rev}.json`))
  }

  saveModuleDraft(
    projectId: string,
    draft: ModuleManifest,
    interviewResponse?: ModuleInterviewResponse,
  ): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    if (interviewResponse && (
      interviewResponse.moduleId !== draft.moduleId
      || (interviewResponse.moduleVersion && interviewResponse.moduleVersion !== draft.moduleVersion)
    )) {
      throw new Error('module interview response does not match the module draft identity or version')
    }
    const dir = path.join(this.root(projectId), 'modules', draft.moduleId, 'drafts')
    atomicWriteJson(path.join(dir, 'current.json'), draft)
    if (interviewResponse) {
      atomicWriteJson(
        path.join(this.root(projectId), 'modules', draft.moduleId, 'interviews', 'drafts', 'current.json'),
        interviewResponse,
      )
    }
    const index = this.getIndex(projectId)
    index.modules[draft.moduleId] = { ...index.modules[draft.moduleId], draft: true }
    this.saveIndex(projectId, index)
  }

  getModuleDraft(projectId: string, moduleId: string): ModuleManifest | undefined {
    return readJson(
      path.join(this.root(projectId), 'modules', moduleId, 'drafts', 'current.json'),
    )
  }

  getModuleInterviewDraft(projectId: string, moduleId: string): ModuleInterviewResponse | undefined {
    return readJson(
      path.join(this.root(projectId), 'modules', moduleId, 'interviews', 'drafts', 'current.json'),
    )
  }

  approveModule(
    projectId: string,
    draft: ModuleManifest,
    interviewResponse?: ModuleInterviewResponse,
  ): ModuleManifest {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const steLexicon = this.getSteLexicon(projectId)
    assertSteApproval(`module ${draft.moduleId}`, evaluateModuleSte(draft, steLexicon))
    const dest = path.join(
      this.root(projectId),
      'modules',
      draft.moduleId,
      'approved',
      `${draft.moduleVersion}.json`,
    )
    if (fs.existsSync(dest)) {
      throw new Error(`approved module revision already exists: ${draft.moduleId}@${draft.moduleVersion}`)
    }
    const approvedInterview = interviewResponse ?? this.getModuleInterviewDraft(projectId, draft.moduleId)
    if (approvedInterview && (
      approvedInterview.moduleId !== draft.moduleId
      || (approvedInterview.moduleVersion && approvedInterview.moduleVersion !== draft.moduleVersion)
    )) {
      throw new Error('module interview response does not match the module identity or version being approved')
    }
    if (approvedInterview) {
      assertSteApproval(
        `module interview ${draft.moduleId}`,
        evaluateModuleInterviewSte(approvedInterview, steLexicon),
      )
    }
    atomicWriteJson(dest, draft)
    if (approvedInterview) {
      atomicWriteJson(
        path.join(
          this.root(projectId),
          'modules',
          draft.moduleId,
          'interviews',
          'approved',
          `${draft.moduleVersion}.json`,
        ),
        approvedInterview,
      )
    }
    const index = this.getIndex(projectId)
    index.modules[draft.moduleId] = {
      draft: false,
      approvedRevision: draft.moduleVersion,
    }
    this.saveIndex(projectId, index)
    return draft
  }

  getApprovedModule(projectId: string, moduleId: string, revision?: string): ModuleManifest | undefined {
    const rev = revision ?? this.getIndex(projectId).modules[moduleId]?.approvedRevision
    if (!rev) return undefined
    return readJson(path.join(this.root(projectId), 'modules', moduleId, 'approved', `${rev}.json`))
  }

  getApprovedModuleInterview(
    projectId: string,
    moduleId: string,
    revision?: string,
  ): ModuleInterviewResponse | undefined {
    const rev = revision ?? this.getIndex(projectId).modules[moduleId]?.approvedRevision
    if (!rev) return undefined
    return readJson(
      path.join(this.root(projectId), 'modules', moduleId, 'interviews', 'approved', `${rev}.json`),
    )
  }

  listModules(
    projectId: string,
    allocatedModuleIds: readonly string[] = [],
  ): { moduleId: string; draft?: ModuleManifest; approved?: ModuleManifest }[] {
    const index = this.getIndex(projectId)
    const moduleIds = [...new Set([...allocatedModuleIds, ...Object.keys(index.modules)])].sort((a, b) =>
      a.localeCompare(b),
    )
    return moduleIds.map((moduleId) => ({
      moduleId,
      draft: this.getModuleDraft(projectId, moduleId),
      approved: this.getApprovedModule(projectId, moduleId),
    }))
  }

  // --- Polished workflow module-design records and sessions ---------------

  saveModuleDesignDraft(projectId: string, draft: ModuleDesignSpecification): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    if (draft.projectId !== projectId) throw new Error('module design projectId does not match workspace')
    const moduleId = draft.module.moduleId
    atomicWriteJson(
      path.join(this.root(projectId), 'module-designs', moduleId, 'drafts', 'current.json'),
      draft,
    )
    const index = this.getIndex(projectId)
    index.moduleDesigns![moduleId] = { ...index.moduleDesigns![moduleId], draft: true }
    this.saveIndex(projectId, index)
  }

  getModuleDesignDraft(projectId: string, moduleId: string): ModuleDesignSpecification | undefined {
    return readJson(
      path.join(this.root(projectId), 'module-designs', moduleId, 'drafts', 'current.json'),
    )
  }

  approveModuleDesign(
    projectId: string,
    draft: ModuleDesignSpecification,
    approvedBy?: string,
  ): ModuleDesignSpecification {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    if (draft.projectId !== projectId) throw new Error('module design projectId does not match workspace')
    if (draft.gates.some((gate) => !gate.passed)) throw new Error('module design has blocking gate diagnostics')
    assertSteApproval(
      `module design ${draft.module.moduleId}`,
      evaluateModuleDesignSte(draft, this.getSteLexicon(projectId)),
    )
    const moduleId = draft.module.moduleId
    const approvedAt = new Date().toISOString()
    const approved: ModuleDesignSpecification = {
      ...draft,
      status: 'approved',
      approval: {
        approvedAt,
        approvedBy,
        sourceHashes: {
          architecture: draft.architecture.contentHash,
          draft: draft.contentHash,
        },
        openNonblockingItemIds: draft.unresolvedItems
          .filter((item) => item.materiality !== 'material')
          .map((item) => item.id),
      },
      contentHash: '',
    }
    approved.contentHash = canonicalHash({ ...approved, contentHash: undefined })
    const dest = path.join(
      this.root(projectId),
      'module-designs',
      moduleId,
      'approved',
      `${approved.revision}.json`,
    )
    if (fs.existsSync(dest)) {
      throw new Error(`approved module design revision already exists: ${moduleId}@${approved.revision}`)
    }
    atomicWriteJson(dest, approved)
    const draftPath = path.join(
      this.root(projectId),
      'module-designs',
      moduleId,
      'drafts',
      'current.json',
    )
    if (fs.existsSync(draftPath)) fs.unlinkSync(draftPath)
    const index = this.getIndex(projectId)
    index.moduleDesigns![moduleId] = { ...index.moduleDesigns![moduleId], draft: false, approvedRevision: approved.revision }
    this.saveIndex(projectId, index)
    return approved
  }

  getApprovedModuleDesign(
    projectId: string,
    moduleId: string,
    revision?: string,
  ): ModuleDesignSpecification | undefined {
    const rev = revision ?? this.getIndex(projectId).moduleDesigns?.[moduleId]?.approvedRevision
    if (!rev) return undefined
    return readJson(
      path.join(this.root(projectId), 'module-designs', moduleId, 'approved', `${rev}.json`),
    )
  }

  listModuleDesigns(projectId: string): {
    moduleId: string
    draft?: ModuleDesignSpecification
    approved?: ModuleDesignSpecification
    session?: ModuleDesignSession
  }[] {
    const index = this.getIndex(projectId)
    const moduleIds = [...new Set([
      ...Object.keys(index.modules),
      ...Object.keys(index.moduleDesigns ?? {}),
    ])].sort((left, right) => left.localeCompare(right))
    return moduleIds.map((moduleId) => ({
      moduleId,
      draft: this.getModuleDesignDraft(projectId, moduleId),
      approved: this.getApprovedModuleDesign(projectId, moduleId),
      session: this.getActiveModuleDesignSession(projectId, moduleId),
    }))
  }

  saveModuleDesignSession(projectId: string, session: ModuleDesignSession): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    if (session.projectId !== projectId) throw new Error('module design session projectId does not match workspace')
    atomicWriteJson(
      path.join(this.root(projectId), 'module-designs', session.moduleId, 'sessions', `${session.id}.json`),
      session,
    )
    const index = this.getIndex(projectId)
    index.moduleDesigns![session.moduleId] = {
      ...index.moduleDesigns![session.moduleId],
      activeSessionId: session.id,
    }
    this.saveIndex(projectId, index)
  }

  getModuleDesignSession(
    projectId: string,
    moduleId: string,
    sessionId: string,
  ): ModuleDesignSession | undefined {
    return readJson(
      path.join(this.root(projectId), 'module-designs', moduleId, 'sessions', `${sessionId}.json`),
    )
  }

  getActiveModuleDesignSession(projectId: string, moduleId: string): ModuleDesignSession | undefined {
    const sessionId = this.getIndex(projectId).moduleDesigns?.[moduleId]?.activeSessionId
    return sessionId ? this.getModuleDesignSession(projectId, moduleId, sessionId) : undefined
  }

  // --- Scenario runs and immutable evidence --------------------------------

  saveScenarioRun(projectId: string, record: ScenarioRunRecord): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    if (record.projectId !== projectId) throw new Error('scenario run projectId does not match workspace')
    atomicWriteJson(
      path.join(this.root(projectId), 'scenario-runs', record.runId, 'run.json'),
      record,
    )
    const index = this.getIndex(projectId)
    index.scenarioRuns![record.runId] = {
      scenarioId: record.scenarioId,
      outcome: record.outcome,
      startedAt: record.startedAt,
    }
    this.saveIndex(projectId, index)
  }

  getScenarioRun(projectId: string, runId: string): ScenarioRunRecord | undefined {
    return readJson(path.join(this.root(projectId), 'scenario-runs', runId, 'run.json'))
  }

  listScenarioRuns(projectId: string): ScenarioRunRecord[] {
    return Object.keys(this.getIndex(projectId).scenarioRuns ?? {})
      .map((runId) => this.getScenarioRun(projectId, runId))
      .filter((record): record is ScenarioRunRecord => Boolean(record))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  saveScenarioEvidence(input: {
    projectId: string
    runId: string
    artifactId: string
    mediaType: string
    bytes: Uint8Array
    producingOperationId?: string
    provenanceSource: string
  }): ArtifactReference {
    if (this.isFutureSchemaVersion(input.projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(input.projectId)
    if (!this.getScenarioRun(input.projectId, input.runId)) {
      throw new Error(`scenario run not found: ${input.runId}`)
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(input.artifactId)) {
      throw new Error('invalid scenario evidence artifactId')
    }
    const extension = input.mediaType === 'image/png'
      ? 'png'
      : input.mediaType === 'image/jpeg'
        ? 'jpg'
        : 'bin'
    const checksum = crypto.createHash('sha256').update(input.bytes).digest('hex')
    const relativeRef = path.posix.join('evidence', 'scenarios', input.runId, `${input.artifactId}.${extension}`)
    const target = path.join(this.root(input.projectId), ...relativeRef.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (fs.existsSync(target)) {
      const existingChecksum = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
      if (existingChecksum !== checksum) {
        throw new Error(`scenario evidence artifact is immutable: ${input.artifactId}`)
      }
    } else {
      fs.writeFileSync(target, input.bytes)
    }
    const reference: ArtifactReference = {
      schemaVersion: '1.0',
      artifactId: input.artifactId,
      projectId: input.projectId,
      mediaType: input.mediaType,
      checksum,
      byteSize: input.bytes.byteLength,
      createdAt: new Date().toISOString(),
      producingOperationId: input.producingOperationId,
      producingRunId: input.runId,
      provenance: {
        source: input.provenanceSource,
        recordedAt: new Date().toISOString(),
      },
      storageClass: 'app-managed',
      opaqueStorageRef: relativeRef,
    }
    atomicWriteJson(
      path.join(this.root(input.projectId), 'evidence', 'scenarios', input.runId, `${input.artifactId}.json`),
      reference,
    )
    return reference
  }

  getScenarioEvidence(
    projectId: string,
    runId: string,
    artifactId: string,
  ): { reference: ArtifactReference; bytes: Uint8Array } | undefined {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(artifactId)) throw new Error('invalid scenario evidence artifactId')
    const reference = readJson<ArtifactReference>(
      path.join(this.root(projectId), 'evidence', 'scenarios', runId, `${artifactId}.json`),
    )
    if (!reference) return undefined
    const root = path.resolve(this.root(projectId))
    const target = path.resolve(root, ...reference.opaqueStorageRef.split('/'))
    if (!target.startsWith(root + path.sep)) throw new Error('scenario evidence escaped workspace')
    if (!fs.existsSync(target)) return undefined
    const bytes = fs.readFileSync(target)
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex')
    if (checksum !== reference.checksum) throw new Error(`scenario evidence checksum mismatch: ${artifactId}`)
    return { reference, bytes }
  }

  saveBindingDraft(projectId: string, draft: FrontendBinding): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    atomicWriteJson(
      path.join(this.root(projectId), 'bindings', draft.bindingId, 'drafts', 'current.json'),
      draft,
    )
    const index = this.getIndex(projectId)
    index.bindings[draft.bindingId] = { ...index.bindings[draft.bindingId], draft: true }
    this.saveIndex(projectId, index)
  }

  getBindingDraft(projectId: string, bindingId: string): FrontendBinding | undefined {
    return readJson(
      path.join(this.root(projectId), 'bindings', bindingId, 'drafts', 'current.json'),
    )
  }

  approveBinding(projectId: string, draft: FrontendBinding): FrontendBinding {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    assertSteApproval(
      'frontend binding',
      evaluateFrontendBindingSte(draft, this.getSteLexicon(projectId)),
    )
    const dest = path.join(
      this.root(projectId),
      'bindings',
      draft.bindingId,
      'approved',
      `${draft.version}.json`,
    )
    if (fs.existsSync(dest)) {
      throw new Error(`approved binding revision already exists: ${draft.bindingId}@${draft.version}`)
    }
    atomicWriteJson(dest, draft)
    const index = this.getIndex(projectId)
    index.bindings[draft.bindingId] = { draft: false, approvedRevision: draft.version }
    this.saveIndex(projectId, index)
    return draft
  }

  getApprovedBinding(projectId: string, bindingId: string, revision?: string): FrontendBinding | undefined {
    const rev = revision ?? this.getIndex(projectId).bindings[bindingId]?.approvedRevision
    if (!rev) return undefined
    return readJson(path.join(this.root(projectId), 'bindings', bindingId, 'approved', `${rev}.json`))
  }

  listBindings(projectId: string): { bindingId: string; draft?: FrontendBinding; approved?: FrontendBinding }[] {
    const index = this.getIndex(projectId)
    return Object.keys(index.bindings)
      .sort((a, b) => a.localeCompare(b))
      .map((bindingId) => ({
        bindingId,
        draft: this.getBindingDraft(projectId, bindingId),
        approved: this.getApprovedBinding(projectId, bindingId),
      }))
  }

  // --- CAP-CONTRACT-024 DeployableSpecification (WP5B connect backing) -----

  saveDeployableDraft(projectId: string, draft: DeployableSpecification): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    atomicWriteJson(
      path.join(this.root(projectId), 'deployables', draft.deployableId, 'drafts', 'current.json'),
      draft,
    )
    const index = this.getIndex(projectId)
    index.deployables[draft.deployableId] = { ...index.deployables[draft.deployableId], draft: true }
    this.saveIndex(projectId, index)
  }

  getDeployableDraft(projectId: string, deployableId: string): DeployableSpecification | undefined {
    return readJson(
      path.join(this.root(projectId), 'deployables', deployableId, 'drafts', 'current.json'),
    )
  }

  /**
   * Approves a deployable specification. `DeployableSpecification` (unlike
   * `ModuleManifest`/`FrontendBinding`) has no intrinsic version field, so the
   * approved revision key is the draft's canonical content hash: re-approving
   * byte-identical content is a no-op collision (same hash, same file).
   */
  approveDeployable(projectId: string, draft: DeployableSpecification): DeployableSpecification {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const revision = canonicalHash(draft)
    const dest = path.join(this.root(projectId), 'deployables', draft.deployableId, 'approved', `${revision}.json`)
    if (fs.existsSync(dest)) {
      throw new Error(`approved deployable revision already exists: ${draft.deployableId}@${revision}`)
    }
    atomicWriteJson(dest, draft)
    const index = this.getIndex(projectId)
    index.deployables[draft.deployableId] = { draft: false, approvedRevision: revision }
    this.saveIndex(projectId, index)
    return draft
  }

  getApprovedDeployable(
    projectId: string,
    deployableId: string,
    revision?: string,
  ): DeployableSpecification | undefined {
    const rev = revision ?? this.getIndex(projectId).deployables[deployableId]?.approvedRevision
    if (!rev) return undefined
    return readJson(path.join(this.root(projectId), 'deployables', deployableId, 'approved', `${rev}.json`))
  }

  listDeployables(
    projectId: string,
  ): { deployableId: string; draft?: DeployableSpecification; approved?: DeployableSpecification }[] {
    const index = this.getIndex(projectId)
    return Object.keys(index.deployables)
      .sort((a, b) => a.localeCompare(b))
      .map((deployableId) => ({
        deployableId,
        draft: this.getDeployableDraft(projectId, deployableId),
        approved: this.getApprovedDeployable(projectId, deployableId),
      }))
  }

  // --- FoundationPlan (WP5A-core foundation planning; not a frozen CAP-CONTRACT) ---

  /**
   * Persists the project's single foundation-planning draft (mirrors the
   * architecture draft's one-current-file-per-project convention, since a
   * `FoundationPlan` is a project-wide plan rather than a per-id record).
   */
  saveFoundationDraft(projectId: string, plan: FoundationPlan): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    atomicWriteJson(path.join(this.root(projectId), 'foundation', 'drafts', 'current.json'), plan)
  }

  getFoundationDraft(projectId: string): FoundationPlan | undefined {
    return readJson(path.join(this.root(projectId), 'foundation', 'drafts', 'current.json'))
  }

  /**
   * Approves a foundation plan. Rejects any plan whose `readiness.status` is
   * not `'ready'` (ambiguous or blocked plans cannot be approved). This is a
   * separate approval step from `approveArchitecture`: approving the
   * architecture never implicitly approves its foundation. On success, also
   * approves every constituent deployable via the existing `approveDeployable`
   * (tolerating a byte-identical re-approval as a no-op, consistent with that
   * method's own content-hash-keyed idempotency).
   */
  approveFoundation(projectId: string, plan: FoundationPlan): FoundationPlan {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    if (plan.readiness.status !== 'ready') {
      throw new Error(`cannot approve a foundation plan with readiness status "${plan.readiness.status}"`)
    }
    this.ensureInitialized(projectId)
    assertSteApproval('foundation plan', evaluateFoundationSte(plan, this.getSteLexicon(projectId)))
    const revision = canonicalHash(plan)
    atomicWriteJson(path.join(this.root(projectId), 'foundation', 'approved', `${revision}.json`), plan)
    const index = this.getIndex(projectId)
    index.foundationApprovedRevision = revision
    this.saveIndex(projectId, index)
    for (const deployable of plan.deployables) {
      try {
        this.approveDeployable(projectId, deployable)
      } catch (error) {
        if (!(error instanceof Error && /already exists/.test(error.message))) throw error
      }
    }
    return plan
  }

  getApprovedFoundation(projectId: string, revision?: string): FoundationPlan | undefined {
    const rev = revision ?? this.getIndex(projectId).foundationApprovedRevision
    if (!rev) return undefined
    return readJson(path.join(this.root(projectId), 'foundation', 'approved', `${rev}.json`))
  }

  // --- CAP-CONTRACT-028 InboundBinding (WP5B connect backing) --------------

  /** Missing/omitted `exposure` always persists as `private` (§5.1): never silently escalated. */
  saveInboundBindingDraft(projectId: string, draft: InboundBinding): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const binding = withDefaultExposure(draft)
    atomicWriteJson(
      path.join(this.root(projectId), 'inbound-bindings', binding.bindingId, 'drafts', 'current.json'),
      binding,
    )
    const index = this.getIndex(projectId)
    index.inboundBindings[binding.bindingId] = {
      ...index.inboundBindings[binding.bindingId],
      draft: true,
      removedAt: undefined,
    }
    this.saveIndex(projectId, index)
  }

  getInboundBindingDraft(projectId: string, bindingId: string): InboundBinding | undefined {
    return readJson(
      path.join(this.root(projectId), 'inbound-bindings', bindingId, 'drafts', 'current.json'),
    )
  }

  /**
   * Approves an inbound binding. Multiple `InboundBinding`s may legitimately
   * target the same `operationId`/`operationVersion` (CAP-ERA-001 §12.4):    * bindings are keyed and stored by their own `bindingId`, never deduplicated
   * by operation.
   */
  approveInboundBinding(projectId: string, draft: InboundBinding): InboundBinding {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const binding = withDefaultExposure(draft)
    assertSteApproval(
      'inbound binding',
      evaluateInboundBindingSte(binding, this.getSteLexicon(projectId)),
    )
    const dest = path.join(
      this.root(projectId),
      'inbound-bindings',
      binding.bindingId,
      'approved',
      `${binding.version}.json`,
    )
    if (fs.existsSync(dest)) {
      throw new Error(`approved inbound binding revision already exists: ${binding.bindingId}@${binding.version}`)
    }
    atomicWriteJson(dest, binding)
    const index = this.getIndex(projectId)
    index.inboundBindings[binding.bindingId] = { draft: false, approvedRevision: binding.version, removedAt: undefined }
    this.saveIndex(projectId, index)
    return binding
  }

  getApprovedInboundBinding(
    projectId: string,
    bindingId: string,
    revision?: string,
  ): InboundBinding | undefined {
    const rev = revision ?? this.getIndex(projectId).inboundBindings[bindingId]?.approvedRevision
    if (!rev) return undefined
    return readJson(path.join(this.root(projectId), 'inbound-bindings', bindingId, 'approved', `${rev}.json`))
  }

  listInboundBindings(
    projectId: string,
  ): { bindingId: string; draft?: InboundBinding; approved?: InboundBinding }[] {
    const index = this.getIndex(projectId)
    return Object.keys(index.inboundBindings)
      .filter((bindingId) => !index.inboundBindings[bindingId]?.removedAt)
      .sort((a, b) => a.localeCompare(b))
      .map((bindingId) => ({
        bindingId,
        draft: this.getInboundBindingDraft(projectId, bindingId),
        approved: this.getApprovedInboundBinding(projectId, bindingId),
      }))
  }

  /**
   * Removes an entry point from the active application without destroying its
   * immutable approved revisions. Re-saving the same binding identity restores
   * it, making the operation deterministic and audit-safe.
   */
  archiveInboundBinding(projectId: string, bindingId: string): void {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const index = this.getIndex(projectId)
    if (!index.inboundBindings[bindingId]) throw new Error(`inbound binding not found: ${bindingId}`)
    index.inboundBindings[bindingId] = {
      ...index.inboundBindings[bindingId],
      draft: false,
      removedAt: new Date().toISOString(),
    }
    this.saveIndex(projectId, index)
  }
}
