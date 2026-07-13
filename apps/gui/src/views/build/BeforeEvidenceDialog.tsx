/**
 * Before-evidence dialog — EvidenceSection phase=before.
 */

import type { HandoffRun, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import type { ViewId } from '../../appState'
import { Dialog } from '../../components'
import { EvidenceSection } from '../workflowShared'

export function BeforeEvidenceDialog(props: {
  bridge: EuikBridge
  run: HandoffRun
  project: Project
  onNavigate: (view: ViewId) => void
  onClose: () => void
}) {
  return (
    <Dialog
      title="Before evidence"
      onClose={props.onClose}
      wide
      actions={
        <button type="button" className="btn btn-primary" onClick={props.onClose}>
          Close
        </button>
      }
    >
      <EvidenceSection
        bridge={props.bridge}
        run={props.run}
        project={props.project}
        phase="before"
        onNavigate={props.onNavigate}
        frameless
      />
    </Dialog>
  )
}
