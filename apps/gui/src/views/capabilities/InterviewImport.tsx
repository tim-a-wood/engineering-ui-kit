/**
 * Shared interview response import control (CAP-PKT-008).
 */

import { useState } from 'react'

export type InterviewImportResult = {
  rawText: string
  parsed: unknown
  error?: string
}

type Props = {
  label?: string
  onImport: (result: InterviewImportResult) => void
  disabled?: boolean
}

export function InterviewImport({ label = 'Import interview response', onImport, disabled }: Props) {
  const [paste, setPaste] = useState('')
  const [status, setStatus] = useState('')

  function applyText(text: string) {
    try {
      const parsed = JSON.parse(text) as unknown
      setStatus('Parsed capability-interview-response.json')
      onImport({ rawText: text, parsed })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Invalid JSON: ${message}`)
      onImport({ rawText: text, parsed: undefined, error: message })
    }
  }

  return (
    <div className="capabilities-interview-import" aria-label={label}>
      <label>
        Paste {`capability-interview-response.json`}
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={8}
          aria-label="Interview response JSON"
          disabled={disabled}
        />
      </label>
      <div className="capabilities-toolbar">
        <button type="button" disabled={disabled || !paste.trim()} onClick={() => applyText(paste)}>
          {label}
        </button>
        <label className="capabilities-file-pick">
          Choose file
          <input
            type="file"
            accept="application/json,.json"
            disabled={disabled}
            aria-label="Choose interview response file"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const text = await file.text()
              setPaste(text)
              applyText(text)
            }}
          />
        </label>
      </div>
      {status ? (
        <p role="status" className="capabilities-note">
          {status}
        </p>
      ) : null}
    </div>
  )
}
