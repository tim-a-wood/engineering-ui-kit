import type { NormalizedBatch, ReviewRecord } from '../domain/model.js'
import { EMPTY_BATCH } from '../domain/model.js'
import type { EvidenceSourcePort, ExtractionContext } from '../ports/outbound.js'
import { readTabularArtifact } from './spreadsheet-adapter.js'

function find(row: Record<string, string>, names: string[]): string {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]))
  return names.map((name) => normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''))).find(Boolean)?.trim() ?? ''
}

function reviewResult(value: string): ReviewRecord['result'] {
  const normalized = value.toLowerCase()
  if (normalized.includes('fail') || normalized.includes('reject')) return 'failed'
  if (normalized.includes('action')) return 'passed-with-actions'
  if (normalized.includes('pass') || normalized.includes('approve') || normalized.includes('close')) return 'passed'
  return 'pending'
}

function reviewMethod(value: string): ReviewRecord['method'] {
  const normalized = value.toLowerCase()
  if (normalized.includes('inspect')) return 'inspection'
  if (normalized.includes('walk')) return 'walkthrough'
  if (normalized.includes('analy')) return 'analysis'
  return 'checklist'
}

export class ReviewEvidenceAdapter implements EvidenceSourcePort {
  readonly id = 'adapter.review-evidence'
  readonly implementedPortIds = ['port.review-evidence-source'] as const
  readonly sourceKinds = ['XLSX', 'CSV', 'REVIEW'] as const

  async extract(context: ExtractionContext): Promise<NormalizedBatch> {
    const batch = EMPTY_BATCH(this.id)
    const candidates = context.artifacts.filter((artifact) =>
      ['XLSX', 'CSV', 'REVIEW'].includes(artifact.sourceKind)
      && /review|checklist|approval|audit/i.test(artifact.relativePath),
    )
    for (const artifact of candidates) {
      try {
        const sheets = await readTabularArtifact(artifact)
        for (const sheet of sheets) {
          sheet.rows.forEach((row, index) => {
            const subjectId = find(row, ['subject id', 'artifact id', 'evidence id', 'requirement id'])
            if (!subjectId) return
            const independentText = find(row, ['independent', 'independence', 'independent review']).toLowerCase()
            const review: ReviewRecord = {
              id: find(row, ['review id', 'id']) || `${artifact.relativePath}#${sheet.name}:${index + 2}`,
              reviewType: find(row, ['review type', 'type']) || 'Lifecycle review',
              subjectId,
              phase: /requirement/i.test(artifact.relativePath) ? 'requirements'
                : /design|model/i.test(artifact.relativePath) ? 'design'
                : /test|verification/i.test(artifact.relativePath) ? 'verification'
                : 'qa',
              reviewer: find(row, ['reviewer', 'reviewed by', 'approver']) || 'Unspecified',
              method: reviewMethod(find(row, ['method'])),
              date: find(row, ['date', 'review date']) || artifact.modifiedAt.slice(0, 10),
              revision: find(row, ['revision', 'artifact revision', 'rev']) || artifact.hash.slice(0, 12),
              result: reviewResult(find(row, ['result', 'decision', 'status'])),
              independent: ['yes', 'true', 'independent', '1'].includes(independentText),
              openActions: Number(find(row, ['open actions', 'actions']) || 0),
              comments: find(row, ['comments', 'notes', 'decision rationale']),
              findingIds: find(row, ['finding ids', 'findings']).split(/[;,|]+/).map((item) => item.trim()).filter(Boolean),
            }
            batch.reviews.push(review)
            if (!review.independent) {
              batch.diagnostics.push({
                id: `${this.id}:independence:${review.id}`,
                adapterId: this.id,
                severity: 'warning',
                code: 'independence-not-demonstrated',
                message: `Review ${review.id} does not demonstrate independence.`,
                sourcePath: artifact.relativePath,
                retryable: false,
              })
            }
          })
        }
        batch.provenance.push({
          sourcePath: artifact.relativePath,
          hash: artifact.hash,
          adapterId: this.id,
          toolVersion: 'review-tabular/1.0',
        })
      } catch (error) {
        batch.diagnostics.push({
          id: `${this.id}:parse:${artifact.relativePath}`,
          adapterId: this.id,
          severity: 'error',
          code: 'review-parse-failed',
          message: `Could not parse review evidence: ${error instanceof Error ? error.message : String(error)}`,
          sourcePath: artifact.relativePath,
          retryable: false,
        })
      }
    }
    return batch
  }
}
