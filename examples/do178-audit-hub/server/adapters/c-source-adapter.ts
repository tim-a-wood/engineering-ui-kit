import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { EvidenceRecord, NormalizedBatch } from '../domain/model.js'
import { EMPTY_BATCH } from '../domain/model.js'
import type { EvidenceSourcePort, ExtractionContext } from '../ports/outbound.js'

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

function generatedClassification(path: string, source: string): string {
  return /(?:^|\/)(?:generated|codegen|slprj)(?:\/|$)/i.test(path)
    || /generated (?:code|file)|do not edit/i.test(source.slice(0, 2000))
    ? 'generated'
    : 'handwritten'
}

function functionNames(source: string): string[] {
  const cleaned = withoutComments(source)
  const matches = cleaned.matchAll(
    /(?:^|\n)\s*(?:static\s+|extern\s+|inline\s+|__attribute__\s*\(\([^)]*\)\)\s*)*(?:[A-Za-z_]\w*(?:\s+|\s*\*\s*))+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g,
  )
  return [...new Set([...matches].map((match) => match[1]).filter((name): name is string => Boolean(name)))]
}

function includes(source: string): string[] {
  return [...source.matchAll(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value))
}

export class CSourceAdapter implements EvidenceSourcePort {
  readonly id = 'adapter.c-source'
  readonly implementedPortIds = ['port.source-code-source'] as const
  readonly sourceKinds = ['C', 'H'] as const

  async extract(context: ExtractionContext): Promise<NormalizedBatch> {
    const batch = EMPTY_BATCH(this.id)
    for (const artifact of context.artifacts.filter((item) => item.sourceKind === 'C' || item.sourceKind === 'H')) {
      try {
        const source = await readFile(artifact.absolutePath, 'utf8')
        const classification = generatedClassification(artifact.relativePath, source)
        const fileId = `SRC:${artifact.relativePath}`
        const names = artifact.sourceKind === 'C' ? functionNames(source) : []
        const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length
        const fileRecord: EvidenceRecord = {
          id: fileId,
          title: basename(artifact.relativePath),
          type: 'source-file',
          phase: 'implementation',
          status: 'approved',
          revision: artifact.hash.slice(0, 12),
          sourcePath: artifact.relativePath,
          sourceKind: artifact.sourceKind,
          hash: artifact.hash,
          modified: artifact.modifiedAt,
          baseline: context.baselineId,
          upstream: [],
          downstream: names.map((name) => `${artifact.relativePath}::${name}`),
          reviewState: 'not-reviewed',
          findingIds: [],
          provenance: `${this.id} read-only index`,
          changeMark: 'unchanged',
          meta: {
            loc: lineCount,
            functions: names.length,
            classification,
            includes: includes(source).join(', '),
          },
        }
        batch.evidence.push(fileRecord)
        batch.provenance.push({
          sourcePath: artifact.relativePath,
          hash: artifact.hash,
          adapterId: this.id,
          toolVersion: 'c-indexer/1.0',
        })
        for (const name of names) {
          const id = `${artifact.relativePath}::${name}`
          batch.evidence.push({
            id,
            title: name,
            type: 'function',
            phase: 'implementation',
            status: 'approved',
            revision: artifact.hash.slice(0, 12),
            sourcePath: artifact.relativePath,
            sourceKind: artifact.sourceKind,
            hash: artifact.hash,
            modified: artifact.modifiedAt,
            baseline: context.baselineId,
            upstream: [fileId],
            downstream: [],
            reviewState: 'not-reviewed',
            findingIds: [],
            provenance: `${this.id} lexical function index`,
            changeMark: 'unchanged',
            meta: { file: artifact.relativePath, classification },
          })
          batch.relationships.push({
            from: fileId,
            to: id,
            type: 'contains',
            sourcePath: artifact.relativePath,
          })
        }
      } catch (error) {
        batch.diagnostics.push({
          id: `${this.id}:read:${artifact.relativePath}`,
          adapterId: this.id,
          severity: 'error',
          code: 'source-read-failed',
          message: `Could not index C/H source: ${error instanceof Error ? error.message : String(error)}`,
          sourcePath: artifact.relativePath,
          retryable: true,
        })
      }
    }
    return batch
  }
}
