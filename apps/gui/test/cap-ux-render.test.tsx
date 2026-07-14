/**
 * CAP-UX render/presentation tests. Static markup assertions (no jsdom), matching
 * the repo's renderToStaticMarkup style. Cover the Guided vs Design disclosure
 * rules, locked-stage gating, the reusable handoff card, and the six design areas.
 */

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CapabilityPacketExportResult, EuikBridge } from '../src/bridge'
import { BindingEditor } from '../src/views/capabilities/BindingEditor'
import { ApplicationDefinition } from '../src/views/capabilities/ApplicationDefinition'
import { ModulesView } from '../src/views/capabilities/ModulesView'
import { ArchitectureInterview } from '../src/views/capabilities/ArchitectureInterview'
import { NeedsAttention } from '../src/views/capabilities/NeedsAttention'
import { GuidedConnect } from '../src/views/capabilities/GuidedConnect'
import { GuidedBuild } from '../src/views/capabilities/GuidedBuild'
import type { ArchitectureSpecification, ModuleManifest } from '@engineering-ui-kit/core'
import { CapabilityHandoffCard } from '../src/views/capabilities/CapabilityHandoffCard'
import { DesignBody, GuidedBody } from '../src/views/capabilities/CapabilitiesView'
import { deriveJourney } from '../src/views/capabilities/capabilitiesUiState'
import type { AttentionItem, CapabilityModuleRecord } from '@engineering-ui-kit/core'
import type { CapabilityPreviewHandle } from '../src/views/capabilities/CapabilityPreview'

function bridge(): EuikBridge {
  return new Proxy({}, { get: () => vi.fn(async () => ({})) }) as unknown as EuikBridge
}

const previewRef = createRef<CapabilityPreviewHandle>()
const headingRef = createRef<HTMLHeadingElement>()

const noModules: CapabilityModuleRecord[] = []

describe('Guided vs Design disclosure', () => {
  it('Guided binding uses friendly behavior labels and hides raw keys, IDs, and CAP codes', () => {
    const html = renderToStaticMarkup(<BindingEditor bridge={bridge()} projectId="p1" projection="guided" />)
    expect(html).toContain('While it runs')
    expect(html).toContain('Something goes wrong')
    expect(html).not.toContain('loadingBehavior')
    expect(html).not.toContain('technicalFailureBehavior')
    expect(html).not.toContain('binding.draft')
    expect(html).not.toContain('CAP-')
    expect(html).not.toContain('aria-label="Binding ID"')
  })

  it('Design binding retains raw field keys, the Binding ID, and coded diagnostics', () => {
    const html = renderToStaticMarkup(<BindingEditor bridge={bridge()} projectId="p1" projection="design" />)
    expect(html).toContain('aria-label="Binding ID"')
    expect(html).toContain('loadingBehavior')
    // Coded diagnostics list is present in design (gate fails with no operation selected).
    expect(html).toContain('aria-label="Binding diagnostics"')
  })

  it('Design renders the six canonical areas', () => {
    const html = renderToStaticMarkup(
      <DesignBody
        bridge={bridge()}
        projectId="p1"
        section="application"
        onSection={() => {}}
        moduleRecords={noModules}
        attentionItems={[]}
        architectureProjection={undefined}
        archSpec={undefined}
        application={{}}
        architecture={{}}
        selectionEvidence={undefined}
        bindingRecords={[]}
        previewRef={previewRef}
        onChanged={() => {}}
        onSelectionEvidence={() => {}}
      />,
    )
    for (const label of ['Application', 'Architecture', 'Needs attention', 'Modules', 'Connections', 'Verification']) {
      expect(html).toContain(`>${label}</button>`)
    }
    expect(html).toContain('role="tablist"')
  })

  it('a locked Guided stage never renders its editor (defensive gating)', () => {
    // App approved only -> Connect is locked. Viewing it must show a blocker, not the binding editor.
    const journey = deriveJourney({ application: { approved: {} }, architecture: {}, modules: [], bindings: [] })
    const html = renderToStaticMarkup(
      <GuidedBody
        bridge={bridge()}
        projectId="p1"
        journey={journey}
        viewing="connect"
        panel="journey"
        moduleRecords={noModules}
        attentionItems={[]}
        architectureProjection={undefined}
        archSpec={undefined}
        selectionEvidence={undefined}
        bindingRecords={[]}
        previewRef={previewRef}
        stageHeadingRef={headingRef}
        onView={() => {}}
        onChanged={() => {}}
        onSelectionEvidence={() => {}}
        onClosePanel={() => {}}
      />,
    )
    expect(html).not.toContain('aria-label="Binding editor"')
    expect(html).toContain('Show me how')
  })
})

