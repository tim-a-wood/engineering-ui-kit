/**
 * §24.2/§24.5 product-scenario test helper (operations level).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §24.2 (the
 * 30 numbered product scenarios), §24.5 (evidence requirements), §19
 * (error/recovery), §14 (evidence model).
 *
 * Two responsibilities, kept in one file because the packet's owned paths
 * allow exactly two test files:
 *
 *  1. A §24.5 structured-evidence recorder. Every `it()` in
 *     `product-scenarios.test.ts` is wrapped in `withScenarioEvidence`,
 *     which — win or lose — writes one small JSON evidence file to
 *     `__evidence__/product-scenarios/<scenarioId>.json` recording scenario
 *     and step ids, expected/actual result, revisions, build, environment,
 *     test-data revision, outcome, and an immutable content hash (§24.5
 *     "immutable content hashes"). This is the "per-test recorder" the
 *     packet asks for: a wrapper around the test body rather than a global
 *     `afterEach`, so the evidence file is deterministic and does not
 *     depend on inspecting Vitest's internal task state.
 *
 *  2. Sample-workspace loaders. There is no existing "load the sample into
 *     a `DesignWorkspace`" helper anywhere in the core package (checked:
 *     `buildSampleAuditHub` is only ever read in-memory by
 *     `sample-audit-hub.test.ts`). `loadSampleFoundation` persists the
 *     approved use-case analysis, application, and architecture (17
 *     modules, no module designs yet) — used by the module-queue/early
 *     lifecycle scenarios (S04, S05-S11). `loadFullSample` additionally
 *     persists every approved module design and the approved Design
 *     baseline — used by the later scenarios that need a fully baselined
 *     project (S16-S23, S27, S30).
 *
 * This file imports only committed core modules (`designWorkspace.ts`,
 * `sampleAuditHub.ts`, `../../hash.js`); it never mocks a core module.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalHash } from '../../../src/capabilities/hash.js'
import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import type { SampleAuditHub } from '../../../src/capabilities/design/sampleAuditHub.js'

// ---------------------------------------------------------------------------
// 1) §24.5 structured evidence recorder
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EVIDENCE_DIR = path.join(HERE, '__evidence__', 'product-scenarios')

export type ScenarioEvidenceRevisions = {
  application?: string
  design?: string
  modules?: Record<string, string>
}

export type ScenarioEvidenceInput = {
  scenarioId: string
  stepIds: string[]
  expected: string
  actual: string
  outcome: 'passed' | 'failed'
  revisions?: ScenarioEvidenceRevisions
  testDataRevision?: string
}

export type ScenarioEvidenceRecord = {
  scenarioId: string
  stepIds: string[]
  expected: string
  actual: string
  revisions: { application: string; design: string; modules: Record<string, string> }
  build: 'core-vitest'
  environment: string
  testDataRevision: string
  outcome: 'passed' | 'failed'
  /** §24.5 "immutable content hashes" — hash of the evidence body above. */
  contentHash: string
  /** §14.2 "reason when a screenshot does not apply" — always applicable here: this suite runs at the operations level, with no rendered surface to screenshot. */
  notApplicableScreenshotReason: string
}

function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n')
}

/**
 * Writes `__evidence__/product-scenarios/<scenarioId>.json`. Overwriting
 * with byte-identical content is fine (the packet allows "overwrite-same
 * content"); a real content change would only occur if the scenario's
 * expected/actual behavior changed, which the test itself would already
 * have to change to produce.
 */
export function recordScenarioEvidence(input: ScenarioEvidenceInput): ScenarioEvidenceRecord {
  const body: Omit<ScenarioEvidenceRecord, 'contentHash'> = {
    scenarioId: input.scenarioId,
    stepIds: input.stepIds,
    expected: input.expected,
    actual: input.actual,
    revisions: {
      application: input.revisions?.application ?? 'n/a',
      design: input.revisions?.design ?? 'n/a',
      modules: input.revisions?.modules ?? {},
    },
    build: 'core-vitest',
    environment: `${process.platform}/node-${process.version}`,
    testDataRevision: input.testDataRevision ?? 'n/a',
    outcome: input.outcome,
    notApplicableScreenshotReason: 'operations-level scenario; no visual surface to capture',
  }
  const record: ScenarioEvidenceRecord = { ...body, contentHash: canonicalHash(body) }
  atomicWriteJson(path.join(EVIDENCE_DIR, `${input.scenarioId}.json`), record)
  return record
}

