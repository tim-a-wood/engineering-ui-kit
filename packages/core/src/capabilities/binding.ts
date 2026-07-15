/**
 * Frontend binding validation, connection packets, and simulation modes.
 * CAP-PKT-024 / CAP-PKT-025 — CAP-CONTRACT-013, CAP-UX-006, CAP-RUN-005, CAP-SEC-002.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import type { GateResult } from './gates.js'
import { canonicalHash } from './hash.js'
import {
  cancelledResult,
  domainRejectionResult,
  successResult,
  technicalFailureResult,
} from './runtime.js'
import type {
  BindingDataMode,
  FrontendBinding,
  ImplementationPacket,
  Provenance,
  ResultEnvelope,
  SelectionEvidence,
  UiInboundBinding,
} from './types.js'
import { validateContractRecord } from './validation.js'

/**
 * Migrate a CAP-CONTRACT-013 FrontendBinding to a CAP-CONTRACT-028 ui InboundBinding.
 * Lossless: every FrontendBinding field is preserved (loadingBehavior and dataMode
 * ride along on the ui variant); new InboundBinding fields get explicit migration
 * defaults so the result is inspectable and reversible.
 */
export function frontendBindingToInboundBinding(
  binding: FrontendBinding,
  options: { deployableId: string },
): UiInboundBinding {
  return {
    schemaVersion: '1.0',
    kind: 'ui',
    bindingId: binding.bindingId,
    version: binding.version,
    projectId: binding.projectId,
    deployableId: options.deployableId,
    operationId: binding.operationId,
    operationVersion: binding.operationVersion,
    inputMappings: binding.inputMappings,
    outputMappings: binding.outputMappings,
    validationBehavior: binding.validationBehavior,
    domainRejectionBehavior: binding.domainRejectionBehavior,
    technicalFailureBehavior: binding.technicalFailureBehavior,
    timeoutBehavior: 'unspecified (migrated from FrontendBinding)',
    cancellationBehavior: binding.cancellationBehavior,
    retryBehavior: 'unspecified (migrated from FrontendBinding)',
    duplicateSubmissionBehavior: binding.duplicateSubmissionBehavior,
    exposure: 'private',
    generatedTargets: [],
    approvalState: 'migrated',
    transport: 'browser-local',
    trigger: binding.trigger,
    selectionEvidence: binding.selectionEvidence,
    loadingBehavior: binding.loadingBehavior,
    dataMode: binding.dataMode,
  }
}

/** Inverse of frontendBindingToInboundBinding — recovers the original FrontendBinding. */
export function inboundBindingToFrontendBinding(binding: UiInboundBinding): FrontendBinding {
  return {
    schemaVersion: '1.0',
    bindingId: binding.bindingId,
    version: binding.version,
    projectId: binding.projectId,
    selectionEvidence: binding.selectionEvidence as SelectionEvidence,
    trigger: binding.trigger,
    operationId: binding.operationId,
    operationVersion: binding.operationVersion,
    inputMappings: binding.inputMappings,
    outputMappings: binding.outputMappings,
    loadingBehavior: binding.loadingBehavior ?? '',
    validationBehavior: binding.validationBehavior,
    domainRejectionBehavior: binding.domainRejectionBehavior,
    technicalFailureBehavior: binding.technicalFailureBehavior,
    cancellationBehavior: binding.cancellationBehavior,
    duplicateSubmissionBehavior: binding.duplicateSubmissionBehavior,
    dataMode: binding.dataMode as BindingDataMode,
  }
}

export const BINDING_BEHAVIOR_FIELDS = [
  'loadingBehavior',
  'validationBehavior',
  'domainRejectionBehavior',
  'technicalFailureBehavior',
  'cancellationBehavior',
  'duplicateSubmissionBehavior',
] as const

export type BindingBehaviorField = (typeof BINDING_BEHAVIOR_FIELDS)[number]

export type MappingAmbiguity = {
  side: 'input' | 'output'
  from: string
  candidates: string[]
  resolvedTo?: string
}