describe('Guided source scan — no technical strings leak by default', () => {
  const BANNED = [
    'CAP-GATE',
    'CAP-CONTRACT',
    'loadingBehavior',
    'validationBehavior',
    'domainRejectionBehavior',
    'technicalFailureBehavior',
    'binding.draft',
  ]
  const guidedRenders: [string, string][] = [
    ['BindingEditor', renderToStaticMarkup(<BindingEditor bridge={bridge()} projectId="p1" projection="guided" />)],
    ['ApplicationDefinition', renderToStaticMarkup(<ApplicationDefinition bridge={bridge()} projectId="p1" projection="guided" />)],
    ['ModulesView', renderToStaticMarkup(<ModulesView bridge={bridge()} projectId="p1" architectureApproved projection="guided" records={noModules} />)],
    ['ArchitectureInterview', renderToStaticMarkup(<ArchitectureInterview bridge={bridge()} projectId="p1" architectureApproved={false} projection="guided" />)],
  ]
  for (const [name, html] of guidedRenders) {
    it(`${name} guided output contains no banned technical strings`, () => {
      for (const token of BANNED) expect(html, `${name} leaked ${token}`).not.toContain(token)
    })
  }
})

function manifest(moduleId: string, ops: string[]): ModuleManifest {
  return {
    schemaVersion: '1.0', architectureVersion: '1.0', moduleId, moduleVersion: '1.0.0',
    moduleType: 'experience', name: '', responsibility: '', ownedConcerns: [], excludedConcerns: [],
    providedOperations: ops.map((operationId) => ({ operationId, contractVersion: '2.0' })),
    requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded', events: [], ownedPaths: [],
  }
}

describe('Guided Connect (progressive four-substep)', () => {
  const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: manifest('mod.orders', ['op.placeOrder']) }]
  // Without a selected element, only step 1 renders (honest gating outside packaged Electron).
  const noElement = renderToStaticMarkup(
    <GuidedConnect
      bridge={bridge()} projectId="p1" records={records}
      selectionEvidence={undefined} onSelectionEvidence={() => {}}
      previewRef={previewRef} onChanged={() => {}}
    />,
  )
  // With a marked element, the capability step becomes available.
  const evidence = { route: '/#/orders', documentTitle: 'Orders', selector: '#place', visibleText: 'Place order', elementTag: 'button', stableMarker: 'data-cap-id=place', captureTime: '2026-07-14T00:00:00.000Z' }
  const withElement = renderToStaticMarkup(
    <GuidedConnect
      bridge={bridge()} projectId="p1" records={records}
      selectionEvidence={evidence} onSelectionEvidence={() => {}}
      previewRef={previewRef} onChanged={() => {}}
    />,
  )
  it('starts at "Select an element" and honestly disables selection outside packaged Electron', () => {
    expect(noElement).toContain('Select an element')
    expect(noElement).not.toContain('Preview binding picker')
    expect(noElement).toContain('packaged desktop app')
    // Capability/behavior are NOT claimed possible without a real element selection.
    expect(noElement).not.toContain('aria-label="Capability"')
    expect(noElement).not.toContain('While it runs')
  })
  it('once an element is selected, humanizes the capability and never shows Binding ID or raw id@version', () => {
    expect(withElement).toContain('aria-label="Capability"')
    expect(withElement).toContain('Place Order')
    expect(withElement).not.toContain('op.placeOrder @')
    expect(withElement).not.toContain('aria-label="Binding ID"')
    expect(withElement).not.toContain('binding.draft')
  })
  it('does not render behavior fields before a capability is chosen', () => {
    // Element selected but no capability chosen yet -> step 3 withheld.
    expect(withElement).not.toContain('While it runs')
    expect(withElement).not.toContain('Something goes wrong')
  })
  it('does not render diagnostics before an interaction or approval attempt', () => {
    expect(withElement).not.toContain('To finish this connection')
    expect(withElement).not.toContain('cap-issue-list')
  })
})

