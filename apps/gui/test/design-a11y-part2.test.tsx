// @vitest-environment jsdom
/**
 * §18.4, §24.4 accessibility tests for the parts of the Design workspace not
 * already covered by `design-a11y.test.tsx`: the top-level workspace
 * tablist's aria-current/aria-selected + arrow-key navigation, the diagram
 * detail modal's focus containment/return for a *relationship* selection,
 * keyboard reachability of the diagram text alternative, status
 * announcements for handoff creation and delta apply, named controls in
 * BuildHandoffView and EvidenceExplorer, non-color state communication in
 * Verify counts and the Evidence defect list, and reduced-motion coverage
 * for the newer Build/Verify/Evidence views.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DesignStore } from '../src/views/design/designState'
import { DesignWorkspaceView } from '../src/views/design/DesignWorkspaceView'
import { ModuleDiagrams } from '../src/views/design/ModuleDiagrams'
import { BuildHandoffView } from '../src/views/design/BuildHandoffView'
import { DesignVerifyView } from '../src/views/design/DesignVerifyView'
import { EvidenceExplorer } from '../src/views/design/EvidenceExplorer'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const NOW = () => '2026-07-25T00:00:00.000Z'
const DIAGRAM_MODULE_ID = 'mod.finding-review'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

function renderDiagramsFor(store: DesignStore, moduleId: string) {
  const state = store.getState()
  const design = store.getDesign(moduleId)!
  return render(
    <ModuleDiagrams
      store={store}
      design={design}
      architecture={state.architecture}
      allDesigns={state.moduleDesigns}
      useCaseAnalysis={state.useCaseAnalysis}
      diagramDiscussions={state.diagramDiscussions}
      diagramImpacts={state.diagramImpacts}
    />,
  )
}

/** Every button in `container` has a non-empty accessible name (aria-label or text content). */
function assertAllButtonsNamed(container: HTMLElement) {
  const buttons = container.querySelectorAll('button')
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of Array.from(buttons)) {
    const accessibleName = (button.getAttribute('aria-label') ?? button.textContent ?? '').trim()
    expect(accessibleName.length).toBeGreaterThan(0)
  }
}

describe('Workspace tabs — tablist semantics, aria-current/aria-selected, arrow-key nav (§18.4, §24.4)', () => {
  it('exposes Design/Build/Verify/Evidence as a tablist with aria-selected and aria-current on the active tab', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    const tablist = screen.getByRole('tablist', { name: 'Design workspace sections' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Design', 'Build', 'Verify', 'Evidence'])

    const designTab = within(tablist).getByRole('tab', { name: 'Design' })
    expect(designTab.getAttribute('aria-selected')).toBe('true')
    expect(designTab.getAttribute('aria-current')).toBe('true')

    const buildTab = within(tablist).getByRole('tab', { name: 'Build' })
    expect(buildTab.getAttribute('aria-selected')).toBe('false')
    expect(buildTab.getAttribute('aria-current')).toBeNull()
  })

  it('moves the active tab and focus with ArrowRight/ArrowLeft, wrapping at both ends', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    const tablist = screen.getByRole('tablist', { name: 'Design workspace sections' })

    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(within(tablist).getByRole('tab', { name: 'Build' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement?.id).toBe('design-workspace-tab-build')

    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(within(tablist).getByRole('tab', { name: 'Verify' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(within(tablist).getByRole('tab', { name: 'Evidence' }).getAttribute('aria-selected')).toBe('true')

    // Wraps forward past the last tab back to the first.
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(within(tablist).getByRole('tab', { name: 'Design' }).getAttribute('aria-selected')).toBe('true')

    // Wraps backward past the first tab to the last.
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
    expect(within(tablist).getByRole('tab', { name: 'Evidence' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement?.id).toBe('design-workspace-tab-evidence')
  })
})

describe('Diagram detail modal focus containment/return for a relationship selection (§18.4)', () => {
  it('opening the modal by selecting a relationship traps focus and returns it to the relationship control on close', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagramsFor(store, DIAGRAM_MODULE_ID)

    const edge = document.querySelector('[role="button"].design-diagram-edge-line') as SVGPolylineElement
    expect(edge).toBeTruthy()
    edge.focus()
    fireEvent.keyDown(edge, { key: 'Enter' })

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(edge)
  })
})

describe('Diagram text alternative is keyboard reachable (§15.2, §18.4)', () => {
  it('the "Show relationship list" control is a native, focusable button and reveals a named list on activation', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagramsFor(store, DIAGRAM_MODULE_ID)

    const toggle = screen.getByRole('button', { name: 'Show relationship list' })
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('type')).toBe('button')
    expect(toggle.tabIndex).not.toBe(-1)

    toggle.focus()
    expect(document.activeElement).toBe(toggle)
    fireEvent.click(toggle)

    expect(document.querySelector('svg')).toBeNull()
    const list = screen.getByRole('list', { name: 'Relationship list' })
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0)
    // The toggle itself remains keyboard-focusable and now offers to go back.
    expect(screen.getByRole('button', { name: 'Show diagram' })).toBeTruthy()
  })
})

describe('Status announcements fire on handoff creation and delta apply (§18.4, §11, §12)', () => {
  it('announces a Copilot handoff creation through the polite live region', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)

    act(() => {
      store.createModuleHandoff('mod.evidence-store')
    })

    const liveRegions = screen.getAllByRole('status')
    expect(liveRegions.some((region) => /Created a Copilot implementation handoff for Evidence Store/.test(region.textContent ?? ''))).toBe(true)
  })

  it('announces a simulated delta apply through the polite live region', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)

    act(() => {
      const handoff = store.createModuleHandoff('mod.evidence-store')
      const packet = handoff.packet as { packetId: string; moduleDesignRevision: string; moduleDesignHash: string; allowedPaths: string[] }
      const targetPath = `${packet.allowedPaths[0]}notes.md`
      store.importReturnedDeltaText(
        'mod.evidence-store',
        JSON.stringify({
          schemaVersion: '1.0',
          deltaId: 'delta.announce-apply',
          packetId: packet.packetId,
          baseRevision: packet.moduleDesignRevision,
          baseHash: packet.moduleDesignHash,
          fileChanges: [{ path: targetPath, action: 'create', content: 'notes' }],
          recordChanges: [],
          testResults: [{ command: 'pnpm test', passed: true, summary: 'All tests passed.' }],
          assumptions: [],
          unresolvedIssues: [],
          requestedScopeChanges: [],
          evidenceFiles: [],
          returnedAt: NOW(),
          contentHash: 'test-content-hash',
        }),
      )
      store.inspectReturnedDelta('mod.evidence-store')
      store.approveReturnedDelta('mod.evidence-store', 'tester.reviewer')
      store.applyReturnedDelta('mod.evidence-store')
    })

    const liveRegions = screen.getAllByRole('status')
    expect(liveRegions.some((region) => /Applied the returned delta \(simulated in browser mode\) for mod\.evidence-store/.test(region.textContent ?? ''))).toBe(true)
  })
})

