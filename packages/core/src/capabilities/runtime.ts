/**
 * Immediate runtime result helpers (CAP-PKT-017).
 */

import type { ErrorRecord, Provenance, ResultEnvelope } from './types.js'
import type { CapDiagnostic } from './diagnostics.js'
import { redactSensitiveText } from './redaction.js'

function toEnvelopeDiagnostics(diagnostics: CapDiagnostic[]) {
  return diagnostics.map((d, index) => ({
    id: d.code + '-' + index,
    code: d.code,
    message: d.message,
    relatedIds: d.relatedIds,
  }))
}

export function successResult(value: unknown, provenance: Provenance, diagnostics: CapDiagnostic[] = []): ResultEnvelope {
  return {
    schemaVersion: '1.0',
    outcome: 'success',
    diagnostics: toEnvelopeDiagnostics(diagnostics),
    artifacts: [],
    provenance,
    value,
  }
}

export function domainRejectionResult(
  code: string,
  message: string,
  provenance: Provenance,
): ResultEnvelope {
  return {
    schemaVersion: '1.0',
    outcome: 'domain-rejection',
    diagnostics: [],
    artifacts: [],
    provenance,
    rejection: { code, message },
  }
}

export function technicalFailureResult(error: ErrorRecord, provenance: Provenance): ResultEnvelope {
  return {
    schemaVersion: '1.0',
    outcome: 'technical-failure',
    diagnostics: [],
    artifacts: [],
    provenance,
    error,
  }
}

export function cancelledResult(provenance: Provenance): ResultEnvelope {
  return {
    schemaVersion: '1.0',
    outcome: 'cancelled',
    diagnostics: [],
    artifacts: [],
    provenance,
  }
}

export function sanitizeBoundaryError(error: unknown): ErrorRecord {
  const message = error instanceof Error ? error.message : String(error)
  return {
    schemaVersion: '1.0',
    code: 'CAP-TECH-001',
    category: 'execution',
    safeMessage: redactSensitiveText(message),
    retryability: 'manual',
    relatedIds: [],
    diagnosticRefs: [],
  }
}
