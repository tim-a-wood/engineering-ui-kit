/**
 * EUC-14: Provider adapters.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §11 (all),
 * §19 (Provider unavailable, Copilot response incomplete, Stale response),
 * §20.2 (agent isolation), §24.3 (Copilot compatibility tests), §25.1
 * (ports and adapters), §25.3 (EUC-14).
 *
 * Owned outputs: the `DesignProvider` port shared by every provider mode
 * (§24.3 "all modes create the same canonical record shape"), the
 * `copilot-handoff`, `in-app`, `deterministic-test`, and `none` adapters,
 * the §19 "Copilot response incomplete" import/sanitize policy, and the
 * §24.3 canonical-shape comparison helper.
 *
 * This module never edits `records.ts` or `identity.ts` (shared contracts),
 * and it never edits `contextPacket.ts` or `deltaInspector.ts` (committed
 * siblings); it only imports from them.
 *
 * Every function here is pure or purely async: no module-level mutable
 * state, no clock reads, no randomness. A provider outage never loses work
 * because nothing here mutates its inputs: the caller (EUC-13 persistence)
 * is responsible for storing the packet, the draft, and the provider result
 * so that a retry or manual continuation always has the last known-good
 * state available.
 */

import { childId, stableSortStrings } from './identity.js'
import { canonicalHash, sha256Hex } from '../hash.js'
import { missingRequiredDeltaFields } from './deltaInspector.js'
import type { PacketFile } from './contextPacket.js'
import type {
  DesignDiagnostic,
  ModuleDesignPacket,
  ModuleDesignSpecification,
  ModuleImplementationPacket,
  ReturnedDelta,
  ReturnedFileChange,
} from './records.js'

// ---------------------------------------------------------------------------
// Diagnostics helpers
// ---------------------------------------------------------------------------

function providerDiagnostic(
  code: string,
  severity: DesignDiagnostic['severity'],
  message: string,
  target?: string,
  relatedIds?: string[],
): DesignDiagnostic {
  return {
    id: `${code}:${target ?? 'provider'}`,
    code,
    severity,
    message,
    ...(relatedIds && relatedIds.length ? { relatedIds } : {}),
    ...(target ? { target } : {}),
  }
}

function sortProviderDiagnostics(diagnostics: DesignDiagnostic[]): DesignDiagnostic[] {
  return [...diagnostics].sort((a, b) => (a.code === b.code ? a.id.localeCompare(b.id) : a.code.localeCompare(b.code)))
}

function providerUnavailableDiagnostic(packetId: string): DesignDiagnostic {
  return providerDiagnostic(
    'CAP-DES-PROV-UNAVAILABLE',
    'warning',
    'the provider did not return a response; the draft is kept for manual work or a later retry (§19 "Provider unavailable")',
    undefined,
    [packetId],
  )
}

function malformedResponseDiagnostic(packetId: string): DesignDiagnostic {
  return providerDiagnostic(
    'CAP-DES-PROV-MALFORMED',
    'warning',
    'the provider response could not be parsed; treated as unavailable so no work is lost (§19)',
    undefined,
    [packetId],
  )
}

function manualWorkDiagnostic(): DesignDiagnostic {
  return providerDiagnostic(
    'CAP-DES-PROV-MANUAL',
    'info',
    'no provider is configured for this request; continue with manual work (§19 "Provider unavailable")',
  )
}

function cancelledDiagnostic(packetId: string): DesignDiagnostic {
  return providerDiagnostic('CAP-DES-PROV-CANCELLED', 'info', 'the caller cancelled this provider request before it completed', undefined, [packetId])
}

function inAppErrorDiagnostic(packetId: string, error: unknown): DesignDiagnostic {
  const message = error instanceof Error ? error.message : String(error)
  return providerDiagnostic('CAP-DES-PROV-ERROR', 'warning', `the in-app provider failed: ${message}`, undefined, [packetId])
}

function missingDeltaFieldDiagnostic(field: string): DesignDiagnostic {
  return providerDiagnostic('CAP-DES-PROV-MISSING-FIELD', 'warning', `the returned delta is missing required field: ${field}`, field)
}

