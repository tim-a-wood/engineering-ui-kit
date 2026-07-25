// @vitest-environment jsdom
/**
 * §9.3 module-design session tests: six-step navigation with completed
 * steps openable and locked future steps, returning to an earlier step
 * without losing later draft data, and the single primary-action label
 * (§9.3, §18.1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MODULE_DESIGN_STEPS } from '@engineering-ui-kit/core/design-browser'
import { DesignStore } from '../src/views/design/designState'
import { ModuleSessionView } from '../src/views/design/ModuleSessionView'

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('Module-design session steps (§9.3)', () => {
  it('shows one current step, keeps completed steps openable, and locks future steps', () => {
    const store = new DesignStore({ now: NOW })
    const moduleId = 'mod.evidence-graph' // sample ships this at currentStep "behavior", completedSteps ["boundary"]
    const entry = store.getState().progress.modules.find((candidate) => candidate.moduleId === moduleId)!
    const design = store.getDesign(moduleId)
    const session = store.getSession(moduleId)

    render(
      <ModuleSessionView
        entry={entry}
        design={design}
        session={session}
        approvedContracts={store.getState().approvedContracts}
        checks={store.evaluateChecks(moduleId)}
        primaryActionLabel={store.primaryActionLabel(moduleId)}
        saveState="idle"
        onPrimaryAction={() => {}}
        onGoToStep={() => {}}
        onAnswerQuestion={() => {}}
        onRunChecks={() => {}}
        onApprove={() => {}}
        onCreateHandoff={() => {}}
      />,
    )

    const reviewBoundary = screen.getByRole('button', { name: /Review boundary/ }) as HTMLButtonElement
    const defineBehavior = screen.getByRole('button', { name: /Define behavior/ }) as HTMLButtonElement
    const defineContracts = screen.getByRole('button', { name: /Define contracts/ }) as HTMLButtonElement

    expect(reviewBoundary.disabled).toBe(false) // completed — openable
    expect(defineBehavior.disabled).toBe(false) // current — open
    expect(defineBehavior.getAttribute('aria-current')).toBe('step')
    expect(defineContracts.disabled).toBe(true) // not reached yet — locked

    expect(MODULE_DESIGN_STEPS.length).toBe(6)
  })

  it('returning to an earlier step never loses later draft data', () => {
    const store = new DesignStore({ now: NOW })
    const moduleId = 'mod.evidence-graph'

    store.completeStep(moduleId) // completes "behavior", advances to "contracts"
    const requiredItem = store.getDesign(moduleId)!.unresolvedItems.find((item) => item.materiality === 'material' && !item.resolvedAt)!
    store.answerRequiredQuestion(moduleId, requiredItem.id, 'Use the per-objective tailored DAL.')

    // Return to the first step.
    store.goToStep(moduleId, 'boundary')
    expect(store.getSession(moduleId)!.currentStep).toBe('boundary')

    // The answer and the completed-step history are still there.
    expect(store.getSession(moduleId)!.completedSteps).toContain('behavior')
    const answers = store.getSession(moduleId)!.answers
    expect(answers.some((answer) => answer.questionId === requiredItem.id)).toBe(true)
    const resolvedItem = store.getDesign(moduleId)!.unresolvedItems.find((item) => item.id === requiredItem.id)!
    expect(resolvedItem.resolvedAt).toBeTruthy()
  })

  it('a locked step cannot be opened directly', () => {
    const store = new DesignStore({ now: NOW })
    const moduleId = 'mod.evidence-graph' // currentStep "behavior", "contracts" not completed or current
    store.goToStep(moduleId, 'approval')
    expect(store.getSession(moduleId)!.currentStep).toBe('behavior') // unchanged
    expect(store.getState().announcement).toMatch(/not open yet/)
  })
})

describe('Primary action label (§9.3, §18.1 "one primary action")', () => {
  it('asks to answer the required question while one is open', () => {
    const store = new DesignStore({ now: NOW })
    expect(store.primaryActionLabel('mod.evidence-graph')).toBe('Answer 1 required question')
  })

  it('offers to approve a module that is ready for review with no blockers', () => {
    const store = new DesignStore({ now: NOW })
    expect(store.primaryActionLabel('mod.package-export')).toBe('Approve module')
  })

  it('asks to create a module draft when no design exists yet', () => {
    const store = new DesignStore({ now: NOW })
    expect(store.primaryActionLabel('mod.does-not-exist')).toBe('Create module draft')
  })

  it('dispatches the primary action: approving a ready module through the single primary button', () => {
    const store = new DesignStore({ now: NOW })
    expect(store.getDesign('mod.package-export')!.status).toBe('readyForReview')
    store.primaryAction('mod.package-export')
    expect(store.getDesign('mod.package-export')!.status).toBe('approved')
  })
})

describe('Approval confirmation is short and factual (§18.3 "no confetti")', () => {
  it('renders a factual approved-by/approved-at line, not a celebratory message', () => {
    const store = new DesignStore({ now: NOW })
    const moduleId = 'mod.package-export'
    // The inferred session for a readyForReview design already opens on the
    // "Approve module" step, so the approval action is immediately visible.
    expect(store.getSession(moduleId)!.currentStep).toBe('approval')

    function Wrapper() {
      const entry = store.getState().progress.modules.find((candidate) => candidate.moduleId === moduleId)!
      return (
        <ModuleSessionView
          entry={entry}
          design={store.getDesign(moduleId)}
          session={store.getSession(moduleId)}
          approvedContracts={store.getState().approvedContracts}
          checks={store.evaluateChecks(moduleId)}
          primaryActionLabel={store.primaryActionLabel(moduleId)}
          saveState="saved"
          onPrimaryAction={() => {}}
          onGoToStep={(step) => store.goToStep(moduleId, step)}
          onAnswerQuestion={() => {}}
          onRunChecks={() => {}}
          onApprove={() => store.approveModule(moduleId, 'tester.reviewer')}
          onCreateHandoff={vi.fn()}
        />
      )
    }

    const { container, rerender } = render(<Wrapper />)
    const approveButton = within(container.querySelector('.design-step-panel')!).getByRole('button', { name: 'Approve module' })
    fireEvent.click(approveButton)
    rerender(<Wrapper />)

    expect(document.body.textContent).toMatch(/Approved by tester\.reviewer on/)
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/congratulations|great job|confetti/)
  })
})
