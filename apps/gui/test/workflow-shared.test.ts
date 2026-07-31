import { describe, expect, it } from 'vitest'
import { groupInspectionWarnings } from '../src/views/workflowShared'

describe('inspection warning groups', () => {
  it('separates STE review reasons inside one overlay rule', () => {
    const groups = groupInspectionWarnings([
      {
        ruleId: 'AI-HANDOFF-STE-REVIEW-001',
        path: 'ui/index.html',
        message: 'line 17, element <button>: STE-LEXICON-REVIEW — Review the vocabulary.',
      },
      {
        ruleId: 'AI-HANDOFF-STE-REVIEW-001',
        path: 'ui/index.html',
        message: 'line 19, element <button>: STE-REVIEW-ACTION-FORM — Use VERB + OBJECT.',
      },
      {
        ruleId: 'AI-HANDOFF-STE-REVIEW-001',
        path: 'ui/other.html',
        message: 'line 8, element <button>: STE-LEXICON-REVIEW — Review the vocabulary.',
      },
    ])

    expect(groups.map((group) => [group.label, group.warnings.length])).toEqual([
      ['STE-LEXICON-REVIEW', 2],
      ['STE-REVIEW-ACTION-FORM', 1],
    ])
    expect(groups[0]?.summary).toBe('Review the vocabulary.')
  })
})