export type ApprovedBindingExample = {
  id: string
  version: string
  operationContractVersion: string
  input: unknown
  expectedResult: unknown
  matchingRule?: string
  source: string
}

export type AdapterCallSpy = {
  calls: { operationId: string; args?: unknown; at: string }[]
}

export type ConnectedInvokePlan = {
  projectId: string
  operationId: string
  operationVersion: string
  bindingId: string
  bindingVersion: string
  args?: unknown
  dataMode: 'connected'
  explicit: true
}

export type BindingExecutionResult = {
  mode: BindingDataMode
  modeLabel: string
  envelope: ResultEnvelope
  presentation: {
    loading: string
    validation: string
    domainRejection: string
    technicalFailure: string
    cancellation: string
    duplicateSubmission: string
    outcome: ResultEnvelope['outcome']
  }
  adapterCalled: boolean
  qualifiesForConnectedVerification: boolean
  connectedInvokePlan?: ConnectedInvokePlan
  diagnostics: CapDiagnostic[]
}

export type ConsequentialActionKind =
  | 'filesystem-write'
  | 'matlab-eval'
  | 'snapshot-restore'
  | 'binding-connected-invoke'
  | 'pipeline-invoke'

export type ConsequentialTrigger =
  | 'background-refresh'
  | 'imported-data'
  | 'direct-request'
  | 'explicit-ui-action'

const MODE_LABELS: Record<BindingDataMode, string> = {
  connected: 'Connected (live)',
  'approved-example': 'Approved example (simulated)',
  'invalid-input': 'Invalid input (simulated)',
  'dependency-unavailable': 'Dependency unavailable (simulated)',
  timeout: 'Timeout (simulated)',
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function bindingModeLabel(mode: BindingDataMode): string {
  return MODE_LABELS[mode]
}

export function validateSelectionEvidence(evidence: SelectionEvidence): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = []
  for (const field of ['route', 'documentTitle', 'selector', 'elementTag', 'captureTime'] as const) {
    if (!nonEmpty(evidence[field])) {
      diagnostics.push(
        diagnostic('CAP-BIND-SEL-001', `selectionEvidence.${field} is required`, {
          fieldPath: `selectionEvidence.${field}`,
          ruleId: 'CAP-BIND-SEL-001',
        }),
      )
    }
  }
  if (evidence.visibleText === undefined || evidence.visibleText === null) {
    diagnostics.push(
      diagnostic('CAP-BIND-SEL-001', 'selectionEvidence.visibleText is required', {
        fieldPath: 'selectionEvidence.visibleText',
        ruleId: 'CAP-BIND-SEL-001',
      }),
    )
  }
  if (!nonEmpty(evidence.stableMarker) && evidence.sourceTargetConfirmed !== true) {
    diagnostics.push(
      diagnostic(
        'CAP-BIND-001',
        'stable marker or explicit source-target confirmation is required',
        { fieldPath: 'selectionEvidence', ruleId: 'CAP-BIND-001' },
      ),
    )
  }
  return diagnostics
}

export function detectMappingAmbiguities(
  binding: FrontendBinding,
  ambiguities: MappingAmbiguity[] = [],
): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = []
  for (const ambiguity of ambiguities) {
    if (ambiguity.candidates.length <= 1) continue
    if (nonEmpty(ambiguity.resolvedTo) && ambiguity.candidates.includes(ambiguity.resolvedTo)) {
      continue
    }
    diagnostics.push(
      diagnostic(
        'CAP-BIND-AMB-001',
        `ambiguous ${ambiguity.side} mapping for "${ambiguity.from}" requires user resolution`,
        {
          fieldPath: `${ambiguity.side}Mappings`,
          ruleId: 'CAP-BIND-AMB-001',
          relatedIds: ambiguity.candidates,
        },
      ),
    )
  }

  const inputFromCounts = new Map<string, number>()
  for (const mapping of binding.inputMappings) {
    inputFromCounts.set(mapping.from, (inputFromCounts.get(mapping.from) ?? 0) + 1)
  }
  for (const [from, count] of inputFromCounts) {
    if (count > 1) {
      const resolved = ambiguities.find(
        (a) => a.side === 'input' && a.from === from && nonEmpty(a.resolvedTo),
      )
      if (!resolved) {
        diagnostics.push(
          diagnostic(
            'CAP-BIND-AMB-001',
            `ambiguous input mapping for "${from}" requires user resolution`,
            { fieldPath: 'inputMappings', ruleId: 'CAP-BIND-AMB-001' },
          ),
        )
      }
    }
  }
  return diagnostics
}

