/**
 * The five Copilot-handoff workflow step views, implementing PRD §13.2–13.7.
 * Each renders the shared stepper, guards its preconditions (ARCH-ROUTE-004),
 * and drives the typed bridge.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type {
  AppliedFiles,
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  VerificationResult,
} from '@engineering-ui-kit/core'
import type { BuildPacketResult, EuikBridge, PrepareContextResult, RunEvidence, TaskPacketFields } from '../bridge'
import { Dialog, PageHeader, StatusLine, Stepper, type Status } from '../components'
import { Markdown } from '../markdown'
import { Icon } from '../icons'
import { TASK_TEMPLATES, applyTemplate, defaultTemplateId, parseFeedbackEntries } from '../taskTemplates'
import { LaunchUrlDialog } from './ProjectsView'
import type { RecipePrefill, ViewId } from '../appState'
import type { GuideTopicId } from '../guides'

type StepProps = {
  bridge: EuikBridge
  project: Project
  run: HandoffRun
  refreshRun: () => Promise<void>
  refreshProjects: () => Promise<void>
  onNavigate: (view: ViewId) => void
  onOpenGuide: (topic: GuideTopicId) => void
}

/** Small right-aligned entry point to the illustrated guide for this step. */
function GuideLink(props: { topic: GuideTopicId; onOpenGuide: (topic: GuideTopicId) => void }) {
  return (
    <div className="guide-link-row">
      <button type="button" className="tip-link" onClick={() => props.onOpenGuide(props.topic)}>
        How this step works →
      </button>
    </div>
  )
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
      <GuideLink topic="prepare-context" onOpenGuide={props.onOpenGuide} />

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
            <div><dt>Intended upload set</dt><dd><code>repo-flatfile.txt</code>, <code>task-and-standard-pack.md</code> (2 of 3 slots — third free for a visual reference)</dd></div>
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

      <EvidenceSection bridge={props.bridge} run={props.run} project={props.project} phase="before" onNavigate={props.onNavigate} />

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
  // Regenerated packets start from the last exported sections (F9); a fresh
  // run starts from the recipe prefill or blank.
  const [fields, setFields] = useState<TaskPacketFields>(() => props.run.taskPacketFields
    ? { ...props.run.taskPacketFields }
    : {
        taskTitle: props.run.taskTitle ?? (props.recipe ? `Apply recipe: ${props.recipe.title}` : ''),
        goal: props.recipe?.goal ?? '',
        scope: props.recipe?.scope ?? '',
        constraints: props.recipe?.constraints ?? '',
        acceptanceCriteria: props.recipe?.acceptanceCriteria ?? '',
        references: props.recipe?.references ?? '',
      })
  const [editing, setEditing] = useState<keyof TaskPacketFields | null>(null)
  const [draft, setDraft] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [templateId, setTemplateId] = useState(() => defaultTemplateId(props.preferredTemplate ?? ''))
  const [confirmTemplate, setConfirmTemplate] = useState(false)
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Start from a template or edit each section, then export the task packet.' })
  const [result, setResult] = useState<BuildPacketResult | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')

  // F16: returning here mid-iteration (overlay applied + feedback saved since
  // the last packet export) auto-populates the sections from that feedback and
  // switches to the iteration category, whose constraints hold the previous
  // design steady instead of re-requesting a full build.
  useEffect(() => {
    if (!props.run.appliedFilesPath || !props.run.userReviewNotesPath || props.recipe) return
    let cancelled = false
    void (async () => {
      try {
        const notes = await props.bridge.getArtifactText(props.run.id, 'user-review-notes.md')
        const builtAt = props.run.taskPacketBuiltAt ? Date.parse(props.run.taskPacketBuiltAt) : 0
        const fresh = parseFeedbackEntries(notes).filter((e) => Date.parse(e.at) > builtAt)
        const template = TASK_TEMPLATES.find((t) => t.id === 'iterate-on-feedback')
        if (cancelled || fresh.length === 0 || !template) return
        setFields({
          ...applyTemplate(template, props.project.name),
          scope: fresh.map((e) => e.text).join('\n'),
        })
        setTemplateId('iterate-on-feedback')
        setStatus({
          tone: 'info',
          text: `Iteration packet prefilled from ${fresh.length} saved feedback note${fresh.length === 1 ? '' : 's'} — Scope carries your feedback; the constraints hold the previous design steady. Adjust and export.`,
        })
      } catch { /* notes unreadable — keep the regular prefill */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.run.id])

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
      <GuideLink topic="workflow-overview" onOpenGuide={props.onOpenGuide} />

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
              onClick={async () => {
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
                // Methods that produce a self-serving app (the monolith) seed the
                // project's launch config so the finished app runs from the
                // workbench with no manual setup — unless the user already set one.
                let launchNote = ''
                if (template.launchDefaults && !props.project.launchUrl) {
                  try {
                    await props.bridge.updateProject(props.project.id, {
                      launchUrl: template.launchDefaults.url,
                      launchCommand: template.launchDefaults.command,
                    })
                    await props.refreshProjects()
                    launchNote = ` Launch App is pre-configured for ${template.launchDefaults.url} — after Verify builds it, open the running app from step 5.`
                  } catch { /* non-fatal: user can still set it in the launch dialog */ }
                }
                setStatus({ tone: 'success', text: `Template applied: ${template.title}. Review the REPLACE markers and tweak before export.${launchNote}` })
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
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Drag (or copy) the files into Microsoft 365 Copilot, paste the prompt, then continue once you have ui-overlay.zip.' })
  const run = props.run
  const files = props.packet?.uploadFiles ?? (run.taskAndStandardPackPath
    ? [
        ...(run.repoFlatfilePath ? [{ file: 'repo-flatfile.txt', bytes: 0, sha256: '' }] : []),
        { file: 'task-and-standard-pack.md', bytes: 0, sha256: '' },
      ]
    : [
        ...(run.repoFlatfilePath ? [{ file: 'repo-flatfile.txt', bytes: 0, sha256: '' }] : []),
        ...(run.taskPacketPath ? [{ file: 'task-packet.md', bytes: 0, sha256: '' }] : []),
        ...(run.standardPackPath ? [{ file: 'standard-pack.md', bytes: 0, sha256: '' }] : []),
      ])

  const getPrompt = async (): Promise<string> => {
    if (props.packet?.recommendedPrompt) return props.packet.recommendedPrompt
    try {
      return await props.bridge.getArtifactText(run.id, 'recommended-prompt.txt')
    } catch {
      return 'Inspect all uploaded files, follow the task packet and standard pack exactly, and return only ui-overlay.zip containing changed and new files with repo-relative paths.'
    }
  }

  const copyPrompt = async () => {
    const ok = await copyText(await getPrompt())
    setCopied(ok)
    setStatus(ok
      ? { tone: 'success', text: 'Recommended prompt copied to the clipboard.' }
      : { tone: 'error', text: 'Could not copy automatically — select the prompt text below and copy manually.' })
    window.setTimeout(() => setCopied(false), 2500)
  }

  const openCopilot = async () => {
    const ok = await copyText(await getPrompt())
    await props.bridge.openExternal(COPILOT_URL)
    setStatus(ok
      ? { tone: 'success', text: 'Copilot opened — the prompt is on your clipboard; attach the files, then paste.' }
      : { tone: 'info', text: 'Copilot opened. Copy the prompt below, attach the files, then paste.' })
  }

  const dragFiles = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    props.bridge.startUploadDrag(run.id).catch((error: unknown) => {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    })
  }

  const copyFiles = async () => {
    try {
      const result = await props.bridge.copyUploadSet(run.id)
      setStatus({ tone: 'success', text: `${result.files} file${result.files === 1 ? '' : 's'} on the clipboard — paste (Ctrl/Cmd+V) into the Copilot chat.` })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
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
      <GuideLink topic="upload-run" onOpenGuide={props.onOpenGuide} />

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
                  {f.file === 'task-and-standard-pack.md' && 'Instructions, acceptance criteria, and standards (combined)'}
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
              <span className="status status-ok">
                <span className="status-dot" aria-hidden="true" /> <span className="num">{files.length} of 3 upload slots used</span>
              </span>
            </span>
          </div>
        </div>
        <div
          className="upload-drag-chip"
          draggable
          onDragStart={dragFiles}
          role="button"
          aria-label={`Drag ${files.length} upload files out to Copilot`}
          title="Drag this straight onto the Copilot chat's attach area"
        >
          <span className="drag-dots" aria-hidden="true">⣿</span>
          <span className="hstack" aria-hidden="true">{files.map((f) => <span key={f.file} className="drag-file-chip">{Icon.file(13)} {f.file}</span>)}</span>
          <span className="drag-hint">drag onto the Copilot chat — no folder needed</span>
        </div>
        <div className="hstack" style={{ marginTop: 'var(--semantic-spacing-3)' }}>
          <button type="button" className="btn btn-secondary btn-compact" onClick={copyFiles}>
            {Icon.copy(14)} Copy Files
          </button>
          <button type="button" className="btn btn-secondary btn-compact" onClick={showFiles}>
            {Icon.folder(15)} Show Files in Folder
          </button>
          <button type="button" className="btn btn-primary btn-compact" onClick={openCopilot}>
            {Icon.external(14)} Open Copilot (copies prompt)
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

/**
 * Paste-ready remediation prompt for a refused overlay: names every blocker
 * the inspector found and restates the packaging contract, so a fresh
 * Copilot session (with the upload set re-attached) can return a corrected
 * zip without the user composing the failure report by hand.
 */
function buildBlockerFixPrompt(summary: OverlayInspectionSummary): string {
  const blockers = summary.hardBlockers
    .map((b, i) => `${i + 1}. ${b.ruleId}${b.path ? ` — \`${b.path}\`` : ''}: ${b.message}`)
    .join('\n')
  return [
    'The `ui-overlay.zip` you returned was refused by our overlay inspector before a single file was extracted. Violations found:',
    '',
    blockers,
    '',
    'Return a corrected `ui-overlay.zip` that fixes every violation above:',
    '- Keep the same intended file changes from the attached task packet — change only what the violations require.',
    '- Include only changed or new files, at repo-relative paths (no absolute paths, no `..` traversal).',
    '- Never include `.git/`, dependencies (`node_modules/`), build output (`dist/`, `build/`), caches, lockfiles, environment or secret files, or a dump of the whole repository.',
    '- An optional `apply-notes.md` may describe what was fixed.',
    '- Do not claim the overlay was locally verified.',
    '',
    'The original `repo-flatfile.txt` and `task-and-standard-pack.md` are attached again for full context.',
  ].join('\n')
}

export function ApplyZipOverlayView(props: StepProps) {
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Select the ui-overlay.zip returned by Copilot.' })
  const [inspection, setInspection] = useState<OverlayInspectionSummary | null>(null)
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const [applied, setApplied] = useState<AppliedFiles | null>(null)
  const [busy, setBusy] = useState(false)
  const [fixCopied, setFixCopied] = useState(false)

  const copyFixPrompt = async () => {
    if (!inspection) return
    const ok = await copyText(buildBlockerFixPrompt(inspection))
    setFixCopied(ok)
    setStatus(ok
      ? { tone: 'success', text: 'Fix prompt copied — start a fresh Copilot session, re-attach the two upload files, and paste.' }
      : { tone: 'error', text: 'Could not copy automatically — select the blocker list and copy manually.' })
    window.setTimeout(() => setFixCopied(false), 2500)
  }

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
          : { tone: 'error', text: `Inspection verdict: blocked — ${summary.hardBlockers.length} hard blockers. This overlay can never be applied; copy the fix prompt below to get a corrected zip from Copilot.` },
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
      <GuideLink topic="apply-safely" onOpenGuide={props.onOpenGuide} />

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
                  <div className="hstack" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary btn-compact" onClick={copyFixPrompt}>
                      {fixCopied ? <>{Icon.check(14)} Copied</> : <>{Icon.copy(14)} Copy Fix Prompt for Copilot</>}
                    </button>
                    <button type="button" className="tip-link" onClick={() => props.onNavigate('run-in-copilot')}>
                      Reopen Run in Copilot to re-attach the upload files →
                    </button>
                  </div>
                  <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                    Paste the prompt into a fresh Copilot session together with the same two upload files;
                    it lists every violation and asks for a corrected <code>ui-overlay.zip</code>.
                  </p>
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

/** A UI element picked inside the previewed app for an anchored review comment. */
export type PickedTarget = { selector: string; text: string; view: string; route: string }

export function VerifyReviewView(props: StepProps) {
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Checks run automatically. Navigate the preview and comment on components as you review.' })
  const [results, setResults] = useState<VerificationResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(props.run.currentStep === 'complete')
  const [reviewPacket, setReviewPacket] = useState<{ path: string; text: string; uploadFiles: string[]; contactSheetPath?: string } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [launchConfigOpen, setLaunchConfigOpen] = useState(false)
  const [preview, setPreview] = useState<{ status: 'idle' | 'starting' | 'ready' | 'error'; url?: string; message?: string }>({ status: 'idle' })
  const previewStarted = useRef(false)
  const checksStarted = useRef(false)
  const [notes, setNotes] = useState('')
  const [checksOpen, setChecksOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [composer, setComposer] = useState<PickedTarget | null>(null)
  const [commentText, setCommentText] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [picking, setPicking] = useState(false)

  // The app under construction previews by default: start (and rebuild) it
  // in the background on arrival, without opening the system browser.
  const startPreview = async () => {
    setPreview({ status: 'starting' })
    try {
      const result = await props.bridge.launchApp(props.project.id, { open: false })
      setPreview({ status: 'ready', url: result.url })
    } catch (error) {
      setPreview({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  useEffect(() => {
    if (!props.project.launchUrl || previewStarted.current) return
    previewStarted.current = true
    void startPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.project.id, props.project.launchUrl])

  // Review notes (manual and component-anchored) live in user-review-notes.md;
  // the toolbar chip and the notes dialog render its parsed entries.
  const loadNotes = async () => {
    try {
      setNotes(await props.bridge.getArtifactText(props.run.id, 'user-review-notes.md'))
    } catch {
      setNotes('')
    }
  }

  useEffect(() => {
    void loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.run.id])

  // Rehydrate stored verification results so revisiting the step (or
  // relaunching the app) doesn't pretend checks never ran.
  useEffect(() => {
    const paths = props.run.verificationResultPaths ?? []
    if (paths.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const restored: VerificationResult[] = []
        for (const p of paths) {
          const fileName = p.split(/[\\/]/).pop()
          if (!fileName) continue
          restored.push(JSON.parse(await props.bridge.getArtifactText(props.run.id, fileName)) as VerificationResult)
        }
        if (cancelled || restored.length === 0) return
        setResults(restored)
        const restoredFailed = restored.filter((r) => r.status !== 'passed').length
        const last = restored[restored.length - 1]
        if (last) setLastRunAt(new Date(last.endedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))
        setStatus(restoredFailed === 0
          ? { tone: 'success', text: 'All checks passed. Your repository builds and typechecks.' }
          : { tone: 'error', text: `${restoredFailed} of ${restored.length} checks failed on the last run. Re-run after the next overlay.` })
      } catch { /* artifacts pruned — user can re-run */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.run.id])

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

  // Health checks run autonomously on arrival; applyOverlay invalidates the
  // stored results, so an empty result set always means "this overlay is
  // unverified" and triggers a fresh run.
  useEffect(() => {
    if (checksStarted.current) return
    if ((props.run.verificationResultPaths ?? []).length > 0) return
    checksStarted.current = true
    void runChecks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.run.id])

  const saveManualNote = async () => {
    if (!noteDraft.trim()) {
      setStatus({ tone: 'error', text: 'Note is empty — write something before saving.' })
      return
    }
    try {
      await props.bridge.saveFeedback(props.run.id, noteDraft.trim())
      setNoteDraft('')
      await props.refreshRun()
      await loadNotes()
      setStatus({ tone: 'success', text: 'Note saved to user-review-notes.md.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const saveComponentComment = async () => {
    if (!composer || !commentText.trim()) return
    const t = composer
    const header = `**Component comment** — \`${t.selector}\`${t.text ? ` ("${t.text}")` : ''} — ${t.route}${t.view ? ` · ${t.view}` : ''}`
    try {
      await props.bridge.saveFeedback(props.run.id, `${header}\n\n${commentText.trim()}`)
      setComposer(null)
      setCommentText('')
      await props.refreshRun()
      await loadNotes()
      setStatus({ tone: 'success', text: 'Component comment saved — it will anchor the next task packet.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const generateReviewPacket = async () => {
    try {
      const result = await props.bridge.buildReviewPacket(props.run.id)
      await props.refreshRun()
      setReviewPacket({
        path: result.reviewPacketPath,
        text: result.reviewPacketText,
        uploadFiles: result.uploadFiles,
        ...(result.contactSheetPath ? { contactSheetPath: result.contactSheetPath } : {}),
      })
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
  const feedbackEntries = parseFeedbackEntries(notes)

  return (
    <>
      <PageHeader
        title="Verify & Review"
        subtitle="Navigate the app in the preview, comment on components, and generate the follow-on packet."
        crumbs={[
          { label: 'Copilot Handoff', onClick: () => props.onNavigate('copilot-handoff') },
          { label: props.project.name },
        ]}
        onBack={() => props.onNavigate('apply-zip-overlay')}
      />
      <Stepper run={props.run} />
      <GuideLink topic="verify-review" onOpenGuide={props.onOpenGuide} />

      <section className="panel" aria-labelledby="review-cockpit-heading">
        <h2 id="review-cockpit-heading" className="sr-only">Review cockpit</h2>
        <div className="hstack between review-toolbar">
          <div className="hstack" style={{ gap: 'var(--semantic-spacing-2)' }}>
            <button
              type="button"
              className={`review-chip ${busy ? 'review-chip-busy' : results ? (failed === 0 ? 'review-chip-ok' : 'review-chip-fail') : ''}`}
              onClick={() => setChecksOpen(true)}
            >
              <span className="status-dot" aria-hidden="true" />
              {busy
                ? 'Checks · running…'
                : results
                  ? failed === 0 ? `Checks · ${passed}/${results.length} passed` : `Checks · ${failed} failed`
                  : 'Checks · not run'}
            </button>
            <button type="button" className="review-chip" onClick={() => setCommentsOpen(true)}>
              {Icon.pencil(13)} Notes · {feedbackEntries.length}
            </button>
            <button type="button" className="review-chip" onClick={() => setEvidenceOpen(true)}>
              {Icon.layers(13)} Evidence
            </button>
          </div>
          <span className="hstack">
            <button type="button" className="btn btn-secondary btn-compact" onClick={generateReviewPacket}>
              {Icon.sparkle(14)} Review Packet
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onNavigate('create-task-packet')}>
              {Icon.doc(14)} New Task Packet
            </button>
            <button
              type="button"
              className="btn btn-primary btn-compact"
              disabled={!results || failed > 0 || completed}
              onClick={approve}
            >
              {Icon.check(14)} {completed ? 'Handoff Complete' : 'Approve & Complete'}
            </button>
          </span>
        </div>

        {props.project.launchUrl ? (
          preview.status !== 'idle' && (
            <AppPreview
              state={preview}
              obscured={checksOpen || commentsOpen || evidenceOpen || reviewOpen || launchConfigOpen || Boolean(composer)}
              picking={picking}
              onPickStart={() => setPicking(true)}
              onPicked={(target) => {
                setPicking(false)
                if (target) {
                  setCommentText('')
                  setComposer(target)
                }
              }}
              onRetry={() => void startPreview()}
              onOpenExternal={() => { if (preview.url) void props.bridge.openExternal(preview.url) }}
            />
          )
        ) : (
          <div className="inset">
            <h3 className="iteration-step-title">Set up the app preview</h3>
            <p className="secondary-text">
              No launch URL yet. For a new app, set one (e.g. <code>http://127.0.0.1:5410</code> with a launch
              command like <code>npm start</code>) and the app will preview here automatically.
            </p>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => setLaunchConfigOpen(true)}>
              {Icon.gear(14)} Set launch URL…
            </button>
          </div>
        )}
      </section>

      <StatusLine status={status} />

      <div className="hstack between">
        <button type="button" className="btn btn-secondary" onClick={() => props.onNavigate('apply-zip-overlay')}>
          Back
        </button>
      </div>

      {checksOpen && (
        <Dialog
          title="Health checks"
          onClose={() => setChecksOpen(false)}
          wide
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={runChecks} disabled={busy}>
                {busy ? 'Running…' : <>{Icon.refresh(14)} Re-run checks</>}
              </button>
              {results?.some((r) => r.combinedOutputPath) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const withLog = results.find((r) => r.combinedOutputPath)
                    if (withLog?.combinedOutputPath) void props.bridge.showInFolder(withLog.combinedOutputPath)
                  }}
                >
                  {Icon.external(14)} View full test report
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setChecksOpen(false)}>
                Close
              </button>
            </>
          }
        >
          <p className="secondary-text" style={{ marginTop: 0 }}>
            Verification runs automatically when you arrive at this step; applying a new overlay invalidates the
            results and triggers a fresh run.
            {lastRunAt && <span className="muted"> Last run: Today at {lastRunAt}.</span>}
          </p>
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
          {results ? (
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
          ) : (
            <p className="muted" style={{ margin: 0 }}>{busy ? 'Running verification commands…' : 'No results recorded yet.'}</p>
          )}
        </Dialog>
      )}

      {commentsOpen && (
        <Dialog
          title="Review notes"
          onClose={() => setCommentsOpen(false)}
          wide
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setCommentsOpen(false)}>
              Close
            </button>
          }
        >
          <div className="field">
            <label htmlFor="review-note">Add a general note</label>
            <textarea
              id="review-note"
              rows={3}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <div className="hstack">
              <button type="button" className="btn btn-secondary btn-compact" onClick={saveManualNote}>
                {Icon.pencil(14)} Save Note
              </button>
            </div>
          </div>
          {feedbackEntries.length === 0 ? (
            <p className="secondary-text" style={{ margin: 0 }}>
              No notes yet. Use <strong>Comment</strong> in the preview to anchor feedback to a specific component,
              or add a general note above.
            </p>
          ) : (
            <ul className="row-list" style={{ gap: 10 }}>
              {[...feedbackEntries].reverse().map((entry) => (
                <li key={entry.at} style={{ borderBottom: '1px solid var(--semantic-border-subtle)', paddingBottom: 8 }}>
                  <div className="muted num" style={{ fontSize: 12, marginBottom: 2 }}>
                    {new Date(entry.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <Markdown text={entry.text} />
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            Notes append to <code>user-review-notes.md</code> and fold into the next task packet automatically.
          </p>
        </Dialog>
      )}

      {evidenceOpen && (
        <Dialog
          title="Visual evidence"
          onClose={() => setEvidenceOpen(false)}
          wide
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setEvidenceOpen(false)}>
              Close
            </button>
          }
        >
          <EvidenceSection
            bridge={props.bridge}
            run={props.run}
            project={props.project}
            phase="after"
            onNavigate={props.onNavigate}
            frameless
          />
        </Dialog>
      )}

      {composer && (
        <Dialog
          title="Comment on component"
          onClose={() => setComposer(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setComposer(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={!commentText.trim()} onClick={saveComponentComment}>
                Save Comment
              </button>
            </>
          }
        >
          <p className="secondary-text" style={{ marginTop: 0 }}>
            <code>{composer.selector}</code>
            {composer.text && <> — “{composer.text}”</>}
            <br />
            <span className="muted">{composer.route}{composer.view ? ` · ${composer.view}` : ''}</span>
          </p>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="component-comment">What should change?</label>
            <textarea
              id="component-comment"
              rows={4}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
            />
          </div>
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
              {reviewPacket.contactSheetPath && (
                <button type="button" className="btn btn-secondary" onClick={() => props.bridge.showInFolder(reviewPacket.contactSheetPath!)}>
                  Show Evidence PDF
                </button>
              )}
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
            Follow-up upload set (3-file budget):{' '}
            {reviewPacket.uploadFiles.map((f, i) => (
              <span key={f}>{i > 0 && ' + '}<code>{f.split(/[\\/]/).pop()}</code></span>
            ))}
            {reviewPacket.contactSheetPath
              ? ' — includes the before/after visual contact sheet.'
              : ' — no visual evidence captured for this run; capture before/after screenshots to include the contact sheet.'}
          </p>
          <div className="preview-scroll"><Markdown text={reviewPacket.text} /></div>
        </Dialog>
      )}

      {launchConfigOpen && (
        <LaunchUrlDialog
          project={props.project}
          onClose={() => setLaunchConfigOpen(false)}
          onSave={async (url, command, views) => {
            await props.bridge.updateProject(props.project.id, {
              launchUrl: url || undefined,
              launchCommand: command || undefined,
              evidenceViews: views.length > 0 ? views : undefined,
            })
            await props.refreshProjects()
            setLaunchConfigOpen(false)
            setStatus(url
              ? { tone: 'success', text: `Launch URL saved. Click Launch App to open ${props.project.name}.` }
              : { tone: 'info', text: 'Launch settings cleared.' })
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------- Embedded app preview */

/**
 * Injected into the <webview> guest to pick a component for an anchored
 * review comment: hover highlights the element under the cursor with a
 * selector tag; click resolves with the element's identity; Escape cancels.
 * Runs entirely inside the guest (our own generated app) and cleans up after
 * itself — capture-phase listeners keep the click from activating the app.
 */
const PICKER_JS = `new Promise((resolve) => {
  const hl = document.createElement('div');
  hl.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #5478ff;background:rgba(84,120,255,0.14);border-radius:4px;left:0;top:0;width:0;height:0';
  const tag = document.createElement('div');
  tag.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#5478ff;color:#fff;font:600 11px system-ui;padding:2px 8px;border-radius:4px;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  document.body.append(hl, tag);
  let current = null;
  const describe = (el) => {
    const parts = [];
    let node = el;
    for (let i = 0; node && node !== document.body && i < 4; i += 1) {
      let part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(part + '#' + node.id); break; }
      const cls = [...node.classList].slice(0, 2).join('.');
      if (cls) part += '.' + cls;
      const siblings = node.parentElement ? [...node.parentElement.children].filter((c) => c.tagName === node.tagName) : [];
      if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const onMove = (e) => {
    const el = e.target;
    if (!(el instanceof Element) || el === hl || el === tag) return;
    current = el;
    const r = el.getBoundingClientRect();
    hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px';
    hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
    tag.textContent = describe(el);
    tag.style.left = r.left + 'px';
    tag.style.top = (r.top > 26 ? r.top - 24 : r.bottom + 4) + 'px';
  };
  const cleanup = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    hl.remove(); tag.remove();
  };
  const onClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = (e.target instanceof Element ? e.target : current);
    cleanup();
    resolve(el instanceof Element ? {
      selector: describe(el),
      text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
      view: document.title || '',
      route: location.hash || location.pathname,
    } : null);
  };
  const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
})`

/**
 * The app under construction, rendered as the centerpiece of Verify & Review:
 * an Electron <webview> guest pointed at the project's launch URL
 * (browser/mock mode falls back to an iframe). Comment mode injects the
 * picker into the guest so review feedback anchors to real components.
 */
function AppPreview(props: {
  state: { status: 'starting' | 'ready' | 'error' | 'idle'; url?: string; message?: string }
  onRetry: () => void
  onOpenExternal: () => void
  picking?: boolean
  onPickStart?: () => void
  onPicked?: (target: PickedTarget | null) => void
  /**
   * Electron composites the <webview> guest in its own layer, so host DOM
   * stacked above it (dialogs) bleeds through. While a dialog is open the
   * preview hides via visibility — the guest stays alive and layout holds.
   */
  obscured?: boolean
}) {
  const webviewRef = useRef<HTMLWebViewElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const isElectron = typeof window !== 'undefined' && window.euikMode === 'electron'

  const reload = () => {
    // Electron's <webview> exposes reload() at runtime; the DOM type doesn't carry it.
    if (isElectron) (webviewRef.current as unknown as { reload?: () => void } | null)?.reload?.()
    else if (iframeRef.current && props.state.url) iframeRef.current.src = props.state.url
  }

  const pickComponent = async () => {
    const wv = webviewRef.current as unknown as { executeJavaScript?: (code: string) => Promise<unknown> } | null
    if (!wv?.executeJavaScript || !props.onPicked) return
    props.onPickStart?.()
    try {
      props.onPicked((await wv.executeJavaScript(PICKER_JS)) as PickedTarget | null)
    } catch {
      // Guest navigated or reloaded mid-pick — treat as cancelled.
      props.onPicked(null)
    }
  }

  return (
    <div className="app-preview" aria-label="App preview" style={props.obscured ? { visibility: 'hidden' } : undefined}>
      <div className="app-preview-shell">
        <div className="hstack between app-preview-chrome">
          <div className="hstack">
            <span className="overline">App preview</span>
            {props.state.url && <span className="mono app-preview-url">{props.state.url}</span>}
          </div>
          {props.state.status === 'ready' && (
            <span className="hstack">
              {isElectron && props.onPicked && (
                <button
                  type="button"
                  className={`btn btn-compact ${props.picking ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => void pickComponent()}
                  disabled={props.picking}
                  title="Click a component in the preview to comment on it (Esc cancels)"
                >
                  {Icon.target(14)} {props.picking ? 'Click a component…' : 'Comment'}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-compact" onClick={reload}>
                {Icon.refresh(14)} Reload
              </button>
              <button type="button" className="btn btn-secondary btn-compact" onClick={props.onOpenExternal}>
                {Icon.external(14)} Open externally
              </button>
            </span>
          )}
        </div>
        {props.state.status === 'starting' && (
          <div className="app-preview-frame app-preview-waiting" role="status">
            Starting the app (rebuilding if already running)…
          </div>
        )}
        {props.state.status === 'error' && (
          <div className="app-preview-frame app-preview-waiting" role="alert">
            <span>Couldn't start the app: {props.state.message}</span>
            <button type="button" className="btn btn-secondary btn-compact" onClick={props.onRetry}>Retry</button>
          </div>
        )}
        {props.state.status === 'ready' && props.state.url && (
          isElectron
            ? <webview ref={webviewRef} className="app-preview-frame" src={props.state.url} />
            : <iframe ref={iframeRef} className="app-preview-frame" src={props.state.url} title="App preview" />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- Visual evidence */

/**
 * Per-run screenshot evidence (R1): baseline capture on Prepare Context,
 * before/after pairs with rendered element-loss badges on Verify & Review.
 */
export function EvidenceSection(props: {
  bridge: EuikBridge
  run: HandoffRun
  project: Project
  phase: 'before' | 'after'
  onNavigate: (view: ViewId) => void
  /** Render without the panel frame — for embedding inside a dialog. */
  frameless?: boolean
}) {
  const [evidence, setEvidence] = useState<RunEvidence | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Status | null>(null)
  const configuredViews = props.project.evidenceViews?.length ?? 0
  const configured = configuredViews > 0 && Boolean(props.project.launchUrl)

  useEffect(() => {
    let cancelled = false
    props.bridge.getEvidence(props.run.id)
      .then((loaded) => { if (!cancelled) setEvidence(loaded) })
      .catch(() => { /* no captures yet */ })
    return () => { cancelled = true }
  }, [props.bridge, props.run.id])

  const capture = async () => {
    setBusy(true)
    setNote({ tone: 'info', text: `Capturing ${props.phase === 'before' ? 'baseline' : 'post-apply'} screenshots…` })
    try {
      const result = await props.bridge.captureEvidence(props.run.id, props.phase)
      setEvidence(await props.bridge.getEvidence(props.run.id))
      setNote(result.ok
        ? { tone: 'success', text: `${result.views.length} view${result.views.length === 1 ? '' : 's'} captured with rendered element census.` }
        : { tone: 'error', text: 'Some views failed to capture — check that the target app is running at the launch URL.' })
    } catch (error) {
      setNote({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const hasCapture = props.phase === 'before' ? Boolean(evidence?.before) : Boolean(evidence?.after)
  const views = evidence?.views ?? []

  return (
    <section className={props.frameless ? undefined : 'panel'} aria-labelledby={`evidence-${props.phase}-heading`}>
      <div className="hstack between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 id={`evidence-${props.phase}-heading`} className={props.frameless ? 'sr-only' : undefined}>
            {props.phase === 'before' ? 'Baseline evidence' : 'Visual evidence — before / after'}
          </h2>
          <p className="panel-desc" style={{ marginBottom: 0 }}>
            {props.phase === 'before'
              ? 'Screenshots and a rendered element census of each target view, captured before any change. The review packet compares against these. Building a new UI from requirements? Skip this — there is no baseline for a green-field build.'
              : 'The same views after applying the overlay. Lost elements (icons, images, buttons, inputs) are flagged per view.'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-compact" onClick={capture} disabled={busy || !configured}>
          {busy ? 'Capturing…' : hasCapture
            ? <>{Icon.refresh(14)} Re-capture</>
            : <>{Icon.play(14)} Capture {props.phase === 'before' ? 'Baseline' : 'After'}</>}
        </button>
      </div>

      {!configured && (
        <p className="muted" style={{ margin: 'var(--semantic-spacing-3) 0 0', fontSize: 13 }}>
          {configuredViews === 0 ? 'No target views configured for this project. ' : 'No launch URL configured for this project. '}
          <button type="button" className="tip-link" onClick={() => props.onNavigate('projects')}>
            Configure in Projects →
          </button>
        </p>
      )}

      {configured && views.length === 0 && (
        <p className="muted" style={{ margin: 'var(--semantic-spacing-3) 0 0', fontSize: 13 }}>
          No captures yet for this run. {configuredViews} view{configuredViews === 1 ? '' : 's'} configured:{' '}
          {props.project.evidenceViews!.map((v) => v.label).join(', ')}. Make sure the target app is running at{' '}
          <code>{props.project.launchUrl}</code>, then capture.
        </p>
      )}

      {views.length > 0 && (
        <ul className="evidence-grid">
          {views.map((view) => (
            <li key={view.viewId} className="evidence-view">
              <div className="hstack between" style={{ minHeight: 26 }}>
                <strong style={{ fontSize: 14 }}>
                  {view.label} <code>{view.path}</code>
                </strong>
                {view.losses.length > 0 ? (
                  <span className="status status-danger">
                    <span className="status-dot" aria-hidden="true" />{' '}
                    lost: {view.losses.map((l) => `${l.element} ${l.before}→${l.after}`).join(', ')}
                  </span>
                ) : (props.phase === 'after' && view.beforeShot && view.afterShot && (
                  <span className="status status-ok">
                    <span className="status-dot" aria-hidden="true" /> no element loss
                  </span>
                ))}
              </div>
              <div className={props.phase === 'after' ? 'evidence-pair' : 'evidence-single'}>
                <EvidenceShot
                  label="Before"
                  src={view.beforeShot}
                  error={view.beforeError}
                  {...(props.phase === 'after' && !view.beforeShot && !view.beforeError
                    ? { missingLabel: 'No baseline — this run builds a new UI, so there was nothing to capture before.' }
                    : {})}
                />
                {props.phase === 'after' && <EvidenceShot label="After" src={view.afterShot} error={view.afterError} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {note && <div style={{ marginTop: 'var(--semantic-spacing-3)' }}><StatusLine status={note} /></div>}
    </section>
  )
}

function EvidenceShot(props: { label: string; src?: string; error?: string; missingLabel?: string }) {
  return (
    <figure className="evidence-shot">
      <figcaption className="overline">{props.label}</figcaption>
      {props.src
        ? <img src={props.src} alt={`${props.label} screenshot`} />
        : <div className="evidence-missing">{props.error ? `Capture failed: ${props.error}` : props.missingLabel ?? 'Not captured yet'}</div>}
    </figure>
  )
}
