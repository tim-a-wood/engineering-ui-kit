/**
 * Needs attention projection (CAP-PKT-016 / CAP-TEST-020).
 */

import type { FreshnessRecord, ImpactRecord } from './types.js'

export type AttentionItem = {
  moduleId: string
  primaryState: FreshnessRecord['primaryState']
  reasonCodes: string[]
  blocker?: string
  nextAction: string
}

export function buildNeedsAttention(
  freshness: FreshnessRecord[],
  impact?: ImpactRecord | null,
): AttentionItem[] {
  const order = impact?.proposedPacketOrder ?? []
  const rank = new Map(order.map((id, index) => [id, index]))
  const items = freshness
    .filter((f) => f.primaryState !== 'ready')
    .map((f) => {
      const nextAction =
        f.primaryState === 'draft'
          ? 'Complete interview and approve specification'
          : f.primaryState === 'needs-review'
            ? 'Review definition changes'
            : f.primaryState === 'verification-needed'
              ? 'Run verification'
              : f.primaryState === 'connection-outdated'
                ? 'Update binding connection'
                : f.primaryState === 'blocked'
                  ? 'Resolve blocker'
                  : 'Inspect failure diagnostics'
      return {
        moduleId: f.moduleId,
        primaryState: f.primaryState,
        reasonCodes: f.reasonCodes,
        blocker: f.reasonCodes[0],
        nextAction,
      } satisfies AttentionItem
    })
  return items.sort((a, b) => {
    const ra = rank.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    return a.moduleId.localeCompare(b.moduleId)
  })
}
