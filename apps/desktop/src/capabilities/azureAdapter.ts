/**
 * Real, READ-ONLY Azure DevOps REST adapter (Workstream 3).
 *
 * Design invariants (enforced by tests in apps/desktop/test/azure-adapter.test.ts):
 *  - Every network call is HTTP GET. There is NO code path that constructs a
 *    POST/PUT/PATCH/DELETE against Azure DevOps. Mutation endpoints are never built.
 *  - The Personal Access Token (PAT) is received as a plaintext function argument
 *    ONLY at call time. It is placed solely in the outbound Authorization header.
 *    It NEVER appears in any returned value, provenance, log, thrown error, or
 *    serialized record. All error text is sanitized via core redaction helpers.
 *  - When process.env.EUIK_TEST_MODE === '1' the adapter operates in a deterministic
 *    FAKE mode that performs NO network I/O and marks results with mode:'fake-boundary'
 *    so they cannot be mistaken for real connected verification credit.
 *  - Imported external records are shaped as PROPOSED impact / DRAFT envelopes
 *    ({ proposedImpact: true, mutatesApprovedSpec: false }); they never mutate
 *    approved specifications.
 *
 * The renderer never sees the PAT: the desktop process decrypts it via safeStorage
 * and hands the plaintext to these functions; the returned ResultEnvelope is the
 * only thing that crosses the IPC boundary back to the renderer.
 */

import crypto from 'node:crypto'
import {
  successResult,
  technicalFailureResult,
  sanitizeBoundaryError,
  redactSensitiveText,
  type AzureDevOpsProvenance,
  type ErrorRecord,
  type Provenance,
  type ResultEnvelope,
} from '@engineering-ui-kit/core'

/** Bump when the shape/behavior of imported records changes. Recorded in provenance. */
export const AZURE_ADAPTER_VERSION = '1.0.0'

/** Supported, current Azure DevOps REST API version. */
export const AZURE_API_VERSION = '7.1'

const DEFAULT_BASE_URL = 'https://dev.azure.com'
const DEFAULT_TIMEOUT_MS = 30_000
/** Cap on artifact bytes buffered into memory during metadata+download. */
const MAX_ARTIFACT_DOWNLOAD_BYTES = 25 * 1024 * 1024

/** The minimum read scopes this adapter needs. Reported in the readiness summary. */
export const REQUIRED_READ_SCOPES = [
  'organization:read',
  'project:read',
  'repository:read',
  'work-item:read',
  'pipeline:read',
  'test:read',
  'artifact:read',
] as const

function isTestMode(): boolean {
  return process.env.EUIK_TEST_MODE === '1'
}

/** Non-secret adapter configuration. Persisted / passed by the caller. NEVER holds a PAT. */
export type AzureAdapterConfig = {
  organization: string
  project?: string
  /** Override for sovereign clouds / on-prem. Defaults to https://dev.azure.com. */
  baseUrl?: string
  timeoutMs?: number
}

export type AzureCallOptions = {
  /** Caller-supplied cancellation. */
  signal?: AbortSignal
  /** Bounded automatic retries for throttling (HTTP 429). Default 2. */
  maxThrottleRetries?: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function fakeProvenance(): Provenance {
  return { source: 'azure-fake', recordedAt: nowIso() }
}

function realProvenance(refs: string[]): Provenance {
  return { source: 'azure-devops', recordedAt: nowIso(), refs }
}

function contentHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function requireConfig(config: AzureAdapterConfig): { organization: string; baseUrl: string; timeoutMs: number } {
  const organization = (config.organization ?? '').trim()
  if (!organization) throw new AzureError('missing-configuration', 'missing organization', 'none')
  return {
    organization,
    baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    timeoutMs: config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS,
  }
}

function requireProject(config: AzureAdapterConfig): string {
  const project = (config.project ?? '').trim()
  if (!project) throw new AzureError('missing-configuration', 'missing project', 'none')
  return project
}

type FailureKind =
  | 'invalid-pat'
  | 'insufficient-scope'
  | 'missing-configuration'
  | 'not-found'
  | 'throttled'
  | 'timeout'
  | 'cancelled'
  | 'network-unavailable'
  | 'unexpected'

const FAILURE_CODE: Record<FailureKind, string> = {
  'invalid-pat': 'CAP-AZURE-AUTH',
  'insufficient-scope': 'CAP-AZURE-SCOPE',
  'missing-configuration': 'CAP-AZURE-CONFIG',
  'not-found': 'CAP-AZURE-NOTFOUND',
  throttled: 'CAP-AZURE-THROTTLED',
  timeout: 'CAP-AZURE-TIMEOUT',
  cancelled: 'CAP-AZURE-CANCELLED',
  'network-unavailable': 'CAP-AZURE-NETWORK',
  unexpected: 'CAP-AZURE-UNEXPECTED',
}

const FAILURE_CATEGORY: Record<FailureKind, ErrorRecord['category']> = {
  'invalid-pat': 'authorization',
  'insufficient-scope': 'authorization',
  'missing-configuration': 'configuration',
  'not-found': 'configuration',
  throttled: 'execution',
  timeout: 'execution',
  cancelled: 'execution',
  'network-unavailable': 'dependency',
  unexpected: 'execution',
}

const FAILURE_RETRYABILITY: Record<FailureKind, ErrorRecord['retryability']> = {
  'invalid-pat': 'manual',
  'insufficient-scope': 'manual',
  'missing-configuration': 'manual',
  'not-found': 'manual',
  throttled: 'delayed',
  timeout: 'immediate',
  cancelled: 'none',
  'network-unavailable': 'manual',
  unexpected: 'manual',
}

class AzureError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
    readonly retryability?: ErrorRecord['retryability'],
  ) {
    // Sanitize eagerly so the PAT / tokens can never survive in .message.
    super(redactSensitiveText(message))
    this.name = 'AzureError'
  }
}