// ---------------------------------------------------------------------------
// §24.3: the provider port (all four modes implement the same interface)
// ---------------------------------------------------------------------------

export type ProviderCallOptions = {
  /** ISO instant the caller expects a response by; adapters may use it to fail fast. */
  deadlineAt?: string
  /** Mutable cancellation flag the caller can flip; checked before and between adapter I/O. */
  cancellation?: { cancelled: boolean }
}

export type ProviderResult<T> = {
  ok: boolean
  value?: T
  /** §19 "Provider unavailable": no response was obtained; nothing was lost. */
  unavailable?: boolean
  /** §19 "Copilot response incomplete": a response was obtained but some required content is missing. */
  partial?: boolean
  diagnostics: DesignDiagnostic[]
}

/** §11.2 response: a candidate module-design draft plus its supporting content. */
export type ModuleDesignResponse = {
  /** Candidate `ModuleDesignSpecification`-shaped payload; validated by `importModuleDesignResponse`. */
  draft: unknown
  assumptions: string[]
  unresolvedQuestions: string[]
  proposedContracts: unknown[]
  proposedDiagrams: unknown[]
  sourceRefs: string[]
  changeSummary: string
}

/**
 * §24.3: one interface shared by every provider mode (Copilot handoff,
 * in-app, deterministic test, and none). Every implementation is
 * side-effect-free beyond its own I/O: it never mutates the packet it is
 * given and never persists anything itself.
 */
export type DesignProvider = {
  providerId: string
  kind: 'copilot-handoff' | 'in-app' | 'deterministic-test' | 'none'
  /** Request a module-design draft for a design packet (§11.2). */
  requestModuleDesign(packet: ModuleDesignPacket, options: ProviderCallOptions): Promise<ProviderResult<ModuleDesignResponse>>
  /** Request an implementation delta for an implementation packet (§11.3, §11.5). */
  requestImplementation(packet: ModuleImplementationPacket, options: ProviderCallOptions): Promise<ProviderResult<ReturnedDelta>>
}

function cancelledResult<T>(packetId: string): ProviderResult<T> {
  return { ok: false, unavailable: true, diagnostics: [cancelledDiagnostic(packetId)] }
}

// ---------------------------------------------------------------------------
// Copilot handoff adapter: the current file-drop flow (§11.2, §11.3, Appendix B)
// ---------------------------------------------------------------------------

export type CopilotIo = {
  /** Drops the handoff file set at a location the user (or Copilot) can read. */
  writePacketFiles(files: PacketFile[]): Promise<void>
  /** Reads back the raw response text once available; `undefined` when none has arrived yet. */
  readResponse(): Promise<string | undefined>
}

function designPacketDropFiles(packet: ModuleDesignPacket): PacketFile[] {
  return [{ path: 'module-handoff/design-packet.json', content: JSON.stringify(packet, null, 2) }]
}

