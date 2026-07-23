import { extname, resolve } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import type {
  ArtifactDescriptor,
  EvidenceRecord,
  LifecyclePhase,
  NormalizedBatch,
} from '../domain/model.js'
import { EMPTY_BATCH } from '../domain/model.js'
import { sha256File } from '../lib/files.js'
import type { EvidenceSourcePort, ExtractionContext } from '../ports/outbound.js'
import { readTabularArtifact } from './spreadsheet-adapter.js'

const PHASES = new Set<LifecyclePhase>([
  'planning',
  'requirements',
  'design',
  'implementation',
  'verification',
  'cm',
  'qa',
  'certification',
])

function field(row: Record<string, unknown>, names: string[]): string {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      value,
    ]),
  )
  for (const name of names) {
    const value = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''))
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function links(value: string): string[] {
  return value.split(/[;,|\n]+/).map((item) => item.trim()).filter(Boolean)
}

function phase(value: string): LifecyclePhase {
  const normalized = value.toLowerCase().replace(/configuration management/g, 'cm')
  return PHASES.has(normalized as LifecyclePhase) ? normalized as LifecyclePhase : 'certification'
}

function status(value: string): EvidenceRecord['status'] {
  const normalized = value.toLowerCase()
  if (normalized.includes('unsatisf') || normalized.includes('fail')) return 'unsatisfied'
  if (normalized.includes('partial')) return 'partial'
  if (normalized.includes('satisf') || normalized.includes('pass') || normalized.includes('approve')) return 'satisfied'
  if (normalized.includes('block')) return 'blocked'
  if (normalized.includes('draft')) return 'draft'
  return 'not-run'
}

export class ObjectiveProfileAdapter implements EvidenceSourcePort {
  readonly id = 'adapter.objective-profile'
  readonly implementedPortIds = ['port.objective-profile-source'] as const
  readonly sourceKinds = [] as const

  async extract(context: ExtractionContext): Promise<NormalizedBatch> {
    const batch = EMPTY_BATCH(this.id)
    if (!context.workspace.objectiveProfilePath) return batch
    const absolutePath = resolve(context.workspace.objectiveProfilePath)
    try {
      const details = await stat(absolutePath)
      if (!details.isFile()) throw new Error('configured objective profile is not a file')
      const hash = await sha256File(absolutePath)
      const extension = extname(absolutePath).toLowerCase()
      let rows: Array<Record<string, unknown>>
      if (extension === '.json') {
        const parsed = JSON.parse(await readFile(absolutePath, 'utf8')) as unknown
        if (Array.isArray(parsed)) {
          rows = parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        } else if (parsed && typeof parsed === 'object' && 'objectives' in parsed && Array.isArray(parsed.objectives)) {
          rows = parsed.objectives.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        } else {
          throw new Error('JSON objective profile must be an array or an object with an objectives array')
        }
      } else if (extension === '.csv' || extension === '.xlsx') {
        const descriptor: ArtifactDescriptor = {
          absolutePath,
          relativePath: absolutePath,
          sourceRootId: 'objective-profile',
          sourceKind: extension === '.xlsx' ? 'XLSX' : 'CSV',
          size: details.size,
          modifiedAt: details.mtime.toISOString(),
          hash,
        }
        rows = (await readTabularArtifact(descriptor)).flatMap((sheet) => sheet.rows)
      } else {
        throw new Error('objective profile must be JSON, CSV, or XLSX')
      }

      rows.forEach((row, index) => {
        const applicable = field(row, ['applicable', 'is applicable']).toLowerCase()
        if (['no', 'false', '0', 'not applicable', 'n/a'].includes(applicable)) return
        const id = field(row, ['id', 'objective id', 'identifier'])
        if (!id) return
        const evidenceIds = links(field(row, ['evidence ids', 'evidence', 'satisfied by', 'artifacts']))
        const objectiveStatus = status(field(row, ['status', 'satisfaction', 'result']))
        const record: EvidenceRecord = {
          id,
          title: field(row, ['title', 'name', 'summary']) || `Program objective ${id}`,
          type: 'objective',
          phase: phase(field(row, ['phase', 'lifecycle phase', 'area'])),
          status: objectiveStatus,
          revision: field(row, ['revision', 'version']) || hash.slice(0, 12),
          sourcePath: `${absolutePath}#objective:${index + 1}`,
          sourceKind: extension === '.xlsx' ? 'XLSX' : extension === '.csv' ? 'CSV' : 'CONFIG',
          hash,
          modified: details.mtime.toISOString(),
          baseline: context.baselineId,
          upstream: evidenceIds,
          downstream: [],
          reviewState: objectiveStatus === 'satisfied' ? 'approved' : 'not-reviewed',
          findingIds: links(field(row, ['finding ids', 'findings'])),
          provenance: `${this.id} row ${index + 1}`,
          changeMark: 'unchanged',
          meta: Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== '' && value !== null && value !== undefined).slice(0, 30)
              .map(([key, value]) => [key, typeof value === 'number' ? value : String(value)]),
          ),
        }
        batch.evidence.push(record)
        for (const evidenceId of evidenceIds) {
          batch.relationships.push({
            from: evidenceId,
            to: record.id,
            type: 'objective-satisfaction',
            sourcePath: record.sourcePath,
          })
        }
      })
      batch.provenance.push({
        sourcePath: absolutePath,
        hash,
        adapterId: this.id,
        toolVersion: 'objective-profile/1.0',
      })
      if (batch.evidence.length === 0) {
        batch.diagnostics.push({
          id: `${this.id}:empty:${absolutePath}`,
          adapterId: this.id,
          severity: 'warning',
          code: 'objective-profile-empty',
          message: 'The configured objective profile contains no applicable objectives with identifiers.',
          sourcePath: absolutePath,
          retryable: false,
        })
      }
    } catch (error) {
      batch.diagnostics.push({
        id: `${this.id}:invalid:${absolutePath}`,
        adapterId: this.id,
        severity: 'fatal',
        code: 'objective-profile-invalid',
        message: `The configured objective profile could not be normalized: ${error instanceof Error ? error.message : String(error)}`,
        sourcePath: absolutePath,
        retryable: false,
      })
    }
    return batch
  }
}
