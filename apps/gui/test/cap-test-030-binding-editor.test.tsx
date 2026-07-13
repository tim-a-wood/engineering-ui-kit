/**
 * CAP-TEST-030 (GUI) — BindingEditor has no demo controls and sources operations
 * only from persisted approved module manifests.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CapabilityModuleRecord, ModuleManifest } from '@engineering-ui-kit/core'
import { BindingEditor } from '../src/views/capabilities/BindingEditor'
import { installMockBridge } from '../src/mockBridge'

const manifest: ModuleManifest = {
  schemaVersion: '1.0',
  architectureVersion: '1.0',
  moduleId: 'mod.orders',
  moduleVersion: '1.0.0',
  moduleType: 'domain',
  name: 'Orders',
  responsibility: 'orders',
  ownedConcerns: [],
  excludedConcerns: [],
  providedOperations: [{ operationId: 'op.placeOrder', contractVersion: '2.0.0' }],
  requiredOperations: [],
  verificationSuiteIds: [],
  runtimeAllocation: 'local-embedded',
  events: [],
  ownedPaths: ['capabilities/modules/mod.orders/'],
}

const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: manifest }]

describe('CAP-TEST-030 GUI binding editor', () => {
  it('removes all demo-only controls', () => {
    const bridge = installMockBridge()
    const html = renderToStaticMarkup(
      <BindingEditor bridge={bridge} projectId="p1" records={records} />,
    )
    expect(html).not.toContain('Demo ambiguous mapping')
    expect(html).not.toContain('aria-label="Operation ID"')
  })

  it('offers operations derived from approved manifests and mapping editors', () => {
    const bridge = installMockBridge()
    const html = renderToStaticMarkup(
      <BindingEditor bridge={bridge} projectId="p1" records={records} />,
    )
    expect(html).toContain('aria-label="Operation"')
    expect(html).toContain('op.placeOrder @ 2.0.0')
    expect(html).toContain('aria-label="Input mappings"')
    expect(html).toContain('aria-label="Output mappings"')
    expect(html).toContain('Add input mapping')
    expect(html).toContain('Add output mapping')
  })

  it('shows an empty operation list when no approved modules exist', () => {
    const bridge = installMockBridge()
    const html = renderToStaticMarkup(<BindingEditor bridge={bridge} projectId="p1" records={[]} />)
    expect(html).toContain('No approved operations available')
  })

  it('reloads persisted binding drafts through the named bridge', async () => {
    const bridge = installMockBridge()
    const draft = {
      schemaVersion: '1.0' as const,
      bindingId: 'binding.saved',
      version: '1.0.0',
      projectId: 'p1',
      selectionEvidence: {
        route: '/', documentTitle: 'App', selector: '#save', visibleText: 'Save',
        elementTag: 'button', stableMarker: 'data-testid=save', captureTime: new Date().toISOString(),
      },
      trigger: 'activate' as const,
      operationId: 'op.placeOrder',
      operationVersion: '2.0.0',
      inputMappings: [], outputMappings: [], loadingBehavior: 'spinner',
      validationBehavior: 'inline', domainRejectionBehavior: 'message',
      technicalFailureBehavior: 'retry', cancellationBehavior: 'restore',
      duplicateSubmissionBehavior: 'disable', dataMode: 'connected' as const,
    }
    await bridge.capabilitiesSaveBindingDraft('p1', draft)
    const persisted = await bridge.capabilitiesListBindings('p1')
    expect(persisted).toEqual([{ bindingId: 'binding.saved', draft }])
  })
})
