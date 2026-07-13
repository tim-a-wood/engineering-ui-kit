/**
 * Overlay workspace tab — full Apply Zip Overlay capabilities.
 */

import { useState } from 'react'
import { Icon } from '../../icons'
import { StatusLine } from '../../components'
import { buildBlockerFixPrompt, buildTree, copyText, formatBytes, TreeView } from '../workflowShared'
import type { BuildWorkspaceProps } from './buildTypes'

export function OverlayWorkspace(props: BuildWorkspaceProps) {
  const [fixCopied, setFixCopied] = useState(false)
  const inspection = props.inspection
  const applied = props.applied

  const canApply = Boolean(
    inspection?.canApply && (inspection.warnings.length === 0 || props.warningsAccepted) && !applied,
  )
  const filePaths = inspection?.normalizedEntries.filter((e) => !e.isDirectory).map((e) => e.normalizedRelativePath) ?? []

  const copyFixPrompt = async () => {
    if (!inspection) return
    const ok = await copyText(buildBlockerFixPrompt(inspection))
    setFixCopied(ok)
    props.setStatus(ok
      ? { tone: 'success', text: 'Fix prompt copied — start a fresh Copilot session, re-attach the two upload files, and paste.' }
      : { tone: 'error', text: 'Could not copy automatically — select the blocker list and copy manually.' })
    window.setTimeout(() => setFixCopied(false), 2500)
  }

  return (
    <div className="workspace-panel">
      <div className="handoff-help handoff-help-single" aria-label="How to apply the Copilot result">
        <div><span className="handoff-help-number">3</span><p><strong>Return with the result</strong><small>Download ui-overlay.zip and drop it into the apply area below.</small></p></div>
      </div>

      <section aria-labelledby="overlay-source-heading">
        <div className="overlay-source-head">
          <div>
            <h3 id="overlay-source-heading">Result zip</h3>
            <p className="panel-desc path-wrap" style={{ marginBottom: 0 }}>
              {props.run.overlayZipPath ? <code className="path-wrap">{props.run.overlayZipPath}</code> : 'No overlay selected yet.'}
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-compact" onClick={props.onPickAndInspect} disabled={props.overlayBusy}>
            {inspection ? 'Select different zip…' : 'Select ui-overlay.zip…'}
          </button>
        </div>
        <div
          className="file-drop-zone overlay-drop-zone"
          role="button"
          tabIndex={0}
          onClick={props.onPickAndInspect}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onPickAndInspect() } }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) void props.onInspectOverlayPath(props.bridge.getDroppedFilePath(file))
          }}
        >
          <span className="file-drop-icon" aria-hidden="true">⇩</span>
          <strong>Drop ui-overlay.zip here</strong>
          <small>or click to browse; the zip is checked before changes can be applied</small>
        </div>
      </section>

      {inspection && (
        <section aria-labelledby="inspection-heading" style={{ marginTop: 14 }}>
          <div className="hstack between">
            <h3 id="inspection-heading">Inspection result</h3>
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
                    <td className="mono path-wrap">{entry.normalizedRelativePath}</td>
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
                  <li key={i}><code>{b.ruleId}</code> {b.path ? <code className="path-wrap">{b.path}</code> : null} — {b.message}</li>
                ))}
              </ul>
              <div className="hstack" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-compact" onClick={copyFixPrompt}>
                  {fixCopied ? <>{Icon.check(14)} Copied</> : <>{Icon.copy(14)} Copy Fix Prompt for Copilot</>}
                </button>
                <button type="button" className="tip-link" onClick={() => props.setWorkspace('copilot')}>
                  Reopen Copilot to re-attach the upload files →
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
                    <code>{w.ruleId}</code> {w.path ? <code className="path-wrap">{w.path}</code> : null} — {w.message}
                  </li>
                ))}
              </ul>
              <label className="hstack" style={{ marginTop: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={props.warningsAccepted}
                  onChange={(e) => props.setWarningsAccepted(e.target.checked)}
                />
                I reviewed every warning and accept the overwrites listed above.
              </label>
            </div>
          )}
        </section>
      )}

      <details className="build-supplementary" style={{ marginTop: 14 }}>
        <summary id="zip-contents-heading">Zip contents</summary>
        {filePaths.length > 0 ? (
          <TreeView node={buildTree(filePaths)} />
        ) : (
          <p className="secondary-text">Select an overlay to preview its file tree.</p>
        )}
      </details>

      {applied && (
        <section aria-labelledby="applied-heading" style={{ marginTop: 14 }}>
          <h3 id="applied-heading">Applied files</h3>
          <ul className="row-list">
            {applied.files.map((f) => (
              <li key={f.relativePath} className="hstack between" style={{ padding: '4px 0' }}>
                <code className="path-wrap">{f.relativePath}</code>
                <span className={`status ${f.action === 'created' ? 'status-ok' : f.action === 'overwritten' ? 'status-info' : 'status-neutral'}`}>
                  <span className="status-dot" aria-hidden="true" /> {f.action}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <StatusLine status={props.status} />

      <div className="workspace-actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={props.onApplyOverlay} disabled={!canApply || props.overlayBusy}>
          Apply changes
        </button>
      </div>
      {!canApply && !applied && (
        <p className="workspace-hint muted">
          {inspection && !inspection.canApply
            ? 'Blocked overlays can never be applied.'
            : 'Apply changes becomes available after the zip passes inspection.'}
        </p>
      )}
    </div>
  )
}