function toErrorRecord(error: unknown): ErrorRecord {
  if (error instanceof AzureError) {
    return {
      schemaVersion: '1.0',
      code: FAILURE_CODE[error.kind],
      category: FAILURE_CATEGORY[error.kind],
      // Message already sanitized in the constructor; redact again defensively.
      safeMessage: redactSensitiveText(error.message),
      retryability: error.retryability ?? FAILURE_RETRYABILITY[error.kind],
      relatedIds: [],
      diagnosticRefs: [],
    }
  }
  // Unknown throwable — fall back to the core sanitizer.
  return sanitizeBoundaryError(error)
}

function classifyStatus(status: number, retryAfterSeconds?: number): AzureError {
  if (status === 401 || status === 203) {
    // 203 Non-Authoritative is what dev.azure.com returns for an unauthenticated
    // API call that got bounced to a sign-in page.
    return new AzureError('invalid-pat', 'authentication failed (invalid or expired PAT)')
  }
  if (status === 403) {
    return new AzureError('insufficient-scope', 'the PAT lacks the required read scope')
  }
  if (status === 404) {
    return new AzureError('not-found', 'organization, project, or resource not found')
  }
  if (status === 429) {
    const hint = retryAfterSeconds ? ` retry after ${retryAfterSeconds}s` : ''
    return new AzureError('throttled', `request throttled by Azure DevOps${hint}`, 'delayed')
  }
  return new AzureError('unexpected', `unexpected response status ${status}`)
}

/**
 * The one and only outbound call site. GET-only by construction: no `method`
 * parameter is accepted, so no mutation verb can be issued. The PAT lives only
 * in the Authorization header of this request.
 */
async function azureGet(
  url: string,
  pat: string,
  timeoutMs: number,
  options: AzureCallOptions | undefined,
): Promise<Response> {
  if (typeof pat !== 'string' || pat.length === 0) {
    throw new AzureError('invalid-pat', 'a Personal Access Token is required')
  }
  const maxThrottleRetries = options?.maxThrottleRetries ?? 2
  // Azure DevOps PAT auth = HTTP Basic with an empty username.
  const authorization = 'Basic ' + Buffer.from(':' + pat).toString('base64')

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController()
    const abortForParent = () => controller.abort()
    if (options?.signal) {
      if (options.signal.aborted) throw new AzureError('cancelled', 'request cancelled')
      options.signal.addEventListener('abort', abortForParent, { once: true })
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
        },
        signal: controller.signal,
        redirect: 'manual',
      })
      if (response.status === 429 && attempt < maxThrottleRetries) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '1')
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000
        await delay(Math.min(waitMs, 10_000), options?.signal)
        continue
      }
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '')
        throw classifyStatus(response.status, Number.isFinite(retryAfter) ? retryAfter : undefined)
      }
      return response
    } catch (cause) {
      if (cause instanceof AzureError) throw cause
      if (isAbort(cause)) {
        if (options?.signal?.aborted) throw new AzureError('cancelled', 'request cancelled')
        throw new AzureError('timeout', 'request timed out')
      }
      // DNS failure / offline / connection refused, etc. Never surface the raw cause.
      throw new AzureError('network-unavailable', 'network is unavailable')
    } finally {
      clearTimeout(timer)
      if (options?.signal) options.signal.removeEventListener('abort', abortForParent)
    }
  }
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ABORT_ERR')
  )
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AzureError('cancelled', 'request cancelled'))
    const timer = setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new AzureError('cancelled', 'request cancelled'))
      },
      { once: true },
    )
  })
}

