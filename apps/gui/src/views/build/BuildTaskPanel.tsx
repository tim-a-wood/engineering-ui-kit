/**
 * Task authoring panel — all Create Task Packet capabilities in the Build main column.
 */

import { Icon } from '../../icons'
import { StatusLine } from '../../components'
import { TASK_TEMPLATES } from '../../taskTemplates'
import { PACKET_SECTIONS } from '../workflowShared'
import type { BuildTaskPanelProps } from './buildTypes'
import type { TaskPacketFields } from '../../bridge'

export function BuildTaskPanel(props: BuildTaskPanelProps) {
  const emptyKeys = PACKET_SECTIONS.filter((s) => s.required && !props.fields[s.key].trim()).map((s) => s.title)
  const titleMissing = !props.fields.taskTitle.trim()

  return (
    <section className="panel" aria-labelledby="build-task-heading">
      <h2 id="build-task-heading">What should Copilot build?</h2>
      <p className="panel-desc">Start from a template or describe the outcome directly.</p>

      <div className="build-task-row">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="build-template-select">Task template</label>
          <select
            id="build-template-select"
            className="select-control"
            value={props.templateId}
            onChange={(e) => {
              props.setTemplateId(e.target.value)
              props.setConfirmTemplate(false)
            }}
          >
            {TASK_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="build-project-label">Project</label>
          <div className="hstack between build-project-chip" id="build-project-label">
            <span><strong>{props.project.name}</strong></span>
            <button type="button" className="tip-link" onClick={() => props.onNavigate('projects')}>
              Change
            </button>
          </div>
        </div>
      </div>

      <div className="hstack" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary btn-compact"
          onClick={props.onUseTemplate}
        >
          {props.confirmTemplate ? 'Replace content' : 'Use template'}
        </button>
        {props.confirmTemplate && (
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => {
              props.setConfirmTemplate(false)
              props.setStatus({ tone: 'info', text: 'Template not applied. Current content kept.' })
            }}
          >
            Keep current
          </button>
        )}
        {props.recipe && (
          <span className="badge badge-info" title={`Recipe components: ${props.recipe.componentsUsed.join(', ')}`}>
            Recipe: {props.recipe.title}
          </span>
        )}
        <span className="muted" style={{ fontSize: 12, flex: 1 }}>
          {TASK_TEMPLATES.find((t) => t.id === props.templateId)?.summary ?? ''}
        </span>
      </div>

      {props.showValidation && (titleMissing || emptyKeys.length > 0) && (
        <div className="validation-summary" role="alert" style={{ marginTop: 14 }}>
          <h3>{Icon.alertTriangle(14)} Validation blockers</h3>
          <ul>
            {titleMissing && <li>Task title is required.</li>}
            {emptyKeys.map((k) => (
              <li key={k}>{k} is required.</li>
            ))}
          </ul>
        </div>
      )}

      <div className={props.showValidation && titleMissing ? 'field invalid' : 'field'} style={{ marginTop: 14 }}>
        <label htmlFor="build-task-title">Task title</label>
        <input
          id="build-task-title"
          type="text"
          value={props.fields.taskTitle}
          placeholder="e.g. Refresh the Create Task Packet screen"
          onChange={(e) => props.setFields((f) => ({ ...f, taskTitle: e.target.value }))}
        />
        {props.showValidation && titleMissing && <p className="field-error" role="alert">Error: Task title is required.</p>}
      </div>

      <GoalSection
        fields={props.fields}
        setFields={props.setFields}
        editing={props.editing}
        setEditing={props.setEditing}
        draft={props.draft}
        setDraft={props.setDraft}
        showValidation={props.showValidation}
        setStatus={props.setStatus}
      />

      <div className="build-section-caps" role="group" aria-label="Additional task sections">
        {PACKET_SECTIONS.filter((s) => s.key !== 'goal').map((section) => {
          const value = props.fields[section.key]
          const isEmpty = !value.trim()
          const isOpen = props.editing === section.key
          const showError = Boolean(section.required && props.showValidation && isEmpty && !isOpen)
          return (
            <details
              key={section.key}
              className="build-disclosure"
              open={isOpen || showError}
              onToggle={(e) => {
                const open = (e.target as HTMLDetailsElement).open
                if (!open && props.editing === section.key) {
                  props.setEditing(null)
                }
              }}
            >
              <summary>
                <span className="build-disclosure-title">
                  {section.title}
                  <span className="req-tag">{section.required ? 'Required' : 'Optional'}</span>
                </span>
                <span className="build-disclosure-meta">
                  {isEmpty ? 'Empty' : 'Populated'}
                  {showError ? ' · needs content' : ''}
                </span>
              </summary>
              <div className="build-disclosure-body">
                <p className="panel-desc" style={{ marginTop: 0 }}>{section.description}</p>
                {isOpen ? (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor={`build-edit-${section.key}`}>{section.title}</label>
                    <textarea
                      id={`build-edit-${section.key}`}
                      rows={section.rows}
                      value={props.draft}
                      onChange={(e) => props.setDraft(e.target.value)}
                    />
                    <div className="hstack">
                      <button
                        type="button"
                        className="btn btn-primary btn-compact"
                        onClick={() => {
                          props.setFields((f) => ({ ...f, [section.key]: props.draft }))
                          props.setEditing(null)
                          props.setStatus({ tone: 'success', text: `${section.title} saved.` })
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => {
                          props.setEditing(null)
                          props.setStatus({ tone: 'info', text: 'Edit cancelled. Previous value restored.' })
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!isEmpty && <p className="mono" style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{value}</p>}
                    {showError && (
                      <p className="field-error" role="alert" style={{ color: 'var(--semantic-status-danger)' }}>
                        <strong>Error:</strong> {section.title} is required.
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      onClick={() => {
                        props.setEditing(section.key)
                        props.setDraft(value)
                      }}
                    >
                      Edit {Icon.chevronRight(12)}
                    </button>
                  </>
                )}
              </div>
            </details>
          )
        })}
      </div>

      {props.packetStale && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }} role="status">
          Task details changed since the last export — regenerate the task packet in Hand off to Copilot.
        </p>
      )}

      <div style={{ marginTop: 12 }}>
        <StatusLine status={props.status} />
      </div>
    </section>
  )
}

function GoalSection(props: {
  fields: TaskPacketFields
  setFields: BuildTaskPanelProps['setFields']
  editing: BuildTaskPanelProps['editing']
  setEditing: BuildTaskPanelProps['setEditing']
  draft: string
  setDraft: (v: string) => void
  showValidation: boolean
  setStatus: BuildTaskPanelProps['setStatus']
}) {
  const section = PACKET_SECTIONS.find((s) => s.key === 'goal')!
  const value = props.fields.goal
  const isEmpty = !value.trim()
  const isEditing = props.editing === 'goal'
  const showError = props.showValidation && isEmpty && !isEditing

  return (
    <div className="field" style={{ marginTop: 4 }}>
      <div className="hstack between">
        <label htmlFor="build-goal">Requirements / Goal <span className="req-tag">Required</span></label>
        {!isEditing && (
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => {
              props.setEditing('goal')
              props.setDraft(value)
            }}
          >
            Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <>
          <textarea
            id="build-goal"
            rows={section.rows}
            value={props.draft}
            onChange={(e) => props.setDraft(e.target.value)}
          />
          <div className="hstack">
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => {
                props.setFields((f) => ({ ...f, goal: props.draft }))
                props.setEditing(null)
                props.setStatus({ tone: 'success', text: 'Goal saved.' })
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => {
                props.setEditing(null)
                props.setStatus({ tone: 'info', text: 'Edit cancelled. Previous value restored.' })
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <textarea
            id="build-goal"
            rows={section.rows}
            value={value}
            readOnly
            placeholder="What you want to achieve"
            onClick={() => {
              props.setEditing('goal')
              props.setDraft(value)
            }}
            style={{ cursor: 'text' }}
          />
          {showError && (
            <p className="field-error" role="alert">Error: Goal is required.</p>
          )}
        </>
      )}
    </div>
  )
}
