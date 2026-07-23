import { describe, expect, it } from 'vitest'
import { benchmarkWorkflow } from '../src/workflowBenchmark.js'

describe('workflow structural benchmark', () => {
  it('quantifies the medium-app reduction without inventing elapsed minutes', () => {
    const result = benchmarkWorkflow({
      name: 'DO-178C audit hub',
      moduleCount: 8,
      implementationWaveCount: 3,
      experienceModuleCount: 2,
      bindingCount: 10,
    })

    expect(result.baseline).toEqual({
      humanReviewPasses: 21,
      llmHandoffs: 20,
      navigationTransitions: 52,
      repeatedContextEntries: 28,
    })
    expect(result.optimized).toEqual({
      humanReviewPasses: 8,
      llmHandoffs: 7,
      navigationTransitions: 11,
      repeatedContextEntries: 0,
    })
    expect(result.reductions).toMatchObject({
      humanReviewPasses: { absolute: 13, percent: 62 },
      llmHandoffs: { absolute: 13, percent: 65 },
      navigationTransitions: { absolute: 41, percent: 79 },
      repeatedContextEntries: { absolute: 28, percent: 100 },
    })
  })
})
