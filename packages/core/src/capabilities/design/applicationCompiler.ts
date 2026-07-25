/**
 * EUC-02 — Application compiler.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §5, §6.1,
 * §16, §25.3 (EUC-02). Pure `compileApplication` operation that maps an
 * approved `UseCaseAnalysis` (EUC-01) to a deterministic legacy
 * `ApplicationSpecification` (CAP-CONTRACT-001). No compilation path grants
 * approval; compiling never reads or writes the analysis approval.
 */

import type { AcceptanceCase, ApplicationSpecification, NamedText } from '../types.js'
import type { DesignDiagnostic, UseCaseAnalysis } from './records.js'
import { canonicalHash, childId, stableSortBy, stableSortStrings } from './identity.js'
import { designDiagnostic, sortDesignDiagnostics, toDesignDiagnostic } from './useCaseAnalysis.js'
import { validateContractRecord } from '../validation.js'

/** §25.3 EUC-02 — stable diagnostic codes owned by the application compiler. */
export const EUC02_DIAGNOSTIC_CODES = {
  notApproved: 'EUC02-ANALYSIS-NOT-APPROVED',
  missingActors: 'EUC02-MISSING-ACTORS',
  missingUseCases: 'EUC02-MISSING-USE-CASES',
  missingAcceptanceCases: 'EUC02-MISSING-ACCEPTANCE-CASES',
} as const

export type ApplicationCompileOptions = {
  /** Overrides the deterministic default application id. */
  id?: string
  /** Overrides the default revision ('1'). */
  revision?: string
}

export type ApplicationCompileResult = {
  specification?: ApplicationSpecification
  diagnostics: DesignDiagnostic[]
}

function byId<T extends { id: string }>(items: T[]): T[] {
  return stableSortBy(items, (item) => item.id)
}

/**
 * §6.1 step 5, §25.3 EUC-02 — compile an approved use-case analysis to the
 * current application specification. Deterministic: the same approved
 * analysis and options always produce the same `contentHash`. A missing
 * required item (no active actor, no use case, no acceptance case) returns a
 * stable diagnostic instead of a specification.
 */
export function compileApplication(
  analysis: UseCaseAnalysis,
  options: ApplicationCompileOptions = {},
): ApplicationCompileResult {
  if (analysis.status !== 'approved' || !analysis.approval) {
    return {
      diagnostics: [
        designDiagnostic(
          EUC02_DIAGNOSTIC_CODES.notApproved,
          'blocker',
          'compileApplication requires an approved use-case analysis',
          { target: 'status', relatedIds: [analysis.id] },
        ),
      ],
    }
  }

  const activeActors = analysis.actors.filter((item) => item.status !== 'rejected')
  const acceptanceCases: AcceptanceCase[] = analysis.useCases.flatMap((useCase) =>
    useCase.acceptanceChecks
      .filter((item) => item.status !== 'rejected')
      .map((item) => ({ id: item.id, description: item.text, expectedOutcome: item.text })),
  )

  const missing: DesignDiagnostic[] = []
  if (!activeActors.length) {
    missing.push(
      designDiagnostic(EUC02_DIAGNOSTIC_CODES.missingActors, 'blocker', 'approved analysis has no active actor', {
        target: 'actors',
      }),
    )
  }
  if (!analysis.useCases.length) {
    missing.push(
      designDiagnostic(EUC02_DIAGNOSTIC_CODES.missingUseCases, 'blocker', 'approved analysis has no use case', {
        target: 'useCases',
      }),
    )
  }
  if (!acceptanceCases.length) {
    missing.push(
      designDiagnostic(
        EUC02_DIAGNOSTIC_CODES.missingAcceptanceCases,
        'blocker',
        'approved analysis has no acceptance check',
        { target: 'acceptanceCases' },
      ),
    )
  }
  if (missing.length) {
    return { diagnostics: sortDesignDiagnostics(missing) }
  }

  const rules: NamedText[] = [
    ...analysis.rules.filter((item) => item.status !== 'rejected').map((item) => ({ id: item.id, text: item.text })),
    ...analysis.useCases.flatMap((useCase) => useCase.rules),
  ]
  const scenarios: NamedText[] = analysis.useCases.flatMap((useCase) =>
    useCase.scenarios.map((scenario) => ({ id: scenario.id, text: scenario.name })),
  )
  const outcomes = stableSortStrings(Array.from(new Set(analysis.useCases.flatMap((useCase) => useCase.outputs))))
  const information: NamedText[] = Array.from(
    new Set(analysis.useCases.flatMap((useCase) => useCase.inputs)),
  ).map((text, index) => ({ id: childId(analysis.id, 'information', text || String(index)), text }))
  const unresolvedQuestions: NamedText[] = analysis.questions
    .filter((q) => !q.material && !q.answer)
    .map((q) => ({ id: q.id, text: q.text }))

  const specWithoutHash: Omit<ApplicationSpecification, 'contentHash'> = {
    schemaVersion: '1.0',
    projectId: analysis.projectId,
    id: options.id ?? childId(analysis.id, 'application', 'spec'),
    revision: options.revision ?? '1',
    status: 'draft',
    purpose: analysis.workDescription,
    outcomes,
    actors: byId(activeActors.map((item) => ({ id: item.id, text: item.text }))),
    goals: [],
    useCases: byId(analysis.useCases.map((useCase) => ({ id: useCase.id, text: useCase.name }))),
    scenarios: byId(scenarios),
    information: byId(information),
    rules: byId(rules),
    externalSystems: [],
    constraints: byId(
      analysis.qualityNeeds
        .filter((item) => item.status !== 'rejected')
        .map((item) => ({ id: item.id, text: item.text })),
    ),
    scope: { inScope: [], outOfScope: [...analysis.prohibitedResults] },
    acceptanceCases: byId(acceptanceCases),
    sources: byId(analysis.sources.map((source) => ({ id: source.id, text: source.name }))),
    unresolvedQuestions: byId(unresolvedQuestions),
  }

  const contentHash = canonicalHash(specWithoutHash)
  const specification: ApplicationSpecification = { ...specWithoutHash, contentHash }

  const structural = validateContractRecord('CAP-CONTRACT-001', specification)
  const diagnostics = sortDesignDiagnostics(structural.map(toDesignDiagnostic))

  return { specification, diagnostics }
}
