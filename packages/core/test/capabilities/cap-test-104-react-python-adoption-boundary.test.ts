/**
 * CAP-TEST-104 — react-python adoption: generated HTTP boundary preservation
 * and incremental minimal-diff regeneration (CAP-ERA-001 §14.3, §13, WP9B).
 *
 * The `react-python` fixture mixes a TypeScript/React frontend and a
 * Python/FastAPI backend joined by a legacy `runtime.js` module. Adopting it
 * additively must never collapse the two deployables' generated output into
 * one namespace: the browser (TypeScript) deployable's generated files and
 * the http-api (Python) deployable's generated files must land in their own,
 * non-overlapping generated directories, and the original `frontend/**`,
 * `backend/**`, and `legacy/**` trees must remain byte-identical throughout.
 *
 * A second concern: re-assembling with unchanged inputs after an initial
 * apply must be a no-op (empty plan) — CAP-ERA-001 §13 impact-scoped
 * regeneration (CAP-TEST-088) applied here across two independently adopted
 * deployables sharing one target repository. Changing ONE deployable's own
 * binding must regenerate only that deployable's own file, leaving the other
 * deployable's generated files, and every original repository file,
 * byte-unchanged.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { assembleGenerationPlan, type AssembleGenerationPlanInput } from '../../src/capabilities/generationAssembly.js'
import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import { proposeDeployables } from '../../src/capabilities/generation/deployables.js'
import {
  planExistingRepoMigration,
  type ExistingRepoCapabilityRecord,
} from '../../src/capabilities/generation/existingRepoMigration.js'
import { discoverRepository } from '../../src/capabilities/generation/repositoryDiscovery.js'
import type { DeployableSpecification } from '../../src/capabilities/types.js'
import { loadExistingRepoEvidence } from './generation/existingRepoFixtureLoader.js'
import {
  buildAdoptionOperation,
  buildAdoptionSchemas,
  buildHttpBinding,
  buildUiBinding,
  copyFixtureTree,
  EXISTING_REPO_FIXTURES_ROOT,
  hashFilesUnder,
  listRepoFiles,
} from './generation/existingRepoAdoptionFixtures.js'

let tempRoots: string[] = []
function tempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-104-react-python-'))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true })
  tempRoots = []
})

const PROJECT_ID = 'proj-cap-test-104'
const FIXTURE_ROOT = path.join(EXISTING_REPO_FIXTURES_ROOT, 'react-python')

const CAPABILITY_RECORDS: ExistingRepoCapabilityRecord[] = [
  {
    recordId: 'rec.dashboard-ui',
    moduleId: 'mod.experience.dashboard',
    name: 'Dashboard',
    moduleType: 'experience',
    responsibility: 'renders the existing dashboard UI',
    providedOperations: [],
  },
  {
    recordId: 'rec.dashboard-api',
    moduleId: 'mod.domain.dashboardApi',
    name: 'Dashboard API',
    moduleType: 'domain',
    responsibility: 'serves dashboard data over HTTP',
    providedOperations: [{ operationId: 'op.dashboard.get', contractVersion: '1.0' }],
  },
]

function proposeBothDeployables(tempRoot: string) {
  const evidence = loadExistingRepoEvidence(tempRoot, 'repo.react-python')
  const discovery = discoverRepository(evidence)
  const deployableResult = proposeDeployables({
    architectureModuleIds: CAPABILITY_RECORDS.map((record) => record.moduleId),
    architectureModuleDefinitions: CAPABILITY_RECORDS.map((record) => ({
      moduleId: record.moduleId,
      name: record.name,
      moduleType: record.moduleType,
      responsibility: record.responsibility,
    })),
    discovery,
  })
  const browser = deployableResult.deployables.find((d) => d.kind === 'browser')
  const httpApi = deployableResult.deployables.find((d) => d.kind === 'http-api')
  expect(browser).toBeDefined()
  expect(httpApi).toBeDefined()
  return { evidence, browser: browser as DeployableSpecification, httpApi: httpApi as DeployableSpecification }
}

function assembleAndApply(input: AssembleGenerationPlanInput) {
  const { plan, virtualFiles } = assembleGenerationPlan(input)
  const result = applyGenerationPlan({ plan, targetRoot: input.targetRoot, virtualFiles, runId: input.runId })
  return { plan, virtualFiles, result }
}

describe('CAP-TEST-104 react-python: generated HTTP boundary preservation', () => {
  it('does not collapse the browser/http-api generated boundary; frontend, backend, and legacy dirs are preserved', () => {
    const tempRoot = tempRepo()
    copyFixtureTree(FIXTURE_ROOT, tempRoot)

    const pristineFiles = listRepoFiles(FIXTURE_ROOT).sort()
    const preApplyHashes = hashFilesUnder(tempRoot, pristineFiles)

    // Review-level plan: the generated composition roots are proposed in their
    // own language's source root, never collapsed onto the other's (WP9A,
    // reaffirmed here at the real-apply level).
    const evidenceForReview = loadExistingRepoEvidence(tempRoot, 'repo.react-python')
    const migrationPlan = planExistingRepoMigration({
      migrationPlanId: 'mig-cap-test-104-0001',
      projectId: PROJECT_ID,
      evidence: evidenceForReview,
      capabilityRecords: CAPABILITY_RECORDS,
      versions: { fromWorkspaceVersion: '1.0', toWorkspaceVersion: '2.0' },
    })
    const created = migrationPlan.fileTransformations.filter((change) => change.action === 'create')
    const browserPlanFile = created.find((change) => change.path.includes('browser'))
    const httpApiPlanFile = created.find((change) => change.path.includes('http-api'))
    expect(browserPlanFile?.path.startsWith('frontend/')).toBe(true)
    expect(httpApiPlanFile?.path.startsWith('backend/')).toBe(true)
    // legacy/runtime.js is never proposed for direct mutation; a compatibility shim covers it instead.
    expect(migrationPlan.fileTransformations.some((change) => change.path === 'legacy/runtime.js')).toBe(false)
    expect(migrationPlan.compatibilityShims.some((shim) => shim.includes('legacy/runtime.js'))).toBe(true)

    // Real generation + apply for BOTH deployables against the same target repository.
    const { browser, httpApi } = proposeBothDeployables(tempRoot)

    const browserInput: AssembleGenerationPlanInput = {
      deployable: browser,
      inboundBindings: [buildUiBinding(browser.deployableId, PROJECT_ID)],
      schemas: buildAdoptionSchemas(),
      operations: [buildAdoptionOperation()],
      targetRoot: tempRoot,
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      planId: 'plan-cap-test-104-browser',
      runId: 'run-cap-test-104-browser',
    }
    const httpApiInput: AssembleGenerationPlanInput = {
      deployable: httpApi,
      inboundBindings: [buildHttpBinding(httpApi.deployableId, PROJECT_ID)],
      schemas: buildAdoptionSchemas(),
      operations: [buildAdoptionOperation()],
      targetRoot: tempRoot,
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      planId: 'plan-cap-test-104-http-api',
      runId: 'run-cap-test-104-http-api',
    }

    const browserApply = assembleAndApply(browserInput)
    const httpApiApply = assembleAndApply(httpApiInput)

    expect(browserApply.plan.fileChanges.every((change) => change.action === 'create')).toBe(true)
    expect(httpApiApply.plan.fileChanges.every((change) => change.action === 'create')).toBe(true)

    const browserPaths = browserApply.plan.fileChanges.map((change) => change.path).sort()
    const httpApiPaths = httpApiApply.plan.fileChanges.map((change) => change.path).sort()

    // Each deployable's generated output lives in its own namespace; the seam is never collapsed.
    for (const p of browserPaths) expect(p.startsWith(`src/generated/${browser.deployableId}/`)).toBe(true)
    for (const p of httpApiPaths) expect(p.startsWith(`src/generated/${httpApi.deployableId}/`)).toBe(true)
    expect(browserPaths.some((p) => httpApiPaths.includes(p))).toBe(false)

    // Every original fixture file (frontend/**, backend/**, legacy/**, root manifests) is byte-unchanged.
    expect(hashFilesUnder(tempRoot, pristineFiles)).toEqual(preApplyHashes)

    // Both original language directories, and the legacy runtime module, remain present untouched.
    const afterApplyFiles = listRepoFiles(tempRoot)
    expect(afterApplyFiles.some((p) => p.startsWith('frontend/'))).toBe(true)
    expect(afterApplyFiles.some((p) => p.startsWith('backend/'))).toBe(true)
    expect(afterApplyFiles).toContain('legacy/runtime.js')
  })
})

describe('CAP-TEST-104 react-python: incremental re-plan yields a minimal diff', () => {
  it('re-assembling unchanged inputs after apply is a no-op; changing one deployable\'s binding only regenerates that file', () => {
    const tempRoot = tempRepo()
    copyFixtureTree(FIXTURE_ROOT, tempRoot)
    const pristineFiles = listRepoFiles(FIXTURE_ROOT).sort()

    const { browser, httpApi } = proposeBothDeployables(tempRoot)

    function browserInput(runId: string): AssembleGenerationPlanInput {
      return {
        deployable: browser,
        inboundBindings: [buildUiBinding(browser.deployableId, PROJECT_ID)],
        schemas: buildAdoptionSchemas(),
        operations: [buildAdoptionOperation()],
        targetRoot: tempRoot,
        generatorVersion: '0.1.0',
        referenceProfileVersion: '1.0.0',
        planId: `plan-cap-test-104-browser-${runId}`,
        runId,
      }
    }
    function httpApiInput(runId: string, httpPath = '/adoption/run'): AssembleGenerationPlanInput {
      return {
        deployable: httpApi,
        inboundBindings: [buildHttpBinding(httpApi.deployableId, PROJECT_ID, { path: httpPath })],
        schemas: buildAdoptionSchemas(),
        operations: [buildAdoptionOperation()],
        targetRoot: tempRoot,
        generatorVersion: '0.1.0',
        referenceProfileVersion: '1.0.0',
        planId: `plan-cap-test-104-http-api-${runId}`,
        runId,
      }
    }

    // Initial generate -> apply for both deployables.
    assembleAndApply(browserInput('run-initial-browser'))
    assembleAndApply(httpApiInput('run-initial-http-api'))

    const browserGeneratedPaths = [
      `src/generated/${browser.deployableId}/types.g.ts`,
      `src/generated/${browser.deployableId}/operations.g.ts`,
      `src/generated/${browser.deployableId}/resolved.g.ts`,
      `src/generated/${browser.deployableId}/inbound/binding.adoption.run.ui.g.ts`,
    ]
    const beforeBrowserContents = hashFilesUnder(tempRoot, browserGeneratedPaths)

    // Re-assembling with wholly unchanged inputs is a no-op (fully converged, CAP-TEST-088 pattern).
    const reconvergedBrowser = assembleGenerationPlan(browserInput('run-reconverged-browser'))
    expect(reconvergedBrowser.plan.fileChanges).toEqual([])
    expect(reconvergedBrowser.virtualFiles).toEqual([])
    const reconvergedHttpApi = assembleGenerationPlan(httpApiInput('run-reconverged-http-api'))
    expect(reconvergedHttpApi.plan.fileChanges).toEqual([])
    expect(reconvergedHttpApi.virtualFiles).toEqual([])

    // Changing ONLY the http-api binding's own field regenerates ONLY that binding's own file.
    const changedHttpApi = assembleGenerationPlan(httpApiInput('run-changed-http-api', '/adoption/run/v2'))
    expect(changedHttpApi.plan.fileChanges.map((c) => c.path)).toEqual([
      `src/generated/${httpApi.deployableId}/inbound/binding.adoption.run.http.g.py`,
    ])
    expect(changedHttpApi.plan.fileChanges[0]!.action).toBe('update')
    applyGenerationPlan({
      plan: changedHttpApi.plan,
      targetRoot: tempRoot,
      virtualFiles: changedHttpApi.virtualFiles,
      runId: 'run-changed-http-api',
    })

    // The browser deployable's generated files, and every original repository file, are untouched.
    expect(hashFilesUnder(tempRoot, browserGeneratedPaths)).toEqual(beforeBrowserContents)
    expect(hashFilesUnder(tempRoot, pristineFiles)).toEqual(hashFilesUnder(FIXTURE_ROOT, pristineFiles))
  })
})
