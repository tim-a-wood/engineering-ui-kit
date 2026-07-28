import { describe, expect, it } from 'vitest'
import {
  evaluateApplicationSte,
  evaluateArchitectureSte,
  evaluateModuleDesignSte,
  evaluateModuleSte,
  projectUseCaseDiagram,
  steWords,
  type ApplicationSpecification,
  type ArchitectureSpecification,
  type OverlayInspectionSummary,
} from '@engineering-ui-kit/core/browser'
import { installMockBridge } from '../src/mockBridge'
import { buildBlockerFixPrompt } from '../src/views/workflowShared'

describe('live DO-178 workflow STE profile', () => {
  it('adds the project lexicon to overlay correction prompts', () => {
    const summary: OverlayInspectionSummary = {
      runId: 'ste-correction',
      zipFilename: 'ui-overlay.zip',
      inspectedAt: '2026-07-28T00:00:00.000Z',
      normalizedEntries: [],
      hardBlockers: [{
        ruleId: 'AI-HANDOFF-030',
        path: '/absolute/path.ts',
        message: 'Use a repository-relative path.',
      }],
      warnings: [],
      canApply: false,
    }

    const prompt = buildBlockerFixPrompt(summary, {
      technicalTerms: ['audit finding'],
      prohibitedAliases: { defect: 'audit finding' },
    })

    expect(prompt).toContain('"audit finding"')
    expect(prompt).toContain('"defect":"audit finding"')
  })

  it('keeps canonical records and projected UML free of blocking defects', async () => {
    const bridge = installMockBridge()
    const projectId = 'do-178c-audit-hub'
    await bridge.capabilitiesEnsureInitialized(projectId)

    const applicationRecord = await bridge.capabilitiesGetApplication(projectId)
    const architectureRecord = await bridge.capabilitiesGetArchitecture(projectId)
    const modules = await bridge.capabilitiesListModules(projectId)
    const designs = await bridge.capabilitiesListModuleDesigns(projectId)

    const application = applicationRecord.approved as ApplicationSpecification
    const architecture = architectureRecord.approved as ArchitectureSpecification
    const assuranceModule = modules.find((item) => item.moduleId === 'mod.assurance-workflow')?.approved
    const assuranceRecord = designs.find((item) => item.moduleId === 'mod.assurance-workflow')
    const assuranceDesign = assuranceRecord?.draft ?? assuranceRecord?.approved

    expect(evaluateApplicationSte(application).diagnostics).toEqual([])
    expect(evaluateArchitectureSte(architecture).diagnostics).toEqual([])
    expect(evaluateModuleSte(assuranceModule!).diagnostics).toEqual([])
    expect(evaluateModuleDesignSte(assuranceDesign!).diagnostics).toEqual([])
    const generatedOperationActionReviews = evaluateModuleDesignSte(assuranceDesign!)
      .reviewDiagnostics
      .filter((item) =>
        item.code === 'STE-REVIEW-ACTION-FORM'
        && /(?:query-dossier|persist-evidence-state|traverse-evidence-chain)/.test(item.fieldPath ?? ''))
    expect(generatedOperationActionReviews).toEqual([])

    const sequence = assuranceDesign!.diagrams.find((item) => item.kind === 'sequence')!
    expect(sequence.edges.every((edge) => !/^\d+\s*:/.test(edge.label ?? ''))).toBe(true)
    expect(sequence.edges.every((edge) => steWords(edge.label ?? '').length <= 4)).toBe(true)

    const useCase = projectUseCaseDiagram(application)
    const useCaseLabels = useCase.nodes
      .filter((node) => node.kind === 'use-case')
      .map((node) => node.label)
    expect(useCaseLabels).toEqual(expect.arrayContaining([
      'Close audit finding',
      'Record assurance review',
      'Build audit package',
    ]))
    expect(useCaseLabels.every((label) => steWords(label).length <= 4)).toBe(true)

    const component = assuranceDesign!.diagrams.find((item) => item.kind === 'component')!
    const operationLabels = [
      ...component.nodes
        .filter((node) => node.kind === 'provided-interface' || node.kind === 'required-interface')
        .map((node) => node.label),
      ...component.edges
        .filter((edge) => edge.kind === 'assembly')
        .map((edge) => edge.label ?? ''),
    ]
    expect(operationLabels).toEqual(expect.arrayContaining([
      'Query dossier',
      'Traverse evidence chain',
      'Persist evidence state',
    ]))
    expect(operationLabels.every((label) => !/^Op\s/.test(label))).toBe(true)
  })
})
