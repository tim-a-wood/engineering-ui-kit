/**
 * The five Copilot-handoff workflow step views, implementing PRD §13.2–13.7.
 * Each renders the shared stepper, guards its preconditions (ARCH-ROUTE-004),
 * and drives the typed bridge.
 */

import { useEffect, useState, type ReactElement } from 'react'
import type {
  AppliedFiles,
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  VerificationResult,
} from '@engineering-ui-kit/core'
import type { BuildPacketResult, EuikBridge, PrepareContextResult, TaskPacketFields } from '../bridge'
import { Dialog, PageHeader, StatusLine, Stepper, type Status } from '../components'
import { Markdown } from '../markdown'
import { Icon } from '../icons'
import { TASK_TEMPLATES, applyTemplate, defaultTemplateId } from '../taskTemplates'
import type { RecipePrefill, ViewId } from '../appState'

type StepProps = {
  bridge: EuikBridge
  project: Project
  run: HandoffRun
  refreshRun: () => Promise<void>
  onNavigate: (view: ViewId) => void
}

const READY: Status = { tone: 'info', text: 'Ready.' }
const COPILOT_URL = 'https://m365.cloud.microsoft/chat'

function durationLabel(results: VerificationResult[]): string {
  const totalMs = results.reduce((sum, r) => sum + (new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()), 0)
  const seconds = Math.max(1, Math.round(totalMs / 1000))
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------- 1. Prepare Context */

const INCLUDE_ROWS: { icon: ReactElement; title: string; body: string }[] = [
  { icon: Icon.code(15), title: 'Source code', body: 'All application source files' },
  { icon: Icon.gear(15), title: 'Configuration', body: 'Package files, configs, build scripts' },
  { icon: Icon.layers(15), title: 'Assets', body: 'Public assets, styles, resources (text only)' },
  { icon: Icon.doc(15), title: 'Documentation', body: 'README, docs, specs (if relevant)' },
]

const EXCLUDED_CATEGORIES = [
  'Git metadata (.git/)',
  'Dependencies (node_modules/) and lockfiles',
  'Build output (dist/, build/, coverage/) and caches',
  'Binaries, images, fonts, and archives',
  'Environment files, keys, certificates, and credential-named files',
]

export function PrepareContextView(props: StepProps & { recipe?: RecipePrefill | null }) {
  const [status, setStatus] = useState<Status>(READY)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PrepareContextResult | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const generate = async () => {
    setBusy(true)
    setStatus({ tone: 'info', text: 'Building repo inventory and flatfile…' })
    try {
      const contextResult = await props.bridge.prepareContext(props.run.id)
      setResult(contextResult)
      await props.refreshRun()
      setStatus({
        tone: 'success',
        text: `Context generated: ${contextResult.inventory.includedFileCount} files included, ${contextResult.inventory.excludedFileCount} excluded, ${contextResult.warnings.length} warnings.`,
      })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Prepare Context"
        subtitle="Export your repo and standards for Copilot."
        crumbs={[
          { label: 'Copilot Handoff', onClick: () => props.onNavigate('copilot-handoff') },
          { label: props.project.name },
        ]}
        onBack={() => props.onNavigate('copilot-handoff')}
      />
      <Stepper run={props.run} />

      <section className="panel" aria-labelledby="repository-heading">
        <div className="hstack between">
          <div className="hstack" style={{ alignItems: 'flex-start' }}>
            <span className="row-icon" aria-hidden="true">{Icon.folder()}</span>
            <div>
              <h2 id="repository-heading">Repository</h2>
              <p style={{ margin: 0 }}>
                <strong>{props.project.name}</strong>
              </p>
              <p className="mono muted" style={{ margin: 0 }}>{props.project.repoPath}</p>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onNavigate('projects')}>
            Change
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="include-heading">
        <h2 id="include-heading">What to include</h2>
        <p className="panel-desc">Text content in these categories is included automatically.</p>
        <ul className="row-list">
          {INCLUDE_ROWS.map((row) => (
            <li key={row.title} className="row-item">
              <span className="row-icon" aria-hidden="true">{row.icon}</span>
              <div className="row-copy">
                <h3>{row.title}</h3>
                <p>{row.body}</p>
              </div>
              <span className="status status-ok">
                <span className="status-dot" aria-hidden="true" /> Included
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="output-format-heading">
        <h2 id="output-format-heading">Output format</h2>
        <div className="grid-2">
          <div className="format-card selected">
            <span className="format-radio" aria-hidden="true" />
            <div>
              <h3>Flat file (recommended)</h3>
              <p>One text file with full file tree and contents.</p>
            </div>
          </div>
          <div className="format-card">
            <span className="format-radio unselected" aria-hidden="true" />
            <div>
              <h3>Structured (JSON)</h3>
              <p>File inventory with metadata — generated alongside as <code>repo-inventory.json</code>.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="context-review-heading">
        <h2 id="context-review-heading">Context review</h2>
        <p className="panel-desc">Review what will be prepared before generating Copilot handoff files.</p>
        <div className="grid-2">
          <dl className="review-list">
            <div><dt>Project / repo</dt><dd><code>{props.project.name}</code></dd></div>
            <div><dt>Task / recipe</dt><dd>{props.run.taskTitle ?? props.recipe?.title ?? 'Defined in the next step'}</dd></div>
            <div><dt>Intended upload set</dt><dd><code>repo-flatfile.txt</code>, <code>task-packet.md</code>, <code>standard-pack.md</code> (3 of 3)</dd></div>
            <div><dt>Included categories</dt><dd>Source code, configuration, assets, documentation</dd></div>
          </dl>
          <dl className="review-list">
            <div>
              <dt>Excluded categories</dt>
              <dd>
                {EXCLUDED_CATEGORIES.length} deterministic exclusion rules{' '}
                <button type="button" className="tip-link" onClick={() => setAdvancedOpen((v) => !v)}>
                  {advancedOpen ? 'Hide' : 'Show'}
                </button>
                {advancedOpen && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {EXCLUDED_CATEGORIES.map((c) => <li key={c} style={{ fontSize: 13 }}>{c}</li>)}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt>Warnings</dt>
              <dd>
                {result
                  ? result.warnings.length === 0
                    ? 'None — no secret-pattern matches detected.'
                    : (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {result.warnings.map((w) => <li key={w} className="mono" style={{ fontSize: 12, color: 'var(--semantic-status-warning)' }}>{w}</li>)}
                      </ul>
                    )
                  : 'Reported here after generation.'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="info-banner" style={{ marginTop: 'var(--semantic-spacing-4)' }}>
          <span aria-hidden="true">{Icon.info(14)}</span>
          Company policy may govern what may be uploaded to Microsoft 365 Copilot. Review the flatfile before upload.
        </div>
      </section>

      {result && (
        <section className="panel" aria-labelledby="context-result-heading">
          <h2 id="context-result-heading">Context result</h2>
          <div className="stat-chips" aria-label="Context result figures">
            <div className="stat-chip">
              <strong>{result.inventory.includedFileCount}</strong>
              <span>Files included</span>
            </div>
            <div className="stat-chip">
              <strong>{result.inventory.excludedFileCount}</strong>
              <span>Files excluded</span>
            </div>
            <div className="stat-chip">
              <strong>{formatBytes(result.flatfileBytes)}</strong>
              <span>Flatfile size</span>
            </div>
            <div className="stat-chip stat-text">
              <strong>{result.inventory.detectedFrameworks.join(', ') || 'none detected'} · {result.inventory.detectedPackageManager}</strong>
              <span>Frameworks · pkg manager</span>
            </div>
          </div>
          <p className="mono muted" style={{ margin: 'var(--semantic-spacing-3) 0 0' }}>{result.flatfilePath}</p>
        </section>
      )}

      <StatusLine status={status} />

      <div className="hstack between">
        <button type="button" className="btn btn-secondary" onClick={() => setAdvancedOpen((v) => !v)}>
          Advanced options
        </button>
        <span className="right" style={{ flex: 1 }}>
        <button
          type="button"
          className={result || props.run.repoFlatfilePath ? 'btn btn-secondary' : 'btn btn-primary'}
          onClick={generate}
          disabled={busy}
        >
          {busy ? 'Generating…' : result ? 'Regenerate Context' : 'Generate Context'}
        </button>
        {(result || props.run.repoFlatfilePath) && (
          <button type="button" className="btn btn-primary" onClick={() => props.onNavigate('create-task-packet')}>
            Continue to Task Packet
          </button>
        )}
        </span>
      </div>
    </>
  )
}

/* ------------------------------------------------- 2. Create Task Packet */

const PACKET_SECTIONS: { key: keyof TaskPacketFields; title: string; description: string; icon: ReactElement; rows: number }[] = [
  { key: 'goal', title: 'Goal', description: 'What you want to achieve', icon: Icon.target(15), rows: 3 },
  { key: 'scope', title: 'Scope', description: 'Screens, features, or areas in scope (one per line)', icon: Icon.box(15), rows: 3 },
  { key: 'constraints', title: 'Constraints', description: 'What not to change, technical limits, etc. (one per line)', icon: Icon.alertTriangle(15), rows: 3 },
  { key: 'acceptanceCriteria', title: 'Acceptance Criteria', description: 'How success will be measured (one per line)', icon: Icon.listChecks(15), rows: 4 },
  { key: 'references', title: 'References', description: 'Specs, designs, screenshots, examples (one per line)', icon: Icon.link(15), rows: 2 },
]

function draftPacketMarkdown(fields: TaskPacketFields): string {
  return [
    '# Task Packet (draft preview)', '',
    `- task: ${fields.taskTitle || 'untitled'}`,
    '- expectedOutput: `ui-overlay.zip`', '',
    '## Goal', '', fields.goal || '(empty)', '',
    '## Scope', '', ...(fields.scope || '(empty)').split('\n').map((s) => `- ${s}`), '',
    '## Constraints', '', ...(fields.constraints || '(empty)').split('\n').map((s) => `- ${s}`), '',
    '## Acceptance Criteria', '', ...(fields.acceptanceCriteria || '(empty)').split('\n').map((s, i) => `${i + 1}. ${s}`), '',
    '## References', '', ...(fields.references || '(empty)').split('\n').map((s) => `- ${s}`), '',
  ].join('\n')
}

export function CreateTaskPacketView(props: StepProps & {
  recipe?: RecipePrefill | null
  onRecipeConsumed?: () => void
  preferredTemplate?: string
}) {
  const [fields, setFields] = useState<TaskPacketFields>(() => ({
    taskTitle: props.run.taskTitle ?? (props.recipe ? `Apply recipe: ${props.recipe.title}` : ''),
    goal: props.recipe?.goal ?? '',
    scope: props.recipe?.scope ?? '',
    constraints: props.recipe?.constraints ?? '',
    acceptanceCriteria: props.recipe?.acceptanceCriteria ?? '',
    references: props.recipe?.references ?? '',
  }))
  const [editing, setEditing] = useState<keyof TaskPacketFields | null>(null)
  const [draft, setDraft] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [templateId, setTemplateId] = useState(() => defaultTemplateId(props.preferredTemplate ?? ''))
  const [confirmTemplate, setConfirmTemplate] = useState(false)
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Start from a template or edit each section, then export the task packet.' })
  const [result, setResult] = useState<BuildPacketResult | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')

  const emptyKeys = PACKET_SECTIONS.filter((s) => !fields[s.key].trim()).map((s) => s.title)
  const titleMissing = !fields.taskTitle.trim()

  const build = async () => {
    setShowValidation(true)
    if (titleMissing || emptyKeys.length > 0) {
      setStatus({ tone: 'error', text: `Required sections are empty: ${[...(titleMissing ? ['Task title'] : []), ...emptyKeys].join(', ')}.` })
      return
    }
    setStatus({ tone: 'info', text: 'Building task packet and standard pack…' })
    try {
      const packetResult = await props.bridge.buildPacket(props.run.id, fields)
      setResult(packetResult)
      props.onRecipeConsumed?.()
      await props.refreshRun()
      setStatus({
        tone: 'success',
        text: `Packet built: ${packetResult.uploadFiles.length} upload files inside the 3-file budget (${formatBytes(packetResult.packBytes)} of instructions).`,
      })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const openPreview = async () => {
    if (result || props.run.taskPacketPath) {
      try {
        setPreviewText(await props.bridge.getArtifactText(props.run.id, 'task-packet.md'))
      } catch {
        setPreviewText(draftPacketMarkdown(fields))
      }
    } else {
      setPreviewText(draftPacketMarkdown(fields))
    }
    setPreviewOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Create Task Packet"
        subtitle="Build the instruction packet Copilot will use to generate the overlay."
        crumbs={[
          { label: 'Copilot Handoff', onClick: () => props.onNavigate('copilot-handoff') },
          { label: props.project.name },
        ]}
        onBack={() => props.onNavigate('prepare-context')}
      />
      <Stepper run={props.run} />

      <section className="panel" aria-labelledby="tp-project-heading">
        <div className="hstack between">
          <div className="hstack" style={{ alignItems: 'flex-start' }}>
            <span className="row-icon" aria-hidden="true">{Icon.folder()}</span>
            <div>
              <h2 id="tp-project-heading">Project</h2>
              <p style={{ margin: 0 }}><strong>{props.project.name}</strong></p>
              <p className="mono muted" style={{ margin: 0 }}>{props.project.repoPath}</p>
            </div>
          </div>
          <div className="hstack">
            {props.recipe && (
              <span className="badge badge-info" title={`Recipe components: ${props.recipe.componentsUsed.join(', ')}`}>
                Recipe: {props.recipe.title}
              </span>
            )}
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onNavigate('projects')}>
              Change
            </button>
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="template-heading">
        <div className="hstack between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 id="template-heading">Start from a template</h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              {TASK_TEMPLATES.find((t) => t.id === templateId)?.summary ?? 'Prefill all sections for a repeatable task type, then tweak.'}
            </p>
          </div>
          <div className="hstack">
            <label className="sr-only" htmlFor="template-select">Task template</label>
            <select
              id="template-select"
              className="select-control"
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setConfirmTemplate(false) }}
            >
              {TASK_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => {
                const template = TASK_TEMPLATES.find((t) => t.id === templateId)
                if (!template) return
                const dirty = Object.values(fields).some((v) => v.trim().length > 0)
                if (dirty && !confirmTemplate) {
                  setConfirmTemplate(true)
                  setStatus({ tone: 'info', text: 'Applying the template will replace the current section content. Select "Replace content" to confirm.' })
                  return
                }
                setFields(applyTemplate(template, props.project.name))
                setConfirmTemplate(false)
                setShowValidation(false)
                setStatus({ tone: 'success', text: `Template applied: ${template.title}. Review the REPLACE markers and tweak before export.` })
              }}
            >
              {confirmTemplate ? 'Replace content' : 'Use template'}
            </button>
            {confirmTemplate && (
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => { setConfirmTemplate(false); setStatus({ tone: 'info', text: 'Template not applied. Current content kept.' }) }}>
                Keep current
              </button>
            )}
          </div>
        </div>
      </section>

      {showValidation && (titleMissing || emptyKeys.length > 0) && (
        <div className="validation-summary" role="alert">
          <h3>{Icon.alertTriangle(14)} Validation blockers</h3>
          <ul>
            {titleMissing && <li>Task title is required.</li>}
            {emptyKeys.map((k) => (
              <li key={k}>{k} is required.</li>
            ))}
          </ul>
        </div>
      )}

      <section className="panel" aria-labelledby="task-sections-heading">
        <h2 id="task-sections-heading">Task sections</h2>
        <div className={showValidation && titleMissing ? 'field invalid' : 'field'}>
          <label htmlFor="task-title">Task title</label>
          <input
            id="task-title"
            type="text"
            value={fields.taskTitle}
            placeholder="e.g. Refresh the Create Task Packet screen"
            onChange={(e) => setFields((f) => ({ ...f, taskTitle: e.target.value }))}
          />
          {showValidation && titleMissing && <p className="field-error" role="alert">Error: Task title is required.</p>}
        </div>

        <ul className="row-list">
          {PACKET_SECTIONS.map((section) => {
            const isEditing = editing === section.key
            const value = fields[section.key]
            const isEmpty = !value.trim()
            const showError = showValidation && isEmpty && !isEditing
            return (
              <li key={section.key} className="row-item" style={showError ? { borderColor: 'var(--semantic-border-danger)' } : undefined}>
                <span className="row-icon" aria-hidden="true">{section.icon}</span>
                <div className="row-copy">
                  <h3>{section.title} <span className="req-tag">Required</span></h3>
                  <p>{section.description}</p>
                  {!isEditing && !isEmpty && <p className="mono" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{value}</p>}
                  {showError && (
                    <p className="field-error" role="alert" style={{ color: 'var(--semantic-status-danger)', margin: '6px 0 0' }}>
                      <strong>Error:</strong> {section.title} is required.
                    </p>
                  )}
                  {isEditing && (
                    <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                      <label htmlFor={`edit-${section.key}`}>{section.title}</label>
                      <textarea
                        id={`edit-${section.key}`}
                        rows={section.rows}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="hstack">
                        <button
                          type="button"
                          className="btn btn-primary btn-compact"
                          onClick={() => {
                            setFields((f) => ({ ...f, [section.key]: draft }))
                            setEditing(null)
                            setStatus({ tone: 'success', text: `${section.title} saved.` })
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => {
                            setEditing(null)
                            setStatus({ tone: 'info', text: 'Edit cancelled. Previous value restored.' })
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => {
                      setEditing(section.key)
                      setDraft(value)
                    }}
                  >
                    Edit {Icon.chevronRight(12)}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <StatusLine status={status} />

      <div className="right">
        <button type="button" className="btn btn-secondary" onClick={openPreview}>
          Preview Task Packet
        </button>
        <button type="button" className={result ? 'btn btn-secondary' : 'btn btn-primary'} onClick={build}>
          {result ? 'Rebuild Task Packet' : 'Export Task Packet'}
        </button>
        {result && (
          <button type="button" className="btn btn-primary" onClick={() => props.onNavigate('run-in-copilot')}>
            Continue
          </button>
        )}
      </div>

      {previewOpen && (
        <TaskPacketPreviewModal text={previewText} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  )
}

/** PRD §13.4 — defaults to rendered Preview; secondary Code tab; Copy/Download/Close. */
function TaskPacketPreviewModal(props: { text: string; onClose: () => void }) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [copied, setCopied] = useState(false)
  return (
    <Dialog
      title="Task Packet Preview"
      onClose={props.onClose}
      wide
      actions={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              setCopied(await copyText(props.text))
              window.setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <>{Icon.check(14)} Copied</> : <>{Icon.copy(14)} Copy</>}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadText('task-packet.md', props.text)}>
            {Icon.download(14)} Download
          </button>
          <button type="button" className="btn btn-primary" onClick={props.onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="tab-row" role="tablist" aria-label="Preview mode">
        <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'tab active' : 'tab'} onClick={() => setTab('preview')}>
          Preview
        </button>
        <button type="button" role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'tab active' : 'tab'} onClick={() => setTab('code')}>
          Code / Markdown
        </button>
      </div>
      {tab === 'preview' ? (
        <div className="preview-scroll"><Markdown text={props.text} /></div>
      ) : (
        <pre className="pre preview-scroll">{props.text}</pre>
      )}
    </Dialog>
  )
}

/* ------------------------------------------------- 3. Run in Copilot */

export function RunInCopilotView(props: StepProps & { packet: BuildPacketResult | null }) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Upload the three files in Microsoft 365 Copilot, paste the prompt, then continue once you have ui-overlay.zip.' })
  const run = props.run
  const files = props.packet?.uploadFiles ?? [
    ...(run.repoFlatfilePath ? [{ file: 'repo-flatfile.txt', bytes: 0, sha256: '' }] : []),
    ...(run.taskPacketPath ? [{ file: 'task-packet.md', bytes: 0, sha256: '' }] : []),
    ...(run.standardPackPath ? [{ file: 'standard-pack.md', bytes: 0, sha256: '' }] : []),
  ]

  const copyPrompt = async () => {
    const prompt = props.packet?.recommendedPrompt ??
      'Inspect all uploaded files, follow the task packet and standard pack exactly, and return only ui-overlay.zip containing changed and new files with repo-relative paths.'
    const ok = await copyText(prompt)
    setCopied(ok)
    setStatus(ok
      ? { tone: 'success', text: 'Recommended prompt copied to the clipboard.' }
      : { tone: 'error', text: 'Could not copy automatically — select the prompt text below and copy manually.' })
    window.setTimeout(() => setCopied(false), 2500)
  }

  const showFiles = async () => {
    const target = props.packet?.taskPacketPath ?? run.taskPacketPath ?? run.repoFlatfilePath
    if (target) await props.bridge.showInFolder(target)
  }

  return (
    <>
      <PageHeader
        title="Run in Copilot"
        subtitle="Upload up to 3 files to Microsoft 365 Copilot and request a zip overlay."
        crumbs={[
          { label: 'Copilot Handoff', onClick: () => props.onNavigate('copilot-handoff') },
          { label: props.project.name },
        ]}
        onBack={() => props.onNavigate('create-task-packet')}
      />
      <Stepper run={run} />

      <section className="panel" aria-labelledby="upload-heading">
        <h2 id="upload-heading">Upload to Microsoft 365 Copilot (max 3 files)</h2>
        <p className="panel-desc">You can upload a maximum of 3 files. These will be attached to your prompt in Copilot.</p>
        <div className="upload-set">
          {files.map((f) => (
            <div key={f.file} className="upload-file">
              <span className="row-icon" aria-hidden="true">{Icon.file(15)}</span>
              <div className="row-copy">
                <h3>{f.file}</h3>
                <p>
                  {f.file === 'repo-flatfile.txt' && 'Repository context (full file contents)'}
                  {f.file === 'task-packet.md' && 'Instructions and acceptance criteria'}
                  {f.file === 'standard-pack.md' && 'Engineering UI Kit standards and rules'}
                </p>
              </div>
              {f.bytes > 0 && <span className="cell-num muted">{formatBytes(f.bytes)}</span>}
            </div>
          ))}
          <div className="hstack between">
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onNavigate('create-task-packet')}>
              {Icon.refresh(14)} Replace files
            </button>
            <span className="hstack">
              {files.length === 3 ? (
                <span className="status status-ok">
                  <span className="status-dot" aria-hidden="true" /> <span className="num">3 of 3 files selected</span>
                </span>
              ) : (
                <span className="secondary-text num">{files.length} of 3 files selected</span>
              )}
            </span>
          </div>
        </div>
        <div className="hstack" style={{ marginTop: 'var(--semantic-spacing-4)' }}>
          <button type="button" className="btn btn-secondary btn-compact" onClick={showFiles}>
            {Icon.folder(15)} Show Files in Folder
          </button>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.bridge.openExternal(COPILOT_URL)}>
            {Icon.external(14)} Open Microsoft 365 Copilot
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="request-heading">
        <div className="hstack between">
          <div>
            <h2 id="request-heading">Request to Copilot</h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>In Copilot, ask it to generate a zip overlay of changed/new files only.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={copyPrompt}>
            {copied ? <>{Icon.check(14)} Copied</> : <>{Icon.copy(14)} Copy Recommended Prompt</>}
          </button>
        </div>
        {props.packet && <pre className="pre" style={{ marginTop: 12 }}>{props.packet.recommendedPrompt}</pre>}
      </section>

      <div className="info-banner info-accent">
        <span aria-hidden="true">{Icon.info(14)}</span>
        Expected output: a .zip file containing only changed/new files (optional apply-notes.md may be included).
      </div>

      <StatusLine status={status} />

      <div className="right">
        <button type="button" className="btn btn-primary" onClick={() => props.onNavigate('apply-zip-overlay')}>
          I have the overlay — Continue
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------- 4. Apply Zip Overlay */

type TreeNode = { name: string; children: Map<string, TreeNode>; isFile: boolean }

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', children: new Map(), isFile: false }
  for (const p of paths) {
    let node = root
    const segments = p.split('/')
    segments.forEach((segment, index) => {
      if (!node.children.has(segment)) {
        node.children.set(segment, { name: segment, children: new Map(), isFile: index === segments.length - 1 })
      }
      node = node.children.get(segment)!
    })
  }
  return root
}

function TreeView(props: { node: TreeNode; depth?: number }) {
  const depth = props.depth ?? 0
  const entries = [...props.node.children.values()].sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name))
  return (
    <ul className="file-tree" style={depth === 0 ? undefined : { paddingLeft: 16 }}>
      {entries.map((child) => (
        <li key={child.name}>
          <span className="tree-glyph" aria-hidden="true">{child.isFile ? Icon.file(13) : Icon.folder(13)}</span>
          <code>{child.name}</code>
          {!child.isFile && <TreeView node={child} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

export function ApplyZipOverlayView(props: StepProps) {
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Select the ui-overlay.zip returned by Copilot.' })
  const [inspection, setInspection] = useState<OverlayInspectionSummary | null>(null)
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const [applied, setApplied] = useState<AppliedFiles | null>(null)
  const [busy, setBusy] = useState(false)

  const pickAndInspect = async () => {
    const zipPath = await props.bridge.pickZipFile()
    if (!zipPath) return
    setBusy(true)
    setApplied(null)
    setWarningsAccepted(false)
    setStatus({ tone: 'info', text: `Inspecting ${zipPath}…` })
    try {
      const summary = await props.bridge.inspectOverlay(props.run.id, zipPath)
      setInspection(summary)
      await props.refreshRun()
      setStatus(
        summary.canApply
          ? summary.warnings.length > 0
            ? { tone: 'info', text: `Inspection verdict: warning — ${summary.warnings.length} warnings require explicit acceptance.` }
            : { tone: 'success', text: 'Inspection verdict: pass.' }
          : { tone: 'error', text: `Inspection verdict: blocked — ${summary.hardBlockers.length} hard blockers. This overlay cannot be applied.` },
      )
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!inspection) return
    setBusy(true)
    try {
      const appliedFiles = await props.bridge.applyOverlay(props.run.id, warningsAccepted)
      setApplied(appliedFiles)
      await props.refreshRun()
      setStatus({ tone: 'success', text: `Overlay applied: ${appliedFiles.files.length} files.` })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const canApply = Boolean(
    inspection?.canApply && (inspection.warnings.length === 0 || warningsAccepted) && !applied,
  )
  const filePaths = inspection?.normalizedEntries.filter((e) => !e.isDirectory).map((e) => e.normalizedRelativePath) ?? []

  return (
    <>
      <PageHeader
        title="Apply Zip Overlay"
        subtitle="Inspect Copilot's zip output, review every entry, then apply it on top of your existing repo."
        crumbs={[
          { label: 'Copilot Handoff', onClick: () => props.onNavigate('copilot-handoff') },
          { label: props.project.name },
        ]}
        onBack={() => props.onNavigate('run-in-copilot')}
      />
      <Stepper run={props.run} />

      <div className="apply-layout">
        <div className="stack">
          <section className="panel" aria-labelledby="overlay-source-heading">
            <div className="hstack between">
              <div>
                <h2 id="overlay-source-heading">Apply to repository</h2>
                <p className="panel-desc" style={{ marginBottom: 0 }}>
                  {props.run.overlayZipPath ? <code>{props.run.overlayZipPath}</code> : 'No overlay selected yet.'}
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={pickAndInspect} disabled={busy}>
                {inspection ? 'Select different zip…' : 'Select ui-overlay.zip…'}
              </button>
            </div>
          </section>

          {inspection && (
            <section className="panel" aria-labelledby="inspection-heading">
              <div className="hstack between">
                <h2 id="inspection-heading">Inspection result</h2>
                {inspection.canApply
                  ? inspection.warnings.length > 0
                    ? <span className="badge badge-warning"><span className="badge-dot" aria-hidden="true" /> Warning — review required</span>
                    : <span className="badge badge-success"><span className="badge-dot" aria-hidden="true" /> Pass</span>
                  : <span className="badge badge-danger"><span className="badge-dot" aria-hidden="true" /> Blocked</span>}
              </div>

              <table className="data-table">
                <caption className="sr-only">Overlay entries</caption>
                <thead>
                  <tr><th scope="col">Path</th><th scope="col">Action</th><th scope="col" className="cell-num">Size</th></tr>
                </thead>
                <tbody>
                  {inspection.normalizedEntries.filter((e) => !e.isDirectory).map((entry) => {
                    const overwrite = inspection.warnings.some((w) => w.ruleId === 'AI-HANDOFF-040' && w.path === entry.normalizedRelativePath)
                    return (
                      <tr key={entry.normalizedRelativePath}>
                        <td className="mono">{entry.normalizedRelativePath}</td>
                        <td>
                          <span className={overwrite ? 'status status-warning' : 'status status-ok'}>
                            <span className="status-dot" aria-hidden="true" /> {overwrite ? 'Overwrite' : 'New file'}
                          </span>
                        </td>
                        <td className="cell-num">{entry.sizeBytes !== undefined ? formatBytes(entry.sizeBytes) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {inspection.hardBlockers.length > 0 && (
                <div className="validation-summary" role="alert" style={{ marginTop: 16 }}>
                  <h3>{Icon.alertTriangle(14)} Hard blockers — apply refused</h3>
                  <ul>
                    {inspection.hardBlockers.map((b, i) => (
                      <li key={i}><code>{b.ruleId}</code> {b.path ? <code>{b.path}</code> : null} — {b.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {inspection.warnings.length > 0 && inspection.canApply && (
                <div className="inset" style={{ marginTop: 16, borderColor: 'var(--semantic-status-warning)' }}>
                  <p className="status-label" style={{ color: 'var(--semantic-status-warning)', marginTop: 0 }}>
                    Warnings requiring explicit acceptance
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {inspection.warnings.map((w, i) => (
                      <li key={i} style={{ fontSize: 13 }}>
                        <code>{w.ruleId}</code> {w.path ? <code>{w.path}</code> : null} — {w.message}
                      </li>
                    ))}
                  </ul>
                  <label className="hstack" style={{ marginTop: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={warningsAccepted}
                      onChange={(e) => setWarningsAccepted(e.target.checked)}
                    />
                    I reviewed every warning and accept the overwrites listed above.
                  </label>
                </div>
              )}
            </section>
          )}

          {applied && (
            <section className="panel" aria-labelledby="applied-heading">
              <h2 id="applied-heading">Applied files</h2>
              <ul className="row-list">
                {applied.files.map((f) => (
                  <li key={f.relativePath} className="hstack between" style={{ padding: '4px 0' }}>
                    <code>{f.relativePath}</code>
                    <span className={`status ${f.action === 'created' ? 'status-ok' : f.action === 'overwritten' ? 'status-info' : 'status-neutral'}`}>
                      <span className="status-dot" aria-hidden="true" /> {f.action}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="panel" aria-labelledby="zip-contents-heading">
          <h2 id="zip-contents-heading">Zip contents</h2>
          {filePaths.length > 0 ? (
            <TreeView node={buildTree(filePaths)} />
          ) : (
            <p className="secondary-text">Select an overlay to preview its file tree.</p>
          )}
        </section>
      </div>

      <StatusLine status={status} />

      <div className="right">
        <button type="button" className="btn btn-primary" onClick={apply} disabled={!canApply || busy}>
          Apply Overlay
        </button>
        {applied && (
          <button type="button" className="btn btn-primary" onClick={() => props.onNavigate('verify-review')}>
            Continue to Verify & Review
          </button>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------- 5. Verify & Review */

type FeedbackEvent = { at: string; kind: 'feedback' | 'review-packet'; summary: string }

export function VerifyReviewView(props: StepProps) {
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Run verification commands against the applied overlay.' })
  const [results, setResults] = useState<VerificationResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(props.run.currentStep === 'complete')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [history, setHistory] = useState<FeedbackEvent[]>([])
  const [reviewPacket, setReviewPacket] = useState<{ path: string; text: string } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [allFeedback, setAllFeedback] = useState<string | null>(null)

  useEffect(() => {
    const seeded: FeedbackEvent[] = []
    if (props.run.userReviewNotesPath) seeded.push({ at: props.run.updatedAt, kind: 'feedback', summary: 'Manual feedback on file' })
    if (props.run.reviewEvidencePackPath) seeded.push({ at: props.run.updatedAt, kind: 'review-packet', summary: 'Copilot review packet generated' })
    setHistory(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runChecks = async () => {
    setBusy(true)
    setStatus({ tone: 'info', text: 'Running verification commands…' })
    try {
      const verification = await props.bridge.runVerification(props.run.id, ['typecheck', 'build'])
      setResults(verification)
      setLastRunAt(new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))
      const failed = verification.filter((r) => r.status !== 'passed')
      setStatus(
        failed.length === 0
          ? { tone: 'success', text: 'All checks passed. Your repository builds and typechecks.' }
          : { tone: 'error', text: `${failed.length} of ${verification.length} checks failed. Review the logs before approving.` },
      )
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const saveFeedback = async () => {
    if (!feedbackText.trim()) {
      setStatus({ tone: 'error', text: 'Feedback is empty — write a note before saving.' })
      return
    }
    try {
      await props.bridge.saveFeedback(props.run.id, feedbackText)
      await props.refreshRun()
      setHistory((h) => [{ at: new Date().toISOString(), kind: 'feedback', summary: feedbackText.trim().slice(0, 60) }, ...h])
      setFeedbackText('')
      setFeedbackOpen(false)
      setStatus({ tone: 'success', text: 'Feedback saved to user-review-notes.md.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const generateReviewPacket = async () => {
    try {
      const result = await props.bridge.buildReviewPacket(props.run.id)
      await props.refreshRun()
      setReviewPacket({ path: result.reviewPacketPath, text: result.reviewPacketText })
      setHistory((h) => [{ at: new Date().toISOString(), kind: 'review-packet', summary: 'Copilot review packet generated' }, ...h])
      setReviewOpen(true)
      setStatus({ tone: 'success', text: 'Copilot review packet generated.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const approve = async () => {
    await props.bridge.updateRun(props.run.id, { currentStep: 'complete', completionStatus: 'approved' })
    await props.refreshRun()
    setCompleted(true)
    setStatus({ tone: 'success', text: 'Handoff approved and completed.' })
  }

  const passed = results?.filter((r) => r.status === 'passed').length ?? 0
  const failed = results?.filter((r) => r.status !== 'passed').length ?? 0

  return (
    <>
      <PageHeader
        title="Verify & Review"
        subtitle="Test the changes and review the Copilot output before finalizing."
        crumbs={[
          { label: 'Copilot Handoff', onClick: () => props.onNavigate('copilot-handoff') },
          { label: props.project.name },
        ]}
        onBack={() => props.onNavigate('apply-zip-overlay')}
      />
      <Stepper run={props.run} />

      <section className="panel" aria-labelledby="iteration-heading">
        <div className="iteration-grid iteration-grid-intro">
          <div className="iteration-intro">
            <span className="iteration-intro-icon" aria-hidden="true">{Icon.refresh(22)}</span>
            <h2 id="iteration-heading" style={{ marginBottom: 4 }}>Iteration &amp; feedback loop</h2>
            <p className="secondary-text" style={{ fontSize: 13, margin: 0 }}>
              Review changes in the app, add feedback (manual or Copilot), and generate a new task packet to iterate.
            </p>
          </div>
          <div className="inset">
            <h3 className="iteration-step-title">1 · Launch app</h3>
            <p className="secondary-text">Open the application to validate the changes and review behavior.</p>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              disabled={!props.project.launchUrl}
              onClick={() => props.project.launchUrl && props.bridge.openExternal(props.project.launchUrl)}
            >
              {Icon.play(14)} Launch App
            </button>
            {!props.project.launchUrl && (
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>No launch URL configured for this project.</p>
            )}
          </div>
          <div className="inset">
            <h3 className="iteration-step-title">2 · Add feedback</h3>
            <p className="secondary-text">Add your feedback manually, or generate a Copilot review packet to streamline the review process.</p>
            {feedbackOpen ? (
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="review-feedback">Review feedback</label>
                <textarea
                  id="review-feedback"
                  rows={3}
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                />
                <div className="hstack">
                  <button type="button" className="btn btn-primary btn-compact" onClick={saveFeedback}>Save Feedback</button>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => setFeedbackOpen(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-compact" onClick={() => setFeedbackOpen(true)}>
                  {Icon.pencil(14)} Add Feedback Manually
                </button>
                <button type="button" className="btn btn-secondary btn-compact" onClick={generateReviewPacket}>
                  {Icon.sparkle(14)} Generate Copilot Review Packet
                </button>
              </div>
            )}
          </div>
          <div className="inset">
            <h3 className="iteration-step-title">3 · Generate new task packet</h3>
            <p className="secondary-text">
              Create a new task packet with updated context and feedback for the next run.
            </p>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onNavigate('create-task-packet')}>
              {Icon.doc(15)} Generate New Task Packet
            </button>
          </div>
        </div>
        <div className="info-banner" style={{ marginTop: 'var(--semantic-spacing-4)' }}>
          <span aria-hidden="true">{Icon.info(14)}</span>
          A new task packet will include your feedback and updated instructions for Copilot.
        </div>
      </section>

      <section className="panel" aria-labelledby="verification-heading">
        <h2 id="verification-heading" className="sr-only">Verification status</h2>
        <div className="hstack between">
          <div className="hstack" style={{ gap: 'var(--semantic-spacing-4)' }}>
            <span
              className={`verify-hero ${results ? (failed === 0 ? 'verify-hero-pass' : 'verify-hero-fail') : ''}`}
              aria-hidden="true"
            >
              {results ? (failed === 0 ? Icon.check(18) : Icon.x(18)) : Icon.shieldCheck(18)}
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, color: results && failed === 0 ? 'var(--semantic-status-success)' : undefined }}>
                {results ? (failed === 0 ? 'All checks passed' : `${failed} check${failed === 1 ? '' : 's'} failed`) : 'Verification status'}
              </h3>
              <p className="panel-desc" style={{ marginBottom: 0 }}>
                {results
                  ? failed === 0
                    ? 'Your repository builds and typechecks.'
                    : 'Review the output logs before approving.'
                  : 'Run the verification commands against the applied overlay.'}
                {lastRunAt && <span className="muted"> · Last run: Today at {lastRunAt}</span>}
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={runChecks} disabled={busy}>
            {busy ? 'Running…' : results ? <>{Icon.refresh(14)} Re-run checks</> : 'Run checks'}
          </button>
        </div>

        {results && (
          <div className="stat-chips" aria-label="Verification summary">
            <div className="stat-chip">
              <span className="stat-chip-icon" aria-hidden="true">{Icon.doc(18)}</span>
              <strong>{results.length}</strong>
              <span>Checks run</span>
            </div>
            <div className="stat-chip stat-pass">
              <span className="stat-chip-icon" aria-hidden="true">{Icon.check(18)}</span>
              <strong>{passed}</strong>
              <span>Passed</span>
            </div>
            <div className={failed > 0 ? 'stat-chip stat-fail' : 'stat-chip'}>
              <span className="stat-chip-icon" aria-hidden="true">{Icon.x(18)}</span>
              <strong>{failed}</strong>
              <span>Failed</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip-icon" aria-hidden="true">{Icon.refresh(18)}</span>
              <strong>{durationLabel(results)}</strong>
              <span>Duration</span>
            </div>
          </div>
        )}

        {results && (
          <table className="data-table" style={{ marginTop: 12 }}>
            <caption className="sr-only">Verification results</caption>
            <thead>
              <tr><th scope="col">Check</th><th scope="col">Command</th><th scope="col">Status</th><th scope="col" className="cell-num">Exit code</th></tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.commandLabel}>
                  <td>{r.commandLabel}</td>
                  <td className="mono">{r.commandText}</td>
                  <td>
                    <span className={`status ${r.status === 'passed' ? 'status-ok' : 'status-danger'}`}>
                      <span className="status-dot" aria-hidden="true" /> {r.status === 'passed' ? 'Passed' : r.status}
                    </span>
                  </td>
                  <td className="cell-num">{r.exitCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {results?.some((r) => r.combinedOutputPath) && (
          <div style={{ marginTop: 'var(--semantic-spacing-3)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => {
                const withLog = results.find((r) => r.combinedOutputPath)
                if (withLog?.combinedOutputPath) void props.bridge.showInFolder(withLog.combinedOutputPath)
              }}
            >
              {Icon.external(14)} View full test report
            </button>
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="panel" aria-labelledby="history-heading">
          <div className="hstack between">
            <h2 id="history-heading">Recent feedback history</h2>
            {props.run.userReviewNotesPath && (
              <button
                type="button"
                className="tip-link"
                onClick={async () => {
                  try {
                    setAllFeedback(await props.bridge.getArtifactText(props.run.id, 'user-review-notes.md'))
                  } catch {
                    setAllFeedback('_No feedback file found._')
                  }
                }}
              >
                View all →
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="secondary-text" style={{ margin: 0 }}>No feedback captured yet for this run.</p>
          ) : (
            <ul className="row-list" style={{ gap: 6 }}>
              {history.map((event, i) => (
                <li key={i} className="hstack between" style={{ padding: '4px 0' }}>
                  <span className="hstack">
                    <span className="row-icon" style={{ width: 24, height: 24 }} aria-hidden="true">
                      {event.kind === 'feedback' ? Icon.pencil(13) : Icon.sparkle(13)}
                    </span>
                    <span>{event.summary}</span>
                  </span>
                  <span className="muted num" style={{ fontSize: 12 }}>{new Date(event.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel" aria-labelledby="next-heading">
          <h2 id="next-heading">What's next?</h2>
          <p className="secondary-text" style={{ margin: 0 }}>
            {failed > 0
              ? 'Fix the failing checks or generate a new task packet with corrective feedback, then run Copilot again.'
              : completed
                ? 'Handoff complete. Start a new handoff from the hub or Projects when you have the next task.'
                : 'If the changes look right, approve and complete the handoff. Otherwise generate a new task packet and run Copilot again with the updated context.'}
          </p>
        </section>
      </div>

      <StatusLine status={status} />

      <div className="hstack between">
        <button type="button" className="btn btn-secondary" onClick={() => props.onNavigate('apply-zip-overlay')}>
          Back
        </button>
        <span className="hstack">
          <button type="button" className="btn btn-secondary" onClick={runChecks} disabled={busy}>
            {Icon.refresh(15)} Re-run tests
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!results || failed > 0 || completed}
            onClick={approve}
          >
            {Icon.check(14)} {completed ? 'Handoff Complete' : 'Approve & Complete Handoff'}
          </button>
        </span>
      </div>

      {allFeedback !== null && (
        <Dialog
          title="Feedback history"
          onClose={() => setAllFeedback(null)}
          wide
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setAllFeedback(null)}>
              Close
            </button>
          }
        >
          <div className="preview-scroll"><Markdown text={allFeedback} /></div>
        </Dialog>
      )}

      {reviewOpen && reviewPacket && (
        <Dialog
          title="Generate Copilot Review Packet"
          onClose={() => setReviewOpen(false)}
          wide
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => copyText(reviewPacket.text)}>
                Copy
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => props.bridge.showInFolder(reviewPacket.path)}>
                Show in Folder
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setReviewOpen(false)}>
                Close
              </button>
            </>
          }
        >
          <p className="secondary-text">
            Follow-up upload set (3-file budget): <code>review-packet.md</code> plus up to two supporting evidence files.
          </p>
          <div className="preview-scroll"><Markdown text={reviewPacket.text} /></div>
        </Dialog>
      )}
    </>
  )
}
