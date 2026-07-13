import { describe, expect, it } from 'vitest'
import { assertNoCanaryLeak, redactSensitiveText } from '../../src/capabilities/redaction.js'
import { migrateCapabilityWorkspace } from '../../src/capabilities/migration.js'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import { transitionJob } from '../../src/capabilities/jobs.js'
import { cancelledResult, domainRejectionResult, successResult, technicalFailureResult, sanitizeBoundaryError } from '../../src/capabilities/runtime.js'
import type { JobRecord } from '../../src/capabilities/types.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('CAP-TEST-024 result envelope outcomes', () => {
  const provenance = { source: 'test', recordedAt: '2026-07-12T00:00:00.000Z' }
  it('distinguishes success, rejection, failure, and cancellation', () => {
    expect(successResult(1, provenance).outcome).toBe('success')
    expect(domainRejectionResult('D', 'no', provenance).outcome).toBe('domain-rejection')
    expect(
      technicalFailureResult(
        {
          schemaVersion: '1.0',
          code: 'E',
          category: 'execution',
          safeMessage: 'x',
          retryability: 'none',
          relatedIds: [],
          diagnosticRefs: [],
        },
        provenance,
      ).outcome,
    ).toBe('technical-failure')
    expect(cancelledResult(provenance).outcome).toBe('cancelled')
    expect(sanitizeBoundaryError(new Error('token=SECRET /Users/tim/secret')).safeMessage).not.toContain('SECRET')
  })
})

describe('CAP-TEST-027 job transitions', () => {
  it('allows legal transitions and rejects illegal ones', () => {
    const job: JobRecord = {
      schemaVersion: '1.0',
      jobId: 'j1',
      projectId: 'p',
      operationId: 'op',
      operationVersion: '1',
      inputHash: 'h',
      state: 'queued',
      createdAt: 't',
      updatedAt: 't',
      diagnostics: [],
      artifactRefs: [],
    }
    expect(transitionJob(job, 'running').ok).toBe(true)
    expect(transitionJob(job, 'succeeded').ok).toBe(false)
  })
})

describe('CAP-TEST-036 redaction', () => {
  it('redacts canary secrets and paths', () => {
    const text = redactSensitiveText('Authorization: Bearer CANARY-TOKEN path=/Users/tim/secret')
    expect(text).not.toContain('CANARY-TOKEN')
    expect(text).not.toContain('/Users/tim/secret')
    expect(assertNoCanaryLeak({ ok: true }, ['CANARY-TOKEN'])).toEqual([])
    expect(assertNoCanaryLeak({ token: 'CANARY-TOKEN' }, ['CANARY-TOKEN'])).toEqual(['CANARY-TOKEN'])
  })
})

describe('CAP-TEST-039 migration', () => {
  it('is lazy and idempotent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-mig-'))
    const ws = new CapabilityWorkspace(dir)
    const first = migrateCapabilityWorkspace(ws, 'proj')
    const second = migrateCapabilityWorkspace(ws, 'proj')
    expect(first.toVersion).toBe('1.0')
    expect(second.idempotent).toBe(true)
  })
})
