/**
 * Job state machine helpers (CAP-PKT-018).
 */

import type { JobRecord, JobState } from './types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'

const LEGAL: Record<JobState, JobState[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
}

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return LEGAL[from].includes(to)
}

export function transitionJob(
  job: JobRecord,
  to: JobState,
  at = new Date().toISOString(),
): { ok: true; job: JobRecord } | { ok: false; diagnostics: CapDiagnostic[] } {
  if (!canTransitionJob(job.state, to)) {
    return {
      ok: false,
      diagnostics: sortDiagnostics([
        diagnostic('CAP-JOB-001', `illegal job transition ${job.state} -> ${to}`, {
          ruleId: 'CAP-JOB-001',
          relatedIds: [job.jobId],
        }),
      ]),
    }
  }
  const updated: JobRecord = {
    ...job,
    state: to,
    updatedAt: at,
    startedAt: to === 'running' ? at : job.startedAt,
    completedAt: to === 'succeeded' || to === 'failed' || to === 'cancelled' ? at : job.completedAt,
  }
  return { ok: true, job: updated }
}
