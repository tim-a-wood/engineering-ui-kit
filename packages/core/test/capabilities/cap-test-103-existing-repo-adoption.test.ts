/**
 * CAP-TEST-103 — additive existing-repository adoption via the real
 * transactional apply (CAP-ERA-001 §14.3, §11.3, WP9B).
 *
 * For the `react-ts` and `python` existing-repo fixtures: copy the fixture
 * tree to a fresh temp directory, discover its conventions, derive a minimal
 * deployable + inbound binding, `assembleGenerationPlan` against the temp
 * copy, and run the frozen `applyGenerationPlan`. Proves:
 *
 * 1. generated foundation files are ADDED under a generated directory
 *    (`src/generated/<deployableId>/**`), never colliding with an existing
 *    fixture path;
 * 2. every ORIGINAL fixture file is byte-identical (sha256) before and after
 *    apply — nothing pre-existing is overwritten;
 * 3. the plan is purely additive: every `fileChange` is a fresh `create`
 *    (never `update`/`delete`), and the WP9A review-level
 *    `CapabilityMigrationPlan`'s `dataLossAssessment.hasLoss` is `false` with
 *    no `delete` file transformations;
 * 4. `rollbackGenerationApply` removes exactly the generated files and
 *    restores the tree to be byte-identical to the pristine (never-copied)
 *    fixture.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { assembleGenerationPlan, type AssembleGenerationPlanInput } from '../../src/capabilities/generationAssembly.js'
import { applyGenerationPlan, rollbackGenerationApply } from '../../src/capabilities/generationApply.js'
import { proposeDeployables } from '../../src/capabilities/generation/deployables.js'
import {
  planExistingRepoMigration,
  type ExistingRepoCapabilityRecord,
} from '../../src/capabilities/generation/existingRepoMigration.js'
import { discoverRepository } from '../../src/capabilities/generation/repositoryDiscovery.js'
import type { InboundBinding } from '../../src/capabilities/types.js'
import { loadExistingRepoEvidence } from './generation/existingRepoFixtureLoader.js'
import {
  buildAdoptionOperation,
  buildAdoptionSchemas,
  buildEmbeddedLibraryBinding,
  buildUiBinding,
  copyFixtureTree,
  EXISTING_REPO_FIXTURES_ROOT,
  hashFilesUnder,
  listRepoFiles,
} from './generation/existingRepoAdoptionFixtures.js'

let tempRoots: string[] = []
function tempRepo(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true })
  tempRoots = []
})

type Scenario = {
  fixtureName: string
  repositoryId: string
  projectId: string
  capabilityRecord: ExistingRepoCapabilityRecord
  buildBinding: (deployableId: string, projectId: string) => InboundBinding
}

function runAdditiveAdoptionScenario(scenario: Scenario): void {
  const fixtureRoot = path.join(EXISTING_REPO_FIXTURES_ROOT, scenario.fixtureName)
  const tempRoot = tempRepo(`cap-test-103-${scenario.fixtureName}-`)
  copyFixtureTree(fixtureRoot, tempRoot)

  const pristineFiles = listRepoFiles(fixtureRoot).sort()
  expect(listRepoFiles(tempRoot).sort()).toEqual(pristineFiles)
  const preApplyHashes = hashFilesUnder(tempRoot, pristineFiles)

  // WP9A review-level plan: additive, no destructive delete/overwrite, no data loss.
  const evidence = loadExistingRepoEvidence(tempRoot, scenario.repositoryId)
  const migrationPlan = planExistingRepoMigration({
    migrationPlanId: `mig-${scenario.fixtureName}-0001`,
    projectId: scenario.projectId,
    evidence,
    capabilityRecords: [scenario.capabilityRecord],
    versions: { fromWorkspaceVersion: '1.0', toWorkspaceVersion: '2.0' },
  })
  expect(migrationPlan.dataLossAssessment.hasLoss).toBe(false)
  expect(migrationPlan.fileTransformations.some((change) => change.action === 'delete')).toBe(false)

  // Real generation + transactional apply.
  const discovery = discoverRepository(evidence)
  const deployableResult = proposeDeployables({
    architectureModuleIds: [scenario.capabilityRecord.moduleId],
    architectureModuleDefinitions: [
      {
        moduleId: scenario.capabilityRecord.moduleId,
        name: scenario.capabilityRecord.name,
        moduleType: scenario.capabilityRecord.moduleType,
        responsibility: scenario.capabilityRecord.responsibility,
      },
    ],
    discovery,
  })
  expect(deployableResult.deployables.length).toBeGreaterThan(0)
  const deployable = deployableResult.deployables[0]!
  const binding = scenario.buildBinding(deployable.deployableId, scenario.projectId)

  const runId = `run-${scenario.fixtureName}-adopt`
  const assembleInput: AssembleGenerationPlanInput = {
    deployable,
    inboundBindings: [binding],
    schemas: buildAdoptionSchemas(),
    operations: [buildAdoptionOperation()],
    targetRoot: tempRoot,
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    planId: `plan-${scenario.fixtureName}-adopt`,
    runId,
  }

  const { plan, virtualFiles } = assembleGenerationPlan(assembleInput)

  // Additive: every generated file change is a fresh `create`, never an overwrite.
  expect(plan.fileChanges.length).toBeGreaterThan(0)
  expect(plan.fileChanges.every((change) => change.action === 'create')).toBe(true)
  expect(plan.fileChanges.every((change) => change.ownership === 'generated')).toBe(true)

  const generatedPaths = plan.fileChanges.map((change) => change.path).sort()
  const generatedDeployableId = deployable.runtimeLanguage === 'python'
    ? deployable.deployableId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()
    : deployable.deployableId
  for (const generatedPath of generatedPaths) {
    expect(generatedPath.startsWith(`src/generated/${generatedDeployableId}/`)).toBe(true)
    expect(pristineFiles).not.toContain(generatedPath)
  }

  const applyResult = applyGenerationPlan({ plan, targetRoot: tempRoot, virtualFiles, runId })
  expect(applyResult.appliedFiles.map((f) => f.path).sort()).toEqual(generatedPaths)
  expect(applyResult.appliedFiles.every((f) => f.action === 'create')).toBe(true)

  // Every ORIGINAL fixture file is byte-identical (sha256) after apply.
  expect(hashFilesUnder(tempRoot, pristineFiles)).toEqual(preApplyHashes)

  // The tree now contains exactly the original files plus the newly generated files.
  expect(listRepoFiles(tempRoot).sort()).toEqual([...pristineFiles, ...generatedPaths].sort())

  // Rollback restores the exact pre-apply state.
  const rollbackResult = rollbackGenerationApply(tempRoot, runId)
  expect(rollbackResult.restoredFiles.map((f) => f.path).sort()).toEqual(generatedPaths)
  expect(rollbackResult.restoredFiles.every((f) => f.action === 'removed')).toBe(true)

  expect(listRepoFiles(tempRoot).sort()).toEqual(pristineFiles)
  expect(hashFilesUnder(tempRoot, pristineFiles)).toEqual(preApplyHashes)

  // The pristine, never-copied fixture on disk is untouched throughout.
  expect(listRepoFiles(fixtureRoot).sort()).toEqual(pristineFiles)
}

describe('CAP-TEST-103 additive existing-repository adoption (real transactional apply)', () => {
  it('react-ts: adopts additively; every original file is byte-unchanged; rollback restores the pristine tree', () => {
    runAdditiveAdoptionScenario({
      fixtureName: 'react-ts',
      repositoryId: 'repo.react-ts',
      projectId: 'proj-cap-test-103-react-ts',
      capabilityRecord: {
        recordId: 'rec.dashboard',
        moduleId: 'mod.experience.dashboard',
        name: 'Dashboard',
        moduleType: 'experience',
        responsibility: 'renders the existing dashboard UI',
        providedOperations: [],
      },
      buildBinding: buildUiBinding,
    })
  })

  it('python: adopts additively; every original file is byte-unchanged; rollback restores the pristine tree', () => {
    runAdditiveAdoptionScenario({
      fixtureName: 'python',
      repositoryId: 'repo.python',
      projectId: 'proj-cap-test-103-python',
      capabilityRecord: {
        recordId: 'rec.widgets',
        moduleId: 'mod.domain.widgets',
        name: 'Widgets',
        moduleType: 'domain',
        responsibility: 'widget domain logic',
        providedOperations: [{ operationId: 'op.widgets.build', contractVersion: '1.0' }],
      },
      buildBinding: buildEmbeddedLibraryBinding,
    })
  })
})
