// @vitest-environment jsdom
/**
 * §22 Lifecycle Explorer tests: the five required §22.3 defects (broken
 * trace, MATLAB/Simulink timeout, invalid column mapping, rejected
 * non-independent review, old package after a baseline change) are all
 * surfaced, and a trace link navigates to the linked module.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesignStore } from '../src/views/design/designState'
import { EvidenceExplorer } from '../src/views/design/EvidenceExplorer'

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('Evidence Explorer (§22)', () => {
  it('surfaces all five §22.3 defects', () => {
    const store = new DesignStore({ now: NOW })
    render(<EvidenceExplorer store={store} onFollowTrace={() => {}} />)

    expect(screen.getByText('Broken trace')).toBeTruthy()
    expect(screen.getByText('MATLAB and Simulink timeout')).toBeTruthy()
    expect(screen.getByText('Invalid column mapping')).toBeTruthy()
    expect(screen.getByText('Rejected — reviewer not independent')).toBeTruthy()
    expect(screen.getByText('Old package after baseline change')).toBeTruthy()
  })

  it('uses Appendix C wording ("Old") for module state, never "stale", in the Old module designs section', () => {
    const store = new DesignStore({ now: NOW })
    render(<EvidenceExplorer store={store} onFollowTrace={() => {}} />)
    const section = screen.getByRole('region', { name: 'Old module designs' })
    expect(section.textContent).toMatch(/: Old/)
    expect(section.textContent).not.toMatch(/: Stale/i)
  })

  it('follows a trace link from a defect to its linked module', () => {
    const store = new DesignStore({ now: NOW })
    const { defects } = store.getState()
    let followed: string | undefined
    render(<EvidenceExplorer store={store} onFollowTrace={(moduleId) => (followed = moduleId)} />)

    const buttons = screen.getAllByRole('button', { name: /Follow trace to/ })
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0]!)
    expect(followed).toBeTruthy()
    expect(followed).toBe(defects.evidenceGraphBrokenTrace.moduleId)
  })
})
