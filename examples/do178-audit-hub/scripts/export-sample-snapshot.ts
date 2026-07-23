import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WATERMARK,
  WORKSPACE_NAME,
  SOFTWARE_LEVEL,
  allEvidence,
  auditRecords,
  baselines,
  canonicalChain,
  changeRecords,
  coverageRows,
  deviationRows,
  findings,
  openActions,
  refreshSourceCounts,
  removedIn240,
  reproChecks,
  reviewRecords,
  sampleCounts,
  seedPackage,
} from '../src/fixtures.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(here, '../sample-data/aeronav-2.4.0.json')

const content = {
  schemaVersion: '1.0',
  snapshotId: 'sample-aeronav-2.4.0',
  workspace: {
    id: 'sample-aeronav',
    name: WORKSPACE_NAME,
    kind: 'sample',
    softwareLevel: SOFTWARE_LEVEL,
    do331Applicable: true,
    watermark: WATERMARK,
  },
  baselineId: '2.4.0',
  comparisonBaselineId: '2.3.0',
  publishedAt: '2026-07-10T09:00:00.000Z',
  revisionSet: [
    {
      sourceId: 'sample-normalized-snapshot',
      revision: 'aeronav-synthetic-r2.4.0',
      dirty: false,
      provenance: 'Bundled deterministic normalized extraction snapshot',
    },
  ],
  evidence: allEvidence,
  findings,
  reviews: reviewRecords,
  baselines,
  changes: changeRecords,
  coverage: coverageRows,
  audits: auditRecords,
  openActions,
  reproducibilityChecks: reproChecks,
  deviations: deviationRows,
  removedEvidence: removedIn240,
  canonicalChain,
  refreshSources: refreshSourceCounts,
  counts: sampleCounts,
  seedPackage,
}

const canonical = JSON.stringify(content)
const snapshot = {
  ...content,
  contentHash: createHash('sha256').update(canonical).digest('hex'),
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
process.stdout.write(`${outputPath}\n`)
