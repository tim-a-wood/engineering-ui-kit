import { describe, expect, it } from 'vitest'
import { buildRunCompletionRecord } from '../src/completion.js'
import type { HandoffRun, VerificationResult } from '../src/types.js'

const run: HandoffRun = {
  id: 'run-1',
  projectId: 'project-1',
  currentStep: 'verify-review',
  repoFlatfilePath: '/data/flatfile.txt',
  repoInventoryPath: '/data/inventory.json',
  taskPacketPath: '/data/task.md',
  taskPacketBuiltAt: '2026-07-23T10:01:00.000Z',
  overlayZipPath: '/data/ui-overlay.zip',
  overlayInspectionSummaryPath: '/data/inspection.json',
  appliedFilesPath: '/data/applied.json',
  verificationResultPaths: ['/data/verification.json'],
  createdAt: '2026-07-23T10:00:00.000Z',
  updatedAt: '2026-07-23T10:04:00.000Z',
}

const passed: VerificationResult = {
  runId: 'run-1',
  commandLabel: 'build',
  commandText: 'npm run build',
  workingDirectory: '/repo',
  startedAt: '2026-07-23T10:04:00.000Z',
  endedAt: '2026-07-23T10:05:00.000Z',
  exitCode: 0,
  status: 'passed',
  wasCancelledByUser: false,
}

describe('completion evidence', () => {
  it('builds a truthful evidence timeline and summary', () => {
    const record = buildRunCompletionRecord({
      run,
      decision: 'approved',
      verificationResults: [passed],
      completedAt: '2026-07-23T10:06:00.000Z',
      appliedAt: '2026-07-23T10:03:00.000Z',
    })

    expect(record.summary.verificationSummary).toEqual({
      passed: 1,
      failed: 0,
      cancelled: 0,
      timedOut: 0,
    })
    expect(record.timeline.every((entry) => entry.state === 'complete')).toBe(true)
    expect(record.metrics).toEqual({
      elapsedMs: 360_000,
      verificationCommands: 1,
      verificationPassed: 1,
      evidenceMilestones: 8,
    })
  })

  it('refuses approval when verification is absent or failed', () => {
    expect(() => buildRunCompletionRecord({
      run,
      decision: 'approved',
      verificationResults: [],
    })).toThrow(/verification/)
    expect(() => buildRunCompletionRecord({
      run,
      decision: 'approved',
      verificationResults: [{ ...passed, status: 'failed', exitCode: 1 }],
    })).toThrow(/every result must pass/)
  })
})
