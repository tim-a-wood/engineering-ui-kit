/**
 * CAP-TEST-050 — a greenfield evidence fixture and an existing-repo evidence
 * fixture each get sensible, evidence-backed proposals.
 */
import { describe, expect, it } from 'vitest'
import { discoverRepository } from '../../../src/capabilities/generation/repositoryDiscovery.js'
import { proposeDeployables } from '../../../src/capabilities/generation/deployables.js'
import {
  EXISTING_REPO_EVIDENCE,
  EXISTING_REPO_MODULE_DEFINITIONS,
  EXISTING_REPO_MODULE_IDS,
  GREENFIELD_EVIDENCE,
} from './fixtures.js'

describe('CAP-TEST-050 greenfield and existing-repository proposals', () => {
  it('greenfield: no host framework evidence proposes a single embedded-library deployable, unapproved', () => {
    const discovery = discoverRepository(GREENFIELD_EVIDENCE)
    expect(discovery.packageManager).toBe('unknown')
    expect(discovery.languages).toEqual([])
    expect(discovery.sourceRoots).toEqual([])
    expect(discovery.ambiguities).toEqual([])

    const result = proposeDeployables({
      architectureModuleIds: ['mod.domain.core'],
      discovery,
    })
    expect(result.ambiguities).toEqual([])
    expect(result.deployables).toHaveLength(1)
    const [deployable] = result.deployables
    expect(deployable?.kind).toBe('embedded-library')
    expect(deployable?.runtimeLanguage).toBe('typescript')
    expect(deployable?.moduleIds).toEqual(['mod.domain.core'])
    expect(deployable?.proposedLocations[0]?.approvalStatus).toBe('proposed')
    // No hard-coded universal `src/` assumption: greenfield has no source-root
    // evidence, so the default composition path lives at the repository root.
    expect(deployable?.compositionRootPath).toBe('composition/embedded-library.ts')
  })

  it('existing repository: React + Express evidence proposes a browser deployable and an http-api deployable', () => {
    const discovery = discoverRepository(EXISTING_REPO_EVIDENCE)
    expect(discovery.packageManager).toBe('npm')
    expect(discovery.languages).toEqual(['typescript'])
    expect(discovery.sourceRoots).toEqual(['src'])
    expect(discovery.frameworks).toEqual(['express', 'react'])
    expect(discovery.ciOperatingSystems).toEqual(['ubuntu-latest', 'windows-latest'])

    const result = proposeDeployables({
      architectureModuleIds: EXISTING_REPO_MODULE_IDS,
      architectureModuleDefinitions: EXISTING_REPO_MODULE_DEFINITIONS,
      discovery,
    })
    expect(result.ambiguities).toEqual([])
    const kinds = result.deployables.map((d) => d.kind).sort()
    expect(kinds).toEqual(['browser', 'http-api'])

    const browser = result.deployables.find((d) => d.kind === 'browser')
    expect(browser?.runtimeLanguage).toBe('typescript')
    expect(browser?.moduleIds).toEqual(['mod.experience.dashboard'])
    expect(browser?.compositionRootPath).toBe('src/composition/browser.ts')
    expect(browser?.proposedLocations[0]?.evidence).toContain('src')

    const httpApi = result.deployables.find((d) => d.kind === 'http-api')
    expect(httpApi?.runtimeLanguage).toBe('typescript')
    expect(httpApi?.moduleIds).toEqual(['mod.domain.orders'])
    expect(httpApi?.compositionRootPath).toBe('src/composition/http-api.ts')
  })
})
