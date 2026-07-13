/**
 * Capability readiness gates CAP-GATE-001–003 (CAP-PKT-002).
 */

import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleManifest,
} from './types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { detectCycles, type CapabilityGraph } from './graph.js'

export type GateResult = {
  gateId: string
  passed: boolean
  diagnostics: CapDiagnostic[]
}

export function evaluateProductGate(spec: ApplicationSpecification): GateResult {
  const diagnostics: CapDiagnostic[] = []
  if (!spec.actors.length) {
    diagnostics.push(diagnostic('CAP-GATE-001-ACTOR', 'at least one actor is required', { ruleId: 'CAP-GATE-001' }))
  }
  if (!spec.outcomes.length) {
    diagnostics.push(diagnostic('CAP-GATE-001-OUTCOME', 'at least one outcome is required', { ruleId: 'CAP-GATE-001' }))
  }
  if (!spec.useCases.length && !spec.scenarios.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-001-WORKFLOW', 'at least one use case or scenario is required', {
        ruleId: 'CAP-GATE-001',
      }),
    )
  }
  if (!spec.scope.inScope.length) {
    diagnostics.push(diagnostic('CAP-GATE-001-SCOPE', 'in-scope items are required', { ruleId: 'CAP-GATE-001' }))
  }
  if (!spec.acceptanceCases.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-001-ACCEPTANCE', 'acceptance cases are required', { ruleId: 'CAP-GATE-001' }),
    )
  }
  if (spec.unresolvedQuestions.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-001-UNRESOLVED', 'unresolved questions block product approval', {
        ruleId: 'CAP-GATE-001',
        relatedIds: spec.unresolvedQuestions.map((q) => q.id),
      }),
    )
  }
  const sorted = sortDiagnostics(diagnostics)
  return { gateId: 'CAP-GATE-001', passed: sorted.length === 0, diagnostics: sorted }
}

export function evaluateArchitectureGate(
  arch: ArchitectureSpecification,
  manifests: ModuleManifest[] = [],
  graph?: CapabilityGraph,
): GateResult {
  const diagnostics: CapDiagnostic[] = []
  if (!arch.moduleIds.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-002-MODULES', 'architecture must allocate at least one module', {
        ruleId: 'CAP-GATE-002',
      }),
    )
  }
  for (const edge of arch.dependencyEdges) {
    if (!edge.reason.trim()) {
      diagnostics.push(
        diagnostic('CAP-GATE-002-DEP-REASON', 'dependency edges require a reason', {
          ruleId: 'CAP-GATE-002',
          fieldPath: `${edge.fromModuleId}->${edge.toModuleId}`,
        }),
      )
    }
    if (!arch.moduleIds.includes(edge.fromModuleId) || !arch.moduleIds.includes(edge.toModuleId)) {
      diagnostics.push(
        diagnostic('CAP-GATE-002-DEP-REF', 'dependency edge references unknown module', {
          ruleId: 'CAP-GATE-002',
        }),
      )
    }
  }
  for (const trace of arch.workflowTraces) {
    if (!trace.moduleIds.length) {
      diagnostics.push(
        diagnostic('CAP-GATE-002-TRACE', 'workflow traces must list modules', {
          ruleId: 'CAP-GATE-002',
          fieldPath: trace.useCaseId,
        }),
      )
    }
    for (const moduleId of trace.moduleIds) {
      if (!arch.moduleIds.includes(moduleId)) {
        diagnostics.push(
          diagnostic('CAP-GATE-002-TRACE-REF', 'workflow trace references unknown module', {
            ruleId: 'CAP-GATE-002',
            relatedIds: [moduleId],
          }),
        )
      }
    }
  }
  const traced = new Set(arch.workflowTraces.flatMap((t) => t.moduleIds))
  for (const moduleId of arch.moduleIds) {
    if (arch.workflowTraces.length && !traced.has(moduleId)) {
      diagnostics.push(
        diagnostic('CAP-GATE-002-ORPHAN', 'module lacks workflow trace coverage', {
          ruleId: 'CAP-GATE-002',
          relatedIds: [moduleId],
        }),
      )
    }
  }
  for (const manifest of manifests) {
    if (!manifest.responsibility.trim() || !manifest.excludedConcerns.length) {
      diagnostics.push(
        diagnostic('CAP-GATE-002-RESP', 'modules need responsibility and exclusions', {
          ruleId: 'CAP-GATE-002',
          relatedIds: [manifest.moduleId],
        }),
      )
    }
  }
  const cycleGraph = graph ?? {
    nodes: arch.moduleIds.map((id) => ({ id })),
    edges: arch.dependencyEdges.map((e) => ({
      from: e.fromModuleId,
      to: e.toModuleId,
      reason: e.reason,
    })),
  }
  const cycles = detectCycles(cycleGraph)
  for (const cycle of cycles) {
    diagnostics.push(
      diagnostic('CAP-AR-006', 'module dependency cycle detected', {
        ruleId: 'CAP-AR-006',
        relatedIds: cycle,
      }),
    )
  }
  const sorted = sortDiagnostics(diagnostics)
  return { gateId: 'CAP-GATE-002', passed: sorted.length === 0, diagnostics: sorted }
}

export function evaluateModuleGate(
  manifest: ModuleManifest,
  extras?: {
    unresolvedDomainQuestions?: string[]
    acceptanceCases?: unknown[]
    rules?: unknown[]
  },
): GateResult {
  const diagnostics: CapDiagnostic[] = []
  if (!manifest.responsibility.trim()) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-PURPOSE', 'module responsibility is required', {
        ruleId: 'CAP-GATE-003',
      }),
    )
  }
  if (!manifest.providedOperations.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-CONTRACTS', 'module must provide at least one operation', {
        ruleId: 'CAP-GATE-003',
      }),
    )
  }
  if (!manifest.ownedConcerns.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-OWNED', 'owned concerns are required', { ruleId: 'CAP-GATE-003' }),
    )
  }
  if (!manifest.excludedConcerns.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-EXCLUDED', 'excluded concerns are required', { ruleId: 'CAP-GATE-003' }),
    )
  }
  if (!manifest.verificationSuiteIds.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-TESTS', 'verification suites are required', { ruleId: 'CAP-GATE-003' }),
    )
  }
  if (extras?.unresolvedDomainQuestions?.length) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-UNRESOLVED', 'unresolved domain questions block module approval', {
        ruleId: 'CAP-GATE-003',
        relatedIds: extras.unresolvedDomainQuestions,
      }),
    )
  }
  if (extras && extras.acceptanceCases && extras.acceptanceCases.length === 0) {
    diagnostics.push(
      diagnostic('CAP-GATE-003-ACCEPTANCE', 'acceptance cases are required', {
        ruleId: 'CAP-GATE-003',
      }),
    )
  }
  const sorted = sortDiagnostics(diagnostics)
  return { gateId: 'CAP-GATE-003', passed: sorted.length === 0, diagnostics: sorted }
}
