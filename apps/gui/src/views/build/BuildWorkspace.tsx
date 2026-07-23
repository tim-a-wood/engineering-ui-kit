/** Single Build workspace — prepare, Copilot transfer, and overlay application. */

import { useId, type KeyboardEvent, type ReactElement } from 'react'
import { Icon } from '../../icons'
import { HandoffWorkspace } from './HandoffWorkspace'
import { OverlayWorkspace } from './OverlayWorkspace'
import type { BuildWorkspaceProps } from './buildTypes'
import { TASK_TEMPLATES, applyTemplate } from '../../taskTemplates'
import { StepHelpButton } from './StepHelpButton'

const USE_CASE_GUIDANCE: Record<string, { intro: string; provide: string[] }> = {
  'standards-refresh': {
    intro: 'Describe the existing UI that should get a visual refresh without changing its behavior.',
    provide: ['The screen or route to update', 'What currently feels wrong or inconsistent', 'Behaviors and elements that must remain unchanged'],
  },
  'new-ui-from-requirements': {
    intro: 'Define a focused new interface from a written spec that can run on sample data without a backend.',
    provide: ['Who will use it and what they need to accomplish', 'The screens, information, and actions it needs', 'Important loading, empty, and error states'],
  },
  'new-ui-existing-api': {
    intro: 'Describe the UI to build against an API that already exists.',
    provide: ['The screens and user workflows', 'Relevant endpoints, schemas, and authentication expectations', 'How loading, failures, empty responses, and retries should behave'],
  },
  'monolithic-web-app': {
    intro: 'Describe a self-contained app delivered as one repository and one runnable service.',
    provide: ['The users and primary job the app supports', 'Two to four core screens and their workflows', 'The records it stores and the create, read, update, or delete actions required', 'Any calculations, validation rules, or offline expectations'],
  },
  'add-screen': {
    intro: 'Define one new screen that fits into the existing application.',
    provide: ['The screen name and purpose', 'Where it belongs in navigation', 'Fields, data, actions, states, and permissions it needs'],
  },
  'iterate-on-feedback': {
    intro: 'List the specific review feedback to address without broadening the change.',
    provide: ['Each requested correction as a separate item', 'The screen or element affected', 'What should remain exactly as delivered'],
  },
  'a11y-remediation': {
    intro: 'Identify UI/UX issues to find and fix while preserving intended behavior.',
    provide: ['Known problems or audit findings', 'Affected screens and components', 'Usability, clarity, keyboard, focus, labeling, contrast, or announcement expectations'],
  },
}

/** Square use-case tiles with short labels and accessible full names. */
const USE_CASE_TILES: { id: string; keyword: string; label: string; icon: (size?: number) => ReactElement }[] = [
  { id: 'standards-refresh', keyword: 'Refresh', label: 'Visual refresh', icon: Icon.sparkle },
  { id: 'new-ui-from-requirements', keyword: 'From spec', label: 'From spec', icon: Icon.doc },
  { id: 'new-ui-existing-api', keyword: 'API', label: 'UI on existing API', icon: Icon.code },
  { id: 'monolithic-web-app', keyword: 'App', label: 'Self-contained app', icon: Icon.box },
  { id: 'add-screen', keyword: 'Screen', label: 'Add screen', icon: Icon.filePlus },
  { id: 'iterate-on-feedback', keyword: 'Iterate', label: 'Iterate on feedback', icon: Icon.refresh },
  { id: 'a11y-remediation', keyword: 'Audit', label: 'UI/UX issue finder', icon: Icon.shieldCheck },
]

