import { useState } from 'react'
import type { Settings } from '@engineering-ui-kit/core'
import { stePolicyNotice } from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../bridge'
import { PageHeader, StatusLine, Toggle, type Status } from '../components'
import { Icon } from '../icons'
import { TASK_TEMPLATES, defaultTemplateId } from '../taskTemplates'

export function SettingsView(props: {
  bridge: EuikBridge
  settings: Settings
  onSaved: (settings: Settings) => void
  onBack: () => void
}) {
  const [draft, setDraft] = useState<Settings>({ ...props.settings })
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Manage workspace and workflow preferences.' })

  const save = async (panel?: string) => {
    try {
      await props.bridge.saveSettings(draft)
      props.onSaved(draft)
      setStatus({ tone: 'success', text: panel ? `${panel} settings saved.` : 'Settings saved.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  // Pinned to the panel foot (RCP-DASH-001) so sibling panels' actions align.
  const SaveButton = (props2: { panel: string }) => (
    <div className="panel-actions">
      <button type="button" className="btn btn-secondary btn-compact" onClick={() => save(props2.panel)}>
        {Icon.doc(14)} Save changes
      </button>
    </div>
  )

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage workspace and workflow preferences." onBack={props.onBack} />
      {/* per-panel Save changes buttons per mockup D7DC446E */}

      <div className="grid-2">
        <section className="panel" aria-labelledby="ws-heading">
          <h2 id="ws-heading">Workspace settings</h2>
          <p className="panel-desc">Configure default paths and templates for this workspace.</p>
          <div className="field">
            <label htmlFor="s-project-folder">Default project folder</label>
            <div className="field-row">
              <input id="s-project-folder" type="text" value={draft.defaultProjectFolder} onChange={(e) => set('defaultProjectFolder', e.target.value)} />
              <button type="button" className="btn btn-secondary btn-compact" onClick={async () => {
                const picked = await props.bridge.pickDirectory()
                if (picked) set('defaultProjectFolder', picked)
              }}>Browse</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="s-output-folder">Default output folder</label>
            <div className="field-row">
              <input id="s-output-folder" type="text" value={draft.defaultOutputFolder} onChange={(e) => set('defaultOutputFolder', e.target.value)} />
              <button type="button" className="btn btn-secondary btn-compact" onClick={async () => {
                const picked = await props.bridge.pickDirectory()
                if (picked) set('defaultOutputFolder', picked)
              }}>Browse</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="s-template">Preferred template</label>
            <select
              id="s-template"
              className="select-control"
              value={defaultTemplateId(draft.preferredTemplate)}
              onChange={(e) => {
                const template = TASK_TEMPLATES.find((t) => t.id === e.target.value)
                if (template) set('preferredTemplate', template.title)
              }}
              aria-describedby="s-template-note"
            >
              {TASK_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <p className="muted" id="s-template-note" style={{ margin: 0, fontSize: 12 }}>
              The Create Task Packet template picker preselects this template.
            </p>
          </div>
          <SaveButton panel="Workspace" />
        </section>

        <section className="panel" aria-labelledby="handoff-heading">
          <h2 id="handoff-heading">Copilot handoff defaults</h2>
          <p className="panel-desc">Set defaults for creating Copilot handoff task packets.</p>
          <div className="field">
            <label htmlFor="s-max-uploads">Maximum uploads</label>
            <input id="s-max-uploads" type="text" value="3" readOnly aria-describedby="s-max-uploads-note" />
            <p className="muted" id="s-max-uploads-note" style={{ margin: 0, fontSize: 12 }}>
              Fixed by the strict Microsoft 365 Copilot three-file budget.
            </p>
          </div>
          <Toggle label="Include screenshots" checked={draft.includeScreenshotsByDefault} onChange={(v) => set('includeScreenshotsByDefault', v)} />
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="s-packet-format">Preferred packet format</label>
            <select id="s-packet-format" className="select-control" disabled aria-describedby="s-packet-format-note">
              <option>Markdown (.md)</option>
            </select>
            <p className="muted" id="s-packet-format-note" style={{ margin: 0, fontSize: 12 }}>v0.1 packets are Markdown.</p>
          </div>
          <SaveButton panel="Copilot handoff" />
        </section>

        <section className="panel" aria-labelledby="review-heading">
          <h2 id="review-heading">Review defaults</h2>
          <p className="panel-desc">Set defaults for verifying and reviewing changes.</p>
          <Toggle label="Include test results" checked={draft.includeBuildTestResultsByDefault} onChange={(v) => set('includeBuildTestResultsByDefault', v)} />
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="s-timeout">Command timeout (minutes)</label>
            <input
              id="s-timeout"
              type="text"
              inputMode="numeric"
              value={String(draft.defaultCommandTimeoutMinutes)}
              onChange={(e) => {
                const parsed = Number(e.target.value)
                if (Number.isFinite(parsed) && parsed > 0) set('defaultCommandTimeoutMinutes', parsed)
              }}
            />
          </div>
          <SaveButton panel="Review & verification" />
        </section>

        <section className="panel settings-writing-standard" aria-labelledby="writing-heading">
          <div className="settings-policy-heading">
            <h2 id="writing-heading">Writing standard</h2>
            <span className="badge badge-success">Required</span>
          </div>
          <p className="panel-desc">{stePolicyNotice()}</p>
          <ul className="settings-policy-list">
            <li>Use concise labels, direct instructions, and consistent technical terms.</li>
            <li>Apply the profile to interface text, diagrams, design documents, and module descriptions.</li>
            <li>Built-in AI prompts require the same profile for all human-facing output.</li>
          </ul>
          <p className="muted settings-policy-note">
            Project terms can extend this profile. They cannot replace or weaken it.
          </p>
        </section>

        <section className="panel" aria-labelledby="safety-heading">
          <h2 id="safety-heading">Safety</h2>
          <p className="panel-desc">Configure safety and confirmation preferences.</p>
          <Toggle label="Require review" checked={draft.requireManualReviewBeforeApply} onChange={(v) => set('requireManualReviewBeforeApply', v)} />
          <Toggle label="Confirm file overwrite" checked={draft.confirmOverwriteExistingFiles} onChange={(v) => set('confirmOverwriteExistingFiles', v)} />
          <Toggle label="Dirty repository warning" checked={draft.warnOnDirtyRepo} onChange={(v) => set('warnOnDirtyRepo', v)} />
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="s-warn-files">File warning limit</label>
            <input
              id="s-warn-files"
              type="text"
              inputMode="numeric"
              value={String(draft.warnWhenOverlayChangesMoreThanFiles)}
              onChange={(e) => {
                const parsed = Number(e.target.value)
                if (Number.isFinite(parsed) && parsed > 0) set('warnWhenOverlayChangesMoreThanFiles', parsed)
              }}
            />
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              The application warns you when an overlay changes more files than this limit.
            </p>
          </div>
          <SaveButton panel="Safety" />
        </section>
      </div>

      <StatusLine status={status} />

      <div className="info-banner">
        <span aria-hidden="true">{Icon.info(14)}</span>
        These settings apply to the current workspace. Team or organization policies may override some settings. They
        are stored in the app-managed workspace, never in your repos.
      </div>
    </>
  )
}
