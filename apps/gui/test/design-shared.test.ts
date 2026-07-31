import { describe, expect, it } from 'vitest'
import {
  scenarioSelectorToken,
  suggestedScenarioSelector,
} from '../src/views/design/designShared'

describe('design selector suggestions', () => {
  it('derives stable selectors from an approved action', () => {
    expect(scenarioSelectorToken('Review requirement set')).toBe('review-requirement-set')
    expect(suggestedScenarioSelector('Review requirement set', 'action')).toBe(
      '[data-scenario-action="review-requirement-set"]',
    )
    expect(suggestedScenarioSelector('Review requirement set', 'result')).toBe(
      '[data-scenario-result="review-requirement-set"]',
    )
  })

  it('normalizes punctuation and keeps a usable fallback', () => {
    expect(scenarioSelectorToken('Check STE wording!')).toBe('check-ste-wording')
    expect(suggestedScenarioSelector('—', 'action')).toBe(
      '[data-scenario-action="user-task"]',
    )
  })
})
