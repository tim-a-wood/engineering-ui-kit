/**
 * Handoff workspace — transfer ready files to Copilot and apply utilities.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { StatusLine } from '../../components'
import { COPILOT_URL, copyText, downloadText, formatBytes } from '../workflowShared'
import type { BuildWorkspaceProps } from './buildTypes'

const FALLBACK_PROMPT = 'Inspect all uploaded files, follow the task packet and standard pack exactly, and return only ui-overlay.zip containing changed and new files with repo-relative paths.'

function promptInline(text: string): ReactNode {
  return text.split(/(`[^`]+`)/g).map((part, index) => (
    part.startsWith('`') && part.endsWith('`')
      ? <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      : part
  ))
}

function PromptPreview({ text }: { text: string }) {
  return (
    <div className="handoff-prompt-body" role="textbox" aria-label="Recommended prompt preview" tabIndex={0}>
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <span className="handoff-prompt-space" key={`space-${index}`} />
        if (trimmed.endsWith(':')) return <h4 key={`${line}-${index}`}>{trimmed}</h4>
        if (/^\d+\.\s/.test(trimmed)) {
          const [number, ...rest] = trimmed.split(/\s+/)
          return <div className="handoff-prompt-item" key={`${line}-${index}`}><span>{number}</span><p>{promptInline(rest.join(' '))}</p></div>
        }
        if (trimmed.startsWith('- ')) {
          return <div className="handoff-prompt-item requirement" key={`${line}-${index}`}><span>✓</span><p>{promptInline(trimmed.slice(2))}</p></div>
        }
        return <p className={index === 0 ? 'handoff-prompt-lead' : undefined} key={`${line}-${index}`}>{promptInline(trimmed)}</p>
      })}
    </div>
  )
}

export function HandoffWorkspace(props: BuildWorkspaceProps) {
  const run = props.run
  const hasContext = Boolean(props.contextResult || run.repoFlatfilePath)
  const hasPacket = Boolean(props.packet || run.taskPacketPath || run.taskAndStandardPackPath)
  const contextReady = hasContext && !props.contextStale
  const packetReady = hasPacket && !props.packetStale && !props.contextStale
  const [promptText, setPromptText] = useState('')

  const baseFiles = props.packet?.uploadFiles ?? (run.taskAndStandardPackPath
    ? [
        ...(run.repoFlatfilePath ? [{ file: 'repo-flatfile.txt', bytes: 0 }] : []),
        { file: 'task-and-standard-pack.md', bytes: 0 },
        ...(run.visualReferencePackPath ? [{ file: run.visualReferencePackPath.split(/[\\/]/).pop() ?? 'reference', bytes: 0 }] : []),
      ]
    : [
        ...(run.repoFlatfilePath ? [{ file: 'repo-flatfile.txt', bytes: 0 }] : []),
        ...(run.taskPacketPath ? [{ file: 'task-packet.md', bytes: 0 }] : []),
        ...(run.standardPackPath ? [{ file: 'standard-pack.md', bytes: 0 }] : []),
      ])
  const referenceName = run.visualReferencePackPath?.split(/[\\/]/).pop()
  const files = referenceName && !baseFiles.some((file) => file.file === referenceName)
    ? [...baseFiles, { file: referenceName, bytes: 0, sha256: '' }]
    : baseFiles
  const slotCount = files.length
  const uploadReady = packetReady && slotCount > 0

  const contextDetail = props.contextResult
    ? `${props.contextResult.inventory.includedFileCount} included · ${props.contextResult.inventory.excludedFileCount} excluded · ${
        props.contextResult.warnings.length === 0
          ? 'no warnings'
          : `${props.contextResult.warnings.length} warning${props.contextResult.warnings.length === 1 ? '' : 's'}`
      }`
    : hasContext
      ? 'Context on disk from a previous prepare'
      : 'Not generated yet'

  const packetDetail = props.packetStale || props.contextStale
    ? 'Stale — generate again from What are you building?'
    : hasPacket
      ? 'Ready to transfer'
      : 'Not generated yet'

  const uploadDetail = uploadReady
    ? 'Ready to drag or copy to Copilot'
    : hasPacket
      ? 'Awaiting fresh packet'
      : 'Requires Generate in What are you building?'

  useEffect(() => {
    if (!uploadReady) {
      setPromptText('')
      return
    }
    if (props.packet?.recommendedPrompt) {
      setPromptText(props.packet.recommendedPrompt)
      return
    }
    let cancelled = false
    void props.bridge.getArtifactText(run.id, 'recommended-prompt.txt')
      .then((text) => { if (!cancelled) setPromptText(text) })
      .catch(() => { if (!cancelled) setPromptText(FALLBACK_PROMPT) })
    return () => { cancelled = true }
  }, [uploadReady, props.packet?.recommendedPrompt, props.bridge, run.id])

  const copyPrompt = async () => {
    const text = promptText || await (async () => {
      if (props.packet?.recommendedPrompt) return props.packet.recommendedPrompt
      try {
        return await props.bridge.getArtifactText(run.id, 'recommended-prompt.txt')
      } catch {
        return FALLBACK_PROMPT
      }
    })()
    const ok = await copyText(text)
    props.setStatus(ok
      ? { tone: 'success', text: 'Recommended prompt copied to the clipboard.' }
      : { tone: 'error', text: 'Could not copy automatically — select the prompt text and copy manually.' })
  }

  const copyPacket = async () => {
    try {
      const text = await props.bridge.getArtifactText(run.id, 'task-packet.md')
      const ok = await copyText(text)
      props.setStatus(ok
        ? { tone: 'success', text: 'Task packet copied to the clipboard.' }
        : { tone: 'error', text: 'Could not copy packet automatically.' })
    } catch (error) {
      props.setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const downloadPacket = async () => {
    try {
      const text = await props.bridge.getArtifactText(run.id, 'task-packet.md')
      downloadText('task-packet.md', text)
      props.setStatus({ tone: 'success', text: 'Task packet download started.' })
    } catch (error) {
      props.setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
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

  const openPacket = async () => {
    const target = props.packet?.taskPacketPath ?? run.taskPacketPath ?? run.taskAndStandardPackPath
    if (!target) return
    try {
      await props.bridge.openPath(target)
      props.setStatus({ tone: 'success', text: 'Task packet opened in your default Markdown app.' })
    } catch (error) {
      props.setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const dragFiles = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    props.bridge.startUploadDrag(run.id).catch((error: unknown) => {
      props.setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    })
  }

  const openCopilot = async () => {
    const text = promptText || FALLBACK_PROMPT
    const ok = await copyText(text)
    await props.bridge.openExternal(COPILOT_URL)
    props.setStatus(ok
      ? { tone: 'success', text: 'Copilot opened — the prompt is on your clipboard; attach the files, then paste.' }
      : { tone: 'info', text: 'Copilot opened. Copy the prompt below, attach the files, then paste.' })
    props.setWorkspace('copilot')
  }

  return (
    <div className="workspace-panel">
      <div className="handoff-help handoff-help-single" aria-label="Attach handoff files">
        <div><span className="handoff-help-number">1</span><p><strong>Attach the files</strong><small>Drag the bundle below into Copilot, or copy and paste the files.</small></p></div>
      </div>

      {uploadReady ? (
        <div className="handoff-transfer">
          <div className="handoff-transfer-row">
            <div
              className="upload-drag-chip"
              draggable
              onDragStart={dragFiles}
              role="button"
              aria-label={`Drag ${files.length} prepared files to Copilot`}
            >
              <span className="drag-dots" aria-hidden="true">⣿</span>
              <span className="hstack" aria-hidden="true">
                {files.map((file) => <span key={file.file} className="drag-file-chip">{file.file}</span>)}
              </span>
              <span className="drag-hint">drag all {files.length} files into Copilot</span>
            </div>
            <div className="handoff-transfer-actions">
              <button type="button" className="btn btn-primary handoff-open-copilot" onClick={openCopilot}>
                Open in Copilot →
              </button>
              <button type="button" className="btn btn-secondary" onClick={copyFiles}>Copy files</button>
              <button type="button" className="btn btn-secondary" onClick={openPacket}>Open packet</button>
            </div>
          </div>

          <div className="handoff-help handoff-help-single" aria-label="Paste the recommended prompt">
            <div><span className="handoff-help-number">2</span><p><strong>Paste the prompt</strong><small>Copy the recommended prompt below, then paste it into Copilot after attaching the files.</small></p></div>
          </div>
          <div className="handoff-prompt-row">
            <div className="handoff-prompt-card">
              <div className="handoff-prompt-card-head">
                <div><strong>Recommended prompt</strong><small>Paste after attaching the handoff files</small></div>
                <button type="button" className="btn btn-secondary btn-compact handoff-prompt-copy" onClick={copyPrompt} disabled={!promptText}>
                  Copy prompt
                </button>
              </div>
              <PromptPreview text={promptText} />
            </div>
          </div>
        </div>
      ) : (
        <p className="workspace-hint muted">
          Use Generate in What are you building? to prepare the handoff files, then return here to send them to Copilot.
        </p>
      )}

      <details className="build-supplementary">
        <summary>Handoff details and utilities</summary>
        <ul className="readiness-list" aria-label="Handoff readiness">
          <li className="readiness-row">
            <span className={`readiness-tick ${contextReady ? 'ready' : props.contextStale ? 'stale' : 'missing'}`} aria-hidden="true">{contextReady ? '✓' : '·'}</span>
            <div><strong>Context screened</strong><small>{contextDetail}</small></div>
            <span className="readiness-meta mono">{props.contextResult ? formatBytes(props.contextResult.flatfileBytes) : hasContext ? 'on disk' : '—'}</span>
          </li>
          <li className="readiness-row">
            <span className={`readiness-tick ${packetReady ? 'ready' : props.packetStale || props.contextStale ? 'stale' : 'missing'}`} aria-hidden="true">{packetReady ? '✓' : '·'}</span>
            <div><strong>Task + standards packet</strong><small>{packetDetail}</small></div>
            <span className="readiness-meta mono">MD</span>
          </li>
          <li className="readiness-row">
            <span className={`readiness-tick ${uploadReady ? 'ready' : 'missing'}`} aria-hidden="true">{uploadReady ? '✓' : '·'}</span>
            <div><strong>Handoff files</strong><small>{uploadDetail}</small></div>
            <span className="readiness-meta mono">{slotCount} / 3</span>
          </li>
        </ul>
        <div className="workspace-mini-actions">
          {packetReady && (
            <>
              <button type="button" className="tip-link" onClick={copyPacket}>Copy packet</button>
              <button type="button" className="tip-link" onClick={downloadPacket}>Download</button>
            </>
          )}
          {uploadReady && <button type="button" className="tip-link" onClick={showFiles}>Show handoff files in folder</button>}
        </div>
      </details>

      <StatusLine status={props.status} />
    </div>
  )
}
