/**
 * Structural validators for capability contracts (CAP-PKT-002).
 */

import {
  BINDING_DATA_MODES,
  BINDING_TRIGGERS,
  CAPABILITY_RUN_KINDS,
  CONTRACT_REQUIRED_FIELDS,
  ERROR_CATEGORIES,
  FRESHNESS_STATES,
  IMPACT_CLASSIFICATIONS,
  JOB_STATES,
  MATLAB_SESSION_STATES,
  MODULE_TYPES,
  OPERATION_BEHAVIORS,
  RECORD_STATUSES,
  RESULT_OUTCOMES,
  RUNTIME_ALLOCATIONS,
  type ContractId,
} from './parity.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'

const ENUMS: Partial<Record<string, readonly string[]>> = {
  status: RECORD_STATUSES,
  moduleType: MODULE_TYPES,
  runtimeAllocation: RUNTIME_ALLOCATIONS,
  behavior: OPERATION_BEHAVIORS,
  outcome: RESULT_OUTCOMES,
  category: ERROR_CATEGORIES,
  state: [...JOB_STATES, ...MATLAB_SESSION_STATES, ...RECORD_STATUSES],
  primaryState: FRESHNESS_STATES,
  freshnessState: FRESHNESS_STATES,
  trigger: BINDING_TRIGGERS,
  dataMode: BINDING_DATA_MODES,
  classification: IMPACT_CLASSIFICATIONS,
  kind: [...CAPABILITY_RUN_KINDS, 'configuration', 'secret-reference', 'module', 'connection'],
}

function isAbsolutePath(p: string): boolean {
  return p.startsWith('/') || p.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(p)
}

export function validateContractRecord(
  contractId: ContractId,
  value: unknown,
): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return sortDiagnostics([
      diagnostic('CAP-VAL-000', 'record must be a non-array object', { fieldPath: '$' }),
    ])
  }
  const record = value as Record<string, unknown>
  for (const field of CONTRACT_REQUIRED_FIELDS[contractId]) {
    if (record[field] === undefined || record[field] === null) {
      diagnostics.push(
        diagnostic('CAP-VAL-001', `missing required field ${field}`, {
          fieldPath: field,
          ruleId: 'CAP-VAL-001',
        }),
      )
    }
  }
  if (record.schemaVersion !== undefined && record.schemaVersion !== '1.0') {
    diagnostics.push(
      diagnostic('CAP-VAL-002', 'unsupported schemaVersion', {
        fieldPath: 'schemaVersion',
        ruleId: 'CAP-VAL-002',
      }),
    )
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (record[key] === undefined || !allowed) continue
    if (typeof record[key] === 'string' && !allowed.includes(record[key] as string)) {
      // job state vs matlab state are overlapping keys — only enforce when contract matches
      if (key === 'state') {
        if (contractId === 'CAP-CONTRACT-007' && !JOB_STATES.includes(record[key] as never)) {
          diagnostics.push(
            diagnostic('CAP-VAL-003', `invalid enum value for ${key}`, {
              fieldPath: key,
              ruleId: 'CAP-VAL-003',
            }),
          )
        } else if (
          contractId === 'CAP-CONTRACT-019' &&
          !MATLAB_SESSION_STATES.includes(record[key] as never)
        ) {
          diagnostics.push(
            diagnostic('CAP-VAL-003', `invalid enum value for ${key}`, {
              fieldPath: key,
              ruleId: 'CAP-VAL-003',
            }),
          )
        }
        continue
      }
      if (key === 'kind') {
        if (contractId === 'CAP-CONTRACT-021' && !CAPABILITY_RUN_KINDS.includes(record[key] as never)) {
          diagnostics.push(
            diagnostic('CAP-VAL-003', `invalid enum value for ${key}`, {
              fieldPath: key,
              ruleId: 'CAP-VAL-003',
            }),
          )
        }
        continue
      }
      if (key === 'outcome' && contractId === 'CAP-CONTRACT-017') continue
      diagnostics.push(
        diagnostic('CAP-VAL-003', `invalid enum value for ${key}`, {
          fieldPath: key,
          ruleId: 'CAP-VAL-003',
        }),
      )
    }
  }

  const pathFields = ['ownedPaths', 'allowedPaths', 'expectedPaths', 'protectedPaths', 'excludedPaths']
  for (const field of pathFields) {
    const paths = record[field]
    if (!Array.isArray(paths)) continue
    paths.forEach((p, index) => {
      if (typeof p === 'string' && isAbsolutePath(p)) {
        diagnostics.push(
          diagnostic('CAP-AR-008', 'absolute paths are not allowed in contract path lists', {
            fieldPath: `${field}[${index}]`,
            ruleId: 'CAP-AR-008',
          }),
        )
      }
    })
  }

  return sortDiagnostics(diagnostics)
}