async function azureGetJson<T = unknown>(
  url: string,
  pat: string,
  timeoutMs: number,
  options: AzureCallOptions | undefined,
): Promise<T> {
  const response = await azureGet(url, pat, timeoutMs, options)
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AzureError('unexpected', 'response was not valid JSON')
  }
}

function withApiVersion(url: string): string {
  return url.includes('api-version=') ? url : url + (url.includes('?') ? '&' : '?') + 'api-version=' + AZURE_API_VERSION
}

type AzureListResponse<T> = { count?: number; value?: T[]; continuationToken?: string }

/**
 * Follows Azure DevOps `x-ms-continuationtoken` pagination. Bounded by maxPages so a
 * pathological server cannot loop us forever.
 */
async function azureGetAll<T>(
  buildUrl: (continuationToken?: string) => string,
  pat: string,
  timeoutMs: number,
  options: AzureCallOptions | undefined,
  maxPages = 50,
): Promise<T[]> {
  const items: T[] = []
  let continuationToken: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const response = await azureGet(withApiVersion(buildUrl(continuationToken)), pat, timeoutMs, options)
    const headerToken = response.headers.get('x-ms-continuationtoken') ?? undefined
    const body = (await response.json().catch(() => ({}))) as AzureListResponse<T>
    if (Array.isArray(body.value)) items.push(...body.value)
    continuationToken = headerToken ?? body.continuationToken
    if (!continuationToken) break
  }
  return items
}

type AzureContext = {
  organization: string
  baseUrl: string
  timeoutMs: number
  /** '' when the operation does not require a project. */
  project: string
}

/**
 * Parses (and validates) the non-secret config INSIDE the try, runs the producer,
 * and converts every throwable — including missing-config/missing-project — into a
 * sanitized ResultEnvelope. This guarantees synchronous configuration errors never
 * escape as raw exceptions and that provenance never carries the PAT.
 */
async function guarded(
  config: AzureAdapterConfig,
  opts: { project?: boolean; refs?: readonly string[] },
  produce: (ctx: AzureContext, pat: string) => Promise<unknown>,
  pat: string,
): Promise<ResultEnvelope> {
  const extra = (opts.refs ?? []).filter((s): s is string => Boolean(s))
  try {
    const { organization, baseUrl, timeoutMs } = requireConfig(config)
    const project = opts.project ? requireProject(config) : (config.project?.trim() ?? '')
    const refs = [organization, ...(opts.project ? [project] : []), ...extra]
    const value = await produce({ organization, baseUrl, timeoutMs, project }, pat)
    return successResult(value, realProvenance(refs))
  } catch (cause) {
    const refs = [(config.organization ?? '').trim(), ...extra].filter(Boolean)
    return technicalFailureResult(toErrorRecord(cause), realProvenance(refs))
  }
}

// ---------------------------------------------------------------------------
// Deterministic FAKE fixtures (EUIK_TEST_MODE=1). No network. Clearly marked.
// ---------------------------------------------------------------------------

const FAKE_ORG = 'Example Org'
const FAKE_PROJECT = 'Example Project'
const FAKE_MARKER = { mode: 'fake-boundary' as const, connected: false }

function fakeDiscover(): ResultEnvelope {
  return successResult(
    {
      organizations: [{ id: 'org-1', name: FAKE_ORG }],
      projects: [{ id: 'ado-proj', name: FAKE_PROJECT }],
      repositories: [{ id: 'repo-1', name: 'example-repo' }],
      permissionSummary: [...REQUIRED_READ_SCOPES],
      apiVersion: AZURE_API_VERSION,
      ...FAKE_MARKER,
    },
    fakeProvenance(),
  )
}

function fakeList(kind: string): ResultEnvelope {
  return successResult({ kind, items: [], apiVersion: AZURE_API_VERSION, ...FAKE_MARKER }, fakeProvenance())
}

