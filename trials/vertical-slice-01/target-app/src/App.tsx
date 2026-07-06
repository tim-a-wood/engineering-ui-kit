import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  CURRENT_WORKFLOW_STEP,
  NAV_ITEMS,
  PROJECT,
  SECTION_META,
  WORKFLOW_STEPS,
  createInitialTaskPacket,
  downloadTaskPacket,
  serializeTaskPacketMarkdown,
  validateTaskPacket,
  type TaskPacketState,
  type TaskSectionKey,
} from './taskPacket'

type StatusTone = 'info' | 'error' | 'success'

type StatusMessage = {
  tone: StatusTone
  text: string
}

const SECTION_SYMBOLS: Record<TaskSectionKey, string> = {
  goal: '◎',
  scope: '□',
  constraints: '△',
  acceptanceCriteria: '◇',
  references: '⌑',
}

function getStatusLabel(tone: StatusTone): string {
  if (tone === 'error') {
    return 'Error'
  }

  if (tone === 'success') {
    return 'Success'
  }

  return 'Status'
}

export default function App() {
  const [packet, setPacket] = useState<TaskPacketState>(createInitialTaskPacket)
  const [editingKey, setEditingKey] = useState<TaskSectionKey | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [status, setStatus] = useState<StatusMessage>({
    tone: 'info',
    text: 'Ready. Edit any section, then preview or export the task packet.',
  })
  const [showValidation, setShowValidation] = useState(false)

  const previewButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogTitleId = useId()
  const statusId = useId()
  const validationSummaryId = useId()
  const validation = validateTaskPacket(packet)
  const showValidationSummary = showValidation && !validation.valid

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    window.requestAnimationFrame(() => {
      previewButtonRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    if (!previewOpen) {
      return
    }

    closeButtonRef.current?.focus()

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePreview()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewOpen, closePreview])

  const beginEdit = (key: TaskSectionKey) => {
    setEditingKey(key)
    setDraftValue(packet[key])
    setStatus({
      tone: 'info',
      text: `Editing ${SECTION_META.find((section) => section.key === key)?.title ?? key}.`,
    })
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraftValue('')
    setStatus({
      tone: 'info',
      text: 'Edit cancelled. Previous value restored.',
    })
  }

  const saveEdit = () => {
    if (!editingKey) {
      return
    }

    setPacket((current) => ({
      ...current,
      [editingKey]: draftValue,
    }))
    setEditingKey(null)
    setDraftValue('')
    setShowValidation(false)
    setStatus({
      tone: 'success',
      text: `${SECTION_META.find((section) => section.key === editingKey)?.title ?? editingKey} saved.`,
    })
  }

  const handlePreview = () => {
    setShowValidation(true)
    if (!validation.valid) {
      setStatus({
        tone: 'error',
        text: validation.messages.join(' '),
      })
      return
    }

    setPreviewOpen(true)
    setStatus({
      tone: 'info',
      text: 'Preview open. Press Escape or Close to dismiss.',
    })
  }

  const handleExport = () => {
    setShowValidation(true)
    if (!validation.valid) {
      setStatus({
        tone: 'error',
        text: validation.messages.join(' '),
      })
      return
    }

    downloadTaskPacket(packet)
    setStatus({
      tone: 'success',
      text: 'Exported task-packet.md in the browser.',
    })
  }

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return
    }

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) {
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-lockup" aria-label="UI Overlay">
          <span className="brand-mark" aria-hidden="true">
            ⬡
          </span>
          <span className="brand-name">UI Overlay</span>
          <span className="version-pill">v0.1.0</span>
        </div>

        <nav aria-label="Primary navigation">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={item === 'Copilot Handoff' ? 'nav-item active' : 'nav-item'}
                  aria-current={item === 'Copilot Handoff' ? 'page' : undefined}
                >
                  <span className="nav-glyph" aria-hidden="true">
                    {item === 'Copilot Handoff'
                      ? '⌂'
                      : item === 'Recipes'
                        ? '▦'
                        : item === 'Components'
                          ? '⬡'
                          : item === 'Projects'
                            ? '▱'
                            : '⚙'}
                  </span>
                  <span>{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <aside className="tip-card" aria-labelledby="tip-heading">
          <div className="tip-icon" aria-hidden="true">
            ◌
          </div>
          <div>
            <h2 id="tip-heading">Tip</h2>
            <p>Be specific about the goal, acceptance criteria, and constraints.</p>
            <p className="tip-link">View guide →</p>
          </div>
        </aside>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Copilot Handoff</p>
            <div className="title-row">
              <span className="back-indicator" aria-hidden="true">
                ←
              </span>
              <h1>Create Task Packet</h1>
            </div>
            <p className="page-subtitle">
              Build the instruction packet Copilot will use to generate the overlay.
            </p>
          </div>
          <div className="header-status" aria-label="Current route">
            <span className="status-dot" aria-hidden="true" />
            Step {CURRENT_WORKFLOW_STEP + 1} of {WORKFLOW_STEPS.length}
          </div>
        </header>

        <ol className="workflow" aria-label="Workflow steps">
          {WORKFLOW_STEPS.map((step, index) => {
            const state =
              index < CURRENT_WORKFLOW_STEP
                ? 'complete'
                : index === CURRENT_WORKFLOW_STEP
                  ? 'current'
                  : 'upcoming'
            const stateLabel =
              state === 'complete' ? 'Complete' : state === 'current' ? 'Current' : 'Pending'

            return (
              <li key={step} className={`workflow-step ${state}`}>
                <span className="workflow-marker" aria-hidden="true">
                  {state === 'complete' ? '✓' : index + 1}
                </span>
                <span className="workflow-copy">
                  <span className="workflow-name">{step}</span>
                  <span className="workflow-state">{stateLabel}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <section className="project-summary surface-panel" aria-labelledby="project-heading">
          <div className="panel-icon" aria-hidden="true">
            ▱
          </div>
          <div className="project-copy">
            <h2 id="project-heading">Selected project</h2>
            <p className="project-name">{PROJECT.name}</p>
            <p className="project-path">{PROJECT.path}</p>
          </div>
        </section>

        <section className="task-sections surface-panel" aria-labelledby="task-sections-heading">
          <div className="section-panel-header">
            <div>
              <h2 id="task-sections-heading">Task sections</h2>
              <p className="muted">Review and edit the required packet content before preview or export.</p>
            </div>
            <span className="section-count">{SECTION_META.length} required sections</span>
          </div>

          {showValidationSummary && (
            <div
              className="validation-summary"
              id={validationSummaryId}
              role="alert"
              aria-labelledby={`${validationSummaryId}-heading`}
            >
              <h3 id={`${validationSummaryId}-heading`}>Validation blockers</h3>
              <ul>
                {validation.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <ul className="section-list">
            {SECTION_META.map((section) => {
              const isEditing = editingKey === section.key
              const isEmpty = packet[section.key].trim().length === 0
              const showEmptyError =
                showValidation && section.required && isEmpty && !isEditing
              const errorId = `section-${section.key}-error`
              const textareaDescriptionId = `section-${section.key}-description`

              return (
                <li
                  key={section.key}
                  className={showEmptyError ? 'section-row invalid' : 'section-row'}
                >
                  <div className="section-icon" aria-hidden="true">
                    {SECTION_SYMBOLS[section.key]}
                  </div>
                  <div className="section-copy">
                    <div className="section-heading-row">
                      <h3>{section.title}</h3>
                      {section.required && <span className="required-chip">Required</span>}
                    </div>
                    <p className="muted" id={textareaDescriptionId}>
                      {section.description}
                    </p>
                    {!isEditing && (
                      <p className="section-value">
                        {packet[section.key].trim() || 'No content yet.'}
                      </p>
                    )}
                    {showEmptyError && (
                      <p className="field-error" id={errorId} role="alert">
                        <span className="field-error-label">Error:</span> {section.title} is required.
                      </p>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="editor">
                      <label htmlFor={`section-${section.key}`}>{section.title}</label>
                      <textarea
                        id={`section-${section.key}`}
                        value={draftValue}
                        onChange={(event) => setDraftValue(event.target.value)}
                        rows={5}
                        aria-describedby={textareaDescriptionId}
                      />
                      <div className="editor-actions">
                        <button type="button" onClick={saveEdit}>
                          Save
                        </button>
                        <button type="button" className="secondary" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="secondary section-edit"
                      onClick={() => beginEdit(section.key)}
                      aria-describedby={showEmptyError ? errorId : undefined}
                    >
                      Edit
                      <span className="chevron" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <div
          className={`status status-${status.tone}`}
          id={statusId}
          role="status"
          aria-live="polite"
        >
          <span className="status-indicator" aria-hidden="true" />
          <span>
            <span className="status-label">{getStatusLabel(status.tone)}:</span> {status.text}
          </span>
        </div>

        <div className="actions" aria-label="Task packet actions">
          <button
            type="button"
            ref={previewButtonRef}
            className="secondary"
            onClick={handlePreview}
            aria-describedby={showValidationSummary ? `${statusId} ${validationSummaryId}` : statusId}
          >
            Preview Task Packet
          </button>
          <button type="button" onClick={handleExport}>
            Export Task Packet
          </button>
        </div>
      </main>

      {previewOpen && (
        <div className="dialog-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onKeyDown={onDialogKeyDown}
          >
            <div className="dialog-header">
              <div>
                <p className="eyebrow">Current packet values</p>
                <h2 id={dialogTitleId}>Task packet preview</h2>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                className="secondary"
                onClick={closePreview}
              >
                Close
              </button>
            </div>
            <pre className="preview-content">{serializeTaskPacketMarkdown(packet)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
