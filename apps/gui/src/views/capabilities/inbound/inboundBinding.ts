/**
 * Shared, pure helpers for the generalized Connect inbound-binding editors
 * (CAP-ERA-001 §12.4, CAP-PKT WP6B). Consumes the frozen CAP-CONTRACT-028
 * `InboundBinding` discriminated union — never redefines it.
 *
 * No React here: kept pure and unit-testable, matching capabilityPresentation.ts.
 */

import {
  EXPOSURE_LEVELS,
  HTTP_METHODS,
  INBOUND_BINDING_KINDS,
  MISFIRE_POLICIES,
  OVERLAP_POLICIES,
  frontendBindingToInboundBinding,
  inboundBindingToFrontendBinding,
  validateSelectionEvidence,
} from '@engineering-ui-kit/core/browser'
import type {
  CliInboundBinding,
  EmbeddedLibraryInboundBinding,
  ExposureLevel,
  FrontendBinding,
  HttpInboundBinding,
  InboundBinding,
  InboundBindingBase,
  InboundBindingKind,
  ScheduleInboundBinding,
  UiInboundBinding,
} from '@engineering-ui-kit/core'

/** Private until a deliberate review elevates it (CAP-ERA-001 §5.1/§15.2). */
export const DEFAULT_EXPOSURE: ExposureLevel = 'private'

export { EXPOSURE_LEVELS, HTTP_METHODS, MISFIRE_POLICIES, OVERLAP_POLICIES, frontendBindingToInboundBinding, inboundBindingToFrontendBinding }

/** The "How is this capability triggered?" choices (CAP-ERA-001 §12.4). `deferred` is a UX-only choice, not a binding kind. */
export type TriggerChoice = InboundBindingKind | 'deferred'

export const TRIGGER_OPTIONS: { id: TriggerChoice; label: string; description: string }[] = [
  { id: 'ui', label: 'Existing or new UI', description: 'A user interacts with an element in an application screen.' },
  { id: 'http', label: 'HTTP endpoint', description: 'Another system calls this over HTTP.' },
  { id: 'cli', label: 'Command line', description: 'A person or script runs a command.' },
  { id: 'schedule', label: 'Scheduled or background', description: 'Runs on a timer, with no one watching.' },
  { id: 'embedded-library', label: 'Embedded library', description: 'Only ever called directly from other code in this app.' },
  { id: 'deferred', label: 'Decide later', description: 'Continue without configuring this entry point yet.' },
]

/** `INBOUND_BINDING_KINDS` re-exported for callers that need the concrete (non-`deferred`) kind list. */
export { INBOUND_BINDING_KINDS }

export function triggerLabel(kind: TriggerChoice): string {
  return TRIGGER_OPTIONS.find((o) => o.id === kind)?.label ?? kind
}

/** Auto-filled defaults for the behavior fields every InboundBinding requires (CAP-CONTRACT-028). Only truly ambiguous fields are surfaced for editing (§12.4). */
export function defaultBehaviorFields(kind: InboundBindingKind): Omit<InboundBindingBase,
  'schemaVersion' | 'bindingId' | 'version' | 'projectId' | 'deployableId' | 'operationId' | 'operationVersion' |
  'inputMappings' | 'outputMappings' | 'exposure' | 'generatedTargets' | 'approvalState'
> {
  const shared = {
    validationBehavior: 'Reject with a validation diagnostic.',
    domainRejectionBehavior: 'Report the domain rejection reason to the caller.',
    technicalFailureBehavior: 'Report a technical failure and log it for investigation.',
    cancellationBehavior: 'Not cancellable once started.',
    retryBehavior: 'No automatic retry.',
  }
  switch (kind) {
    case 'http':
      return { ...shared, timeoutBehavior: 'Respond with a timeout status.', duplicateSubmissionBehavior: 'Process each request independently.' }
    case 'cli':
      return { ...shared, timeoutBehavior: 'Exit non-zero and print a timeout message.', duplicateSubmissionBehavior: 'Process each invocation independently.' }
    case 'schedule':
      return { ...shared, timeoutBehavior: 'Abandon the run and log a timeout.', duplicateSubmissionBehavior: 'Follow the configured overlap policy.' }
    case 'embedded-library':
      return { ...shared, timeoutBehavior: 'Propagate a timeout error to the caller.', duplicateSubmissionBehavior: 'Process each call independently.' }
    case 'ui':
    default:
      return { ...shared, timeoutBehavior: 'Show a retry prompt.', duplicateSubmissionBehavior: 'Ignore the repeated submission.' }
  }
}

