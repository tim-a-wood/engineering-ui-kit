/**
 * §21 performance and capacity — measurement harness.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §21 ("For
 * a medium project with 10 to 40 modules... the product shall measure
 * these targets on reference hardware. A failure to meet a target shall
 * create a visible performance issue. It shall not remove a required
 * control.").
 *
 * This is the repeatable measurement suite §21 requires, run over the real
 * §22 17-module sample (`buildSampleAuditHub()`). It measures, with
 * `performance.now()`, five §21 targets, N=5 runs each, comparing the
 * median to the target:
 *
 *  1. module-queue read-model computation (`computeModuleDesignProgress` +
 *     `filterModuleQueue`) vs 200ms;
 *  2. selection projection (`selectDefaultModule` + one
 *     `projectComponentDiagram` + `layoutDiagram`) vs 100ms;
 *  3. local design checks (`evaluateModuleDesignChecks` on the largest
 *     module) vs 500ms;
 *  4. impact analysis first result (`analyzeDesignChange` with
 *     `operationBehavior` on a well-connected module) vs 2000ms;
 *  5. diagram selection response (projection lookup +
 *     `accessibleDescription`) vs 100ms.
 *
 * A target miss is a "should", not a blocking control (§21 "It shall not
 * remove a required control"): this suite does not fail on a miss. Instead
 * it writes a visible performance-issue entry (`met: false`) into the
 * evidence file. The suite fails only if a metric cannot be measured at
 * all, or if the evidence file cannot be written/parsed.
 *
 * Evidence file: `__evidence__/perf/runs/<runId>/perf-measurement.json`,
 * one file per execution — reusing the run-stamped, collision-refusing
 * pattern from `product-scenario-evidence.ts` (read first; see its header
 * comment for the exact rationale: a run id derived only from
 * {build rev, suite name} can collide across two executions of the same
 * build and silently overwrite an earlier run's evidence).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildSampleAuditHub } from '../../../src/capabilities/design/sampleAuditHub.js'
import { computeModuleDesignProgress, evaluateModuleDesignChecks, filterModuleQueue, selectDefaultModule } from '../../../src/capabilities/design/moduleDesign.js'
import { projectComponentDiagram } from '../../../src/capabilities/design/diagramSemantics.js'
import { accessibleDescription, layoutDiagram } from '../../../src/capabilities/design/diagramLayout.js'
import { analyzeDesignChange } from '../../../src/capabilities/design/impactEngine.js'

// ---------------------------------------------------------------------------
// Run-stamped evidence directory (pattern reused from
// product-scenario-evidence.ts — see that file's header comment).
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SUITE_NAME = 'perf'
const EVIDENCE_BASE_DIR = path.join(HERE, '__evidence__', SUITE_NAME)

function detectBuildRev(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: HERE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

function compactUtcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function randomRunSuffix(): string {
  return `${process.pid.toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

const BUILD_REV = detectBuildRev()
const STARTED_AT = new Date()
const RUN_ID = `${BUILD_REV}-${compactUtcTimestamp(STARTED_AT)}-${randomRunSuffix()}`
const EVIDENCE_DIR = path.join(EVIDENCE_BASE_DIR, 'runs', RUN_ID)
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, 'perf-measurement.json')

function ensureFreshRunDir(): void {
  if (fs.existsSync(EVIDENCE_DIR) && fs.readdirSync(EVIDENCE_DIR).length > 0) {
    throw new Error(
      `refusing to write perf evidence: run directory already exists and is non-empty: "${EVIDENCE_DIR}" ` +
        '(this run id should be unique per execution — never delete or overwrite an existing run\'s evidence)',
    )
  }
}

/** Write-to-temp-then-rename so a reader never observes a half-written file. */
function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmpPath = path.join(path.dirname(filePath), `.tmp-${path.basename(filePath)}-${process.pid}-${Math.random().toString(36).slice(2)}`)
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmpPath, filePath)
}

// ---------------------------------------------------------------------------
// Measurement primitives
// ---------------------------------------------------------------------------

const RUNS_PER_METRIC = 5

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

type MetricRecord = {
  metric: string
  description: string
  targetMs: number
  runsMs: number[]
  medianMs: number
  met: boolean
}

/** Runs `fn` `RUNS_PER_METRIC` times, timing each with `performance.now()`. */
function measure(metric: string, description: string, targetMs: number, fn: () => void): MetricRecord {
  const runsMs: number[] = []
  for (let i = 0; i < RUNS_PER_METRIC; i += 1) {
    const start = performance.now()
    fn()
    runsMs.push(performance.now() - start)
  }
  const medianMs = median(runsMs)
  return { metric, description, targetMs, runsMs, medianMs, met: medianMs <= targetMs }
}

