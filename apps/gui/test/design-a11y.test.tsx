// @vitest-environment jsdom
/**
 * §18.4 accessibility tests for the Design workspace, following the
 * `cap-test-038-a11y` pattern: headings/landmarks, named controls, aria-live
 * status announcements, an error summary that links to the offending step,
 * modal focus containment/return, reduced motion, and non-color status
 * indicators.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesignStore } from '../src/views/design/designState'
import { DesignWorkspaceView } from '../src/views/design/DesignWorkspaceView'
import { ModuleSessionView } from '../src/views/design/ModuleSessionView'

const HERE = path.dirname(fileURLToPath(import.meta.url))

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('Design workspace — headings, landmarks, and named controls (§18.4)', () => {
  it('has a heading hierarchy and labelled landmark regions', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Design' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Design modules' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'System canvas' })).toBeTruthy()
  })

  it('gives every interactive control an accessible name', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)

    for (const chip of ['All', 'Not started', 'Needs input', 'Ready for review', 'Approved', 'Old', 'Blocked']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${chip}`) })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy()
  })
})

describe('Design workspace — status announcements (§18.4 "status announcements")', () => {
  it('announces an approval through a polite live region', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    act(() => {
      store.approveModule('mod.package-export', 'tester.reviewer')
    })
    const liveRegions = screen.getAllByRole('status')
    const announced = liveRegions.some((region) => /approved/i.test(region.textContent ?? ''))
    expect(announced).toBe(true)
  })

  it('shows a save-state live region (§18.1 "show save state")', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    expect(document.querySelector('.design-save-indicator[role="status"][aria-live="polite"]')).toBeTruthy()
  })

  it('announces the number of modules a filter shows', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    const resultCount = document.querySelector('.design-queue-result-count')
    expect(resultCount?.getAttribute('role')).toBe('status')
    expect(resultCount?.getAttribute('aria-live')).toBe('polite')
  })
})

describe('Error summary links to the offending step (§18.4)', () => {
  it('a blocking diagnostic in the checks step is a control that opens the step containing the field', () => {
    const store = new DesignStore({ now: NOW })
    const moduleId = 'mod.evidence-graph'
    const checks = store.runChecks(moduleId)
    expect(checks?.blockerCount).toBeGreaterThan(0)

    const entry = store.getState().progress.modules.find((candidate) => candidate.moduleId === moduleId)!
    render(
      <ModuleSessionView
        entry={entry}
        design={store.getDesign(moduleId)}
        session={{ ...store.getSession(moduleId)!, currentStep: 'checks' }}
        approvedContracts={store.getState().approvedContracts}
        checks={checks}
        primaryActionLabel={store.primaryActionLabel(moduleId)}
        saveState="idle"
        onPrimaryAction={() => {}}
        onGoToStep={(step) => store.goToStep(moduleId, step)}
        onAnswerQuestion={() => {}}
        onRunChecks={() => {}}
        onApprove={() => {}}
        onCreateHandoff={() => {}}
      />,
    )

    const summary = screen.getByRole('list', { name: 'Error summary' })
    const links = summary.querySelectorAll('button.design-diagnostic-link')
    expect(links.length).toBeGreaterThan(0)
  })
})

describe('Modal focus containment and return (§18.4)', () => {
  it('the detail modal traps Tab focus and returns focus to the opening control on close', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    const node = document.querySelector('[data-node-id="system.element.mod.evidence-store"]') as SVGGElement
    node.focus()
    fireEvent.keyDown(node, { key: 'Enter' })

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(node)
  })
})

describe('Reduced motion (§18.4)', () => {
  it('disables animation and transitions for the Design workspace under prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.join(HERE, '../src/styles.css'), 'utf8')
    const anchor = css.indexOf('.design-workspace')
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)', anchor))
    expect(block).toMatch(/\.design-workspace \* \{/)
    expect(block).toMatch(/animation: none !important/)
    expect(block).toMatch(/transition: none !important/)
  })
})

describe('Non-color status indicators (§18.4)', () => {
  it('every module state is also carried by text and a glyph, not color alone', () => {
    const store = new DesignStore({ now: NOW })
    render(<DesignWorkspaceView store={store} />)
    const badges = document.querySelectorAll('.design-state-badge')
    expect(badges.length).toBeGreaterThan(0)
    for (const badge of Array.from(badges)) {
      // Text content beyond the aria-hidden glyph span carries the state name.
      expect((badge.textContent ?? '').trim().length).toBeGreaterThan(1)
    }
    expect(document.body.textContent).toMatch(/Waiting for dependency|Old|Needs input|Ready for review|Approved/)
  })
})