function fakeImportedRecord(
  externalType: string,
  externalId: string,
  revision: string,
  fields: Record<string, string>,
  extra: Partial<AzureDevOpsProvenance> = {},
): ResultEnvelope {
  const provenance = buildAzureProvenance({
    organization: FAKE_ORG,
    project: FAKE_PROJECT,
    externalType,
    externalId,
    revision,
    fields,
    ...extra,
  })
  return successResult(
    { provenance, proposedImpact: true, mutatesApprovedSpec: false, ...FAKE_MARKER },
    fakeProvenance(),
  )
}

// ---------------------------------------------------------------------------
// Provenance capture (CAP-CONTRACT-020). PAT is never an input here.
// ---------------------------------------------------------------------------

export function buildAzureProvenance(input: {
  organization: string
  project: string
  externalType: string
  externalId: string
  revision: string
  url?: string
  fields: Record<string, string>
  pipelineRunId?: string
  testRunId?: string
  artifactId?: string
}): AzureDevOpsProvenance {
  const provenance: AzureDevOpsProvenance = {
    schemaVersion: '1.0',
    organization: input.organization,
    project: input.project,
    externalType: input.externalType,
    externalId: input.externalId,
    revision: input.revision,
    retrievedAt: nowIso(),
    contentHash: contentHash(input.fields),
    fieldMapping: input.fields,
    sourceAdapterVersion: AZURE_ADAPTER_VERSION,
  }
  if (input.url) provenance.url = input.url
  if (input.pipelineRunId) provenance.pipelineRunId = input.pipelineRunId
  if (input.testRunId) provenance.testRunId = input.testRunId
  if (input.artifactId) provenance.artifactId = input.artifactId
  return provenance
}

// ---------------------------------------------------------------------------
// Public READ-ONLY operations.
// Every function takes (config, pat, options?) and returns a ResultEnvelope.
// ---------------------------------------------------------------------------

/** Confirm the PAT authenticates. Uses connectionData (org-read). */
export async function validateCredential(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) {
    return successResult(
      { authenticated: true, organization: FAKE_ORG, apiVersion: AZURE_API_VERSION, ...FAKE_MARKER },
      fakeProvenance(),
    )
  }
  return guarded(config, {}, async ({ organization, baseUrl, timeoutMs }, secret) => {
    const data = await azureGetJson<{ authenticatedUser?: { id?: string; providerDisplayName?: string } }>(
      withApiVersion(`${baseUrl}/${encodeURIComponent(organization)}/_apis/connectionData`),
      secret,
      timeoutMs,
      options,
    )
    // Deliberately return only non-secret identity metadata.
    return {
      authenticated: true,
      organization,
      authenticatedUserId: data.authenticatedUser?.id,
      authenticatedUserDisplayName: data.authenticatedUser?.providerDisplayName,
      apiVersion: AZURE_API_VERSION,
    }
  }, pat)
}

/** Organization/project/repository discovery + readiness summary. */
export async function discover(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) return fakeDiscover()
  return guarded(config, {}, async ({ organization, baseUrl, timeoutMs, project }, secret) => {
    const projects = await azureGetAll<{ id: string; name: string }>(
      (token) =>
        `${baseUrl}/${encodeURIComponent(organization)}/_apis/projects` +
        (token ? `?continuationToken=${encodeURIComponent(token)}` : ''),
      secret,
      timeoutMs,
      options,
    )
    // Repositories are project-scoped; only enumerate when a project is configured.
    let repositories: { id: string; name: string }[] = []
    if (project) {
      repositories = await azureGetAll<{ id: string; name: string }>(
        () => `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/git/repositories`,
        secret,
        timeoutMs,
        options,
      )
    }
    return {
      organizations: [{ id: organization, name: organization }],
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      repositories: repositories.map((r) => ({ id: r.id, name: r.name })),
      permissionSummary: [...REQUIRED_READ_SCOPES],
      apiVersion: AZURE_API_VERSION,
    }
  }, pat)
}

