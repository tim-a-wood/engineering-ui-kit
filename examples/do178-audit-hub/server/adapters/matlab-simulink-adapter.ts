import { access, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { AdapterDiagnostic, NormalizedBatch } from '../domain/model.js'
import { EMPTY_BATCH } from '../domain/model.js'
import type { EvidenceSourcePort, ExtractionContext } from '../ports/outbound.js'

const MATLAB_KINDS = new Set(['SLREQX', 'SLMX', 'SLX', 'SLDD', 'SLDATX'])

function matlabQuote(value: string): string {
  return value.replace(/'/g, "''")
}

async function firstReadable(paths: string[]): Promise<string | undefined> {
  for (const candidate of paths) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported normalized sidecar location.
    }
  }
  return undefined
}

function merge(target: NormalizedBatch, source: Partial<NormalizedBatch>): void {
  target.evidence.push(...(source.evidence ?? []))
  target.relationships.push(...(source.relationships ?? []))
  target.reviews.push(...(source.reviews ?? []))
  target.findings.push(...(source.findings ?? []))
  target.coverage.push(...(source.coverage ?? []))
  target.changes.push(...(source.changes ?? []))
  target.diagnostics.push(...(source.diagnostics ?? []))
  target.provenance.push(...(source.provenance ?? []))
}

function normalizeAddedEvidence(
  batch: NormalizedBatch,
  startIndex: number,
  artifact: ExtractionContext['artifacts'][number],
  baselineId: string,
): void {
  for (const record of batch.evidence.slice(startIndex)) {
    record.hash = artifact.hash
    record.baseline = baselineId
    record.modified = artifact.modifiedAt
    if (!record.revision || record.revision === 'extracted' || record.revision === 'candidate') {
      record.revision = artifact.hash.slice(0, 12)
    }
    if (!record.sourcePath || record.sourcePath === artifact.absolutePath) {
      record.sourcePath = artifact.relativePath
    }
    record.provenance = `${batch.adapterId} read-only extraction from ${artifact.relativePath}`
  }
}

async function runMatlab(
  executable: string,
  extractorDirectory: string,
  inputPath: string,
  outputPath: string,
  timeoutMs: number,
): Promise<{ ok: boolean; output: string }> {
  const expression = `addpath('${matlabQuote(extractorDirectory)}'); extract_audit_hub('${matlabQuote(inputPath)}','${matlabQuote(outputPath)}');`
  return new Promise((resolve) => {
    const child = spawn(executable, ['-batch', expression], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.stderr.on('data', (chunk) => { output += String(chunk) })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      resolve({ ok: false, output: `${output}\nMATLAB extraction timed out after ${timeoutMs} ms.` })
    }, timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ ok: false, output: `${output}\n${error.message}` })
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, output })
    })
  })
}

export class MatlabSimulinkAdapter implements EvidenceSourcePort {
  readonly id = 'adapter.matlab-simulink'
  readonly implementedPortIds = [
    'port.requirement-source',
    'port.trace-source',
    'port.design-source',
    'port.verification-source',
  ] as const
  readonly sourceKinds = ['SLREQX', 'SLMX', 'SLX', 'SLDD', 'SLDATX'] as const

  constructor(private readonly extractorDirectory: string) {}

  async extract(context: ExtractionContext): Promise<NormalizedBatch> {
    const batch = EMPTY_BATCH(this.id)
    const artifacts = context.artifacts.filter((artifact) => MATLAB_KINDS.has(artifact.sourceKind))
    const sidecarSuffix = context.workspace.matlab?.normalizedSidecarSuffix ?? '.audit-hub.json'
    const executable = context.workspace.matlab?.executable ?? 'matlab'
    const enabled = context.workspace.matlab?.enabled ?? true
    const timeoutMs = context.workspace.matlab?.timeoutMs ?? 120_000

    for (const artifact of artifacts) {
      const withoutExtension = artifact.absolutePath.slice(0, -extname(artifact.absolutePath).length)
      const sidecar = await firstReadable([
        `${artifact.absolutePath}${sidecarSuffix}`,
        `${withoutExtension}${sidecarSuffix}`,
        join(dirname(artifact.absolutePath), '.audit-hub', `${basename(withoutExtension)}.json`),
      ])
      if (sidecar) {
        try {
          const parsed = JSON.parse(await readFile(sidecar, 'utf8')) as Partial<NormalizedBatch>
          const evidenceStart = batch.evidence.length
          merge(batch, parsed)
          normalizeAddedEvidence(batch, evidenceStart, artifact, context.baselineId)
          batch.provenance.push({
            sourcePath: artifact.relativePath,
            hash: artifact.hash,
            adapterId: this.id,
            toolVersion: 'normalized-sidecar/1.0',
          })
          continue
        } catch (error) {
          batch.diagnostics.push({
            id: `${this.id}:sidecar:${artifact.relativePath}`,
            adapterId: this.id,
            severity: 'error',
            code: 'normalized-sidecar-invalid',
            message: `Normalized extraction sidecar is invalid: ${error instanceof Error ? error.message : String(error)}`,
            sourcePath: artifact.relativePath,
            retryable: false,
          })
          continue
        }
      }

      if (!enabled) {
        batch.diagnostics.push({
          id: `${this.id}:disabled:${artifact.relativePath}`,
          adapterId: this.id,
          severity: 'error',
          code: 'matlab-adapter-disabled',
          message: 'MATLAB extraction is disabled and no normalized sidecar is available.',
          sourcePath: artifact.relativePath,
          retryable: false,
        })
        continue
      }

      const temporaryDirectory = join(tmpdir(), `do178-audit-hub-${randomUUID()}`)
      const outputPath = join(temporaryDirectory, 'extraction.json')
      try {
        const result = await runMatlab(executable, this.extractorDirectory, artifact.absolutePath, outputPath, timeoutMs)
        if (!result.ok) {
          batch.diagnostics.push({
            id: `${this.id}:execution:${artifact.relativePath}`,
            adapterId: this.id,
            severity: 'error',
            code: 'matlab-extraction-failed',
            message: 'MATLAB/Simulink extraction failed. The last published snapshot remains active.',
            sourcePath: artifact.relativePath,
            retryable: true,
            detail: { output: result.output.slice(-2000) },
          })
          continue
        }
        const evidenceStart = batch.evidence.length
        merge(batch, JSON.parse(await readFile(outputPath, 'utf8')) as Partial<NormalizedBatch>)
        normalizeAddedEvidence(batch, evidenceStart, artifact, context.baselineId)
        batch.provenance.push({
          sourcePath: artifact.relativePath,
          hash: artifact.hash,
          adapterId: this.id,
          toolVersion: 'matlab-extractor/1.0',
        })
      } catch (error) {
        const diagnostic: AdapterDiagnostic = {
          id: `${this.id}:unexpected:${artifact.relativePath}`,
          adapterId: this.id,
          severity: 'error',
          code: 'matlab-adapter-unavailable',
          message: `MATLAB/Simulink extraction could not run: ${error instanceof Error ? error.message : String(error)}`,
          sourcePath: artifact.relativePath,
          retryable: true,
        }
        batch.diagnostics.push(diagnostic)
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true })
      }
    }
    return batch
  }
}