function implementationPacketDropFiles(packet: ModuleImplementationPacket): PacketFile[] {
  return [{ path: 'module-handoff/packet.json', content: JSON.stringify(packet, null, 2) }]
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

function coerceModuleDesignResponse(parsed: Record<string, unknown>): { value: ModuleDesignResponse; partial: boolean } {
  const hasDraft = 'draft' in parsed && parsed.draft !== undefined && parsed.draft !== null
  const requiredKeys = ['draft', 'assumptions', 'unresolvedQuestions', 'proposedContracts', 'proposedDiagrams', 'sourceRefs', 'changeSummary']
  const partial = !hasDraft || requiredKeys.some((key) => !(key in parsed))
  const value: ModuleDesignResponse = {
    draft: parsed.draft,
    assumptions: Array.isArray(parsed.assumptions) ? (parsed.assumptions as string[]) : [],
    unresolvedQuestions: Array.isArray(parsed.unresolvedQuestions) ? (parsed.unresolvedQuestions as string[]) : [],
    proposedContracts: Array.isArray(parsed.proposedContracts) ? (parsed.proposedContracts as unknown[]) : [],
    proposedDiagrams: Array.isArray(parsed.proposedDiagrams) ? (parsed.proposedDiagrams as unknown[]) : [],
    sourceRefs: Array.isArray(parsed.sourceRefs) ? (parsed.sourceRefs as string[]) : [],
    changeSummary: typeof parsed.changeSummary === 'string' ? parsed.changeSummary : '',
  }
  return { value, partial }
}

/**
 * §11.2 / §11.3 / Appendix B: the current Copilot file-drop flow as a
 * `DesignProvider` adapter. Writes the handoff files, then reads back
 * whatever response is available. An absent response never discards the
 * packet or the caller's draft: it returns `unavailable: true` so the
 * caller can keep working manually or retry later (§19).
 */
export function copilotHandoffProvider(io: CopilotIo): DesignProvider {
  return {
    providerId: 'copilot-handoff',
    kind: 'copilot-handoff',

    async requestModuleDesign(packet, options) {
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      await io.writePacketFiles(designPacketDropFiles(packet))
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      const raw = await io.readResponse()
      if (raw === undefined) {
        return { ok: false, unavailable: true, diagnostics: [providerUnavailableDiagnostic(packet.packetId)] }
      }
      const parsed = parseJson(raw)
      if (!parsed.ok || typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
        return { ok: false, unavailable: true, diagnostics: [malformedResponseDiagnostic(packet.packetId)] }
      }
      const { value, partial } = coerceModuleDesignResponse(parsed.value as Record<string, unknown>)
      return { ok: true, value, partial, diagnostics: [] }
    },

    async requestImplementation(packet, options) {
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      await io.writePacketFiles(implementationPacketDropFiles(packet))
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      const raw = await io.readResponse()
      if (raw === undefined) {
        return { ok: false, unavailable: true, diagnostics: [providerUnavailableDiagnostic(packet.packetId)] }
      }
      const parsed = parseJson(raw)
      if (!parsed.ok || typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
        return { ok: false, unavailable: true, diagnostics: [malformedResponseDiagnostic(packet.packetId)] }
      }
      const delta = parsed.value as ReturnedDelta
      const missing = missingRequiredDeltaFields(delta)
      return { ok: true, value: delta, partial: missing.length > 0, diagnostics: missing.map((field) => missingDeltaFieldDiagnostic(field)) }
    },
  }
}

// ---------------------------------------------------------------------------
// In-app provider adapter: wraps a supplied generation function
// ---------------------------------------------------------------------------

export type InAppGenerator = {
  requestModuleDesign(packet: ModuleDesignPacket, options: ProviderCallOptions): Promise<ModuleDesignResponse>
  requestImplementation(packet: ModuleImplementationPacket, options: ProviderCallOptions): Promise<ReturnedDelta>
}

/**
 * Wraps a supplied in-app generation function as a `DesignProvider`. Any
 * thrown error (or rejected promise) becomes `unavailable: true`: the
 * generator never throws through to the caller, so a provider outage never
 * loses the packet or the draft (§19).
 */
export function inAppProvider(generate: InAppGenerator): DesignProvider {
  return {
    providerId: 'in-app',
    kind: 'in-app',

    async requestModuleDesign(packet, options) {
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      try {
        const value = await generate.requestModuleDesign(packet, options)
        return { ok: true, value, diagnostics: [] }
      } catch (error) {
        return { ok: false, unavailable: true, diagnostics: [inAppErrorDiagnostic(packet.packetId, error)] }
      }
    },

    async requestImplementation(packet, options) {
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      try {
        const value = await generate.requestImplementation(packet, options)
        return { ok: true, value, diagnostics: [] }
      } catch (error) {
        return { ok: false, unavailable: true, diagnostics: [inAppErrorDiagnostic(packet.packetId, error)] }
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Deterministic test provider adapter
// ---------------------------------------------------------------------------

function deterministicDigest(seed: string, contentHash: string): string {
  return sha256Hex(`${seed}::${contentHash}`)
}

function buildDeterministicModuleDesignResponse(packet: ModuleDesignPacket, seed: string): ModuleDesignResponse {
  const digest = deterministicDigest(seed, packet.contentHash)
  const directDependencyIds = stableSortStrings(
    packet.systemSlice.dependencyEdges.filter((edge) => edge.fromModuleId === packet.moduleId).map((edge) => edge.toModuleId),
  )
  const draft: Record<string, unknown> = {
    module: {
      moduleId: packet.moduleId,
      moduleType: packet.moduleType,
      responsibility: `Deterministic responsibility for ${packet.moduleId} (${digest.slice(0, 8)})`,
    },
    architecture: {
      revision: packet.architectureRevision,
      contentHash: packet.architectureHash,
    },
    trace: {
      useCaseIds: packet.useCaseIds,
      scenarioStepIds: packet.scenarioStepIds,
    },
    boundary: {
      directDependencyIds,
    },
    providedOperations: packet.providerSummaries.flatMap((provider) => provider.operations),
    requiredOperations: packet.consumerSummaries.flatMap((consumer) => consumer.operations),
    schemas: [],
    behavior: { idempotency: 'deterministic', cancellation: 'deterministic', timeouts: 'deterministic' },
    data: { dataOwnership: 'deterministic' },
    runtime: { lifecycleRegistration: 'deterministic' },
    verification: { acceptanceCases: [] },
    typeSpecific: { moduleType: packet.moduleType },
  }
  return {
    draft,
    assumptions: [`generated deterministically from packet ${packet.packetId}`],
    unresolvedQuestions: [],
    proposedContracts: [],
    proposedDiagrams: [],
    sourceRefs: packet.contextManifest.entries.map((entry) => entry.ref),
    changeSummary: `Deterministic draft for module ${packet.moduleId}.`,
  }
}

function firstWritablePath(packet: ModuleImplementationPacket): string | undefined {
  const boundary = packet.allowedPaths[0] ?? packet.editableSharedPaths[0]
  if (!boundary) return undefined
  const dir = boundary.endsWith('/') ? boundary : `${boundary}/`
  return `${dir}deterministic-response.md`
}

function buildDeterministicReturnedDelta(packet: ModuleImplementationPacket, seed: string): ReturnedDelta {
  const digest = deterministicDigest(seed, packet.contentHash)
  const path = firstWritablePath(packet)
  const content = `Deterministic response for ${packet.moduleId} (${digest.slice(0, 12)})\n`
  const fileChanges: ReturnedFileChange[] = path ? [{ path, action: 'create', content, contentHash: sha256Hex(content) }] : []
  const testCommands = packet.testCommands.length ? packet.testCommands : ['deterministic-check']
  const testResults = testCommands.map((command) => ({ command, passed: true, summary: 'deterministic pass' }))

  const withoutHash: Omit<ReturnedDelta, 'contentHash'> = {
    schemaVersion: '1.0',
    deltaId: childId(packet.packetId, 'delta', digest),
    packetId: packet.packetId,
    baseRevision: packet.moduleDesignRevision,
    baseHash: packet.moduleDesignHash,
    fileChanges,
    recordChanges: [{ recordId: packet.moduleId, kind: 'note', summary: `deterministic test provider response for ${packet.moduleId}` }],
    testResults,
    assumptions: [`generated deterministically from packet ${packet.packetId}`],
    unresolvedIssues: [],
    requestedScopeChanges: [],
    evidenceFiles: [],
    returnedAt: '1970-01-01T00:00:00.000Z',
  }
  return { ...withoutHash, contentHash: canonicalHash(withoutHash) }
}

/**
 * §24.3 "a fixed deterministic test provider": every value is derived
 * purely from the packet's own content (and the optional `seed`), so the
 * same packet always produces a byte-identical response. The generated
 * `ReturnedDelta` stays within `packet.allowedPaths`/`editableSharedPaths`
 * and echoes the packet's own ids, base revision, and hash, so it passes
 * `validateReturnedDelta` unmodified.
 */
export function deterministicTestProvider(seed = 'deterministic-test'): DesignProvider {
  return {
    providerId: 'deterministic-test',
    kind: 'deterministic-test',

    async requestModuleDesign(packet, options) {
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      return { ok: true, value: buildDeterministicModuleDesignResponse(packet, seed), diagnostics: [] }
    },

    async requestImplementation(packet, options) {
      if (options.cancellation?.cancelled) return cancelledResult(packet.packetId)
      return { ok: true, value: buildDeterministicReturnedDelta(packet, seed), diagnostics: [] }
    },
  }
}

// ---------------------------------------------------------------------------
// No-provider adapter: manual-work mode
// ---------------------------------------------------------------------------

/** §24.3 "no provider": always unavailable; the user continues with manual work (§19). */
export function noProvider(): DesignProvider {
  return {
    providerId: 'none',
    kind: 'none',
    async requestModuleDesign() {
      return { ok: false, unavailable: true, diagnostics: [manualWorkDiagnostic()] }
    },
    async requestImplementation() {
      return { ok: false, unavailable: true, diagnostics: [manualWorkDiagnostic()] }
    },
  }
}

// ---------------------------------------------------------------------------
// §19 "Copilot response incomplete": import, sanitize, and validate
// ---------------------------------------------------------------------------

const REQUIRED_DRAFT_FIELDS = [
  'module',
  'boundary',
  'trace',
  'providedOperations',
  'requiredOperations',
  'schemas',
  'behavior',
  'data',
  'runtime',
  'verification',
  'typeSpecific',
] as const

const KNOWN_DRAFT_FIELDS = new Set<string>([
  'schemaVersion',
  'projectId',
  'id',
  'revision',
  'architecture',
  'module',
  'trace',
  'boundary',
  'providedOperations',
  'requiredOperations',
  'schemas',
  'rules',
  'invariants',
  'behavior',
  'data',
  'runtime',
  'verification',
  'typeSpecific',
  'diagrams',
  'unresolvedItems',
  'inferredFieldPaths',
])

export type ImportModuleDesignResult = {
  imported: Partial<ModuleDesignSpecification>
  missingRequiredFields: string[]
  diagnostics: DesignDiagnostic[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * §19 "Copilot response incomplete": imports every valid field from a
 * candidate response into a draft, lists exactly the missing required
 * fields, and never approves the result:
 *  - `status` and `approval` are always stripped (an agent cannot approve);
 *  - `gates` and `contentHash` are always stripped (product-computed, not
 *    provider-supplied);
 *  - an attempt to change the preserved `module.moduleId` or the approved
 *    `architecture` reference is rejected and reverted to the packet's
 *    value (§20.2 "an agent shall not change access policy");
 *  - an unrecognized top-level field is stripped with a diagnostic.
 * `baseDraft` lets a second, later import complete an earlier partial one.
 */
export function importModuleDesignResponse(
  response: ModuleDesignResponse | undefined,
  packet: ModuleDesignPacket,
  baseDraft?: Partial<ModuleDesignSpecification>,
): ImportModuleDesignResult {
  const diagnostics: DesignDiagnostic[] = []
  const rawDraft: Record<string, unknown> = isPlainObject(response?.draft) ? { ...(response!.draft as Record<string, unknown>) } : {}

  for (const field of ['status', 'approval'] as const) {
    if (field in rawDraft) {
      diagnostics.push(
        providerDiagnostic(
          'CAP-DES-PROV-STRIP-APPROVAL',
          'blocker',
          `a provider response cannot set ${field}; the receiving agent must not approve the result (§11.2)`,
          field,
          [packet.moduleId],
        ),
      )
      delete rawDraft[field]
    }
  }

  for (const field of ['gates', 'contentHash'] as const) {
    if (field in rawDraft) {
      diagnostics.push(
        providerDiagnostic(
          'CAP-DES-PROV-STRIP-CONTROLLED',
          'warning',
          `a provider response cannot set the product-computed field ${field}`,
          field,
          [packet.moduleId],
        ),
      )
      delete rawDraft[field]
    }
  }

  const moduleBlock = rawDraft.module
  if (isPlainObject(moduleBlock)) {
    const candidateModuleId = moduleBlock.moduleId
    if (candidateModuleId !== undefined && candidateModuleId !== packet.moduleId) {
      diagnostics.push(
        providerDiagnostic(
          'CAP-DES-PROV-MODULE-ID-TAMPER',
          'blocker',
          `a provider response attempted to change the preserved module id from ${packet.moduleId} to ${String(candidateModuleId)}`,
          'module.moduleId',
          [packet.moduleId],
        ),
      )
      rawDraft.module = { ...moduleBlock, moduleId: packet.moduleId }
    }
  }

  const architectureBlock = rawDraft.architecture
  if (isPlainObject(architectureBlock)) {
    const nextBlock = { ...architectureBlock }
    let tampered = false
    if (architectureBlock.revision !== undefined && architectureBlock.revision !== packet.architectureRevision) {
      nextBlock.revision = packet.architectureRevision
      tampered = true
    }
    if (architectureBlock.contentHash !== undefined && architectureBlock.contentHash !== packet.architectureHash) {
      nextBlock.contentHash = packet.architectureHash
      tampered = true
    }
    if (tampered) {
      diagnostics.push(
        providerDiagnostic(
          'CAP-DES-PROV-ARCHITECTURE-TAMPER',
          'blocker',
          'a provider response attempted to change the approved architecture reference',
          'architecture',
          [packet.moduleId],
        ),
      )
      rawDraft.architecture = nextBlock
    }
  }

  for (const key of Object.keys(rawDraft)) {
    if (!KNOWN_DRAFT_FIELDS.has(key)) {
      diagnostics.push(
        providerDiagnostic('CAP-DES-PROV-UNKNOWN-FIELD', 'warning', `a provider response contained an unrecognized field: ${key}`, key, [packet.moduleId]),
      )
      delete rawDraft[key]
    }
  }

  const merged: Record<string, unknown> = { ...(baseDraft ?? {}), ...rawDraft }
  const missingRequiredFields = REQUIRED_DRAFT_FIELDS.filter((field) => merged[field] === undefined)

  return {
    imported: merged as Partial<ModuleDesignSpecification>,
    missingRequiredFields,
    diagnostics: sortProviderDiagnostics(diagnostics),
  }
}

// ---------------------------------------------------------------------------
// §24.3: canonical shape comparison across every provider mode
// ---------------------------------------------------------------------------

export type CanonicalDesignResponseShape = {
  hasDraft: boolean
  draftKeys: string[]
  assumptionsCount: number
  unresolvedQuestionsCount: number
  proposedContractsCount: number
  proposedDiagramsCount: number
  sourceRefsCount: number
  hasChangeSummary: boolean
}

/**
 * §24.3 "all modes create the same canonical record shape": normalizes a
 * `ModuleDesignResponse` (from any provider mode) into a comparable shape:
 * which top-level draft fields are present, and how many entries each
 * supporting list has. Deliberately ignores generated content (exact
 * wording, generated ids) so structurally equivalent responses from
 * different providers compare equal.
 */
export function canonicalizeResponse(response: ModuleDesignResponse | undefined): CanonicalDesignResponseShape {
  const draft = isPlainObject(response?.draft) ? (response!.draft as Record<string, unknown>) : {}
  return {
    hasDraft: response?.draft !== undefined && response?.draft !== null,
    draftKeys: stableSortStrings(Object.keys(draft)),
    assumptionsCount: response?.assumptions.length ?? 0,
    unresolvedQuestionsCount: response?.unresolvedQuestions.length ?? 0,
    proposedContractsCount: response?.proposedContracts.length ?? 0,
    proposedDiagramsCount: response?.proposedDiagrams.length ?? 0,
    sourceRefsCount: response?.sourceRefs.length ?? 0,
    hasChangeSummary: Boolean(response?.changeSummary),
  }
}
