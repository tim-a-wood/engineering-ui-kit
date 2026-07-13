/**
 * Copilot workspace tab — full Run in Copilot capabilities.
 */

import { useState } from 'react'
import { Icon } from '../../icons'
import { StatusLine } from '../../components'
import { COPILOT_URL, copyText, formatBytes } from '../workflowShared'
import type { BuildWorkspaceProps } from './buildTypes'

export function CopilotWorkspace(props: BuildWorkspaceProps) {
  const [copied, setCopied] = useState(false)
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
    props.setStatus(ok
      ? { tone: 'success', text: 'Recommended prompt copied to the clipboard.' }
      : { tone: 'error', text: 'Could not copy automatically — select the prompt text below and copy manually.' })
    window.setTimeout(() => setCopied(false), 2500)
  }

  const openCopilot = async () => {
    const ok = await copyText(await getPrompt())
    await props.bridge.openExternal(COPILOT_URL)
    props.setStatus(ok
      ? { tone: 'success', text: 'Copilot opened — the prompt is on your clipboard; attach the files, then paste.' }
      : { tone: 'info', text: 'Copilot opened. Copy the prompt below, attach the files, then paste.' })
  }

  const dragFiles = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    props.bridge.startUploadDrag(run.id).catch((error: unknown) => {
      props.setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    })
  }

  const copyFiles = async () => {
    try {
      const result = await props.bridge.copyUploadSet(run.id)
      props.setStatus({ tone: 'success', text: `${result.files} file${result.files === 1 ? '' : 's'} on the clipboard — paste (Ctrl/Cmd+V) into the Copilot chat.` })
    } catch (error) {
      props.setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const showFiles = async () => {
    const target = props.packet?.taskPacketPath ?? run.taskPacketPath ?? run.repoFlatfilePath
    if (target) await props.bridge.showInFolder(target)
  }

  return (
    <div className="workspace-panel">
      <div className="workspace-phase-header">
        <div>
          <p className="workspace-phase">Phase 2 of 3</p>
          <h3>Run in Copilot</h3>
          <p className="panel-desc">Transfer the prepared files and prompt, then return with the generated overlay.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCopilot}>
          {Icon.external(14)} Open Copilot
        </button>
      </div>

      <div className="workspace-split">
      <section className="workspace-primary-card" aria-labelledby="upload-heading">
        <h3 id="upload-heading">Upload (max 3 files)</h3>
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
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.setWorkspace('handoff')}>
              {Icon.refresh(14)} Replace files
            </button>
            <span className="status status-ok">
              <span className="status-dot" aria-hidden="true" /> <span className="num">{files.length} of 3 upload slots used</span>
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
        <div className="hstack" style={{ marginTop: 'var(--semantic-spacing-3)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-compact" onClick={copyFiles}>
            {Icon.copy(14)} Copy Files
          </button>
          <button type="button" className="btn btn-secondary btn-compact" onClick={showFiles}>
            {Icon.folder(15)} Show Files in Folder
          </button>
        </div>
      </section>

      <aside className="workspace-support-card" aria-labelledby="request-heading">
        <div className="hstack between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 id="request-heading">Request to Copilot</h3>
            <p className="panel-desc" style={{ marginBottom: 0 }}>Ask Copilot to generate a zip overlay of changed/new files only.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={copyPrompt}>
            {copied ? <>{Icon.check(14)} Copied</> : <>{Icon.copy(14)} Copy Recommended Prompt</>}
          </button>
        </div>
        {props.packet && <pre className="pre path-wrap workspace-prompt">{props.packet.recommendedPrompt}</pre>}

        <div className="info-banner info-accent" style={{ marginTop: 12 }}>
          <span aria-hidden="true">{Icon.info(14)}</span>
          Expected output: a .zip containing only changed and new files.
        </div>

        <StatusLine status={props.status} />

        <div className="workspace-actions workspace-actions-stack" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => props.setWorkspace('overlay')}>
            I have the overlay →
          </button>
          <span className="muted" style={{ fontSize: 12 }}>Continue after Copilot returns ui-overlay.zip</span>
        </div>
      </aside>
      </div>
    </div>
  )
}
