/**
 * CAP-TEST-051 — a user-approved path choice, passed back in, persists in the
 * next plan.
 */
import { describe, expect, it } from 'vitest'
import { discoverRepository } from '../../../src/capabilities/generation/repositoryDiscovery.js'
import { proposeDeployables } from '../../../src/capabilities/generation/deployables.js'
import { EXISTING_REPO_EVIDENCE, EXISTING_REPO_MODULE_DEFINITIONS, EXISTING_REPO_MODULE_IDS } from './fixtures.js'

describe('CAP-TEST-051 approved location persistence', () => {
  it('a first-generation default proposal is superseded and then persisted after user approval', () => {
    const discovery = discoverRepository(EXISTING_REPO_EVIDENCE)

    const firstGeneration = proposeDeployables({
      architectureModuleIds: EXISTING_REPO_MODULE_IDS,
      architectureModuleDefinitions: EXISTING_REPO_MODULE_DEFINITIONS,
      discovery,
    })
    const defaultBrowser = firstGeneration.deployables.find((d) => d.kind === 'browser')
    expect(defaultBrowser?.proposedLocations[0]?.approvalStatus).toBe('proposed')
    expect(defaultBrowser?.compositionRootPath).toBe('src/composition/browser.ts')

    // The user approves a different location than the default proposal.
    const userApprovedPath = 'src/renderer/composition/browser.ts'
    const secondGeneration = proposeDeployables({
      architectureModuleIds: EXISTING_REPO_MODULE_IDS,
      architectureModuleDefinitions: EXISTING_REPO_MODULE_DEFINITIONS,
      discovery,
      approvedLocations: [{ deployableId: 'browser', path: userApprovedPath }],
    })
    const approvedBrowser = secondGeneration.deployables.find((d) => d.kind === 'browser')
    expect(approvedBrowser?.compositionRootPath).toBe(userApprovedPath)
    expect(approvedBrowser?.proposedLocations[0]?.approvalStatus).toBe('approved')

    // Passing the same approval back in for a later regeneration must keep
    // producing the approved path, not silently revert to the default.
    const thirdGeneration = proposeDeployables({
      architectureModuleIds: EXISTING_REPO_MODULE_IDS,
      architectureModuleDefinitions: EXISTING_REPO_MODULE_DEFINITIONS,
      discovery,
      approvedLocations: [{ deployableId: 'browser', path: userApprovedPath }],
    })
    const persistedBrowser = thirdGeneration.deployables.find((d) => d.kind === 'browser')
    expect(persistedBrowser?.compositionRootPath).toBe(userApprovedPath)
    expect(persistedBrowser?.proposedLocations[0]?.approvalStatus).toBe('approved')
    expect(JSON.stringify(persistedBrowser)).toBe(JSON.stringify(approvedBrowser))
  })
})
