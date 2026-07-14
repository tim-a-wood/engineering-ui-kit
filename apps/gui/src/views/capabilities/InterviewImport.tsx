/**
 * Shared interview response import control (CAP-PKT-008).
 * Guided: the file chooser is the primary import method; raw JSON paste lives
 * behind a "Paste JSON instead" disclosure. Design keeps the paste box visible.
 */

import { useRef, useState } from 'react'
import { Icon } from '../../icons'

export type InterviewImportResult = {
  rawText: string
  parsed: unknown
  error?: string
}

type Props = {
  label?: string
  onImport: (result: InterviewImportResult) => void
  disabled?: boolean
  projection?: 'guided' | 'design'
}

export function InterviewImport({ label = 'Import interview response', onImport, disabled, projection = 'guided' }: Props) {
  const [paste, setPaste] = useState('')
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const guided = projection === 'guided'

  function applyText(text: string) {
    try {
      const parsed = JSON.parse(text) as unknown
      setStatus('Imported the response.')
      onImport({ rawText: text, parsed })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(guided ? 'That file was not valid JSON. Re-export from Copilot and try again.' : `Invalid JSON: ${message}`)
      onImport({ rawText: text, parsed: undefined, error: message })
    }
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="application/json,.json"
      disabled={disabled}
      aria-label="Choose interview response file"
      className="sr-only"
      onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const text = await file.text()
        setPaste(text)
        applyText(text)
      }}
    />
  )

  const pasteBox = (
    <label className="cap-import-paste">
      Interview response JSON
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        rows={6}
        aria-label="Interview response JSON"
        disabled={disabled}
      />
      <button type="button" className="btn btn-secondary btn-compact" disabled={disabled || !paste.trim()} onClick={() => applyText(paste)}>
        {label}
      </button>
    </label>
  )

  return (
    <div className="capabilities-interview-import cap-import" aria-label={label}>
      {guided ? (
        <>
          <div className="cap-import-primary">
            <button type="button" className="btn btn-secondary btn-compact" disabled={disabled} onClick={() => fileRef.current?.click()}>
              {Icon.upload(14)} {label}
            </button>
            {fileInput}
            <span className="capabilities-note">Choose the response file Copilot produced.</span>
          </div>
          <details className="cap-import-advanced">
            <summary>Paste JSON instead</summary>
            {pasteBox}
          </details>
        </>
      ) : (
        <>
          {pasteBox}
          <div className="capabilities-toolbar">
            <label className="capabilities-file-pick btn btn-secondary btn-compact">
              Choose file
              {fileInput}
            </label>
          </div>
        </>
      )}
      {status ? (
        <p role="status" className="capabilities-note">
          {status}
        </p>
      ) : null}
    </div>
  )
}
