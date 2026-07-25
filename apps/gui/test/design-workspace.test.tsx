// @vitest-environment jsdom
/**
 * Design workspace integration tests (EUC-17 GUI foundation).
 *
 * Covers: default sample load (§22.1) with 17 modules, the synthetic-data
 * statement, counts-not-percentages progress (§18.3), default module
 * selection precedence (§9.2), approving one module changing only its own
 * count, and restoring a persisted draft + last selected module + exact
 * session step after a simulated reload (§19 "Lost client session").
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { DesignStore } from '../src/views/design/designState'
import { DesignWorkspaceView } from '../src/views/design/DesignWorkspaceView'

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(cleanup)

describe('Design workspace default sample (§22.1)', () => {
  it('opens the synthetic sample with 17 modules and states the data is synthetic', () => {
    const store = new DesignStore({ now: NOW })
    expect(store.getState().projectId).toBe('sample-do178c-audit-hub')
    expect(store.getState().progress.total).toBe(17)
    expect(store.getState().syntheticDataStatement).toMatch(/synthetic/i)

    render(<DesignWorkspaceView store={store} />)
    expect(screen.getByText(/synthetic/i)).toBeTruthy()
  })

  it('shows progress as counts, never percentages (§18.3)', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    const statusText = document.querySelector('.design-system-status')?.textContent ?? ''
    expect(statusText).toMatch(/13 of 17 module designs approved/)
    expect(statusText).not.toMatch(/%/)
  })

  it('applies the default-selection precedence (first incomplete dependency)', () => {
    const store = new DesignStore({ now: NOW })
    // No canvas selection is persisted, so rule 2 applies: the first
    // incomplete dependency in recommended order — Evidence Graph (order 10,
    // needsInput, 5 direct consumers).
    expect(store.getState().selectedModuleId).toBe('mod.evidence-graph')
  })
})

describe('Approving one module (§9.10, §18.3)', () => {
  it('changes only the approved module — the "N of 17" counter moves by exactly one', () => {
    const store = new DesignStore({ now: NOW })
    const before = store.getState().progress
    expect(before.approved).toBe(13)
    const evidenceGraphBefore = before.modules.find((entry) => entry.moduleId === 'mod.evidence-graph')

    const result = store.approveModule('mod.package-export', 'tester.reviewer')
    expect(result.ok).toBe(true)

    const after = store.getState().progress
    expect(after.approved).toBe(14)
    expect(after.total).toBe(17)
    expect(after.modules.find((entry) => entry.moduleId === 'mod.package-export')?.state).toBe('approved')
    // A completely unrelated module's state is untouched by this approval.
    const evidenceGraphAfter = after.modules.find((entry) => entry.moduleId === 'mod.evidence-graph')
    expect(evidenceGraphAfter?.state).toBe(evidenceGraphBefore?.state)
  })
})

describe('Lost client session (§19)', () => {
  it('restores the persisted draft, the last selected module, and the exact session step after a simulated reload', async () => {
    const store1 = new DesignStore({ now: NOW })
    store1.completeStep('mod.evidence-graph') // advances behavior -> contracts
    store1.selectModule('mod.package-export')

    await waitFor(() => expect(store1.getState().saveState).toBe('saved'))

    // A brand-new store reading the same localStorage simulates an app reload.
    const store2 = new DesignStore({ now: () => '2026-07-25T00:05:00.000Z' })
    expect(store2.getState().selectedModuleId).toBe('mod.package-export')
    expect(store2.getSession('mod.evidence-graph')?.currentStep).toBe('contracts')
    expect(store2.getSession('mod.evidence-graph')?.completedSteps).toContain('behavior')
  })
})