export function validateFrontendBinding(
  binding: FrontendBinding,
  options: { ambiguities?: MappingAmbiguity[] } = {},
): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = [
    ...validateContractRecord('CAP-CONTRACT-013', binding),
    ...validateSelectionEvidence(binding.selectionEvidence),
  ]

  if (!nonEmpty(binding.operationId) || !nonEmpty(binding.operationVersion)) {
    diagnostics.push(
      diagnostic('CAP-BIND-002', 'binding must name exactly one operation id and version', {
        fieldPath: 'operationId',
        ruleId: 'CAP-BIND-002',
      }),
    )
  }

  for (const field of BINDING_BEHAVIOR_FIELDS) {
    if (!nonEmpty(binding[field])) {
      diagnostics.push(
        diagnostic('CAP-BIND-002', `all behavior mappings are required (${field})`, {
          fieldPath: field,
          ruleId: 'CAP-BIND-002',
        }),
      )
    }
  }

  diagnostics.push(...detectMappingAmbiguities(binding, options.ambiguities ?? []))
  return sortDiagnostics(diagnostics)
}

export function evaluateBindingApprovalGate(
  binding: FrontendBinding,
  options: { ambiguities?: MappingAmbiguity[] } = {},
): GateResult {
  const diagnostics = validateFrontendBinding(binding, options)
  return {
    gateId: 'CAP-GATE-BINDING',
    passed: diagnostics.length === 0,
    diagnostics,
  }
}

export function buildConnectionPacket(input: {
  packetId: string
  binding: FrontendBinding
  architectureVersion: string
  architectureHash: string
  ownedPaths?: string[]
  acceptanceCases?: ImplementationPacket['acceptanceCases']
  unchangedBehavior?: string[]
  requiredTests?: string[]
}): ImplementationPacket {
  const gate = evaluateBindingApprovalGate(input.binding)
  if (!gate.passed) {
    throw new Error(
      `cannot export connection packet: ${gate.diagnostics.map((d) => d.code).join(', ')}`,
    )
  }

  const owned =
    input.ownedPaths && input.ownedPaths.length > 0
      ? input.ownedPaths
      : [`capabilities/modules/connections/${input.binding.bindingId}/`]

  const packet: ImplementationPacket = {
    schemaVersion: '1.0',
    packetId: input.packetId,
    packetVersion: '1.0',
    projectId: input.binding.projectId,
    targetKind: 'connection',
    targetId: input.binding.bindingId,
    inputHashes: {
      binding: canonicalHash(input.binding),
      operation: `${input.binding.operationId}@${input.binding.operationVersion}`,
    },
    architectureVersion: input.architectureVersion,
    architectureHash: input.architectureHash,
    allowedPaths: owned,
    expectedPaths: owned.map((p) => (p.endsWith('/') ? `${p}binding.json` : `${p}/binding.json`)),
    protectedPaths: [],
    excludedPaths: ['node_modules/', 'dist/', '.git/'],
    requiredTests: input.requiredTests ?? [],
    acceptanceCases: input.acceptanceCases ?? [],
    unchangedBehavior: input.unchangedBehavior ?? ['other connections remain unchanged'],
    requiredOutput: 'ui-overlay.zip',
  }
  return packet
}