export type ScenarioEvidencePartial = {
  actual?: string
  revisions?: ScenarioEvidenceRevisions
  testDataRevision?: string
}

/**
 * Per-test evidence recorder. Wrap a scenario's assertions:
 * `it('S01 ...', withScenarioEvidence('S01', [...], 'expected...', () => {
 *   ...assertions...
 *   return { actual: 'what happened', revisions: {...} }
 * }))`. Writes evidence whether the test passes or throws (a thrown error's
 * message becomes `actual`), then rethrows so Vitest still reports the
 * failure.
 */
export function withScenarioEvidence(
  scenarioId: string,
  stepIds: string[],
  expected: string,
  testFn: () => ScenarioEvidencePartial | void | Promise<ScenarioEvidencePartial | void>,
): () => Promise<void> {
  return async () => {
    let outcome: ScenarioEvidenceInput['outcome'] = 'passed'
    let partial: ScenarioEvidencePartial = {}
    try {
      partial = (await testFn()) ?? {}
    } catch (error) {
      outcome = 'failed'
      partial = { actual: error instanceof Error ? error.message : String(error) }
      throw error
    } finally {
      recordScenarioEvidence({
        scenarioId,
        stepIds,
        expected,
        actual: partial.actual ?? `${scenarioId} completed as expected`,
        outcome,
        revisions: partial.revisions,
        testDataRevision: partial.testDataRevision,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// 2) Sample-workspace loaders (§22 default DO-178C Audit Hub sample)
// ---------------------------------------------------------------------------

/**
 * Persists the sample's approved use-case analysis, compiled application,
 * and approved 17-module architecture into `workspace` — nothing else. This
 * is enough for `listModuleDesigns` to show the 17-module queue (all
 * `notStarted`) and for module-design lifecycle operations (`startModuleDesign`,
 * `updateModuleDesignItem`, `approveModuleDesign`, `createModuleImplementationPacket`, ...)
 * to run against the real §22 module catalog.
 */
export function loadSampleFoundation(workspace: DesignWorkspace, sample: SampleAuditHub): void {
  workspace.saveUseCaseAnalysisDraft(sample.projectId, sample.useCaseAnalysis)
  workspace.approveUseCaseAnalysis(sample.projectId, sample.useCaseAnalysis)
  workspace.saveApplicationDraft(sample.projectId, sample.applicationSpecification)
  workspace.approveApplication(sample.projectId, sample.applicationSpecification)
  // Approve the architecture only. `saveArchitectureDraft` deliberately keeps
  // whatever was last saved as a *draft*-status record (§9.1 draft/approved
  // are separate stores) — a scenario that needs to edit the architecture
  // again (a system-design decision requires a `draft`-status record) saves
  // its own `{ ...sample.architecture, status: 'draft' }` clone locally.
  workspace.approveArchitecture(sample.projectId, sample.architecture)
}

/**
 * Everything `loadSampleFoundation` does, plus every one of the sample's 17
 * approved (r1) module designs and the approved Design baseline — the
 * project as it stands right after §22's baseline approval, before any of
 * the sample's later reopen/impact/split examples are applied. Used by
 * scenarios that need a fully baselined project (reopen, impact, split,
 * diagram regeneration, waves, multi-module handoff, verification runs).
 */
export function loadFullSample(workspace: DesignWorkspace, sample: SampleAuditHub): void {
  loadSampleFoundation(workspace, sample)
  for (const design of Object.values(sample.approvedModuleDesigns)) {
    workspace.saveModuleDesignDraft(sample.projectId, design.module.moduleId, design)
    workspace.approveModuleDesign(sample.projectId, design.module.moduleId, design)
  }
  workspace.saveDesignBaselineDraft(sample.projectId, sample.designBaseline)
  workspace.approveDesignBaseline(sample.projectId, sample.designBaseline)
}

export { DesignWorkspace }
