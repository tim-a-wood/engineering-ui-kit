/**
 * Reusable "Handoff ready" card for capability interviews and implementation
 * packets. Consumes CapabilityPacketExportResult. Guided mode shows filenames,
 * compact sizes and one natural transfer instruction; Design mode adds packet/run IDs,
 * full paths, bytes and SHA-256. No drag affordance is offered for capability
 * run IDs (the desktop bridge does not support it).
 */

import { useState } from 'react'
import type { EuikBridge, CapabilityPacketExportResult } from '../../bridge'
import { StatusLine, type Status } from '../../components'
import { Icon } from '../../icons'
import { COPILOT_URL, copyText } from '../workflowShared'
import { fileNameOf, formatBytes } from './capabilityPresentation'

export function CapabilityHandoffCard(props: {
  bridge: EuikBridge
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
      setStatus({ tone: 'success', text: 'Copilot opened — attach the files, then paste the prompt.' })
    } catch {
      setStatus({ tone: 'error', text: 'Could not open Copilot. Open m365.cloud.microsoft/chat manually.' })
    }
  }

  async function copyPrompt() {
    const ok = await copyText(result.recommendedPrompt)
    setStatus(
      ok
        ? { tone: 'success', text: 'Recommended prompt copied to the clipboard.' }
        : { tone: 'error', text: 'Could not copy the prompt. Select and copy it manually.' },
    )
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
        Open Copilot, attach these files, and paste the copied prompt. Bring its response back into the importer below.
      </p>

      <ul className="cap-handoff-files" aria-label="Handoff files">
        {result.files.map((f) => (
          <li key={f.path}>
            <span className="cap-handoff-file-icon" aria-hidden="true">{Icon.file(14)}</span>
            <span className="cap-handoff-file-name">{fileNameOf(f.path)}</span>
            <span className="cap-handoff-file-size">{formatBytes(f.bytes)}</span>
          </li>
        ))}
      </ul>

      <div className="cap-handoff-actions" role="group" aria-label="Handoff actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={openCopilot}>
          {Icon.external(14)} Open Copilot
        </button>
        <button type="button" className="btn btn-secondary btn-compact" onClick={copyPrompt}>
          {Icon.copy(14)} Copy prompt
        </button>
        <button type="button" className="btn btn-secondary btn-compact" onClick={showFiles}>
          {Icon.folder(14)} Show files
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