export function connectionPacketNamesSingleOperation(packet: ImplementationPacket, binding: FrontendBinding): boolean {
  const opHash = packet.inputHashes.operation
  return (
    packet.targetKind === 'connection' &&
    packet.targetId === binding.bindingId &&
    opHash === `${binding.operationId}@${binding.operationVersion}` &&
    Boolean(binding.operationId) &&
    !binding.operationId.includes(',')
  )
}

function simulationProvenance(mode: BindingDataMode): Provenance {
  return {
    source: `binding-simulation:${mode}`,
    recordedAt: new Date().toISOString(),
  }
}

export function simulateBindingMode(input: {
  binding: FrontendBinding
  mode: BindingDataMode
  example?: ApprovedBindingExample
  args?: unknown
  adapter?: AdapterCallSpy
  explicit?: boolean
}): BindingExecutionResult {
  const { binding, mode } = input
  const presentation = {
    loading: binding.loadingBehavior,
    validation: binding.validationBehavior,
    domainRejection: binding.domainRejectionBehavior,
    technicalFailure: binding.technicalFailureBehavior,
    cancellation: binding.cancellationBehavior,
    duplicateSubmission: binding.duplicateSubmissionBehavior,
    outcome: 'success' as ResultEnvelope['outcome'],
  }
  const modeLabel = bindingModeLabel(mode)
  const base = {
    mode,
    modeLabel,
    presentation,
    adapterCalled: false,
    qualifiesForConnectedVerification: false,
    diagnostics: [] as CapDiagnostic[],
  }

  if (mode === 'connected') {
    if (input.explicit !== true) {
      const diagnostics = [
        diagnostic('CAP-SEC-002', 'connected binding invoke requires explicit:true user action', {
          ruleId: 'CAP-SEC-002',
          fieldPath: 'explicit',
        }),
      ]
      const envelope = technicalFailureResult(
        {
          schemaVersion: '1.0',
          code: 'CAP-SEC-002',
          category: 'authorization',
          safeMessage: 'connected invoke requires explicit user action',
          retryability: 'manual',
          relatedIds: [binding.bindingId],
          diagnosticRefs: [],
        },
        simulationProvenance(mode),
      )
      return {
        ...base,
        envelope,
        presentation: { ...presentation, outcome: envelope.outcome },
        diagnostics,
      }
    }

    const plan: ConnectedInvokePlan = {
      projectId: binding.projectId,
      operationId: binding.operationId,
      operationVersion: binding.operationVersion,
      bindingId: binding.bindingId,
      bindingVersion: binding.version,
      args: input.args,
      dataMode: 'connected',
      explicit: true,
    }
    const envelope = successResult(
      { connectedInvokePlan: plan, pendingDesktopInvoke: true },
      { source: 'binding-connected-plan', recordedAt: new Date().toISOString() },
    )
    return {
      ...base,
      envelope,
      presentation: { ...presentation, outcome: envelope.outcome },
      qualifiesForConnectedVerification: true,
      connectedInvokePlan: plan,
    }
  }

  // Simulated modes never call adapters and never earn connected verification.
  if (input.adapter) {
    // Intentionally do not push to adapter.calls — isolation guarantee.
  }

  let envelope: ResultEnvelope
  switch (mode) {
    case 'approved-example': {
      if (!input.example) {
        envelope = technicalFailureResult(
          {
            schemaVersion: '1.0',
            code: 'CAP-BIND-EX-001',
            category: 'validation',
            safeMessage: 'approved example is required for approved-example mode',
            retryability: 'none',
            relatedIds: [binding.bindingId],
            diagnosticRefs: [],
          },
          simulationProvenance(mode),
        )
        break
      }
      envelope = successResult(
        {
          simulated: true,
          exampleId: input.example.id,
          exampleVersion: input.example.version,
          value: input.example.expectedResult,
          matchingRule: input.example.matchingRule ?? 'exact',
        },
        simulationProvenance(mode),
      )
      break
    }
    case 'invalid-input': {
      envelope = domainRejectionResult(
        'CAP-BIND-SIM-INVALID',
        binding.validationBehavior || 'invalid input (simulated)',
        simulationProvenance(mode),
      )
      break
    }
    case 'dependency-unavailable': {
      envelope = technicalFailureResult(
        {
          schemaVersion: '1.0',
          code: 'CAP-BIND-SIM-UNAVAILABLE',
          category: 'dependency',
          safeMessage: binding.domainRejectionBehavior || 'dependency unavailable (simulated)',
          retryability: 'delayed',
          relatedIds: [binding.operationId],
          diagnosticRefs: [],
        },
        simulationProvenance(mode),
      )
      break
    }
    case 'timeout': {
      envelope = technicalFailureResult(
        {
          schemaVersion: '1.0',
          code: 'CAP-BIND-SIM-TIMEOUT',
          category: 'timeout',
          safeMessage: binding.technicalFailureBehavior || 'operation timed out (simulated)',
          retryability: 'immediate',
          relatedIds: [binding.operationId],
          diagnosticRefs: [],
        },
        simulationProvenance(mode),
      )
      break
    }
    default: {
      envelope = cancelledResult(simulationProvenance(mode))
    }
  }

  return {
    ...base,
    envelope,
    presentation: { ...presentation, outcome: envelope.outcome },
    adapterCalled: false,
    qualifiesForConnectedVerification: false,
  }
}

