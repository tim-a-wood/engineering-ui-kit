/**
 * CAP-TEST-049 — Windows (`\\`) and POSIX (`/`) path inputs yield identical
 * canonical repository-relative output.
 */
import { describe, expect, it } from 'vitest'
import { normalizeRepoRelativePath, toPosixPath } from '../../../src/capabilities/generation/paths.js'
import { discoverRepository, type RepositoryEvidence } from '../../../src/capabilities/generation/repositoryDiscovery.js'
import { proposeDeployables } from '../../../src/capabilities/generation/deployables.js'
import { buildGenerationPlan, type GenerationPlanInput } from '../../../src/capabilities/generation/plan.js'
import { EXISTING_REPO_MODULE_DEFINITIONS, EXISTING_REPO_MODULE_IDS } from './fixtures.js'

describe('CAP-TEST-049 canonical POSIX path output regardless of host separator', () => {
  it('normalizes Windows-style separators to POSIX', () => {
    expect(toPosixPath('src\\composition\\api.ts')).toBe('src/composition/api.ts')
    expect(normalizeRepoRelativePath('.\\src\\index.ts')).toBe('src/index.ts')
    expect(normalizeRepoRelativePath('src/index.ts')).toBe('src/index.ts')
    expect(normalizeRepoRelativePath('src\\composition\\')).toBe('src/composition')
  })

  it('repository discovery is identical for Windows-separated and POSIX-separated evidence', () => {
    const posixEvidence: RepositoryEvidence = {
      repositoryId: 'repo.paths',
      files: [
        { path: 'src/index.ts' },
        { path: 'src/composition/existing.ts' },
        { path: 'test/app.test.ts' },
      ],
      manifests: [{ path: 'package.json', content: { dependencies: { react: '19.0.0' } } }],
    }
    const windowsEvidence: RepositoryEvidence = {
      repositoryId: 'repo.paths',
      files: [
        { path: 'src\\index.ts' },
        { path: 'src\\composition\\existing.ts' },
        { path: 'test\\app.test.ts' },
      ],
      manifests: [{ path: 'package.json', content: { dependencies: { react: '19.0.0' } } }],
    }
    const posixResult = discoverRepository(posixEvidence)
    const windowsResult = discoverRepository(windowsEvidence)
    expect(JSON.stringify(windowsResult)).toBe(JSON.stringify(posixResult))
    expect(posixResult.sourceRoots).toContain('src')
    expect(posixResult.existingCompositionPaths).toEqual(['src/composition/existing.ts'])
  })

  it('deployable proposals use canonical POSIX composition paths for approved Windows-style locations', () => {
    const discovery = discoverRepository({
      repositoryId: 'repo.paths',
      files: [{ path: 'src/index.ts' }],
      manifests: [{ path: 'package.json', content: { dependencies: { react: '19.0.0' } } }],
    })
    const result = proposeDeployables({
      architectureModuleIds: EXISTING_REPO_MODULE_IDS,
      architectureModuleDefinitions: EXISTING_REPO_MODULE_DEFINITIONS,
      discovery,
      approvedLocations: [{ deployableId: 'browser', path: 'apps\\gui\\src\\composition\\browser.ts' }],
    })
    const browser = result.deployables.find((d) => d.deployableId === 'browser')
    expect(browser?.compositionRootPath).toBe('apps/gui/src/composition/browser.ts')
    expect(browser?.proposedLocations[0]?.path).toBe('apps/gui/src/composition/browser.ts')
  })

  it('a GenerationPlan normalizes file-change and target-repository paths to POSIX', () => {
    const input: GenerationPlanInput = {
      planId: 'plan-0001',
      projectId: 'proj-1',
      inputRecords: [],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: 'C:\\repo\\', cleanState: 'clean' },
      dependencyChanges: [],
      fileChanges: [
        { path: 'src\\composition\\api.ts', action: 'create', ownership: 'generated', reason: 'composition root' },
      ],
      commands: [],
      rollbackStrategy: 'staged-rename-with-journal',
    }
    const plan = buildGenerationPlan(input)
    expect(plan.targetRepository.root).toBe('C:/repo')
    expect(plan.fileChanges[0]?.path).toBe('src/composition/api.ts')
  })
})
