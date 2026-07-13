/**
 * Context & privacy dialog — include categories, exclusions, warnings, generate.
 */

import { useState } from 'react'
import type { PrepareContextResult } from '../../bridge'
import { Dialog } from '../../components'
import { Icon } from '../../icons'
import { EXCLUDED_CATEGORIES, INCLUDE_ROWS, formatBytes } from '../workflowShared'

export function ContextPrivacyDialog(props: {
  result: PrepareContextResult | null
  hasPersistedContext: boolean
  busy: boolean
  onGenerate: () => void
  onClose: () => void
}) {
  const [exclusionsOpen, setExclusionsOpen] = useState(false)
  const result = props.result

  return (
    <Dialog
      title="Context & privacy"
      onClose={props.onClose}
      wide
      actions={
        <>
          <button
            type="button"
            className={result || props.hasPersistedContext ? 'btn btn-secondary' : 'btn btn-primary'}
            onClick={props.onGenerate}
            disabled={props.busy}
          >
            {props.busy ? 'Generating…' : result || props.hasPersistedContext ? 'Regenerate Context' : 'Generate Context'}
          </button>
          <button type="button" className="btn btn-primary" onClick={props.onClose}>
            Close
          </button>
        </>
      }
    >
      <section aria-labelledby="include-heading">
        <h3 id="include-heading">What to include</h3>
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

      <section aria-labelledby="exclusions-heading" style={{ marginTop: 16 }}>
        <h3 id="exclusions-heading">Exclusions</h3>
        <p className="panel-desc" style={{ marginBottom: 8 }}>
          {EXCLUDED_CATEGORIES.length} deterministic exclusion rules{' '}
          <button type="button" className="tip-link" onClick={() => setExclusionsOpen((v) => !v)}>
            {exclusionsOpen ? 'Hide' : 'Show'}
          </button>
        </p>
        {exclusionsOpen && (
          <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
            {EXCLUDED_CATEGORIES.map((c) => <li key={c} style={{ fontSize: 13 }}>{c}</li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="warnings-heading" style={{ marginTop: 8 }}>
        <h3 id="warnings-heading">Warnings</h3>
        <div>
          {result
            ? result.warnings.length === 0
              ? <p className="muted" style={{ margin: 0 }}>None — no secret-pattern matches detected.</p>
              : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.warnings.map((w) => (
                    <li key={w} className="mono path-wrap" style={{ fontSize: 12, color: 'var(--semantic-status-warning)' }}>{w}</li>
                  ))}
                </ul>
              )
            : <p className="muted" style={{ margin: 0 }}>Reported here after generation.</p>}
        </div>
      </section>

      <div className="info-banner" style={{ marginTop: 'var(--semantic-spacing-4)' }}>
        <span aria-hidden="true">{Icon.info(14)}</span>
        Company policy may govern what may be uploaded to Microsoft 365 Copilot. Review the flatfile before upload.
      </div>

      {result && (
        <section aria-labelledby="context-result-heading" style={{ marginTop: 16 }}>
          <h3 id="context-result-heading">Context result</h3>
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
          <p className="mono muted path-wrap" style={{ margin: 'var(--semantic-spacing-3) 0 0' }}>{result.flatfilePath}</p>
        </section>
      )}
    </Dialog>
  )
}
