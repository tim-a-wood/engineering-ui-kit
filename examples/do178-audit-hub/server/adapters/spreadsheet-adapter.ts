import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import AdmZip from 'adm-zip'
import type { ArtifactDescriptor, EvidenceRecord, LifecyclePhase, NormalizedBatch } from '../domain/model.js'
import { EMPTY_BATCH } from '../domain/model.js'
import type { EvidenceSourcePort, ExtractionContext } from '../ports/outbound.js'

export interface TabularSheet {
  name: string
  rows: Array<Record<string, string>>
}

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function columnIndex(reference: string): number {
  const letters = reference.replace(/\d+/g, '').toUpperCase()
  let result = 0
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64
  return result - 1
}

function sharedStrings(zip: AdmZip): string[] {
  const entry = zip.getEntry('xl/sharedStrings.xml')
  if (!entry) return []
  const xml = entry.getData().toString('utf8')
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...(match[1] ?? '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((part) => xmlDecode(part[1] ?? ''))
      .join(''),
  )
}

function workbookSheetNames(zip: AdmZip): Map<string, string> {
  const workbook = zip.getEntry('xl/workbook.xml')?.getData().toString('utf8') ?? ''
  const relationships = zip.getEntry('xl/_rels/workbook.xml.rels')?.getData().toString('utf8') ?? ''
  const targets = new Map(
    [...relationships.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
      .map((match) => [match[1] ?? '', match[2] ?? '']),
  )
  const result = new Map<string, string>()
  for (const match of workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*(?:r:id|id)="([^"]+)"/g)) {
    const target = targets.get(match[2] ?? '')
    if (!target) continue
    const normalized = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    result.set(normalized.replace(/xl\/worksheets\/\.\.\//, 'xl/'), xmlDecode(match[1] ?? 'Sheet'))
  }
  return result
}

function rowsFromWorksheet(xml: string, strings: string[]): string[][] {
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const cell of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cell[1] ?? ''
      const body = cell[2] ?? ''
      const ref = /\br="([^"]+)"/.exec(attrs)?.[1] ?? `A${rows.length + 1}`
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1]
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        ?? /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1]
        ?? ''
      const value = type === 's' ? strings[Number(raw)] ?? '' : xmlDecode(raw)
      row[columnIndex(ref)] = value
    }
    rows.push(row)
  }
  return rows
}

function objectRows(rows: string[][]): Array<Record<string, string>> {
  const headerIndex = rows.findIndex((row) => row.some((value) => value?.trim()))
  if (headerIndex < 0) return []
  const headers = (rows[headerIndex] ?? []).map((value, index) => value?.trim() || `Column ${index + 1}`)
  return rows.slice(headerIndex + 1)
    .filter((row) => row.some((value) => value?.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ''])))
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (char === '"' && quoted && content[i + 1] === '"') {
      cell += '"'
      i++
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export async function readTabularArtifact(artifact: ArtifactDescriptor): Promise<TabularSheet[]> {
  if (artifact.sourceKind === 'CSV') {
    return [{ name: basename(artifact.relativePath), rows: objectRows(parseCsv(await readFile(artifact.absolutePath, 'utf8'))) }]
  }
  const zip = new AdmZip(artifact.absolutePath)
  const strings = sharedStrings(zip)
  const names = workbookSheetNames(zip)
  return zip.getEntries()
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.entryName))
    .map((entry) => ({
      name: names.get(entry.entryName) ?? basename(entry.entryName, '.xml'),
      rows: objectRows(rowsFromWorksheet(entry.getData().toString('utf8'), strings)),
    }))
}

function value(row: Record<string, string>, candidates: string[]): string {
  const entry = Object.entries(row).find(([key]) =>
    candidates.some((candidate) => key.toLowerCase().replace(/\s+/g, '') === candidate.toLowerCase().replace(/\s+/g, '')),
  )
  return entry?.[1]?.trim() ?? ''
}

function phaseOf(path: string): LifecyclePhase {
  if (/requirement/i.test(path)) return 'requirements'
  if (/design|model|dictionary/i.test(path)) return 'design'
  if (/test|verification|result|coverage/i.test(path)) return 'verification'
  if (/(^|\/)(cm|config)/i.test(path)) return 'cm'
  if (/review|quality|audit|qa/i.test(path)) return 'qa'
  if (/cert|objective|accomplishment/i.test(path)) return 'certification'
  return 'planning'
}

function splitLinks(input: string): string[] {
  return input.split(/[;,\n|]+/).map((item) => item.trim()).filter(Boolean)
}

