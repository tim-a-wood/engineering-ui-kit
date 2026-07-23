import { readFile } from 'node:fs/promises'
import type { EvidenceSnapshot } from '../domain/model.js'
import { sha256Json } from '../lib/files.js'
import type { SampleSnapshotPort } from '../ports/outbound.js'

export class SampleSnapshotAdapter implements SampleSnapshotPort {
  readonly id = 'adapter.sample-snapshot'

  constructor(private readonly snapshotPath: string) {}

  async load(): Promise<EvidenceSnapshot> {
    const parsed = JSON.parse(await readFile(this.snapshotPath, 'utf8')) as EvidenceSnapshot
    const { contentHash, ...snapshotWithoutHash } = parsed
    if (
      parsed.schemaVersion !== '1.0'
      || parsed.workspace.kind !== 'sample'
      || parsed.evidence.length === 0
      || contentHash.length !== 64
      || sha256Json(snapshotWithoutHash) !== contentHash
    ) {
      throw new Error('bundled sample snapshot failed integrity validation')
    }
    return parsed
  }
}