export function BuildWorkspace(props: BuildWorkspaceProps) {
  const baseId = useId()
  const selectedTemplate = TASK_TEMPLATES.find((template) => template.id === props.templateId)
  const guidance = USE_CASE_GUIDANCE[props.templateId]

  const configureUseCase = (id: string) => {
    const template = TASK_TEMPLATES.find((item) => item.id === id)
    props.setTemplateId(id)
    if (!template) return
    const next = applyTemplate(template, props.project.name)
    const attached = props.fields.references.split('\n').filter((line) => line.startsWith('Attached file:'))
    props.setFields({ ...next, goal: '', references: attached.join('\n') })
  }

  const onTileKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % USE_CASE_TILES.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + USE_CASE_TILES.length) % USE_CASE_TILES.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = USE_CASE_TILES.length - 1
    else return
    event.preventDefault()
    const tile = USE_CASE_TILES[next]!
    configureUseCase(tile.id)
    const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-use-case="${tile.id}"]`)
    target?.focus()
  }

  return (
    <main className="build-workspace" aria-labelledby={`${baseId}-heading`}>
      <h2 className="sr-only" id={`${baseId}-heading`}>Build workspace</h2>

      <div className="build-workspace-unified" aria-label="Configure, hand off, and apply result">
        <section className="build-primary-card" aria-labelledby={`${baseId}-define`}>
          <div className="build-primary-card-head">
            <div>
              <p className="workspace-phase">Build setup</p>
              <h3 id={`${baseId}-define`}>What are you building?</h3>
              <p className="panel-desc">Choose the use case, then give Copilot the requirements and source material it needs.</p>
            </div>
            <StepHelpButton
              step={1}
              variant="build"
              title="What are you building?"
              description="Use this panel to turn your intended change into a complete, project-aware handoff."
              flow={[
                { icon: 'prompt', label: 'Choose a use case' },
                { icon: 'files', label: 'Add requirements' },
                { icon: 'check', label: 'Generate handoff' },
              ]}
              items={[
                'Choose the tile that best matches the work you want done.',
                'Describe the outcome and add a reference file when one will help.',
                'Preview if needed, then select Generate to prepare the handoff.',
              ]}
            />
          </div>

          <div className="field">
            <span className="sr-only" id={`${baseId}-use-case-label`}>Use case</span>
            <div
              className="use-case-tiles"
              role="radiogroup"
              aria-labelledby={`${baseId}-use-case-label`}
            >
              {USE_CASE_TILES.map((tile, index) => {
                const selected = tile.id === props.templateId
                return (
                  <button
                    key={tile.id}
                    type="button"
                    role="radio"
                    data-use-case={tile.id}
                    className={selected ? 'use-case-tile active' : 'use-case-tile'}
                    aria-label={tile.label}
                    title={tile.label}
                    aria-checked={selected}
                    tabIndex={selected || (!selectedTemplate && index === 0) ? 0 : -1}
                    onClick={() => configureUseCase(tile.id)}
                    onKeyDown={(event) => onTileKeyDown(event, index)}
                  >
                    <span className="use-case-tile-icon" aria-hidden="true">{tile.icon(26)}</span>
                    <span className="use-case-tile-keyword">{tile.keyword}</span>
                  </button>
                )
              })}
            </div>
            {selectedTemplate && (
              <small id={`${baseId}-use-case-summary`}>
                <strong>{USE_CASE_TILES.find((tile) => tile.id === selectedTemplate.id)?.keyword ?? selectedTemplate.title}</strong>
                {' — '}
                {selectedTemplate.summary}
              </small>
            )}
          </div>

          {guidance && (
            <div className="requirements-guidance" aria-labelledby={`${baseId}-guidance-heading`}>
              <div>
                <span className="badge badge-info">What to provide</span>
                <h4 id={`${baseId}-guidance-heading`}>{guidance.intro}</h4>
              </div>
              <ul>{guidance.provide.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          <div className="build-primary-inputs">
            <div className="field">
              <label htmlFor={`${baseId}-requirements`}>{props.templateId === 'new-ui-from-requirements' ? 'Requirement spec' : 'Your requirements'}</label>
              <textarea
                id={`${baseId}-requirements`}
                rows={props.templateId === 'new-ui-from-requirements' ? 15 : 7}
                value={props.fields.goal}
                placeholder={props.templateId === 'new-ui-from-requirements' ? 'Paste or generate the complete requirement spec for this UI.' : 'Add the project-specific details outlined above.'}
                onChange={(event) => props.setFields((fields) => ({ ...fields, goal: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Reference file</label>
              <div
                className="file-drop-zone"
                role="button"
                tabIndex={0}
                onClick={() => { void props.onAddReference() }}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void props.onAddReference() } }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files[0]
                  if (file) void props.onAddReference(props.bridge.getDroppedFilePath(file))
                }}
              >
                <span className="file-drop-icon" aria-hidden="true">＋</span>
                <strong>{props.run.visualReferencePackPath ? props.run.visualReferencePackPath.split(/[\\/]/).pop()?.replace(/^reference-/, '') : 'Add a reference file'}</strong>
                <small>{props.run.visualReferencePackPath ? 'Drop or browse to replace it' : 'Drop a requirements doc, mockup, PDF, image, or other source file here'}</small>
                <span className="btn btn-secondary btn-compact">Browse…</span>
              </div>
            </div>
          </div>
          {(props.packetDiagnostics ?? []).length > 0 && (
            <div className="validation-summary" role="alert">
              <h4>Handoff review</h4>
              <ul>
                {(props.packetDiagnostics ?? []).map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${diagnostic.section}-${index}`}>
                    <strong>{diagnostic.section}:</strong> {diagnostic.message}
                    {diagnostic.evidence ? <code style={{ marginLeft: 6 }}>{diagnostic.evidence}</code> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="build-primary-card-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={props.onPreviewPacket}
              disabled={props.contextBusy || props.packetBusy}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={props.onGenerate}
              disabled={props.contextBusy || props.packetBusy}
            >
              {props.contextBusy || props.packetBusy ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </section>

        <section className="build-primary-card build-delivery-card" aria-labelledby={`${baseId}-delivery`}>
          <div className="build-primary-card-head">
            <div>
              <p className="workspace-phase">Copilot loop</p>
              <h3 id={`${baseId}-delivery`}>Hand off and apply</h3>
              <p className="panel-desc">Prepare the packet, run it in Copilot, then inspect and apply the overlay zip it returns.</p>
            </div>
            <StepHelpButton
              step={2}
              variant="handoff"
              title="Hand off and apply"
              description="This panel carries the prepared work into Copilot and safely brings the resulting changes back."
              flow={[
                { icon: 'files', label: 'Attach files' },
                { icon: 'copilot', label: 'Run in Copilot' },
                { icon: 'zip', label: 'Inspect result' },
                { icon: 'check', label: 'Apply changes' },
              ]}
              items={[
                'Open Copilot and attach the prepared files.',
                'Copy and send the recommended prompt, then download ui-overlay.zip.',
                'Drop the zip into the result area, review the inspection, and apply it.',
              ]}
            />
          </div>
          <div className="build-delivery-stack">
            <HandoffWorkspace {...props} />
            <OverlayWorkspace {...props} />
          </div>
        </section>
      </div>
    </main>
  )
}
