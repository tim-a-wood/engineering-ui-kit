/**
 * Needs attention panel — dependency-ordered actionable items.
 */

import type { AttentionItem } from '@engineering-ui-kit/core'

type Props = {
  items: AttentionItem[]
  projection: 'guided' | 'design'
}

export function NeedsAttention({ items, projection }: Props) {
  if (items.length === 0) {
    return (
      <section role="region" aria-label="Needs attention" className="capabilities-attention">
        <p role="status">No modules need attention.</p>
      </section>
    )
  }
  return (
    <section role="region" aria-label="Needs attention" className="capabilities-attention">
      <ol className="capabilities-attention-list" aria-label="Attention items in dependency order">
        {items.map((item) => (
          <li key={item.moduleId}>
            <div>
              <strong>{item.moduleId}</strong>
              <span aria-label={`state ${item.primaryState}`}> — {item.primaryState.replace(/-/g, ' ')}</span>
            </div>
            <p>{item.nextAction}</p>
            {projection === 'design' ? (
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
