/**
 * Reusable wizard primitives (RCP-WORKFLOW-001 / CMP-WORKFLOW-STEP-INDICATOR):
 * a compact numbered step indicator plus the phase/action scaffolding for any
 * multi-phase flow. Completed steps are clickable to go back; forward
 * navigation stays gated behind the owner's validation.
 */

import type { ReactNode } from 'react'

export interface WizardStep {
  id: string
  label: string
}

export function WizardStepper(props: {
  steps: WizardStep[]
  current: number
  /** Highest step index reached (steps at or below are clickable). */
  furthest: number
  onSelect: (index: number) => void
}) {
  return (
    <ol className="wizard-stepper" aria-label="Steps">
      {props.steps.map((step, index) => {
        const state = index === props.current ? 'current' : index <= props.furthest ? 'complete' : 'upcoming'
        const reachable = index <= props.furthest && index !== props.current
        return (
          <li key={step.id} className="wizard-stepper-item">
            {index > 0 && <span className="wizard-connector" aria-hidden="true" />}
            <button
              type="button"
              className={`wizard-step ${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
              disabled={!reachable}
              onClick={() => props.onSelect(index)}
            >
              <span className="wizard-dot" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
              <span className="wizard-label">{step.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** One visible phase at a time; width tuned for forms, full for review content. */
export function WizardPhase(props: { wide?: boolean; children: ReactNode }) {
  return <div className={props.wide ? 'wizard-phase wide' : 'wizard-phase'}>{props.children}</div>
}

/** Back / Next / commit row, ruled off from the phase content. */
export function WizardActions(props: { children: ReactNode }) {
  return <div className="wizard-actions">{props.children}</div>
}
