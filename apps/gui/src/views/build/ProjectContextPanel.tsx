/**
 * Project context panel — repo identity + three disclosure/dialog entry points.
 */

import { useState } from 'react'
import { Icon } from '../../icons'
import { EXCLUDED_CATEGORIES } from '../workflowShared'
import { BeforeEvidenceDialog } from './BeforeEvidenceDialog'
import { ContextPrivacyDialog } from './ContextPrivacyDialog'
import { OutputUploadDialog } from './OutputUploadDialog'
import type { ProjectContextPanelProps } from './buildTypes'

export function ProjectContextPanel(props: ProjectContextPanelProps) {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [outputOpen, setOutputOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  const hasContext = Boolean(props.contextResult || props.run.repoFlatfilePath)
  const warningCount = props.contextResult?.warnings.length ?? 0
  const privacySummary = warningCount > 0
    ? `Source, config, assets, docs · ${EXCLUDED_CATEGORIES.length} exclusion rules · ${warningCount} warning${warningCount === 1 ? '' : 's'}`
    : `Source, config, assets, docs · ${EXCLUDED_CATEGORIES.length} exclusion rules`

  const outputSummary = hasContext
    ? `Flat file + JSON · ${props.uploadSlotCount} of 3 slots`
    : 'Flat file + JSON · not generated yet'

  const evidenceConfigured = (props.project.evidenceViews?.length ?? 0) > 0 && Boolean(props.project.launchUrl)
  const evidenceSummary = evidenceConfigured
    ? `Capture configured views for visual drift`
    : 'Configure launch URL and views in Projects'

  return (
    <section className="panel" aria-labelledby="project-context-heading">
      <h2 id="project-context-heading">Project context</h2>
      <p className="panel-desc">Included automatically and screened before anything leaves your machine.</p>

      <div className="build-repo">
        <span className="build-repo-icon" aria-hidden="true">{Icon.folder()}</span>
        <div className="build-repo-copy">
          <strong>{props.project.name}</strong>
          <div className="mono muted path-wrap">{props.project.repoPath}</div>
        </div>
        <button type="button" className="tip-link" onClick={() => props.onNavigate('projects')}>
          Change
        </button>
      </div>

      <button
        type="button"
        className="build-disclosure-row"
        aria-expanded={privacyOpen}
        aria-controls="context-privacy-dialog"
        onClick={() => setPrivacyOpen(true)}
      >
        <span className="build-disclosure-chev" aria-hidden="true">›</span>
        <span className="build-disclosure-label">Context & privacy</span>
        <span className="build-disclosure-summary">{privacySummary}</span>
        <span className="build-disclosure-action">Configure</span>
      </button>

      <button
        type="button"
        className="build-disclosure-row"
        aria-expanded={outputOpen}
        aria-controls="output-upload-dialog"
        onClick={() => setOutputOpen(true)}
      >
        <span className="build-disclosure-chev" aria-hidden="true">›</span>
        <span className="build-disclosure-label">Output & upload set</span>
        <span className="build-disclosure-summary">{outputSummary}</span>
        <span className="build-disclosure-action">Configure</span>
      </button>

      <button
        type="button"
        className="build-disclosure-row"
        aria-expanded={evidenceOpen}
        aria-controls="before-evidence-dialog"
        onClick={() => setEvidenceOpen(true)}
      >
        <span className="build-disclosure-chev" aria-hidden="true">›</span>
        <span className="build-disclosure-label">Before evidence</span>
        <span className="build-disclosure-summary">{evidenceSummary}</span>
        <span className="build-disclosure-action">Capture</span>
      </button>

      {privacyOpen && (
        <div id="context-privacy-dialog">
          <ContextPrivacyDialog
            result={props.contextResult}
            hasPersistedContext={Boolean(props.run.repoFlatfilePath)}
            busy={props.contextBusy}
            onGenerate={props.onGenerateContext}
            onClose={() => setPrivacyOpen(false)}
          />
        </div>
      )}
      {outputOpen && (
        <div id="output-upload-dialog">
          <OutputUploadDialog
            result={props.contextResult}
            flatfilePath={props.run.repoFlatfilePath}
            uploadSlotCount={props.uploadSlotCount}
            packetReady={props.packetReady}
            onClose={() => setOutputOpen(false)}
          />
        </div>
      )}
      {evidenceOpen && (
        <div id="before-evidence-dialog">
          <BeforeEvidenceDialog
            bridge={props.bridge}
            run={props.run}
            project={props.project}
            onNavigate={props.onNavigate}
            onClose={() => setEvidenceOpen(false)}
          />
        </div>
      )}
    </section>
  )
}