describe('BuildHandoffView and EvidenceExplorer controls are all named (§18.4, §24.4)', () => {
  it('every button in the Evidence Explorer has an accessible name', () => {
    const store = new DesignStore({ now: NOW })
    const { container } = render(<EvidenceExplorer store={store} onFollowTrace={() => {}} />)
    assertAllButtonsNamed(container)
  })

  it('every button in the Build handoff view has an accessible name, including conditional post-handoff controls', () => {
    const store = new DesignStore({ now: NOW })
    const { container } = render(<BuildHandoffView store={store} />)

    fireEvent.change(screen.getByLabelText('Module'), { target: { value: 'mod.evidence-store' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Copilot handoff' }))

    assertAllButtonsNamed(container)
  })
})

describe('Non-color state communication (§18.4)', () => {
  it('Verify current/old counts are carried by text labels, not color alone', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignVerifyView store={store} onSelectDesignLink={() => {}} />)
    const currentRow = screen.getByText('Current results').closest('dt')?.nextElementSibling
    const oldRow = screen.getByText('Old results').closest('dt')?.nextElementSibling
    expect(currentRow?.textContent).toMatch(/Current:\s*\d+/)
    expect(oldRow?.textContent).toMatch(/Old:\s*\d+/)
  })

  it('Evidence defect list items carry state through text, not color alone', () => {
    const store = new DesignStore({ now: NOW })
    render(<EvidenceExplorer store={store} onFollowTrace={() => {}} />)
    const oldSection = screen.getByRole('region', { name: 'Old module designs' })
    expect(oldSection.textContent).toMatch(/: Old/)
    const matlabSection = screen.getByRole('region', { name: 'Refresh evidence defects' })
    expect(matlabSection.textContent).toMatch(/Timed out|Failed|Valid|Skipped/)
  })
})

describe('Reduced motion coverage extends to the Build/Verify/Evidence panels (§18.4)', () => {
  it('the CSS rule that disables animation/transition for the Design workspace applies to every descendant, including the new tabs', () => {
    const css = fs.readFileSync(path.join(HERE, '../src/styles.css'), 'utf8')
    const anchor = css.indexOf('.design-workspace')
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)', anchor))
    expect(block).toMatch(/\.design-workspace \* \{/)
    expect(block).toMatch(/animation: none !important/)
    expect(block).toMatch(/transition: none !important/)

    // The Build, Verify, and Evidence panels are always rendered as
    // descendants of `.design-workspace`, so the wildcard rule above covers
    // them without any additional selectors.
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Build' }))
    expect(document.querySelector('.design-workspace .design-build-handoff')).toBeTruthy()
    expect(document.querySelector('.design-workspace .design-waves')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Verify' }))
    expect(document.querySelector('.design-workspace .design-verify')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Evidence' }))
    expect(document.querySelector('.design-workspace .design-evidence-explorer')).toBeTruthy()
  })
})
