/**
 * Output & upload set dialog — flatfile/JSON formats and slot accounting.
 * Visual reference picker: N/A (none exists in Prepare Context today).
 */

import type { PrepareContextResult } from '../../bridge'
import { Dialog } from '../../components'

export function OutputUploadDialog(props: {
  result: PrepareContextResult | null
  flatfilePath?: string
  uploadSlotCount: number
  packetReady: boolean
  onClose: () => void
}) {
  return (
    <Dialog
      title="Output & upload set"
      onClose={props.onClose}
      wide
      actions={
        <button type="button" className="btn btn-primary" onClick={props.onClose}>
          Close
        </button>
      }
    >
      <section aria-labelledby="output-format-heading">
        <h3 id="output-format-heading">Output format</h3>
        <div className="grid-2">
          <div className="format-card selected">
            <span className="format-radio" aria-hidden="true" />
            <div>
              <h3>Flat file (recommended)</h3>
              <p>One text file with full file tree and contents.</p>
            </div>
          </div>
          <div className="format-card">
            <span className="format-radio unselected" aria-hidden="true" />
            <div>
              <h3>Structured (JSON)</h3>
              <p>File inventory with metadata — generated alongside as <code>repo-inventory.json</code>.</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="upload-slots-heading" style={{ marginTop: 16 }}>
        <h3 id="upload-slots-heading">Upload slots</h3>
        <p className="panel-desc">
          Intended upload set: <code>repo-flatfile.txt</code>
          {props.packetReady ? ', ' : ' and '}
          {props.packetReady && <code>task-and-standard-pack.md</code>}
          {' '}({props.uploadSlotCount} of 3 slots — third free for a visual reference)
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Visual reference attachment: not available in the current Prepare Context flow (N/A).
        </p>
      </section>

      {(props.result?.flatfilePath || props.flatfilePath) && (
        <section aria-labelledby="generated-paths-heading" style={{ marginTop: 16 }}>
          <h3 id="generated-paths-heading">Generated paths</h3>
          <dl className="review-list">
            <div>
              <dt>Flat file</dt>
              <dd><code className="path-wrap">{props.result?.flatfilePath ?? props.flatfilePath}</code></dd>
            </div>
            <div>
              <dt>Inventory</dt>
              <dd><code>repo-inventory.json</code> (alongside flatfile)</dd>
            </div>
          </dl>
        </section>
      )}
    </Dialog>
  )
}