/** List projects in the organization. */
export async function listProjects(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) return fakeList('projects')
  return guarded(config, {}, async ({ organization, baseUrl, timeoutMs }, secret) => ({
    kind: 'projects',
    items: await azureGetAll<{ id: string; name: string }>(
      (token) =>
        `${baseUrl}/${encodeURIComponent(organization)}/_apis/projects` +
        (token ? `?continuationToken=${encodeURIComponent(token)}` : ''),
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/** List git repositories in the configured project. */
export async function listRepositories(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) return fakeList('repositories')
  return guarded(config, { project: true }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'repositories',
    items: await azureGetAll<{ id: string; name: string }>(
      () => `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/git/repositories`,
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/**
 * Read a work item and import it as a PROPOSED impact / DRAFT record.
 * Never mutates the work item; never mutates approved specs.
 */
export async function importWorkItem(
  config: AzureAdapterConfig,
  pat: string,
  input: { externalId: string; revision?: string; fields?: Record<string, string> },
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  const externalId = (input.externalId ?? '').trim()
  if (!externalId) return technicalFailureResult(toErrorRecord(new AzureError('missing-configuration', 'missing work item id')), isTestMode() ? fakeProvenance() : realProvenance([]))

  if (isTestMode()) {
    return fakeImportedRecord('work-item', externalId, input.revision ?? '1', input.fields ?? { id: externalId })
  }
  return guarded(config, { project: true, refs: [externalId] }, async ({ organization, baseUrl, timeoutMs, project }, secret) => {
    const item = await azureGetJson<{
      id: number
      rev: number
      url?: string
      fields?: Record<string, unknown>
    }>(
      withApiVersion(
        `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wit/workitems/${encodeURIComponent(externalId)}`,
      ),
      secret,
      timeoutMs,
      options,
    )
    const fields: Record<string, string> = {}
    for (const [key, value] of Object.entries(item.fields ?? {})) {
      fields[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }
    const provenance = buildAzureProvenance({
      organization,
      project,
      externalType: 'work-item',
      externalId: String(item.id ?? externalId),
      revision: String(item.rev ?? input.revision ?? '1'),
      url: item.url,
      fields,
    })
    return { provenance, proposedImpact: true, mutatesApprovedSpec: false }
  }, pat)
}

/** Read pipeline (build) definitions. */
export async function readPipelineDefinitions(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) return fakeList('pipeline-definitions')
  return guarded(config, { project: true }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'pipeline-definitions',
    items: await azureGetAll<{ id: number; name: string }>(
      (token) =>
        `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/pipelines` +
        (token ? `?continuationToken=${encodeURIComponent(token)}` : ''),
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/** Read pipeline runs for a definition. */
export async function readPipelineRuns(
  config: AzureAdapterConfig,
  pat: string,
  input: { pipelineId: string },
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  const pipelineId = (input.pipelineId ?? '').trim()
  if (isTestMode()) return fakeList('pipeline-runs')
  if (!pipelineId) return technicalFailureResult(toErrorRecord(new AzureError('missing-configuration', 'missing pipelineId')), realProvenance([]))
  return guarded(config, { project: true, refs: [pipelineId] }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'pipeline-runs',
    pipelineId,
    items: await azureGetAll<{ id: number; state: string; result?: string }>(
      () =>
        `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/pipelines/${encodeURIComponent(pipelineId)}/runs`,
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/** Read test plans. */
export async function readTestPlans(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) return fakeList('test-plans')
  return guarded(config, { project: true }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'test-plans',
    items: await azureGetAll<{ id: number; name: string }>(
      (token) =>
        `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/testplan/plans` +
        (token ? `?continuationToken=${encodeURIComponent(token)}` : ''),
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/** Read test runs. */
export async function readTestRuns(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) return fakeList('test-runs')
  return guarded(config, { project: true }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'test-runs',
    items: await azureGetAll<{ id: number; name: string; state: string }>(
      () => `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/test/runs`,
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/** Read test results for a run. */
export async function readTestResults(
  config: AzureAdapterConfig,
  pat: string,
  input: { runId: string },
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  const runId = (input.runId ?? '').trim()
  if (isTestMode()) return fakeList('test-results')
  if (!runId) return technicalFailureResult(toErrorRecord(new AzureError('missing-configuration', 'missing runId')), realProvenance([]))
  return guarded(config, { project: true, refs: [runId] }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'test-results',
    runId,
    items: await azureGetAll<{ id: number; outcome?: string }>(
      () => `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/test/runs/${encodeURIComponent(runId)}/results`,
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/** List build artifact metadata for a build. */
export async function listArtifacts(
  config: AzureAdapterConfig,
  pat: string,
  input: { buildId: string },
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  const buildId = (input.buildId ?? '').trim()
  if (isTestMode()) return fakeList('artifacts')
  if (!buildId) return technicalFailureResult(toErrorRecord(new AzureError('missing-configuration', 'missing buildId')), realProvenance([]))
  return guarded(config, { project: true, refs: [buildId] }, async ({ organization, baseUrl, timeoutMs, project }, secret) => ({
    kind: 'artifacts',
    buildId,
    items: await azureGetAll<{ id: number; name: string; resource?: { downloadUrl?: string } }>(
      () => `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/build/builds/${encodeURIComponent(buildId)}/artifacts`,
      secret,
      timeoutMs,
      options,
    ),
  }), pat)
}

/**
 * Download a build artifact and return its metadata + content hash (bounded).
 * Read-only: this only performs a GET against the download URL. The bytes are
 * hashed and their size reported; the raw content is NOT placed in provenance.
 */
export async function downloadArtifact(
  config: AzureAdapterConfig,
  pat: string,
  input: { buildId: string; artifactName: string },
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  const buildId = (input.buildId ?? '').trim()
  const artifactName = (input.artifactName ?? '').trim()
  if (isTestMode()) {
    return successResult(
      { kind: 'artifact-download', buildId, artifactName, byteSize: 0, contentHash: contentHash(''), ...FAKE_MARKER },
      fakeProvenance(),
    )
  }
  if (!buildId || !artifactName) {
    return technicalFailureResult(toErrorRecord(new AzureError('missing-configuration', 'missing buildId or artifactName')), realProvenance([]))
  }
  return guarded(config, { project: true, refs: [buildId, artifactName] }, async ({ organization, baseUrl, timeoutMs, project }, secret) => {
    const meta = await azureGetJson<{ id: number; name: string; resource?: { downloadUrl?: string } }>(
      withApiVersion(
        `${baseUrl}/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/build/builds/${encodeURIComponent(buildId)}/artifacts?artifactName=${encodeURIComponent(artifactName)}`,
      ),
      secret,
      timeoutMs,
      options,
    )
    const downloadUrl = meta.resource?.downloadUrl
    if (!downloadUrl) throw new AzureError('not-found', 'artifact download url not available')
    const response = await azureGet(downloadUrl, secret, timeoutMs, options)
    const declaredLength = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTIFACT_DOWNLOAD_BYTES) {
      throw new AzureError('unexpected', 'artifact exceeds the maximum download size')
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > MAX_ARTIFACT_DOWNLOAD_BYTES) {
      throw new AzureError('unexpected', 'artifact exceeds the maximum download size')
    }
    const provenance = buildAzureProvenance({
      organization,
      project,
      externalType: 'artifact',
      externalId: artifactName,
      revision: buildId,
      fields: { name: artifactName, buildId },
      artifactId: String(meta.id ?? artifactName),
    })
    return {
      kind: 'artifact-download',
      buildId,
      artifactName,
      byteSize: buffer.byteLength,
      contentHash: crypto.createHash('sha256').update(buffer).digest('hex'),
      provenance,
      proposedImpact: true,
      mutatesApprovedSpec: false,
    }
  }, pat)
}

/**
 * Permission / readiness summary: validates the credential and reports the read
 * scopes this adapter requires. Non-mutating.
 */
export async function readinessSummary(
  config: AzureAdapterConfig,
  pat: string,
  options?: AzureCallOptions,
): Promise<ResultEnvelope> {
  if (isTestMode()) {
    return successResult(
      {
        ready: true,
        organization: FAKE_ORG,
        requiredScopes: [...REQUIRED_READ_SCOPES],
        apiVersion: AZURE_API_VERSION,
        ...FAKE_MARKER,
      },
      fakeProvenance(),
    )
  }
  const validation = await validateCredential(config, pat, options)
  if (validation.outcome !== 'success') return validation
  const { organization } = requireConfig(config)
  return successResult(
    {
      ready: true,
      organization,
      requiredScopes: [...REQUIRED_READ_SCOPES],
      apiVersion: AZURE_API_VERSION,
    },
    realProvenance([organization]),
  )
}

/** Convenience surface object so the caller can inject/wire one value. */
export const azureAdapter = {
  version: AZURE_ADAPTER_VERSION,
  apiVersion: AZURE_API_VERSION,
  requiredReadScopes: REQUIRED_READ_SCOPES,
  validateCredential,
  discover,
  listProjects,
  listRepositories,
  importWorkItem,
  readPipelineDefinitions,
  readPipelineRuns,
  readTestPlans,
  readTestRuns,
  readTestResults,
  listArtifacts,
  downloadArtifact,
  readinessSummary,
  buildProvenance: buildAzureProvenance,
} as const

export type AzureAdapter = typeof azureAdapter