describe('Guided Build (two-region, single next action)', () => {
  const arch = { schemaVersion: '1.0', moduleIds: ['mod.a', 'mod.b'] } as unknown as ArchitectureSpecification
  const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.a', approved: manifest('mod.a', ['op.a']) }, { moduleId: 'mod.b' }]
  const html = renderToStaticMarkup(<GuidedBuild bridge={bridge()} projectId="p1" archSpec={arch} records={records} onChanged={() => {}} />)
  it('shows the left module list with progress and per-module state', () => {
    expect(html).toContain('aria-label="Allocated modules"')
    expect(html).toContain('1 of 2')
    expect(html).toContain('approved')
    expect(html).toMatch(/aria-label="[^"]*, Approved"/)
    expect(html).toMatch(/aria-label="[^"]*, Not started"/)
  })
  it('right region shows only the next relevant action, not every lifecycle button', () => {
    // First-incomplete module (mod.b) -> "Create interview" only.
    expect(html).toContain('Create interview')
    expect(html).not.toContain('Export implementation packet')
    expect(html).not.toContain('Apply reviewed overlay')
    expect(html).not.toContain('Verify module')
  })
})

describe('CapabilityHandoffCard', () => {
  const result: CapabilityPacketExportResult = {
    runId: 'run-123',
    packetId: 'pkt-abc',
    recommendedPrompt: 'Attach the files and answer the interview.',
    files: [{ path: '/Users/tim/app/capabilities/generated/product-interview.md', bytes: 2048, sha256: 'deadbeefcafebabe0000' }],
    uploadFiles: ['/Users/tim/app/capabilities/generated/product-interview.md'],
  }

  it('Guided shows filenames + compact size and the three actions, no full path or sha', () => {
    const html = renderToStaticMarkup(<CapabilityHandoffCard bridge={bridge()} result={result} projection="guided" />)
    expect(html).toContain('Handoff ready')
    expect(html).toContain('product-interview.md')
    expect(html).toContain('2 KB')
    expect(html).toContain('Open Copilot')
    expect(html).toContain('Copy prompt')
    expect(html).toContain('Show files')
    expect(html).not.toContain('/Users/tim/app')
    expect(html).not.toContain('deadbeef')
  })

  it('Design adds packet id, run id, full path and sha', () => {
    const html = renderToStaticMarkup(<CapabilityHandoffCard bridge={bridge()} result={result} projection="design" />)
    expect(html).toContain('pkt-abc')
    expect(html).toContain('run-123')
    expect(html).toContain('/Users/tim/app')
    expect(html).toContain('deadbeef')
  })
})

describe('NeedsAttention', () => {
  const items: AttentionItem[] = [
    { moduleId: 'mod.order-history', primaryState: 'verification-needed', nextAction: 'Run verification', reasonCodes: ['CAP-FRESH-004'] },
  ]
  it('Guided humanizes and exposes exactly one next action, no raw codes', () => {
    const html = renderToStaticMarkup(<NeedsAttention items={items} projection="guided" onNextAction={() => {}} />)
    expect(html).toContain('Order History')
    expect(html).toContain('Needs verification')
    expect(html).toMatch(/<button[^>]*>Run verification/)
    expect(html).not.toContain('CAP-FRESH')
  })
  it('Design retains reason codes', () => {
    const html = renderToStaticMarkup(<NeedsAttention items={items} projection="design" />)
    expect(html).toContain('CAP-FRESH-004')
  })
})
