// @vitest-environment jsdom
/**
 * §9.8 module diagrams + §15 UML rendering tests: selectable elements,
 * required detail-modal fields with focus trap/return, propose-change impact
 * BEFORE any record change, an approved rename re-projecting only affected
 * diagrams, and the text-alternative relationship list.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { projectComponentDiagram } from '@engineering-ui-kit/core/design-browser'
import { DesignStore } from '../src/views/design/designState'
import { ModuleDiagrams } from '../src/views/design/ModuleDiagrams'

const NOW = () => '2026-07-25T00:00:00.000Z'
const MODULE_ID = 'mod.finding-review'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

function renderDiagrams(store: DesignStore) {
  const state = store.getState()
  const design = store.getDesign(MODULE_ID)!
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

describe('Module diagrams (§9.8, §15) — an approved sample module', () => {
  it('renders the component diagram with selectable nodes', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagrams(store)
    const nodes = document.querySelectorAll('[data-diagram-node-id]')
    expect(nodes.length).toBeGreaterThan(0)
  })

  it('renders activity, state machine, and sequence diagram tabs because this module has that behavior data', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagrams(store)
    expect(screen.getByRole('tab', { name: 'Component' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'State machine' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Sequence' })).toBeTruthy()
  })

  it('opens the detail modal with the required §9.8 fields on click, traps focus, and returns focus on close', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagrams(store)
    const node = document.querySelector('[data-diagram-node-id]') as SVGGElement
    node.focus()
    fireEvent.click(node)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(within(dialog).getByText('UML element type')).toBeTruthy()
    expect(within(dialog).getByText('Stable element ID')).toBeTruthy()
    expect(within(dialog).getByText('Label')).toBeTruthy()
    expect(within(dialog).getByText('Source record')).toBeTruthy()
    expect(within(dialog).getByText('Definition')).toBeTruthy()
    expect(within(dialog).getByText('Connected elements')).toBeTruthy()
    expect(within(dialog).getAllByText('Trace links')).toHaveLength(2)
    expect(within(dialog).getByText('Discussion history')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Analyze impact' })).toBeTruthy()

    // Focus containment.
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Focus return (§18.4).
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(node)
  })

  it('selects elements with the keyboard (Enter)', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagrams(store)
    const node = document.querySelector('[data-diagram-node-id]') as SVGGElement
    node.focus()
    fireEvent.keyDown(node, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('toggles a text relationship-list alternative to the SVG diagram (§15.2, §18.4)', () => {
    const store = new DesignStore({ now: NOW })
    renderDiagrams(store)
    expect(document.querySelector('svg')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Relationship list' }))
    expect(document.querySelector('svg')).toBeNull()
    expect(screen.getByRole('list', { name: 'Relationship list' })).toBeTruthy()
  })
})

describe('Propose change → impact analysis → approve (§9.8, §10)', () => {
  it('runs impact analysis before any record change, and shows the affected items', () => {
    const store = new DesignStore({ now: NOW })
    const before = store.getDesign(MODULE_ID)!
    const target = {
      diagramId: `${before.id}.diagram.component`,
      diagramKind: 'component' as const,
      elementId: `${before.id}.element.component.${MODULE_ID}`,
      elementLabel: before.module.name,
      isRenameable: true,
    }
    const impact = store.proposeDiagramChange(MODULE_ID, target, 'Rename to Finding Review Desk')
    expect(impact).toBeTruthy()
    expect(impact!.items.length).toBeGreaterThan(0)

    // The record itself is unchanged by the proposal alone — impact analysis
    // reflects the record as it existed at proposal time, never a "future" edit.
    const after = store.getDesign(MODULE_ID)!
    expect(after.module.name).toBe(before.module.name)
    expect(after.revision).toBe(before.revision)

    const discussion = store.getDiagramDiscussion(target.elementId)
    expect(discussion.map((entry) => entry.kind)).toEqual(['proposedChange', 'impactAnalysis'])
  })

  it('an approved rename updates the record and re-projects; an unrelated module diagram keeps an identical content hash', () => {
    const store = new DesignStore({ now: NOW })
    const before = store.getDesign(MODULE_ID)!
    const state = store.getState()

    const unrelatedModuleId = 'mod.adapter.filesystem'
    const unrelatedBefore = store.getDesign(unrelatedModuleId)!
    const unrelatedProjectionBefore = projectComponentDiagram({
      design: unrelatedBefore,
      architecture: state.architecture,
      allDesigns: state.moduleDesigns,
    })

    const target = {
      diagramId: `${before.id}.diagram.component`,
      diagramKind: 'component' as const,
      elementId: `${before.id}.element.component.${MODULE_ID}`,
      elementLabel: before.module.name,
      isRenameable: true,
    }
    const newName = 'Finding Review Desk'
    store.proposeDiagramChange(MODULE_ID, target, newName)
    store.approveDiagramChangePlan(MODULE_ID, target)
    store.executeDiagramChangePlan(MODULE_ID, target)

    const after = store.getDesign(MODULE_ID)!
    expect(after.module.name).toBe(newName)
    expect(after.revision).not.toBe(before.revision)

    const afterState = store.getState()
    const renamedProjection = projectComponentDiagram({ design: after, architecture: afterState.architecture, allDesigns: afterState.moduleDesigns })
    expect(renamedProjection.elements.some((element) => element.label === newName)).toBe(true)

    const unrelatedAfter = store.getDesign(unrelatedModuleId)!
    const unrelatedProjectionAfter = projectComponentDiagram({
      design: unrelatedAfter,
      architecture: afterState.architecture,
      allDesigns: afterState.moduleDesigns,
    })
    expect(unrelatedProjectionAfter.contentHash).toBe(unrelatedProjectionBefore.contentHash)

    const discussion = store.getDiagramDiscussion(target.elementId)
    expect(discussion.map((entry) => entry.kind)).toEqual(['proposedChange', 'impactAnalysis', 'approvedChangePlan', 'executedChange'])
  })
})
