/**
 * Shared helpers and components used by the Copilot-handoff workflow views
 * and the consolidated Build view. Extracted from workflow.tsx so both the
 * legacy full-page steps and Build can reuse the same bridge-facing logic.
 */

import { useState, type ReactElement } from 'react'
import type {
  HandoffRun,
  OverlayInspectionSummary,
  Project,
  VerificationResult,
} from '@engineering-ui-kit/core'
import type { EuikBridge, RunEvidence } from '../bridge'
import { Dialog, StatusLine, type Status } from '../components'
import { Markdown } from '../markdown'
import { Icon } from '../icons'
import type { TaskPacketFields } from '../bridge'
import type { ViewId } from '../appState'
import type { GuideTopicId } from '../guides'
import { useEffect } from 'react'

export type StepProps = {
  bridge: EuikBridge
  project: Project
  run: HandoffRun
  refreshRun: () => Promise<void>
  refreshProjects: () => Promise<void>
  onNavigate: (view: ViewId) => void
  onOpenGuide: (topic: GuideTopicId) => void
}

/** Small right-aligned entry point to the illustrated guide for this step. */
export function GuideLink(props: { topic: GuideTopicId; onOpenGuide: (topic: GuideTopicId) => void }) {
  return (
    <div className="guide-link-row">
      <button type="button" className="tip-link" onClick={() => props.onOpenGuide(props.topic)}>
        How this step works →
      </button>
    </div>
  )
}

export const READY: Status = { tone: 'info', text: 'Ready.' }
export const COPILOT_URL = 'https://m365.cloud.microsoft/chat'

export function durationLabel(results: VerificationResult[]): string {
  const totalMs = results.reduce((sum, r) => sum + (new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()), 0)
  const seconds = Math.max(1, Math.round(totalMs / 1000))
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export async function copyText(text: string): Promise<boolean> {
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

export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export const INCLUDE_ROWS: { icon: ReactElement; title: string; body: string }[] = [
  { icon: Icon.code(15), title: 'Source code', body: 'All application source files' },
  { icon: Icon.gear(15), title: 'Configuration', body: 'Package files, configs, build scripts' },
  { icon: Icon.layers(15), title: 'Assets', body: 'Public assets, styles, resources (text only)' },
  { icon: Icon.doc(15), title: 'Documentation', body: 'README, docs, specs (if relevant)' },
]

export const EXCLUDED_CATEGORIES = [
  'Git metadata (.git/)',
  'Dependencies (node_modules/) and lockfiles',
  'Build output (dist/, build/, coverage/) and caches',
  'Binaries, images, fonts, and archives',
  'Environment files, keys, certificates, and credential-named files',
]

export const PACKET_SECTIONS: {
  key: keyof TaskPacketFields
  title: string
  description: string
  icon: ReactElement
  rows: number
  required?: boolean
}[] = [
  { key: 'goal', title: 'Goal', description: 'What you want to achieve', icon: Icon.target(15), rows: 3, required: true },
  { key: 'scope', title: 'Scope', description: 'Screens, features, or areas in scope (one per line)', icon: Icon.box(15), rows: 3, required: true },
  { key: 'constraints', title: 'Constraints', description: 'What not to change, technical limits, etc. (one per line)', icon: Icon.alertTriangle(15), rows: 3, required: true },
  { key: 'acceptanceCriteria', title: 'Acceptance Criteria', description: 'How success will be measured (one per line)', icon: Icon.listChecks(15), rows: 4, required: true },
  { key: 'references', title: 'References', description: 'Optional specs, designs, screenshots, or examples', icon: Icon.link(15), rows: 2 },
]

export function draftPacketMarkdown(fields: TaskPacketFields): string {
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

/** PRD §13.4 — defaults to rendered Preview; secondary Code tab; Copy/Download/Close. */
export function TaskPacketPreviewModal(props: { text: string; onClose: () => void }) {
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

export type TreeNode = { name: string; children: Map<string, TreeNode>; isFile: boolean }

export function buildTree(paths: string[]): TreeNode {
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

export function TreeView(props: { node: TreeNode; depth?: number }) {
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
 * the inspector found and restates the packaging contract.
 */
export function buildBlockerFixPrompt(summary: OverlayInspectionSummary): string {
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
