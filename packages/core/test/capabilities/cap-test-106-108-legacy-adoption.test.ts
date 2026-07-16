/**
 * CAP-TEST-106..108 — finish the WP9 legacy-adoption gate:
 * - a real legacy runtime remains invocable before and after additive apply;
 * - only evidence-backed material ambiguity becomes a user question;
 * - compatibility cannot retire until contracts, composition, and a real
 *   connection have all reached conformance.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { assembleGenerationPlan } from '../../src/capabilities/generationAssembly.js'
import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import { proposeDeployables } from '../../src/capabilities/generation/deployables.js'
import {
  evaluateLegacyRuntimeCompatibility,
  planExistingRepoMigration,
  type ExistingRepoCapabilityRecord,
} from '../../src/capabilities/generation/existingRepoMigration.js'
import {
  discoverRepository,
  type RepositoryEvidence,
} from '../../src/capabilities/generation/repositoryDiscovery.js'
import { invokeLocalRuntime } from '../../src/capabilities/localRuntimeHost.js'
import type { DeployableSpecification } from '../../src/capabilities/types.js'
import {
  buildAdoptionOperation,
  buildAdoptionSchemas,
  buildHttpBinding,
  copyFixtureTree,
  EXISTING_REPO_FIXTURES_ROOT,
  hashFilesUnder,
} from './generation/existingRepoAdoptionFixtures.js'
import { loadExistingRepoEvidence } from './generation/existingRepoFixtureLoader.js'

const FIXTURE_ROOT = path.join(EXISTING_REPO_FIXTURES_ROOT, 'react-python')
const PROJECT_ID = 'proj-cap-test-106'
const CAPABILITY_RECORDS: ExistingRepoCapabilityRecord[] = [
  {
    recordId: 'rec.dashboard-api',
    moduleId: 'mod.domain.dashboardApi',
    name: 'Dashboard API',
    moduleType: 'domain',
    responsibility: 'serves dashboard data over HTTP',
    providedOperations: [{ operationId: 'op.dashboard.get', contractVersion: '1.0' }],
  },
]

let tempRoots: string[] = []

function tempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-106-legacy-'))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true })
  tempRoots = []
})

async function startDashboardServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ aircraft: 12, status: 'ready' }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('test server did not bind a TCP port')
  return {
    url: `http://127.0.0.1:${address.port}/api/dashboard`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}

async function invokeLegacyDashboard(repoRoot: string, dashboardUrl: string): Promise<unknown> {
  return invokeLocalRuntime({
    repoRoot,
    moduleId: 'legacy.dashboard',
    ownedPaths: ['legacy/runtime.js'],
    operationId: 'legacy.dashboard.refresh',
    args: { dashboardUrl },
  })
}

describe('CAP-TEST-106 legacy runtime continuity through adoption', () => {
  it('invokes the actual runtime.js over HTTP before and after additive generate/apply without changing it', async () => {
    const root = tempRepo()
    copyFixtureTree(FIXTURE_ROOT, root)
    const server = await startDashboardServer()
    try {
      const legacyPath = 'legacy/runtime.js'
      const originalHash = hashFilesUnder(root, [legacyPath])
      await expect(invokeLegacyDashboard(root, server.url)).resolves.toEqual({ aircraft: 12, status: 'ready' })

      const evidence = loadExistingRepoEvidence(root, 'repo.react-python.legacy-e2e')
      const discovery = discoverRepository(evidence)
      const proposed = proposeDeployables({
        architectureModuleIds: CAPABILITY_RECORDS.map((record) => record.moduleId),
        architectureModuleDefinitions: CAPABILITY_RECORDS.map((record) => ({
          moduleId: record.moduleId,
          name: record.name,
          moduleType: record.moduleType,
          responsibility: record.responsibility,
        })),
        discovery,
      })
      const deployable = proposed.deployables.find((candidate) => candidate.kind === 'http-api') as
        | DeployableSpecification
        | undefined
      expect(deployable).toBeDefined()

      const assembled = assembleGenerationPlan({
        deployable: deployable!,
        inboundBindings: [buildHttpBinding(deployable!.deployableId, PROJECT_ID)],
        schemas: buildAdoptionSchemas(),
        operations: [buildAdoptionOperation()],
        targetRoot: root,
        generatorVersion: '0.1.0',
        referenceProfileVersion: '1.0.0',
        planId: 'plan-cap-test-106',
        runId: 'run-cap-test-106',
      })
      applyGenerationPlan({
        plan: assembled.plan,
        targetRoot: root,
        virtualFiles: assembled.virtualFiles,
        runId: 'run-cap-test-106',
      })

      expect(hashFilesUnder(root, [legacyPath])).toEqual(originalHash)
      await expect(invokeLegacyDashboard(root, server.url)).resolves.toEqual({ aircraft: 12, status: 'ready' })
    } finally {
      await server.close()
    }
  })
})

describe('CAP-TEST-107 material-ambiguity boundary', () => {
  it('asks only about concrete conflicting evidence and asks nothing for the unambiguous fixture', () => {
    const clearEvidence = loadExistingRepoEvidence(FIXTURE_ROOT, 'repo.react-python.clear')
    const clearPlan = planExistingRepoMigration({
      migrationPlanId: 'mig-cap-test-107-clear',
      projectId: PROJECT_ID,
      evidence: clearEvidence,
      capabilityRecords: CAPABILITY_RECORDS,
      versions: { fromWorkspaceVersion: '1.0', toWorkspaceVersion: '2.0' },
    })
    expect(clearPlan.blockedAmbiguities).toEqual([])

    const conflictingEvidence: RepositoryEvidence = {
      repositoryId: 'repo.conflicting-evidence',
      files: [
        { path: 'package-lock.json' },
        { path: 'yarn.lock' },
        { path: 'alpha/index.ts' },
        { path: 'beta/index.ts' },
      ],
    }
    const conflictingPlan = planExistingRepoMigration({
      migrationPlanId: 'mig-cap-test-107-conflicting',
      projectId: PROJECT_ID,
      evidence: conflictingEvidence,
      capabilityRecords: CAPABILITY_RECORDS,
      versions: { fromWorkspaceVersion: '1.0', toWorkspaceVersion: '2.0' },
    })
    expect(conflictingPlan.blockedAmbiguities.map((ambiguity) => ambiguity.id)).toEqual([
      'package-manager',
      'source-root',
    ])
  })
})

describe('CAP-TEST-108 compatibility retirement gate', () => {
  it('retains compatibility until every conformance proof exists, then retires it', () => {
    expect(evaluateLegacyRuntimeCompatibility({
      generatedContractsImplemented: true,
      compositionRootRegistered: true,
      realConnectionVerified: false,
    })).toEqual({ status: 'retain', missingEvidence: ['real-connection-verified'] })

    expect(evaluateLegacyRuntimeCompatibility({
      generatedContractsImplemented: true,
      compositionRootRegistered: true,
      realConnectionVerified: true,
    })).toEqual({ status: 'retire', missingEvidence: [] })
  })
})
