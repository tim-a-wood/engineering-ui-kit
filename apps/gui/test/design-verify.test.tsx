// @vitest-environment jsdom
/**
 * §14.4 Verify view tests: counts from `buildVerifySummary` over the sample
 * scenario runs, links to approved Design records, and no design diagrams
 * anywhere in this view.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DesignStore } from '../src/views/design/designState'
import { DesignVerifyView } from '../src/views/design/DesignVerifyView'

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('Verify view (§14.4)', () => {
  it('shows counts for use cases, scenarios, outcomes, steps, and evidence', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignVerifyView store={store} onSelectDesignLink={() => {}} />)

    const summary = screen.getByLabelText('Verification summary')
    expect(within(summary).getByText('Use cases')).toBeTruthy()
    expect(within(summary).getByText('Scenarios')).toBeTruthy()
    expect(within(summary).getByText('Recorded passed')).toBeTruthy()
    expect(within(summary).getByText('Recorded failed')).toBeTruthy()
    expect(within(summary).getByText('Skipped')).toBeTruthy()
    expect(within(summary).getByText('Canceled')).toBeTruthy()
    expect(within(summary).getByText('Steps')).toBeTruthy()
    expect(within(summary).getByText('Screenshots')).toBeTruthy()
    expect(within(summary).getByText('Structured evidence')).toBeTruthy()

    const sample = store.getState()
    expect(sample.scenarioRuns.length).toBeGreaterThan(0)
  })

  it('contains no SVG diagram elements anywhere in the view', () => {
    const store = new DesignStore({ now: NOW })
    const { container } = render(<DesignVerifyView store={store} onSelectDesignLink={() => {}} />)
    expect(container.querySelectorAll('svg').length).toBe(0)
  })

  it('links to approved Design records; clicking a link selects that module', () => {
    const store = new DesignStore({ now: NOW })
    let selected: string | undefined
    render(<DesignVerifyView store={store} onSelectDesignLink={(moduleId) => (selected = moduleId)} />)

    const approvedModuleIds = Object.keys(store.getState().approvedModuleDesigns)
    expect(approvedModuleIds.length).toBeGreaterThan(0)

    const firstApprovedName = store.getState().progress.modules.find((entry) => entry.moduleId === approvedModuleIds[0])?.name
    const link = screen.getByRole('button', { name: firstApprovedName })
    fireEvent.click(link)
    expect(selected).toBe(approvedModuleIds[0])
  })
})