export type NewBindingBase = {
  bindingId: string
  version: string
  projectId: string
  deployableId: string
  operationId: string
  operationVersion: string
}

function base(input: NewBindingBase, kind: InboundBindingKind): InboundBindingBase {
  return {
    schemaVersion: '1.0',
    bindingId: input.bindingId,
    version: input.version,
    projectId: input.projectId,
    deployableId: input.deployableId,
    operationId: input.operationId,
    operationVersion: input.operationVersion,
    inputMappings: [],
    outputMappings: [],
    ...defaultBehaviorFields(kind),
    exposure: DEFAULT_EXPOSURE,
    generatedTargets: [],
    approvalState: 'draft',
  }
}

export function createHttpBinding(input: NewBindingBase): HttpInboundBinding {
  return { ...base(input, 'http'), kind: 'http', method: 'POST', path: '' }
}

export function createCliBinding(input: NewBindingBase): CliInboundBinding {
  return { ...base(input, 'cli'), kind: 'cli', command: '' }
}

export function createScheduleBinding(input: NewBindingBase): ScheduleInboundBinding {
  return {
    ...base(input, 'schedule'),
    kind: 'schedule',
    cronExpression: '',
    timezone: 'UTC',
    overlapPolicy: 'skip',
    misfirePolicy: 'run-once',
  }
}

export function createEmbeddedLibraryBinding(input: NewBindingBase): EmbeddedLibraryInboundBinding {
  return { ...base(input, 'embedded-library'), kind: 'embedded-library', exportedCallable: '', reason: '' }
}

/** Migrates a working `FrontendBinding` draft into a `ui` InboundBinding (lossless; CAP-CONTRACT-013 -> 028). */
export function createUiBinding(
  binding: FrontendBinding,
  deployableId: string,
  transport: UiInboundBinding['transport'] = 'browser-local',
): UiInboundBinding {
  return { ...frontendBindingToInboundBinding(binding, { deployableId }), transport }
}

/**
 * Plain-language validation for approval readiness. Complements (does not
 * replace) any server/mock-side schema validation — every message here is
 * safe to show directly in Guided copy (no CAP-* codes).
 */
export function validateInboundBindingDraft(binding: InboundBinding): string[] {
  const issues: string[] = []
  if (!binding.operationId.trim() || !binding.operationVersion.trim()) {
    issues.push('Choose the capability this entry point triggers.')
  }
  for (const field of ['validationBehavior', 'domainRejectionBehavior', 'technicalFailureBehavior', 'timeoutBehavior', 'cancellationBehavior', 'retryBehavior', 'duplicateSubmissionBehavior'] as const) {
    if (!binding[field]?.trim()) issues.push('Every behavior field is required.')
  }
  switch (binding.kind) {
    case 'ui': {
      if (binding.selectionEvidence) {
        const evidenceIssues = validateSelectionEvidence(binding.selectionEvidence)
        if (evidenceIssues.length > 0) issues.push('Select an element and confirm its source target.')
      } else {
        issues.push('Select an element on the application UI.')
      }
      break
    }
    case 'http': {
      if (!binding.method) issues.push('Choose the HTTP method.')
      if (!binding.path.trim() || !binding.path.startsWith('/')) issues.push('Enter a request path starting with "/".')
      break
    }
    case 'cli': {
      if (!binding.command.trim()) issues.push('Enter the command name.')
      break
    }
    case 'schedule': {
      if (!binding.cronExpression.trim()) issues.push('Enter a schedule (cron expression).')
      if (!binding.timezone.trim()) issues.push('Choose a timezone.')
      break
    }
    case 'embedded-library': {
      if (!binding.exportedCallable.trim()) issues.push('Name the exported callable other code will call.')
      if (!binding.reason.trim()) issues.push('Explain why this operation is only reachable as an embedded library.')
      break
    }
  }
  return [...new Set(issues)]
}

/** Whether this binding has been deliberately elevated beyond the private default (CAP-ERA-001 §5.1/§15.2). */
export function isExposureElevated(exposure: ExposureLevel | undefined): boolean {
  return (exposure ?? DEFAULT_EXPOSURE) !== DEFAULT_EXPOSURE
}
