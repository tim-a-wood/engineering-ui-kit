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
  DeployableSpecification,
  FrontendBinding,
  InboundBinding,
  ModuleManifest,
} from './types.js'
import type { ModuleInterviewResponse } from './moduleInterview.js'
import { withDefaultExposure } from './journeys.js'

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

import { canonicalHash } from './hash.js'
export { canonicalHash }

export type CapabilityIndex = {
  schemaVersion: string
  applicationDraftId?: string
  applicationApprovedRevision?: string
  architectureDraftId?: string
  architectureApprovedRevision?: string
  modules: Record<string, { draft?: boolean; approvedRevision?: string }>
  bindings: Record<string, { draft?: boolean; approvedRevision?: string }>
  deployables: Record<string, { draft?: boolean; approvedRevision?: string }>
  inboundBindings: Record<string, { draft?: boolean; approvedRevision?: string }>
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
      modules: {},
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

  private indexPath(projectId: string): string {
    return path.join(this.root(projectId), 'index.json')
  }

  getIndex(projectId: string): CapabilityIndex {
    this.ensureInitialized(projectId)
    const index = readJson<CapabilityIndex>(this.indexPath(projectId)) ?? {
      schemaVersion: '1.0',
      modules: {},
      bindings: {},
      deployables: {},
      inboundBindings: {},
    }
    // Back-compat: a workspace created before deployables/inboundBindings existed
    // may be missing these maps on disk.
    index.deployables ??= {}
    index.inboundBindings ??= {}
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
   * approved revision key is the draft's canonical content hash — re-approving
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

  // --- CAP-CONTRACT-028 InboundBinding (WP5B connect backing) --------------

  /** Missing/omitted `exposure` always persists as `private` (§5.1) — never silently escalated. */
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
    index.inboundBindings[binding.bindingId] = { ...index.inboundBindings[binding.bindingId], draft: true }
    this.saveIndex(projectId, index)
  }

  getInboundBindingDraft(projectId: string, bindingId: string): InboundBinding | undefined {
    return readJson(
      path.join(this.root(projectId), 'inbound-bindings', bindingId, 'drafts', 'current.json'),
    )
  }

  /**
   * Approves an inbound binding. Multiple `InboundBinding`s may legitimately
   * target the same `operationId`/`operationVersion` (CAP-ERA-001 §12.4) —
   * bindings are keyed and stored by their own `bindingId`, never deduplicated
   * by operation.
   */
  approveInboundBinding(projectId: string, draft: InboundBinding): InboundBinding {
    if (this.isFutureSchemaVersion(projectId)) {
      throw new Error('capability workspace is read-only due to future schema version')
    }
    this.ensureInitialized(projectId)
    const binding = withDefaultExposure(draft)
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
    index.inboundBindings[binding.bindingId] = { draft: false, approvedRevision: binding.version }
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
      .sort((a, b) => a.localeCompare(b))
      .map((bindingId) => ({
        bindingId,
        draft: this.getInboundBindingDraft(projectId, bindingId),
        approved: this.getApprovedInboundBinding(projectId, bindingId),
      }))
  }
}
