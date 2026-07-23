import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type WorkflowTelemetryAction =
  | 'run.create'
  | 'context.prepare'
  | 'packet.export'
  | 'overlay.inspect'
  | 'overlay.apply'
  | 'verification.run'
  | 'run.complete'

export type WorkflowTelemetryEvent = {
  schemaVersion: '1.0'
  eventId: string
  projectId: string
  runId?: string
  action: WorkflowTelemetryAction
  outcome: 'succeeded' | 'blocked' | 'failed'
  startedAt: string
  endedAt: string
  durationMs: number
  counts?: Record<string, number>
}

export type WorkflowMetrics = {
  schemaVersion: '1.0'
  projectId?: string
  events: number
  uniqueRuns: number
  completedRuns: number
  blockedActions: number
  failedActions: number
  handoffsExported: number
  medianActionDurationMs: number
  p95ActionDurationMs: number
  byAction: {
    action: WorkflowTelemetryAction
    attempts: number
    succeeded: number
    blocked: number
    failed: number
    medianDurationMs: number
  }[]
  firstEventAt?: string
  lastEventAt?: string
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0
}

export function summarizeWorkflowTelemetry(
  events: WorkflowTelemetryEvent[],
  projectId?: string,
): WorkflowMetrics {
  const selected = events
    .filter((event) => !projectId || event.projectId === projectId)
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
  const actions = [...new Set(selected.map((event) => event.action))].sort()
  return {
    schemaVersion: '1.0',
    ...(projectId ? { projectId } : {}),
    events: selected.length,
    uniqueRuns: new Set(selected.flatMap((event) => event.runId ? [event.runId] : [])).size,
    completedRuns: new Set(selected
      .filter((event) => event.action === 'run.complete' && event.outcome === 'succeeded')
      .flatMap((event) => event.runId ? [event.runId] : [])).size,
    blockedActions: selected.filter((event) => event.outcome === 'blocked').length,
    failedActions: selected.filter((event) => event.outcome === 'failed').length,
    handoffsExported: selected.filter((event) => event.action === 'packet.export' && event.outcome === 'succeeded').length,
    medianActionDurationMs: percentile(selected.map((event) => event.durationMs), .5),
    p95ActionDurationMs: percentile(selected.map((event) => event.durationMs), .95),
    byAction: actions.map((action) => {
      const matching = selected.filter((event) => event.action === action)
      return {
        action,
        attempts: matching.length,
        succeeded: matching.filter((event) => event.outcome === 'succeeded').length,
        blocked: matching.filter((event) => event.outcome === 'blocked').length,
        failed: matching.filter((event) => event.outcome === 'failed').length,
        medianDurationMs: percentile(matching.map((event) => event.durationMs), .5),
      }
    }),
    ...(selected[0] ? { firstEventAt: selected[0].startedAt } : {}),
    ...(selected.at(-1) ? { lastEventAt: selected.at(-1)!.endedAt } : {}),
  }
}

/** Local-only operational telemetry. No prompt text, source paths, or user content is stored. */
export class WorkflowTelemetryStore {
  constructor(readonly dataDir: string) {}

  private filePath(): string {
    return path.join(this.dataDir, 'telemetry', 'workflow-events.jsonl')
  }

  append(input: Omit<WorkflowTelemetryEvent, 'schemaVersion' | 'eventId'>): WorkflowTelemetryEvent {
    const event: WorkflowTelemetryEvent = {
      schemaVersion: '1.0',
      eventId: crypto.randomUUID(),
      ...input,
      durationMs: Math.max(0, input.durationMs),
    }
    fs.mkdirSync(path.dirname(this.filePath()), { recursive: true })
    fs.appendFileSync(this.filePath(), JSON.stringify(event) + '\n')
    return event
  }

  list(projectId?: string): WorkflowTelemetryEvent[] {
    if (!fs.existsSync(this.filePath())) return []
    return fs.readFileSync(this.filePath(), 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const event = JSON.parse(line) as WorkflowTelemetryEvent
          return !projectId || event.projectId === projectId ? [event] : []
        } catch {
          return []
        }
      })
  }

  summarize(projectId?: string): WorkflowMetrics {
    return summarizeWorkflowTelemetry(this.list(projectId), projectId)
  }
}
