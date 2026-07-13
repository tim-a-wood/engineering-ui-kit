/**
 * CAP-TEST-041 — Performance at 100 modules / 300 edges (CAP-PKT-031).
 */
import os from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildPerfFixture } from '../../src/capabilities/perfFixture.js'
import { buildCapabilityGraph } from '../../src/capabilities/graph.js'
import { projectArchitecture } from '../../src/capabilities/architectureProjection.js'
import { calculateFreshness } from '../../src/capabilities/freshness.js'
import { transitionJob } from '../../src/capabilities/jobs.js'
import type { JobRecord, VerificationRecord } from '../../src/capabilities/types.js'

const PROJECTION_P95_MS = 200
const RECOMPUTE_P95_MS = 500
const RUNS = 20

function percentile95(samples: number[]): number {
  const sorted = samples.slice().sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)
  return sorted[Math.max(0, index)]!
}

function measure(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

describe('CAP-TEST-041 performance fixture and p95 targets', () => {
  it('exposes a fixed 100-module / 300-edge fixture', () => {
    const { architecture, manifests } = buildPerfFixture()
    expect(manifests).toHaveLength(100)
    expect(architecture.moduleIds).toHaveLength(100)
    expect(architecture.dependencyEdges).toHaveLength(300)
  })

  it('meets p95 projection and freshness recompute targets over 20 runs', () => {
    const { architecture, manifests } = buildPerfFixture()
    // Warm once (excluded from measurement per CAP-QUAL-003 — first disk/load excluded).
    buildCapabilityGraph(architecture, manifests)
    projectArchitecture(architecture, manifests, {}, { mode: 'guided' })

    const projectionSamples: number[] = []
    const recomputeSamples: number[] = []

    for (let i = 0; i < RUNS; i += 1) {
      projectionSamples.push(
        measure(() => {
          const graph = buildCapabilityGraph(architecture, manifests)
          const guided = projectArchitecture(architecture, manifests, {}, { mode: 'guided' })
          const design = projectArchitecture(architecture, manifests, {}, { mode: 'design' })
          expect(graph.nodes).toHaveLength(100)
          expect(graph.edges).toHaveLength(300)
          expect(guided.nodes).toHaveLength(100)
          expect(design.listItems).toHaveLength(100)
        }),
      )

      recomputeSamples.push(
        measure(() => {
          const verification: VerificationRecord = {
            schemaVersion: '1.0',
            verificationId: `ver-${i}`,
            projectId: 'perf',
            moduleId: 'mod.perf.000',
            suiteIds: ['suite.perf'],
            suiteVersions: ['1.0'],
            suiteHashes: ['suite.perf'],
            inputHashes: {
              specification: 's',
              implementation: 'i',
              architecture: 'a',
              dependencies: 'd',
              adapters: 'ad',
              bindings: 'b',
              verificationSuites: 'v',
            },
            commandResults: [{ label: 'suite.perf', exitCode: 0, passed: true }],
            artifacts: [],
            diagnostics: [],
            startedAt: '2026-07-12T00:00:00.000Z',
            completedAt: '2026-07-12T00:00:00.000Z',
            outcome: 'passed',
          }
          for (const manifest of manifests) {
            calculateFreshness({
              moduleId: manifest.moduleId,
              moduleVersion: manifest.moduleVersion,
              specificationHash: 's',
              implementationHash: 'i',
              architectureHash: 'a',
              dependencyHash: 'd',
              adapterHash: 'ad',
              bindingHash: 'b',
              verificationSuiteHash: 'v',
              verification: { ...verification, moduleId: manifest.moduleId },
            })
          }
        }),
      )
    }

    const projectionP95 = percentile95(projectionSamples)
    const recomputeP95 = percentile95(recomputeSamples)
    const hardware = {
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      model: os.cpus()[0]?.model,
      totalMemGb: Math.round(os.totalmem() / (1024 ** 3)),
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        test: 'CAP-TEST-041',
        hardware,
        projectionP95Ms: projectionP95,
        recomputeP95Ms: recomputeP95,
        projectionSamplesMs: projectionSamples.map((n) => Number(n.toFixed(3))),
        recomputeSamplesMs: recomputeSamples.map((n) => Number(n.toFixed(3))),
      }),
    )

    expect(projectionP95).toBeLessThanOrEqual(PROJECTION_P95_MS)
    expect(recomputeP95).toBeLessThanOrEqual(RECOMPUTE_P95_MS)
  })

  it('keeps projection responsive during delayed jobs and honors cancellation', async () => {
    const { architecture, manifests } = buildPerfFixture()
    let job: JobRecord = {
      schemaVersion: '1.0',
      jobId: 'job-delayed-1',
      projectId: 'perf',
      operationId: 'op.perf.0',
      operationVersion: '1.0.0',
      inputHash: 'h',
      state: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      diagnostics: [],
      artifactRefs: [],
    }
    const started = transitionJob(job, 'running')
    expect(started.ok).toBe(true)
    if (!started.ok) return
    job = started.job

    // Delayed adapter job — navigation/projection must remain usable while running.
    const delay = new Promise<void>((resolve) => setTimeout(resolve, 40))
    const navDuringJob = measure(() => {
      const projection = projectArchitecture(architecture, manifests, {}, { mode: 'design' })
      expect(projection.nodes).toHaveLength(100)
    })
    await delay

    const cancelled = transitionJob({ ...job, cancellationRequested: true }, 'cancelled')
    expect(cancelled.ok).toBe(true)
    if (cancelled.ok) {
      expect(cancelled.job.state).toBe('cancelled')
      expect(cancelled.job.completedAt).toBeTruthy()
    }
    expect(navDuringJob).toBeLessThanOrEqual(PROJECTION_P95_MS)
  })
})
