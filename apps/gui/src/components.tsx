import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { HandoffRun } from '@engineering-ui-kit/core'
import { WORKFLOW_STEPS, stepStateFor, type ViewId } from './appState'
import { Icon } from './icons'

export function PageHeader(props: {
  title: string
  subtitle?: string
  onBack?: () => void
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      {props.onBack && (
        <button type="button" className="back-button" onClick={props.onBack} aria-label="Back">
          ←
        </button>
      )}
      <div>
        <h1>{props.title}</h1>
        {props.subtitle && <p className="page-subtitle">{props.subtitle}</p>}
      </div>
      {props.actions && <div className="page-header-actions">{props.actions}</div>}
    </header>
  )
}

export function Stepper(props: { run: HandoffRun | undefined; onNavigate?: (view: ViewId) => void }) {
  return (
    <ol className="workflow" aria-label="Workflow steps">
      {WORKFLOW_STEPS.map((step) => {
        const state = stepStateFor(props.run, step.index)
        const stateLabel = state === 'complete' ? 'Complete' : state === 'current' ? 'Current' : 'Pending'
        return (
          <li key={step.id} className={`workflow-step ${state}`}>
            <span className="workflow-marker" aria-hidden="true">
              {state === 'complete' ? '✓' : step.index + 1}
            </span>
            <span className="workflow-name">
              {step.name}
              <span className="sr-only">, {stateLabel}</span>
            </span>
            <span className="workflow-state" aria-hidden="true">
              {stateLabel}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function Toggle(props: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  const id = useId()
  return (
    <div className="toggle-row">
      <span className="toggle-label" id={id}>
        {props.label}
      </span>
      <button
        type="button"
        className="toggle"
        role="switch"
        aria-checked={props.checked}
        aria-labelledby={id}
        onClick={() => props.onChange(!props.checked)}
      />
    </div>
  )
}

export function Dialog(props: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  actions?: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        props.onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        className={props.wide ? 'dialog dialog-wide' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
      >
        <div className="dialog-header">
          <h2 id={titleId}>{props.title}</h2>
          <button type="button" className="dialog-close" onClick={props.onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {props.children}
        {props.actions && <div className="dialog-actions">{props.actions}</div>}
      </div>
    </div>
  )
}

export type Status = { tone: 'info' | 'error' | 'success'; text: string }

export function StatusLine(props: { status: Status }) {
  const label = props.status.tone === 'error' ? 'Error' : props.status.tone === 'success' ? 'Success' : 'Status'
  return (
    <div className={`status-line status-${props.status.tone}`} role="status" aria-live="polite">
      <span>
        <span className="status-label">{label}:</span> {props.status.text}
      </span>
    </div>
  )
}

export function TipCard(props: { text: string; linkLabel?: string; onLink?: () => void }) {
  return (
    <aside className="tip-card" aria-label="Tip">
      <span className="tip-icon" aria-hidden="true">{Icon.lightbulb()}</span>
      <div>
        <h2>Tip</h2>
        <p>{props.text}</p>
        {props.linkLabel && (
          <button type="button" className="tip-link" onClick={props.onLink}>
            {props.linkLabel} →
          </button>
        )}
      </div>
    </aside>
  )
}
