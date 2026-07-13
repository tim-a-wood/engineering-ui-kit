/**
 * CAP-TEST-016 (GUI) — VerificationPanel uses the real approved-module path only.
 * No injected outcomes, scenario picker, or placeholder hashes remain in the renderer.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ModuleManifest } from '@engineering-ui-kit/core'
import { VerificationPanel } from '../src/views/capabilities/VerificationPanel'
import { installMockBridge } from '../src/mockBridge'

const approvedManifest: ModuleManifest = {
  schemaVersion: '1.0',
  architectureVersion: '1.0',
  moduleId: 'mod.domain',
  moduleVersion: '1.0.0',
  moduleType: 'domain',
  name: 'Domain module',
  responsibility: 'domain',
  ownedConcerns: [],
  excludedConcerns: [],
  providedOperations: [],
  requiredOperations: [],
  verificationSuiteIds: [],
  runtimeAllocation: 'local-embedded',
  events: [],
  ownedPaths: ['capabilities/modules/mod.domain/'],
}

describe('CAP-TEST-016 GUI verification', () => {
  it('shows an empty state and no controls when no approved modules exist', () => {
    const bridge = installMockBridge()
    const html = renderToStaticMarkup(
      <VerificationPanel
        bridge={bridge}
        projectId="p1"
        projection="guided"
        records={[]}
        onVerified={() => {}}
      />,
    )
    expect(html).toContain('No approved modules yet')
    expect(html).not.toContain('aria-label="Verification controls"')
    // No demo scenario picker.
    expect(html).not.toContain('Injected outcome')
  })

  it('renders approved-module controls without a scenario picker or demo hashes', () => {
    const bridge = installMockBridge()
    const html = renderToStaticMarkup(
      <VerificationPanel
        bridge={bridge}
        projectId="p1"
        projection="design"
        records={[{ moduleId: 'mod.domain', approved: approvedManifest }]}
        onVerified={() => {}}
      />,
    )
    expect(html).toContain('aria-label="Verification controls"')
    expect(html).toContain('aria-label="Approved module"')
    expect(html).not.toContain('Injected outcome')
    expect(html).not.toContain('spec-demo')
  })

  it('verifies an approved module through the desktop-owned path only', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    await bridge.capabilitiesApproveModule('p1', approvedManifest)

    // Requires explicit user action.
    await expect(
      bridge.capabilitiesVerifyApprovedModule({ projectId: 'p1', moduleId: 'mod.domain', explicit: false }),
    ).rejects.toThrow(/explicit/)

    const result = await bridge.capabilitiesVerifyApprovedModule({
      projectId: 'p1',
      moduleId: 'mod.domain',
      explicit: true,
    })
    expect(result.record.moduleId).toBe('mod.domain')
    // Renderer supplied no commands or hashes; desktop computed them.
    expect(result.record.commandResults.length).toBeGreaterThan(0)
    expect(Object.values(result.record.inputHashes).some((h) => h.includes('demo'))).toBe(false)

    // Freshness persisted and reloadable.
    const modules = await bridge.capabilitiesListModules('p1')
    expect(modules.find((m) => m.moduleId === 'mod.domain')?.freshness).toBeTruthy()
  })

  it('rejects verification for a non-approved module', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    await expect(
      bridge.capabilitiesVerifyApprovedModule({ projectId: 'p1', moduleId: 'mod.absent', explicit: true }),
    ).rejects.toThrow(/approved module not found/)
  })
})