type PerfEvidence = {
  suite: 'design-perf-measurement'
  runId: string
  buildRev: string
  startedAt: string
  completedAt: string
  environment: { platform: string; release: string; nodeVersion: string; cpuCount: number }
  sample: { moduleCount: number }
  metrics: MetricRecord[]
  /** §21 "A failure to meet a target shall create a visible performance issue." */
  performanceIssues: { metric: string; description: string; targetMs: number; medianMs: number }[]
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('§21 performance measurement harness (medium-project targets, 17-module sample)', () => {
  it('measures all five §21 targets and writes a parseable, visible evidence record', () => {
    ensureFreshRunDir()

    const sample = buildSampleAuditHub()
    const architecture = sample.architecture
    const designs = sample.moduleDesigns
    expect(designs.length).toBe(17)

    // ---- 1) module-queue read-model computation (target 200ms) ----------
    const moduleQueueMetric = measure(
      'moduleQueueReadModel',
      'computeModuleDesignProgress + filterModuleQueue over the 17-module sample',
      200,
      () => {
        const progress = computeModuleDesignProgress(architecture, designs, sample.sessions)
        filterModuleQueue(progress, 'all')
      },
    )

    // Reused by both the selection-projection and diagram-selection metrics
    // below (computing the progress once outside the timed block for those
    // two, since the read-model computation is already measured above).
    const progress = computeModuleDesignProgress(architecture, designs, sample.sessions)
    const defaultModuleId = selectDefaultModule(progress) ?? designs[0]!.module.moduleId
    const defaultModuleDesign = designs.find((d) => d.module.moduleId === defaultModuleId) ?? designs[0]!

    // ---- 2) selection projection (target 100ms) --------------------------
    const selectionMetric = measure(
      'selectionProjection',
      'selectDefaultModule + one projectComponentDiagram + layoutDiagram',
      100,
      () => {
        const selectedId = selectDefaultModule(progress) ?? designs[0]!.module.moduleId
        const design = designs.find((d) => d.module.moduleId === selectedId) ?? designs[0]!
        const projection = projectComponentDiagram({ design, architecture, allDesigns: designs })
        layoutDiagram(projection, 'wide')
      },
    )

    // ---- 3) local design checks on the largest module (target 500ms) ----
    const largestModule = [...designs].sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0]!
    const localChecksMetric = measure(
      'localDesignChecks',
      `evaluateModuleDesignChecks on the largest sample module (${largestModule.module.moduleId})`,
      500,
      () => {
        evaluateModuleDesignChecks(largestModule, { architecture, otherDesigns: designs })
      },
    )

    // ---- 4) impact analysis first result on a well-connected module (target 2000ms) ----
    // mod.evidence-store's EvidenceStorePort is required by most of the
    // sample catalog (Import and Publish, Finding Review, Package Export,
    // Audit Workspace, ...) — the same well-connected operation product
    // scenarios (S17) use for operation-behavior impact analysis.
    const impactMetric = measure(
      'impactAnalysisFirstResult',
      'analyzeDesignChange (operationBehavior) on mod.evidence-store / EvidenceStorePort',
      2000,
      () => {
        analyzeDesignChange({
          projectId: sample.projectId,
          changeKind: 'operationBehavior',
          initiatingRecordId: sample.approvedModuleDesigns['mod.evidence-store']!.id,
          initiatingRevision: sample.approvedModuleDesigns['mod.evidence-store']!.revision,
          description: 'perf-measurement probe: EvidenceStorePort behavior change',
          target: { operationId: 'EvidenceStorePort', moduleId: 'mod.evidence-store' },
          world: { architecture, moduleDesigns: Object.values(sample.approvedModuleDesigns) },
        })
      },
    )

    // ---- 5) diagram selection response (target 100ms) --------------------
    const diagramById = new Map(sample.diagrams.map((d) => [d.diagramId, d]))
    const selectedDiagramId = sample.diagramLayoutExample.diagramId
    const diagramSelectionMetric = measure('diagramSelectionResponse', 'projection lookup + accessibleDescription', 100, () => {
      const projection = diagramById.get(selectedDiagramId)
      if (!projection) throw new Error(`perf-measurement probe: no projection found for diagram ${selectedDiagramId}`)
      accessibleDescription(sample.diagramLayoutExample, projection)
    })

    const metrics = [moduleQueueMetric, selectionMetric, localChecksMetric, impactMetric, diagramSelectionMetric]
    expect(metrics).toHaveLength(5)
    expect(new Set(metrics.map((m) => m.metric)).size).toBe(5)

    const performanceIssues = metrics
      .filter((m) => !m.met)
      .map((m) => ({ metric: m.metric, description: m.description, targetMs: m.targetMs, medianMs: m.medianMs }))

    const completedAt = new Date().toISOString()
    const evidence: PerfEvidence = {
      suite: 'design-perf-measurement',
      runId: RUN_ID,
      buildRev: BUILD_REV,
      startedAt: STARTED_AT.toISOString(),
      completedAt,
      environment: { platform: os.platform(), release: os.release(), nodeVersion: process.version, cpuCount: os.cpus().length },
      sample: { moduleCount: designs.length },
      metrics,
      performanceIssues,
    }

    atomicWriteJson(EVIDENCE_FILE, evidence)

    // §21 "the product shall measure these targets on reference hardware" —
    // assert the evidence file was actually written and is parseable, and
    // that every one of the five targets was measured. A target miss does
    // not fail this suite (§21 "should"; "It shall not remove a required
    // control") — it is instead a visible entry in `performanceIssues`.
    expect(fs.existsSync(EVIDENCE_FILE)).toBe(true)
    const parsed = JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8')) as PerfEvidence
    expect(parsed.metrics).toHaveLength(5)
    expect(parsed.metrics.map((m) => m.metric).sort()).toEqual(
      ['diagramSelectionResponse', 'impactAnalysisFirstResult', 'localDesignChecks', 'moduleQueueReadModel', 'selectionProjection'].sort(),
    )
    for (const m of parsed.metrics) {
      expect(typeof m.medianMs).toBe('number')
      expect(m.runsMs).toHaveLength(RUNS_PER_METRIC)
      expect(typeof m.met).toBe('boolean')
    }
    expect(parsed.environment.nodeVersion).toBe(process.version)
    expect(Array.isArray(parsed.performanceIssues)).toBe(true)

    // Visible-issue reporting, not a hard failure: log any miss so a human
    // reviewing test output sees it without digging into the evidence file.
    if (performanceIssues.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[§21 performance issue] ${performanceIssues.length} target(s) missed on this run — see ${EVIDENCE_FILE}:\n` +
          performanceIssues.map((i) => `  - ${i.metric}: median ${i.medianMs.toFixed(2)}ms > target ${i.targetMs}ms`).join('\n'),
      )
    }
  })
})
