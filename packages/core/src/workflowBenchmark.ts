export type WorkflowBenchmarkScenario = {
  name: string
  moduleCount: number
  implementationWaveCount: number
  experienceModuleCount: number
  bindingCount: number
}

export type WorkflowBenchmarkMeasure = {
  humanReviewPasses: number
  llmHandoffs: number
  navigationTransitions: number
  repeatedContextEntries: number
}

export type WorkflowBenchmarkResult = {
  schemaVersion: '1.0'
  scenario: WorkflowBenchmarkScenario
  baseline: WorkflowBenchmarkMeasure
  optimized: WorkflowBenchmarkMeasure
  reductions: Record<keyof WorkflowBenchmarkMeasure, { absolute: number; percent: number }>
}

/**
 * Structural benchmark: compares the former per-module/per-surface workflow
 * with the batched architecture, wave handoff, compiled-brief workflow.
 * It measures passes and transitions, not speculative minutes.
 */
export function benchmarkWorkflow(scenario: WorkflowBenchmarkScenario): WorkflowBenchmarkResult {
  for (const [key, value] of Object.entries(scenario)) {
    if (key !== 'name' && (!Number.isInteger(value) || Number(value) < 0)) {
      throw new Error(`${key} must be a non-negative integer`)
    }
  }
  if (scenario.moduleCount > 0 && scenario.implementationWaveCount < 1) {
    throw new Error('implementationWaveCount must be at least one when modules exist')
  }
  const baseline: WorkflowBenchmarkMeasure = {
    humanReviewPasses: 2 + scenario.moduleCount + scenario.moduleCount + scenario.experienceModuleCount + 1,
    llmHandoffs: 2 + scenario.moduleCount + scenario.moduleCount + scenario.experienceModuleCount,
    navigationTransitions: 4 + (scenario.moduleCount * 4) + (scenario.experienceModuleCount * 3) + scenario.bindingCount,
    repeatedContextEntries: (scenario.moduleCount * 2) + scenario.experienceModuleCount + scenario.bindingCount,
  }
  const optimized: WorkflowBenchmarkMeasure = {
    humanReviewPasses: 2 + (scenario.moduleCount ? 1 : 0) + scenario.implementationWaveCount + (scenario.experienceModuleCount ? 1 : 0) + 1,
    llmHandoffs: 2 + (scenario.moduleCount ? 1 : 0) + scenario.implementationWaveCount + (scenario.experienceModuleCount ? 1 : 0),
    navigationTransitions: 4 + (scenario.moduleCount ? 2 : 0) + scenario.implementationWaveCount + (scenario.experienceModuleCount ? 2 : 0),
    repeatedContextEntries: 0,
  }
  const reductions = Object.fromEntries(
    (Object.keys(baseline) as (keyof WorkflowBenchmarkMeasure)[]).map((key) => {
      const absolute = Math.max(0, baseline[key] - optimized[key])
      return [key, {
        absolute,
        percent: baseline[key] === 0 ? 0 : Math.round((absolute / baseline[key]) * 100),
      }]
    }),
  ) as WorkflowBenchmarkResult['reductions']
  return { schemaVersion: '1.0', scenario, baseline, optimized, reductions }
}