function evidenceType(input: string): string {
  const normalized = input.toLowerCase().trim().replace(/[_\s]+/g, '-')
  const aliases: Record<string, string> = {
    requirement: 'hlr',
    'system-requirement': 'sys-requirement',
    'high-level-requirement': 'hlr',
    'low-level-requirement': 'llr',
    'derived-requirement': 'derived-requirement',
    'test': 'test-case',
    'test-result': 'result',
    'verification-result': 'result',
    'results': 'result-set',
    'data-dictionary': 'data-dictionary',
    'model-element': 'model-element',
    'source': 'source-file',
    'configuration-item': 'config-item',
  }
  const resolved = aliases[normalized] ?? normalized
  return new Set([
    'plan',
    'standard',
    'sys-requirement',
    'hlr',
    'llr',
    'derived-requirement',
    'model',
    'harness',
    'data-dictionary',
    'model-element',
    'source-file',
    'function',
    'test-case',
    'result-set',
    'result',
    'objective',
    'config-item',
  ]).has(resolved) ? resolved : 'config-item'
}

export class SpreadsheetAdapter implements EvidenceSourcePort {
  readonly id = 'adapter.spreadsheet'
  readonly implementedPortIds = ['port.tabular-evidence-source'] as const
  readonly sourceKinds = ['XLSX', 'CSV'] as const

  async extract(context: ExtractionContext): Promise<NormalizedBatch> {
    const batch = EMPTY_BATCH(this.id)
    for (const artifact of context.artifacts.filter((item) => item.sourceKind === 'XLSX' || item.sourceKind === 'CSV')) {
      try {
        const sheets = await readTabularArtifact(artifact)
        for (const sheet of sheets) {
          sheet.rows.forEach((row, index) => {
            const id = value(row, ['id', 'identifier', 'requirement id', 'test id', 'record id'])
              || `${artifact.relativePath}#${sheet.name}:${index + 2}`
            const title = value(row, ['title', 'summary', 'name', 'description', 'objective'])
              || `${sheet.name} row ${index + 2}`
            const status = value(row, ['status', 'result', 'verdict']).toLowerCase()
            const evidence: EvidenceRecord = {
              id,
              title,
              type: evidenceType(value(row, ['type', 'artifact type'])),
              phase: phaseOf(artifact.relativePath),
              status: status.includes('fail') ? 'failed'
                : status.includes('pass') ? 'passed'
                : status.includes('approve') || status.includes('closed') ? 'approved'
                : status.includes('draft') ? 'draft'
                : 'in-review',
              revision: value(row, ['revision', 'rev', 'version']) || artifact.hash.slice(0, 12),
              sourcePath: `${artifact.relativePath}#${sheet.name}!${index + 2}`,
              sourceKind: artifact.sourceKind,
              hash: artifact.hash,
              modified: artifact.modifiedAt,
              baseline: context.baselineId,
              upstream: splitLinks(value(row, ['upstream', 'traces from', 'parent', 'source id'])),
              downstream: splitLinks(value(row, ['downstream', 'traces to', 'children', 'target id'])),
              reviewState: value(row, ['review state', 'reviewed']).toLowerCase().includes('approve')
                ? 'approved'
                : 'not-reviewed',
              findingIds: splitLinks(value(row, ['finding ids', 'findings'])),
              provenance: `${this.id} ${sheet.name} row ${index + 2}`,
              changeMark: 'unchanged',
              meta: Object.fromEntries(
                Object.entries(row)
                  .filter(([, cell]) => cell !== '')
                  .slice(0, 30),
              ),
            }
            batch.evidence.push(evidence)
            for (const upstream of evidence.upstream) {
              batch.relationships.push({ from: upstream, to: id, type: 'trace', sourcePath: evidence.sourcePath })
            }
            for (const downstream of evidence.downstream) {
              batch.relationships.push({ from: id, to: downstream, type: 'trace', sourcePath: evidence.sourcePath })
            }
          })
        }
        batch.provenance.push({
          sourcePath: artifact.relativePath,
          hash: artifact.hash,
          adapterId: this.id,
          toolVersion: 'xlsx-xml/1.0',
        })
      } catch (error) {
        batch.diagnostics.push({
          id: `${this.id}:parse:${artifact.relativePath}`,
          adapterId: this.id,
          severity: 'error',
          code: 'workbook-parse-failed',
          message: `Could not parse tabular evidence: ${error instanceof Error ? error.message : String(error)}`,
          sourcePath: artifact.relativePath,
          retryable: false,
        })
      }
    }
    return batch
  }
}
