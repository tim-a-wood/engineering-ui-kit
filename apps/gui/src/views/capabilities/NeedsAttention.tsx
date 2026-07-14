/**
 * Needs attention panel — dependency-ordered actionable items.
 * Guided mode humanizes the module name and state and offers exactly one next
 * action per item; raw reason codes and blocker ids stay in Design mode.
 */

import type { AttentionItem } from '@engineering-ui-kit/core'
import { Icon } from '../../icons'
import { freshnessLabel, humanizeIdentifier } from './capabilityPresentation'

type Props = {
  items: AttentionItem[]
  projection: 'guided' | 'design'
  onNextAction?: (item: AttentionItem) => void
}

export function NeedsAttention({ items, projection, onNextAction }: Props) {
  if (items.length === 0) {
    return (
      <section role="region" aria-label="Needs attention" className="capabilities-attention">
        <p role="status">No modules need attention.</p>
      </section>
    )
  }
  const guided = projection === 'guided'
  return (
    <section role="region" aria-label="Needs attention" className="capabilities-attention">
      <ol className="capabilities-attention-list" aria-label="Attention items in dependency order">
        {items.map((item) => (
          <li key={item.moduleId} className="panel cap-attention-item">
            <div className="cap-attention-head">
              <strong>{guided ? humanizeIdentifier(item.moduleId) : item.moduleId}</strong>
              <span className="badge" aria-label={`state ${item.primaryState}`}>
                {guided ? freshnessLabel(item.primaryState) : item.primaryState.replace(/-/g, ' ')}
              </span>
            </div>
            <p className="cap-attention-action">{item.nextAction}</p>
            {onNextAction ? (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => onNextAction(item)}
              >
                {item.nextAction} {Icon.arrowRight(13)}
              </button>
            ) : null}
            {!guided ? (
              <p className="capabilities-note">
                Reasons: {item.reasonCodes.join(', ') || '—'}
                {item.blocker ? `; blocker ${item.blocker}` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
