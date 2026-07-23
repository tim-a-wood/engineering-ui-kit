import { readFile } from 'node:fs/promises'
import type { ArtifactDescriptor, EvidenceRecord, NormalizedBatch } from '../domain/model.js'
import { EMPTY_BATCH } from '../domain/model.js'
import type { EvidenceSourcePort, ExtractionContext } from '../ports/outbound.js'

function percent(hit: number, found: number): number {
  return found === 0 ? 0 : Math.round((hit / found) * 10_000) / 100
}

function parseLcov(content: string): Record<string, string | number> {
  let linesFound = 0
  let linesHit = 0
  let branchesFound = 0
  let branchesHit = 0
  for (const line of content.split(/\r?\n/)) {
    const [key, raw] = line.split(':', 2)
    const value = Number(raw)
    if (key === 'LF') linesFound += value
    if (key === 'LH') linesHit += value
    if (key === 'BRF') branchesFound += value
    if (key === 'BRH') branchesHit += value
  }
  return {
    statement: percent(linesHit, linesFound),
    decision: percent(branchesHit, branchesFound),
    linesFound,
    linesHit,
    branchesFound,
    branchesHit,
  }
}

function flattenNumeric(value: unknown, prefix = '', output: Record<string, number> = {}): Record<string, number> {
  if (typeof value === 'number') {
    output[prefix] = value
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenNumeric(child, prefix ? `${prefix}.${key}` : key, output)
    }
  }
  return output
}

function firstNumber(values: Record<string, number>, patterns: RegExp[]): number | undefined {
  return Object.entries(values).find(([key]) => patterns.some((pattern) => pattern.test(key)))?.[1]
}

async function coverageMeta(artifact: ArtifactDescriptor): Promise<Record<string, string | number>> {
  const content = await readFile(artifact.absolutePath, 'utf8')
  if (artifact.relativePath.toLowerCase().endsWith('.lcov')) return parseLcov(content)
  if (artifact.relativePath.toLowerCase().endsWith('.json')) {
    const values = flattenNumeric(JSON.parse(content))
    return {
      statement: firstNumber(values, [/statement.*pct/i, /line.*percent/i]) ?? 0,
      decision: firstNumber(values, [/branch.*pct/i, /decision.*percent/i]) ?? 0,
      condition: firstNumber(values, [/condition.*percent/i]) ?? 0,
      mcdc: firstNumber(values, [/mcdc.*percent/i]) ?? 0,
    }
  }
  const lineRate = Number(/\bline-rate="([^"]+)"/.exec(content)?.[1] ?? 0)
  const branchRate = Number(/\bbranch-rate="([^"]+)"/.exec(content)?.[1] ?? 0)
  return { statement: lineRate * 100, decision: branchRate * 100 }
}

export class CoverageAdapter implements EvidenceSourcePort {
  readonly id = 'adapter.coverage'
  readonly implementedPortIds = ['port.coverage-source'] as const
  readonly sourceKinds = ['COVERAGE', 'CONFIG'] as const

  async extract(context: ExtractionContext): Promise<NormalizedBatch> {
    const batch = EMPTY_BATCH(this.id)
    const artifacts = context.artifacts.filter((artifact) =>
      artifact.sourceKind === 'COVERAGE'
      || (artifact.sourceKind === 'CONFIG' && /coverage/i.test(artifact.relativePath)),
    )
    for (const artifact of artifacts) {
      try {
        const meta = await coverageMeta(artifact)
        const id = `COVERAGE:${artifact.relativePath}`
        const record: EvidenceRecord = {
          id,
          title: `Coverage — ${artifact.relativePath}`,
          type: 'result-set',
          phase: 'verification',
          status: 'passed',
          revision: artifact.hash.slice(0, 12),
          sourcePath: artifact.relativePath,
          sourceKind: 'COVERAGE',
          hash: artifact.hash,
          modified: artifact.modifiedAt,
          baseline: context.baselineId,
          upstream: [],
          downstream: [],
          reviewState: 'not-reviewed',
          findingIds: [],
          provenance: `${this.id} authoritative result import`,
          changeMark: 'unchanged',
          meta,
        }
        batch.evidence.push(record)
        batch.coverage.push({ id, sourcePath: artifact.relativePath, ...meta })
        batch.provenance.push({
          sourcePath: artifact.relativePath,
          hash: artifact.hash,
          adapterId: this.id,
          toolVersion: 'coverage-import/1.0',
        })
      } catch (error) {
        batch.diagnostics.push({
          id: `${this.id}:parse:${artifact.relativePath}`,
          adapterId: this.id,
          severity: 'error',
          code: 'coverage-parse-failed',
          message: `Could not import authoritative coverage results: ${error instanceof Error ? error.message : String(error)}`,
          sourcePath: artifact.relativePath,
          retryable: false,
        })
      }
    }
    return batch
  }
}
