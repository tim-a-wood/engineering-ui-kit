/**
 * Guided four-outcome journey. The canonical Define and Architect gates are
 * intentionally grouped into one user-facing Plan outcome: they are successive
 * parts of the same thought process, not separate destinations. This remains a
 * pure presentation over the derived journey and holds no capability truth.
 */

import { Icon } from '../../icons'
import type { JourneyStage, StageId } from './capabilitiesUiState'

const STATE_LABEL: Record<JourneyStage['state'], string> = {
  complete: 'Complete',
  current: 'Current',
  available: 'Available',
  locked: 'Locked',
  'not-applicable': 'Not required',
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function marker(stage: JourneyStage, index: number) {
  if (stage.state === 'complete') return Icon.check(13)
  if (stage.state === 'locked') return <LockGlyph />
  if (stage.state === 'not-applicable') return <span aria-hidden="true">—</span>
  return <span aria-hidden="true">{index + 1}</span>
}

export function CapabilityJourney(props: {
  stages: JourneyStage[]
  viewing: StageId
  onView: (id: StageId) => void
}) {
  const define = props.stages.find((stage) => stage.id === 'define')
  const architect = props.stages.find((stage) => stage.id === 'architect')
  const planViewing = props.viewing === 'define' || props.viewing === 'architect'
  const planComplete = Boolean(define?.satisfied && architect?.satisfied)
  const planTarget: StageId = architect && architect.state !== 'locked' ? 'architect' : 'define'
  const planStatus = !define?.satisfied
    ? define?.shortStatus === 'Draft ready to review.' ? 'Review the application brief.' : 'Describe the application.'
    : !architect?.satisfied
      ? architect?.shortStatus === 'Draft ready to review.' ? 'Review the solution shape.' : 'Shape the module plan.'
      : 'Plan approved.'
  const visibleStages = props.stages.filter((stage) => stage.id !== 'define' && stage.id !== 'architect')

  return (
    <ol className="cap-journey" aria-label="Capabilities journey">
      <li className={`cap-journey-step ${planComplete ? 'complete' : 'current'}${planViewing ? ' viewing' : ''}`}>
        <button
          type="button"
          className="cap-journey-link"
          aria-current={planViewing ? 'step' : undefined}
          onClick={() => props.onView(planTarget)}
        >
          <span className="cap-journey-marker" aria-hidden="true">
            {planComplete ? Icon.check(13) : <span>1</span>}
          </span>
          <span className="cap-journey-copy">
            <span className="cap-journey-name">Plan</span>
            <span className="cap-journey-status">{planStatus}</span>
            <span className="sr-only">, {planComplete ? 'Complete' : 'Current'}{planViewing ? ', viewing' : ''}</span>
          </span>
        </button>
      </li>
      {visibleStages.map((stage, index) => {
        const viewingThis = stage.id === props.viewing
        const navigable = stage.state !== 'locked'
        const stateLabel = STATE_LABEL[stage.state]
        const content = (
          <>
            <span className="cap-journey-marker" aria-hidden="true">
              {marker(stage, index + 1)}
            </span>
            <span className="cap-journey-copy">
              <span className="cap-journey-name">{stage.label}</span>
              <span className="cap-journey-status">{stage.shortStatus}</span>
              <span className="sr-only">
                , {stateLabel}
                {viewingThis ? ', viewing' : ''}
              </span>
            </span>
          </>
        )
        return (
          <li
            key={stage.id}
            className={`cap-journey-step ${stage.state}${viewingThis ? ' viewing' : ''}`}
          >
            {navigable ? (
              <button
                type="button"
                className="cap-journey-link"
                aria-current={viewingThis ? 'step' : undefined}
                onClick={() => props.onView(stage.id)}
              >
                {content}
              </button>
            ) : (
              <div
                className="cap-journey-locked"
                aria-disabled="true"
                title={stage.prerequisiteReason ?? 'Locked until earlier stages are complete.'}
              >
                {content}
                <span className="sr-only">. {stage.prerequisiteReason ?? 'Locked.'}</span>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
