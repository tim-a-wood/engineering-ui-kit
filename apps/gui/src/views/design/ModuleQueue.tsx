/**
 * §9.2 Module queue — left side of the wide-screen Design workspace (§18.2),
 * or a drawer/selector on a narrow screen.
 */

import { useId, useMemo } from 'react'
import { filterModuleQueue, type ModuleDesignProgress, type ModuleDesignProgressEntry, type ModuleQueueFilter } from '@engineering-ui-kit/core/design-browser'
import { QUEUE_FILTERS, StateBadge, blockingModuleNames, filterCount, moduleTypeLabel } from './designShared'

export type ModuleQueueProps = {
  progress: ModuleDesignProgress
  filter: ModuleQueueFilter
  onFilterChange: (filter: ModuleQueueFilter) => void
  selectedModuleId?: string
  onSelectModule: (moduleId: string) => void
  /** Narrow-screen drawer mode (§18.2). */
  compact?: boolean
}

export function ModuleQueue(props: ModuleQueueProps) {
  const headingId = useId()
  const rows = useMemo(() => {
    const filtered = filterModuleQueue(props.progress, props.filter)
    return [...filtered].sort((a, b) => a.recommendedOrder - b.recommendedOrder)
  }, [props.progress, props.filter])

  return (
    <nav className={compact_class(props.compact)} aria-labelledby={headingId}>
      <h2 id={headingId}>Design modules</h2>

      <div className="design-queue-filters" role="group" aria-label="Filter design modules">
        {QUEUE_FILTERS.map((chip) => {
          const count = filterCount(props.progress, chip.id)
          const active = props.filter === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              className={active ? 'design-filter-chip active' : 'design-filter-chip'}
              aria-pressed={active}
              onClick={() => props.onFilterChange(chip.id)}
            >
              {chip.label} <span className="design-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      <p className="design-queue-result-count" role="status" aria-live="polite">
        {rows.length} module{rows.length === 1 ? '' : 's'} shown
      </p>

      <ul className="design-queue-list">
        {rows.map((entry) => (
          <ModuleQueueRow
            key={entry.moduleId}
            entry={entry}
            progress={props.progress}
            selected={entry.moduleId === props.selectedModuleId}
            onSelect={() => props.onSelectModule(entry.moduleId)}
          />
        ))}
        {rows.length === 0 && <li className="design-queue-empty">No modules match this filter.</li>}
      </ul>
    </nav>
  )
}

function compact_class(compact: boolean | undefined): string {
  return compact ? 'design-queue design-queue-compact' : 'design-queue'
}

function ModuleQueueRow(props: {
  entry: ModuleDesignProgressEntry
  progress: ModuleDesignProgress
  selected: boolean
  onSelect: () => void
}) {
  const { entry } = props
  return (
    <li className={props.selected ? 'design-queue-row selected' : 'design-queue-row'}>
      <button type="button" className="design-queue-row-button" aria-current={props.selected ? 'true' : undefined} onClick={props.onSelect}>
        <span className="design-queue-row-order" aria-hidden="true">
          {entry.recommendedOrder}
        </span>
        <span className="design-queue-row-main">
          <span className="design-queue-row-name">{entry.name}</span>
          <span className="design-queue-row-meta">
            {moduleTypeLabel(entry.moduleType)} · {entry.responsibility || 'No responsibility recorded yet.'}
          </span>
          <span className="design-queue-row-stats">
            <StateBadge state={entry.state} />
            {entry.owner && <span className="design-queue-row-owner">Owner: {entry.owner}</span>}
            <span>{entry.directDependencyCount} dependenc{entry.directDependencyCount === 1 ? 'y' : 'ies'}</span>
            <span>{entry.directConsumerCount} consumer{entry.directConsumerCount === 1 ? '' : 's'}</span>
            {entry.blockingIssueCount > 0 && (
              <span className="design-queue-row-blocking">{entry.blockingIssueCount} blocking issue{entry.blockingIssueCount === 1 ? '' : 's'}</span>
            )}
            {entry.changedUpstream && <span className="design-queue-row-changed">Changed upstream</span>}
          </span>
          {entry.state === 'blocked' && (
            <span className="design-queue-row-explain">Waiting for dependency: {blockingModuleNames(entry, props.progress).join(', ')}</span>
          )}
        </span>
      </button>
    </li>
  )
}
