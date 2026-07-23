import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  summarizeWorkflowTelemetry,
  WorkflowTelemetryStore,
  type WorkflowTelemetryEvent,
} from '../src/telemetry.js'

function event(
  action: WorkflowTelemetryEvent['action'],
  outcome: WorkflowTelemetryEvent['outcome'],
  durationMs: number,
  runId = 'run-1',
): WorkflowTelemetryEvent {
  return {
    schemaVersion: '1.0',
    eventId: `${action}-${outcome}`,
    projectId: 'project-1',
    runId,
    action,
    outcome,
    startedAt: '2026-07-23T10:00:00.000Z',
    endedAt: '2026-07-23T10:00:01.000Z',
    durationMs,
  }
}

describe('local workflow telemetry', () => {
  it('summarizes pass counts, failures, and latency without content fields', () => {
    const metrics = summarizeWorkflowTelemetry([
      event('run.create', 'succeeded', 5),
      event('packet.export', 'succeeded', 20),
      event('verification.run', 'blocked', 100),
      event('verification.run', 'succeeded', 80),
      event('run.complete', 'succeeded', 5),
    ], 'project-1')

    expect(metrics).toMatchObject({
      events: 5,
      uniqueRuns: 1,
      completedRuns: 1,
      blockedActions: 1,
      failedActions: 0,
      handoffsExported: 1,
      medianActionDurationMs: 20,
      p95ActionDurationMs: 80,
    })
  })

  it('persists JSONL locally and ignores a malformed tail line', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-telemetry-'))
    const store = new WorkflowTelemetryStore(dataDir)
    store.append({
      projectId: 'project-1',
      runId: 'run-1',
      action: 'run.create',
      outcome: 'succeeded',
      startedAt: '2026-07-23T10:00:00.000Z',
      endedAt: '2026-07-23T10:00:00.010Z',
      durationMs: 10,
    })
    fs.appendFileSync(path.join(dataDir, 'telemetry', 'workflow-events.jsonl'), '{bad json}\n')
    expect(store.list('project-1')).toHaveLength(1)
    expect(store.summarize('project-1').uniqueRuns).toBe(1)
  })
})
