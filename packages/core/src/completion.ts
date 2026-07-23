import type {
  CompletionSummary,
  HandoffRun,
  VerificationResult,
} from './types.js'

export type CompletionTimelineEntry = {
  id:
    | 'run-created'
    | 'context-prepared'
    | 'handoff-exported'
    | 'result-returned'
    | 'overlay-inspected'
    | 'changes-applied'
    | 'verification-complete'
    | 'human-decision'
  label: string
  state: 'complete' | 'pending' | 'blocked'
  at?: string
  evidenceRefs: string[]
}

export type RunCompletionRecord = {
  schemaVersion: '1.0'
  summary: CompletionSummary
  timeline: CompletionTimelineEntry[]
  metrics: {
    elapsedMs: number
    verificationCommands: number
    verificationPassed: number
    evidenceMilestones: number
  }
}

function entry(
  id: CompletionTimelineEntry['id'],
  label: string,
  complete: boolean,
  options: { at?: string; evidenceRefs?: string[]; blocked?: boolean } = {},
): CompletionTimelineEntry {
  return {
    id,
    label,
    state: complete ? 'complete' : options.blocked ? 'blocked' : 'pending',
    ...(options.at ? { at: options.at } : {}),
    evidenceRefs: options.evidenceRefs ?? [],
  }
}

export function buildRunCompletionRecord(input: {
  run: HandoffRun
  decision: CompletionSummary['completionStatus']
  verificationResults: VerificationResult[]
  completedAt?: string
  userDecisionNote?: string
  appliedAt?: string
}): RunCompletionRecord {
  const completedAt = input.completedAt ?? new Date().toISOString()
  const passed = input.verificationResults.filter((result) => result.status === 'passed').length
  const failed = input.verificationResults.filter((result) => result.status === 'failed').length
  const cancelled = input.verificationResults.filter((result) => result.status === 'cancelled').length
  const timedOut = input.verificationResults.filter((result) => result.status === 'timed-out').length
  if (input.decision === 'approved' && (input.verificationResults.length === 0 || failed + cancelled + timedOut > 0)) {
    throw new Error('approval requires at least one verification result and every result must pass')
  }
  const verificationAt = input.verificationResults
    .map((result) => result.endedAt)
    .sort()
    .at(-1)
  const summary: CompletionSummary = {
    runId: input.run.id,
    projectId: input.run.projectId,
    completedAt,
    completionStatus: input.decision,
    ...(input.userDecisionNote?.trim() ? { userDecisionNote: input.userDecisionNote.trim() } : {}),
    verificationSummary: { passed, failed, cancelled, timedOut },
    artifacts: {
      copilotInputs: [
        input.run.repoFlatfilePath,
        input.run.taskAndStandardPackPath,
        input.run.taskPacketPath,
        input.run.standardPackPath,
        input.run.visualReferencePackPath,
      ].filter((value): value is string => Boolean(value)),
      ...(input.run.overlayInspectionSummaryPath
        ? { overlayInspectionSummary: input.run.overlayInspectionSummaryPath }
        : {}),
      ...(input.run.appliedFilesPath ? { appliedFiles: input.run.appliedFilesPath } : {}),
      ...(input.run.verificationResultPaths?.length
        ? { verificationResults: input.run.verificationResultPaths }
        : {}),
      ...(input.run.userReviewNotesPath ? { userReviewNotes: input.run.userReviewNotesPath } : {}),
    },
  }
  const resultReturned = Boolean(input.run.overlayZipPath || input.run.changesZipPath)
  const timeline: CompletionTimelineEntry[] = [
    entry('run-created', 'Work started', true, { at: input.run.createdAt }),
    entry('context-prepared', 'Repository context prepared', Boolean(input.run.repoFlatfilePath || input.run.repoInventoryPath), {
      evidenceRefs: [input.run.repoFlatfilePath, input.run.repoInventoryPath].filter((value): value is string => Boolean(value)),
    }),
    entry('handoff-exported', 'Implementation handoff exported', Boolean(input.run.taskPacketPath || input.run.taskAndStandardPackPath), {
      at: input.run.taskPacketBuiltAt,
      evidenceRefs: [input.run.taskPacketPath, input.run.taskAndStandardPackPath].filter((value): value is string => Boolean(value)),
    }),
    entry('result-returned', 'Implementation result returned', resultReturned, {
      evidenceRefs: [input.run.overlayZipPath, input.run.changesZipPath].filter((value): value is string => Boolean(value)),
    }),
    entry('overlay-inspected', 'Returned files inspected', Boolean(input.run.overlayInspectionSummaryPath), {
      evidenceRefs: input.run.overlayInspectionSummaryPath ? [input.run.overlayInspectionSummaryPath] : [],
    }),
    entry('changes-applied', 'Reviewed files applied', Boolean(input.run.appliedFilesPath), {
      at: input.appliedAt,
      evidenceRefs: input.run.appliedFilesPath ? [input.run.appliedFilesPath] : [],
    }),
    entry('verification-complete', 'Verification completed', input.verificationResults.length > 0 && failed + cancelled + timedOut === 0, {
      at: verificationAt,
      evidenceRefs: input.run.verificationResultPaths ?? [],
      blocked: failed + cancelled + timedOut > 0,
    }),
    entry('human-decision', input.decision === 'approved' ? 'Approved by reviewer' : 'Reviewer decision recorded', true, {
      at: completedAt,
    }),
  ]
  return {
    schemaVersion: '1.0',
    summary,
    timeline,
    metrics: {
      elapsedMs: Math.max(0, Date.parse(completedAt) - Date.parse(input.run.createdAt)),
      verificationCommands: input.verificationResults.length,
      verificationPassed: passed,
      evidenceMilestones: timeline.filter((milestone) => milestone.state === 'complete').length,
    },
  }
}
