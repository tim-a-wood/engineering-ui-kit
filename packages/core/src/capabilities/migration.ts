/**
 * Capability workspace migration helpers (CAP-PKT-029).
 */

import fs from 'node:fs'
import path from 'node:path'
import { CapabilityWorkspace, type SchemaMeta } from './persistence.js'

export type MigrationEvidence = {
  fromVersion: string
  toVersion: string
  migratedAt: string
  idempotent: boolean
}

export function migrateCapabilityWorkspace(
  workspace: CapabilityWorkspace,
  projectId: string,
): MigrationEvidence {
  const metaPath = path.join(workspace.root(projectId), 'meta', 'schema-version.json')
  const before = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, 'utf8')) as SchemaMeta)
    : undefined
  const meta = workspace.ensureInitialized(projectId)
  const evidence: MigrationEvidence = {
    fromVersion: before?.schemaVersion ?? 'none',
    toVersion: meta.schemaVersion,
    migratedAt: new Date().toISOString(),
    idempotent: before?.schemaVersion === meta.schemaVersion,
  }
  const evidencePath = path.join(
    workspace.root(projectId),
    'meta',
    'migrations',
    `${evidence.migratedAt.replace(/[:.]/g, '-')}.json`,
  )
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true })
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n')
  return evidence
}
