/**
 * Reusable "Handoff ready" card for capability interviews and implementation
 * packets. Each export is one self-contained file with the same native drag-out
 * affordance used by Build & Test. Design mode also exposes packet/run IDs,
 * the full path, bytes and SHA-256.
 */

import { useState } from 'react'
import type { EuikBridge, CapabilityPacketExportResult } from '../../bridge'
import { StatusLine, type Status } from '../../components'
import { Icon } from '../../icons'
import { COPILOT_URL } from '../workflowShared'
import { fileNameOf, formatBytes } from './capabilityPresentation'

export function CapabilityHandoffCard(props: {
  bridge: EuikBridge
  projectId: string
  result: CapabilityPacketExportResult
  projection: 'guided' | 'design'
  onHelp?: () => void
}) {
  const { bridge, result, projection } = props
  const guided = projection === 'guided'
  const [status, setStatus] = useState<Status | null>(null)

  async function openCopilot() {
    try {
      await bridge.openExternal(COPILOT_URL)
      setStatus({ tone: 'success', text: 'Copilot opened — drag the handoff below directly into the chat.' })
    } catch {
      setStatus({ tone: 'error', text: 'Could not open Copilot. Open m365.cloud.microsoft/chat manually.' })
    }
  }

  function dragHandoff(event: { preventDefault: () => void }) {
    event.preventDefault()
    bridge.capabilitiesStartHandoffDrag({ projectId: props.projectId, runId: result.runId }).catch((error: unknown) => {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    })
  }

  async function showFiles() {
    const target = result.files[0]?.path ?? result.uploadFiles[0]
    if (!target) {
      setStatus({ tone: 'error', text: 'No handoff files are available to show.' })
      return
    }
    try {
      await bridge.showInFolder(target)
    } catch {
      setStatus({ tone: 'error', text: 'Could not open the folder for these files.' })
    }
  }

  return (
    <section className="panel-raised cap-handoff" aria-label={guided ? 'Ready for Copilot' : 'Handoff ready'}>
      <header className="cap-handoff-head">
        <span className="cap-handoff-icon" aria-hidden="true">{Icon.sparkle(16)}</span>
        <h3>{guided ? 'Ready for Copilot' : 'Handoff ready'}</h3>
        {props.onHelp && (
          <button type="button" className="btn btn-ghost btn-compact cap-handoff-help" onClick={props.onHelp}>
            {Icon.help(14)} What to do
          </button>
        )}
      </header>

      <p className="cap-handoff-instruction">
        Open Copilot, then drag this single handoff into the chat. It already contains the prompt, context, and required response format.
      </p>

      {result.files[0] ? (
        <div
          className="upload-drag-chip cap-handoff-drag"
          draggable
          onDragStart={dragHandoff}
          role="button"
          aria-label={`Drag ${fileNameOf(result.files[0].path)} out to Copilot`}
          title="Drag this straight onto the Copilot chat's attach area"
        >
          <span className="drag-dots" aria-hidden="true">⣿</span>
          <span className="drag-file-chip" aria-hidden="true">
            {Icon.file(13)} {fileNameOf(result.files[0].path)} · {formatBytes(result.files[0].bytes)}
          </span>
          <span className="drag-hint">drag onto the Copilot chat — everything is included</span>
        </div>
      ) : null}

      <div className="cap-handoff-actions" role="group" aria-label="Handoff actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={openCopilot}>
          {Icon.external(14)} Open Copilot
        </button>
        <button type="button" className="btn btn-secondary btn-compact" onClick={showFiles}>
          {Icon.folder(14)} Show file
        </button>
      </div>

      {status && <StatusLine status={status} />}

      {projection === 'design' && (
        <details className="cap-handoff-detail">
          <summary>Packet details</summary>
          <dl className="capabilities-ids" aria-label="Packet identifiers">
            <div><dt>Packet ID</dt><dd><code>{result.packetId}</code></dd></div>
            <div><dt>Run ID</dt><dd><code>{result.runId}</code></dd></div>
          </dl>
          <ul className="cap-handoff-files-raw">
            {result.files.map((f) => (
              <li key={f.path}>
                <code>{f.path}</code> — {f.bytes} bytes — <code>{f.sha256.slice(0, 16)}…</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
