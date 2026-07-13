/**
 * Offline, deterministic tests for the READ-ONLY Azure DevOps adapter.
 *
 * The MANDATORY suites run entirely in FAKE mode (EUIK_TEST_MODE=1) with NO
 * network access. The HOSTILE suites prove the three security invariants:
 *   (1) the PAT never leaks into any returned value / provenance / error / record;
 *   (2) no mutation endpoint is ever constructed or called (GET-only);
 *   (3) fake results carry an unforgeable mode:'fake-boundary' marker.
 *
 * A final opt-in suite exercises a REAL org and is skipped unless
 * EUIK_AZURE_ORG + EUIK_AZURE_PAT are set.
 *
 * Run: npx vitest run apps/desktop/test/azure-adapter.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertNoCanaryLeak } from '@engineering-ui-kit/core'
import * as adapter from '../src/capabilities/azureAdapter.js'

const CANARY_PAT = 'PAT-CANARY-super-secret-token-DO-NOT-LEAK-abc123'
const CONFIG = { organization: 'org-under-test', project: 'proj-under-test' } as const

function serialized(value: unknown): string {
  return JSON.stringify(value)
}

beforeEach(() => {
  process.env.EUIK_TEST_MODE = '1'
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// MANDATORY offline fake-mode behavior.
// ---------------------------------------------------------------------------
describe('fake mode (EUIK_TEST_MODE=1, offline)', () => {
  it('validateCredential succeeds and is marked fake', async () => {
    const r = await adapter.validateCredential(CONFIG, CANARY_PAT)
    expect(r.outcome).toBe('success')
    expect((r.value as any).mode).toBe('fake-boundary')
    expect((r.value as any).connected).toBe(false)
  })

  it('discover returns projects/repos/permissionSummary with a fake marker', async () => {
    const r = await adapter.discover(CONFIG, CANARY_PAT)
    expect(r.outcome).toBe('success')
    const v = r.value as any
    expect(Array.isArray(v.projects)).toBe(true)
    expect(v.permissionSummary).toContain('work-item:read')
    expect(v.mode).toBe('fake-boundary')
    expect(r.provenance.source).toBe('azure-fake')
  })

  it('importWorkItem returns a PROPOSED/DRAFT envelope, never a mutation', async () => {
    const r = await adapter.importWorkItem(CONFIG, CANARY_PAT, {
      externalId: '4242',
      revision: '7',
      fields: { 'System.Title': 'Example requirement' },
    })
    expect(r.outcome).toBe('success')
    const v = r.value as any
    expect(v.proposedImpact).toBe(true)
    expect(v.mutatesApprovedSpec).toBe(false)
    expect(v.mode).toBe('fake-boundary')
    // Provenance carries the full CAP-CONTRACT-020 shape.
    expect(v.provenance).toMatchObject({
      schemaVersion: '1.0',
      externalType: 'work-item',
      externalId: '4242',
      revision: '7',
      sourceAdapterVersion: adapter.AZURE_ADAPTER_VERSION,
    })
    expect(typeof v.provenance.contentHash).toBe('string')
    expect(v.provenance.contentHash).toHaveLength(64)
  })

  it('all list/read operations return empty fake lists offline', async () => {
    const ops = [
      adapter.listProjects(CONFIG, CANARY_PAT),
      adapter.listRepositories(CONFIG, CANARY_PAT),
      adapter.readPipelineDefinitions(CONFIG, CANARY_PAT),
      adapter.readPipelineRuns(CONFIG, CANARY_PAT, { pipelineId: '9' }),
      adapter.readTestPlans(CONFIG, CANARY_PAT),
      adapter.readTestRuns(CONFIG, CANARY_PAT),
      adapter.readTestResults(CONFIG, CANARY_PAT, { runId: '3' }),
      adapter.listArtifacts(CONFIG, CANARY_PAT, { buildId: '11' }),
    ]
    for (const r of await Promise.all(ops)) {
      expect(r.outcome).toBe('success')
      expect((r.value as any).mode).toBe('fake-boundary')
    }
  })

  it('downloadArtifact returns bounded metadata + hash in fake mode', async () => {
    const r = await adapter.downloadArtifact(CONFIG, CANARY_PAT, { buildId: '11', artifactName: 'drop' })
    expect(r.outcome).toBe('success')
    const v = r.value as any
    expect(v.kind).toBe('artifact-download')
    expect(v.byteSize).toBe(0)
    expect(v.mode).toBe('fake-boundary')
  })

  it('readinessSummary reports required read scopes', async () => {
    const r = await adapter.readinessSummary(CONFIG, CANARY_PAT)
    expect(r.outcome).toBe('success')
    expect((r.value as any).requiredScopes).toEqual([...adapter.REQUIRED_READ_SCOPES])
  })

  it('performs NO network I/O in fake mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await adapter.discover(CONFIG, CANARY_PAT)
    await adapter.importWorkItem(CONFIG, CANARY_PAT, { externalId: '1' })
    await adapter.readinessSummary(CONFIG, CANARY_PAT)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// HOSTILE (1): the PAT never appears anywhere it is returned or recorded.
// ---------------------------------------------------------------------------
describe('hostile: PAT never leaks', () => {
  it('fake-mode results never contain the PAT', async () => {
    const results = await Promise.all([
      adapter.validateCredential(CONFIG, CANARY_PAT),
      adapter.discover(CONFIG, CANARY_PAT),
      adapter.importWorkItem(CONFIG, CANARY_PAT, { externalId: '5', fields: { x: 'y' } }),
      adapter.readinessSummary(CONFIG, CANARY_PAT),
      adapter.downloadArtifact(CONFIG, CANARY_PAT, { buildId: '1', artifactName: 'a' }),
    ])
    for (const r of results) {
      expect(assertNoCanaryLeak(r, [CANARY_PAT])).toEqual([])
      expect(serialized(r)).not.toContain(CANARY_PAT)
    }
  })

  it('real-mode failures (auth/network/timeout) never echo the PAT', async () => {
    process.env.EUIK_TEST_MODE = '0'
    // 401 unauthorized
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('unauthorized', { status: 401, headers: { 'content-type': 'text/plain' } }),
    )
    const authFail = await adapter.discover(CONFIG, CANARY_PAT)
    expect(authFail.outcome).toBe('technical-failure')
    expect(authFail.error?.code).toBe('CAP-AZURE-AUTH')
    expect(assertNoCanaryLeak(authFail, [CANARY_PAT])).toEqual([])

    // Network unavailable (fetch rejects with the PAT embedded in the message).
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(`connect failed using ${CANARY_PAT}`))
    const netFail = await adapter.validateCredential(CONFIG, CANARY_PAT)
    expect(netFail.outcome).toBe('technical-failure')
    expect(netFail.error?.code).toBe('CAP-AZURE-NETWORK')
    expect(assertNoCanaryLeak(netFail, [CANARY_PAT])).toEqual([])
    expect(serialized(netFail)).not.toContain(CANARY_PAT)
  })

  it('insufficient scope (403) is a sanitized authorization failure', async () => {
    process.env.EUIK_TEST_MODE = '0'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('forbidden', { status: 403 }))
    const r = await adapter.listRepositories(CONFIG, CANARY_PAT)
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-AZURE-SCOPE')
    expect(assertNoCanaryLeak(r, [CANARY_PAT])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// HOSTILE (2): every real call is GET; no mutation verb is ever issued.
// ---------------------------------------------------------------------------
describe('hostile: read-only (GET verbs only)', () => {
  it('uses only GET across every real-mode operation', async () => {
    process.env.EUIK_TEST_MODE = '0'
    const seenMethods = new Set<string>()
    const seenUrls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      seenMethods.add((init?.method ?? 'GET').toUpperCase())
      seenUrls.push(String(url))
      // Minimal JSON body good enough for every parser path.
      return new Response(JSON.stringify({ count: 0, value: [], authenticatedUser: { id: 'u' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    await adapter.validateCredential(CONFIG, CANARY_PAT)
    await adapter.discover(CONFIG, CANARY_PAT)
    await adapter.listProjects(CONFIG, CANARY_PAT)
    await adapter.listRepositories(CONFIG, CANARY_PAT)
    await adapter.importWorkItem(CONFIG, CANARY_PAT, { externalId: '1' })
    await adapter.readPipelineDefinitions(CONFIG, CANARY_PAT)
    await adapter.readPipelineRuns(CONFIG, CANARY_PAT, { pipelineId: '2' })
    await adapter.readTestPlans(CONFIG, CANARY_PAT)
    await adapter.readTestRuns(CONFIG, CANARY_PAT)
    await adapter.readTestResults(CONFIG, CANARY_PAT, { runId: '3' })
    await adapter.listArtifacts(CONFIG, CANARY_PAT, { buildId: '4' })

    expect([...seenMethods]).toEqual(['GET'])
    // Sanity: api-version is pinned and no obvious mutation path was built.
    for (const u of seenUrls) {
      expect(u).toContain('api-version=')
      expect(u).not.toMatch(/\$apply|_apis\/wit\/\$batch/i)
    }
    expect(seenUrls.length).toBeGreaterThan(0)
  })

  it('the PAT rides only in the Authorization header, never in the URL', async () => {
    process.env.EUIK_TEST_MODE = '0'
    let capturedUrl = ''
    let capturedAuth = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      capturedUrl = String(url)
      capturedAuth = String(new Headers(init?.headers).get('authorization') ?? '')
      return new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    await adapter.listProjects(CONFIG, CANARY_PAT)
    expect(capturedUrl).not.toContain(CANARY_PAT)
    // Auth header is Basic base64(":"+pat) — the raw PAT still never appears.
    expect(capturedAuth.startsWith('Basic ')).toBe(true)
    expect(capturedAuth).not.toContain(CANARY_PAT)
    expect(Buffer.from(capturedAuth.slice(6), 'base64').toString()).toBe(':' + CANARY_PAT)
  })
})

// ---------------------------------------------------------------------------
// HOSTILE (3): throttling / cancellation / timeout are handled safely.
// ---------------------------------------------------------------------------
describe('hostile: resilience', () => {
  it('retries on 429 then succeeds, honoring Retry-After', async () => {
    process.env.EUIK_TEST_MODE = '0'
    let calls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls++
      if (calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '0' } })
      return new Response(JSON.stringify({ value: [{ id: '1', name: 'p' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const r = await adapter.listProjects(CONFIG, CANARY_PAT)
    expect(calls).toBe(2)
    expect(r.outcome).toBe('success')
  })

  it('surfaces sustained throttling as a delayed-retry failure', async () => {
    process.env.EUIK_TEST_MODE = '0'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
    const r = await adapter.listProjects(CONFIG, CANARY_PAT, { maxThrottleRetries: 1 })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-AZURE-THROTTLED')
    expect(r.error?.retryability).toBe('delayed')
  })

  it('honors caller cancellation via AbortController', async () => {
    process.env.EUIK_TEST_MODE = '0'
    const controller = new AbortController()
    controller.abort()
    const r = await adapter.discover(CONFIG, CANARY_PAT, { signal: controller.signal })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-AZURE-CANCELLED')
  })

  it('rejects missing configuration without touching the network', async () => {
    process.env.EUIK_TEST_MODE = '0'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const r = await adapter.discover({ organization: '' }, CANARY_PAT)
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-AZURE-CONFIG')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an empty PAT before any request', async () => {
    process.env.EUIK_TEST_MODE = '0'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const r = await adapter.listProjects(CONFIG, '')
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-AZURE-AUTH')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// OPT-IN: real network. Skipped unless a real org + PAT are provided.
// ---------------------------------------------------------------------------
const realOrg = process.env.EUIK_AZURE_ORG
const realPat = process.env.EUIK_AZURE_PAT
const realConfigured = Boolean(realOrg && realPat)

describe('real Azure DevOps (opt-in)', () => {
  it.skipIf(!realConfigured)('validates a real credential read-only', async () => {
    delete process.env.EUIK_TEST_MODE
    const r = await adapter.validateCredential(
      { organization: realOrg!, project: process.env.EUIK_AZURE_PROJECT },
      realPat!,
    )
    expect(r.outcome).toBe('success')
    expect(assertNoCanaryLeak(r, [realPat!])).toEqual([])
  })
})