/**
 * Gate for consequential local actions (CAP-SEC-002 / CAP-TEST-032).
 * Only explicit UI actions with explicit:true may run the side effect.
 */
export function runConsequentialAction<T>(input: {
  kind: ConsequentialActionKind
  trigger: ConsequentialTrigger
  explicit: boolean
  approvedOperation?: boolean
  sideEffect: () => T
}): { ok: true; value: T } | { ok: false; diagnostics: CapDiagnostic[]; sideEffectRan: false } {
  const diagnostics: CapDiagnostic[] = []
  if (input.approvedOperation === false) {
    diagnostics.push(
      diagnostic('CAP-SEC-002', `${input.kind} requires an approved operation`, {
        ruleId: 'CAP-SEC-002',
        fieldPath: 'approvedOperation',
      }),
    )
  }
  if (input.trigger !== 'explicit-ui-action' || input.explicit !== true) {
    diagnostics.push(
      diagnostic(
        'CAP-SEC-002',
        `${input.kind} blocked for trigger "${input.trigger}" without explicit:true UI action`,
        { ruleId: 'CAP-SEC-002', fieldPath: 'explicit' },
      ),
    )
  }
  if (diagnostics.length) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics), sideEffectRan: false }
  }
  return { ok: true, value: input.sideEffect() }
}

/** Alias used by offline journeys (CAP-PKT-032). */
export function selectionAllowsProgress(evidence: SelectionEvidence): CapDiagnostic[] {
  return validateSelectionEvidence(evidence)
}

/** Alias used by offline journeys (CAP-PKT-032). */
export function approveFrontendBinding(
  binding: FrontendBinding,
  options: { ambiguities?: MappingAmbiguity[] } = {},
): { ok: boolean; diagnostics: CapDiagnostic[]; gate: GateResult } {
  const gate = evaluateBindingApprovalGate(binding, options)
  return { ok: gate.passed, diagnostics: gate.diagnostics, gate }
}

/** Alias used by offline journeys (CAP-PKT-032). */
export function executeBindingMode(input: {
  binding: FrontendBinding
  mode: BindingDataMode
  example?: ApprovedBindingExample
  args?: unknown
  adapter?: AdapterCallSpy
  explicit?: boolean
  invokeConnected?: () => ResultEnvelope
}): BindingExecutionResult {
  const result = simulateBindingMode(input)
  if (input.mode === 'connected' && input.explicit === true && input.invokeConnected) {
    const envelope = input.invokeConnected()
    return {
      ...result,
      envelope,
      presentation: { ...result.presentation, outcome: envelope.outcome },
      adapterCalled: true,
      qualifiesForConnectedVerification: envelope.outcome === 'success',
    }
  }
  return result
}
