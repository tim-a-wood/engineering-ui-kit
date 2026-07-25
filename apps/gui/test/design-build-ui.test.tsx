// @vitest-environment jsdom
/**
 * React-rendered wiring tests for `BuildHandoffView` and `WavesView` — the
 * two Build-tab views that were previously exercised only against the store
 * directly (see `design-build-handoff.test.tsx`). These tests drive the real
 * `DesignStore` through the DOM: module picker, the one-module Copilot
 * handoff button, the Build-gate blocked banner (§3.5), the returned-delta
 * paste/inspect/approve/apply/rollback round trip (§11.5, §11.6, §12.2), the
 * implementation-waves table (§11.8, no dispatch-all control), and the
 * multi-module handoff selection flow (§3.3).
 *
 * A fresh `DesignStore` is constructed per test (mirroring the pattern used
 * by every sibling `design-*.test.tsx` file) rather than the module-level
 * `getDesignStore()` singleton, so tests never leak state into one another.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { buildSampleAuditHub, type DesignBaseline, type ModuleDesignSpecification, type ModuleImplementationPacket } from '@engineering-ui-kit/core/design-browser'
import { DesignStore } from '../src/views/design/designState'
import { DesignWorkspaceView } from '../src/views/design/DesignWorkspaceView'

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

function baseSnapshot() {
  const sample = buildSampleAuditHub()
  return {
    projectId: sample.projectId,
    syntheticDataStatement: sample.syntheticDataStatement,
    architecture: sample.architecture,
    approvedModuleDesigns: sample.approvedModuleDesigns,
    moduleDesigns: sample.moduleDesigns,
    sessions: sample.sessions,
    approvedContracts: sample.operationContracts.contracts.filter((c) => c.status === 'approved').map((c) => c.contract),
    useCaseAnalysis: sample.useCaseAnalysis,
    contractRegistry: sample.operationContracts,
    designBaseline: sample.designBaseline,
    policy: sample.policy,
    incrementalPreview: sample.incrementalPreview,
    wavePlan: sample.wavePlan,
    copilotHandoffTargets: sample.copilotHandoffTargets,
    scenarioTestPlan: sample.scenarioTestPlan,
    scenarioRuns: sample.scenarioRuns,
    verificationResults: sample.verificationResults,
    defects: sample.defects,
  }
}

/** Renders the full workspace and switches to the Build tab (WavesView + BuildHandoffView). */
function renderBuildTab(store: DesignStore) {
  const result = render(<DesignWorkspaceView store={store} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Build' }))
  return result
}

function selectModule(name: string, moduleId: string) {
  fireEvent.change(screen.getByLabelText('Module'), { target: { value: moduleId } })
  expect((screen.getByLabelText('Module') as HTMLSelectElement).value).toBe(moduleId)
  void name
}

/** The `BuildHandoffView` section, scoped away from `WavesView`'s per-row "Create Copilot handoff" buttons. */
function buildHandoffSection(): HTMLElement {
  return document.querySelector('.design-build-handoff') as HTMLElement
}

describe('BuildHandoffView — gate mode banner (§3.5)', () => {
  it('shows the completeBaseline gate mode by default', () => {
    const store = new DesignStore({ now: NOW })
    expect(store.getState().policy.mode).toBe('completeBaseline')
    renderBuildTab(store)

    const banner = document.querySelector('.design-gate-mode-banner')
    expect(banner).toBeTruthy()
    expect(banner!.textContent).toMatch(/Gate mode:\s*Complete Design baseline/)
    expect(banner!.textContent).toMatch(/Build starts after the complete Design baseline is approved\./)
  })
})

describe('BuildHandoffView — one-module Copilot handoff (§11.2, §11.3, §6.2)', () => {
  it('"Create Copilot handoff" produces a packet summary in the DOM for exactly one module', () => {
    const store = new DesignStore({ now: NOW })
    renderBuildTab(store)
    selectModule('Evidence Store', 'mod.evidence-store')

    fireEvent.click(within(buildHandoffSection()).getByRole('button', { name: 'Create Copilot handoff' }))

    const result = document.querySelector('.design-handoff-result')
    expect(result).toBeTruthy()
    expect(result!.textContent).toMatch(/Created a implementation handoff packet\.|Created a design handoff packet\./)
    expect(within(result as HTMLElement).getByText('Context manifest')).toBeTruthy()
    expect((result as HTMLElement).querySelectorAll('.design-context-manifest li').length).toBeGreaterThan(0)

    // Exactly one module's handoff was recorded, not a batch.
    expect(Object.keys(store.getState().moduleHandoffs)).toEqual(['mod.evidence-store'])
  })

  it('a blocked handoff shows the verbatim Build gate blocking reason in completeBaseline mode', () => {
    const snapshot = baseSnapshot()
    const unapprovedBaseline: DesignBaseline = { ...snapshot.designBaseline, status: 'draft' }
    const store = new DesignStore({ now: NOW, snapshot: { ...snapshot, designBaseline: unapprovedBaseline } })
    renderBuildTab(store)
    selectModule('Evidence Store', 'mod.evidence-store')

    fireEvent.click(within(buildHandoffSection()).getByRole('button', { name: 'Create Copilot handoff' }))

    const result = document.querySelector('.design-handoff-result')
    expect(result!.textContent).toMatch(/Handoff blocked \(implementation\)\./)
    const reasons = within(result as HTMLElement).getByRole('list', { name: 'Handoff blocked reasons' })
    expect(reasons.textContent).toContain('implementation handoffs remain blocked until the complete Design baseline is approved')
  })
})

describe('BuildHandoffView — returned-delta review round trip (§11.5, §11.6, §12.2)', () => {
  function pasteAndImport(delta: unknown) {
    fireEvent.change(screen.getByLabelText('Paste a returned delta (JSON)'), { target: { value: JSON.stringify(delta) } })
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted delta' }))
  }

  it('an out-of-scope path shows up in the inspection panel as an out-of-scope attempt', () => {
    const store = new DesignStore({ now: NOW })
    renderBuildTab(store)
    selectModule('Evidence Store', 'mod.evidence-store')
    fireEvent.click(within(buildHandoffSection()).getByRole('button', { name: 'Create Copilot handoff' }))

    const packet = store.getState().moduleHandoffs['mod.evidence-store']!.packet as ModuleImplementationPacket
    pasteAndImport({
      schemaVersion: '1.0',
      deltaId: 'delta.ui-out-of-scope',
      packetId: packet.packetId,
      baseRevision: packet.moduleDesignRevision,
      baseHash: packet.moduleDesignHash,
      fileChanges: [{ path: 'apps/desktop/src/forbidden-out-of-scope.ts', action: 'create', content: 'nope' }],
      recordChanges: [],
      testResults: [],
      assumptions: [],
      unresolvedIssues: [],
      requestedScopeChanges: [],
      evidenceFiles: [],
      returnedAt: NOW(),
      contentHash: 'test-content-hash',
    })

    expect(screen.getByText(/imported \(pasted\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect returned changes' }))

    const outOfScope = screen.getByRole('list', { name: 'Out-of-scope attempts' })
    expect(outOfScope.textContent).toContain('apps/desktop/src/forbidden-out-of-scope.ts')
    // A rejected delta never offers an approve action.
    expect(screen.queryByRole('button', { name: 'Approve to apply' })).toBeNull()
  })

  it('approve → apply (simulated) → rollback drive DOM state transitions for an in-scope delta', () => {
    const store = new DesignStore({ now: NOW })
    renderBuildTab(store)
    selectModule('Evidence Store', 'mod.evidence-store')
    fireEvent.click(within(buildHandoffSection()).getByRole('button', { name: 'Create Copilot handoff' }))

    const packet = store.getState().moduleHandoffs['mod.evidence-store']!.packet as ModuleImplementationPacket & { allowedPaths: string[] }
    const targetPath = `${packet.allowedPaths[0]}notes.md`
    pasteAndImport({
      schemaVersion: '1.0',
      deltaId: 'delta.ui-round-trip',
      packetId: packet.packetId,
      baseRevision: packet.moduleDesignRevision,
      baseHash: packet.moduleDesignHash,
      fileChanges: [{ path: targetPath, action: 'create', content: 'implementation notes' }],
      recordChanges: [],
      testResults: [{ command: 'pnpm test', passed: true, summary: 'All tests passed.' }],
      assumptions: [],
      unresolvedIssues: [],
      requestedScopeChanges: [],
      evidenceFiles: [],
      returnedAt: NOW(),
      contentHash: 'test-content-hash',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Inspect returned changes' }))
    expect(screen.getByText('Accepted.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Approve to apply' }))
    expect(screen.queryByRole('button', { name: 'Approve to apply' })).toBeNull()
    const applyButton = screen.getByRole('button', { name: 'Apply reviewed changes' })

    fireEvent.click(applyButton)
    const applyResult = document.querySelector('.design-delta-apply-result')
    expect(applyResult).toBeTruthy()
    expect(applyResult!.textContent).toMatch(/Applied \(simulated in browser mode\)/)
    expect(applyResult!.textContent).toContain(targetPath)

    const rollbackButton = screen.getByRole('button', { name: 'Roll back (demonstration)' })
    fireEvent.click(rollbackButton)
    expect(document.querySelector('.design-delta-apply-result')!.textContent).toContain('Rolled back.')
    expect(screen.queryByRole('button', { name: 'Roll back (demonstration)' })).toBeNull()
  })
})

describe('WavesView — implementation waves table (§11.8)', () => {
  it('lists modules with their batch eligibility', () => {
    const store = new DesignStore({ now: NOW })
    renderBuildTab(store)

    const wavesSection = document.querySelector('.design-waves') as HTMLElement
    const headers = within(wavesSection).getAllByRole('columnheader', { name: 'Batch eligible' })
    expect(headers.length).toBeGreaterThan(0)

    const filesystemRow = within(wavesSection).getByRole('cell', { name: 'File-system adapter' }).closest('tr')!
    expect(within(filesystemRow).getByRole('cell', { name: 'Yes' })).toBeTruthy()
    const compositionRow = within(wavesSection).getByRole('cell', { name: 'composition.entry-points' }).closest('tr')!
    expect(within(compositionRow).getByRole('cell', { name: 'No' })).toBeTruthy()
  })

  it('has no dispatch-all control anywhere on the Build tab', () => {
    const store = new DesignStore({ now: NOW })
    renderBuildTab(store)
    expect(screen.queryByRole('button', { name: /dispatch/i })).toBeNull()
    expect(screen.queryByText(/dispatch all/i)).toBeNull()
  })

  it('selecting two independent adapters enables the combined multi-module handoff action', () => {
    const store = new DesignStore({ now: NOW })
    renderBuildTab(store)

    const disabledButton = screen.getByRole('button', { name: 'Create multi-module handoff (0 selected)' })
    expect((disabledButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select File-system adapter for a multi-module handoff' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Git adapter for a multi-module handoff' }))

    const enabledButton = screen.getByRole('button', { name: 'Create multi-module handoff (2 selected)' })
    expect((enabledButton as HTMLButtonElement).disabled).toBe(false)

    // §3.3 / review finding #2 — a combined handoff requires real, explicit
    // user confirmations; the button is enabled purely by selection count,
    // but creating a packet also requires these checked.
    fireEvent.click(screen.getByRole('checkbox', { name: 'I confirm these modules are independent' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'The receiving agent supports this combined task' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fixtures and external resources are isolated: File-system adapter' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fixtures and external resources are isolated: Git adapter' }))

    fireEvent.click(enabledButton)
    const multiResult = document.querySelector('.design-waves-multi-result')
    expect(multiResult).toBeTruthy()
    expect(multiResult!.textContent).toMatch(/Created 2 implementation packets\./)
  })

  it('an overlapping-owned-paths selection shows the diagnostic and creates no packet', () => {
    const snapshot = baseSnapshot()
    const filesystemDesign = snapshot.moduleDesigns.find((d) => d.module.moduleId === 'mod.adapter.filesystem')!
    const gitDesign = snapshot.moduleDesigns.find((d) => d.module.moduleId === 'mod.adapter.git')!
    const overlappingGit: ModuleDesignSpecification = {
      ...gitDesign,
      boundary: { ...gitDesign.boundary, ownedPaths: filesystemDesign.boundary.ownedPaths },
    }
    const moduleDesigns = snapshot.moduleDesigns.map((d) => (d.module.moduleId === 'mod.adapter.git' ? overlappingGit : d))
    const approvedModuleDesigns = { ...snapshot.approvedModuleDesigns, [overlappingGit.module.moduleId]: overlappingGit }
    const store = new DesignStore({ now: NOW, snapshot: { ...snapshot, moduleDesigns, approvedModuleDesigns } })
    renderBuildTab(store)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select File-system adapter for a multi-module handoff' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Git adapter for a multi-module handoff' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create multi-module handoff (2 selected)' }))

    const multiResult = document.querySelector('.design-waves-multi-result')
    expect(multiResult).toBeTruthy()
    expect(multiResult!.textContent).not.toMatch(/Created \d+ implementation packets\./)
    const diagnostics = within(multiResult as HTMLElement).getByRole('list', { name: 'Multi-module handoff diagnostics' })
    expect(diagnostics.textContent).toMatch(/overlaps/)
    expect(store.getState().multiModuleHandoff?.result.ok).toBe(false)
  })
})
