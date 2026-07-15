/**
 * Capability workspace migration helpers (CAP-PKT-029, CAP-ERA §14.1).
 *
 * Schema 1.0 -> 2.0 migration: convert FrontendBinding records to ui
 * InboundBinding records (additively, losslessly), promote preserved module
 * interviews to ModuleImplementationSpecification, and bump the workspace
 * schema version. Apply snapshots the workspace first and is fully reversible.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  CapabilityWorkspace,
  CURRENT_WORKSPACE_SCHEMA_VERSION,
  type SchemaMeta,
} from './persistence.js'
import { frontendBindingToInboundBinding } from './binding.js'
import type {
  CapabilityMigrationPlan,
  ModuleImplementationSpecification,
  ModuleManifest,
  RuntimeLanguage,
} from './types.js'
import type { ModuleInterviewResponse } from './moduleInterview.js'

export type MigrationEvidence = {
  fromVersion: string
  toVersion: string
  migratedAt: string
  idempotent: boolean
}

function readSchemaMeta(root: string): SchemaMeta | undefined {
  const metaPath = path.join(root, 'meta', 'schema-version.json')
  return fs.existsSync(metaPath) ? (JSON.parse(fs.readFileSync(metaPath, 'utf8')) as SchemaMeta) : undefined
}

/** Legacy compatibility: ensure init and record evidence (CAP-PKT-029). */
export function migrateCapabilityWorkspace(
  workspace: CapabilityWorkspace,
  projectId: string,
): MigrationEvidence {
  const before = readSchemaMeta(workspace.root(projectId))
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

/**
 * Best-effort promotion of a preserved module interview into a canonical
 * CAP-CONTRACT-031 ModuleImplementationSpecification. Missing detail is recorded
 * as unresolved items rather than fabricated.
 */
export function promoteInterviewToModuleImplementationSpecification(input: {
  manifest: ModuleManifest
  interview?: ModuleInterviewResponse
  projectId: string
  deployableId: string
  runtimeLanguage: RuntimeLanguage
}): ModuleImplementationSpecification {
  const { manifest, interview } = input
  const unresolvedItems: ModuleImplementationSpecification['unresolvedItems'] = []
  if (!interview) {
    unresolvedItems.push({
      id: 'missing-interview',
      description: 'No preserved module interview was available to promote; fields inferred from the manifest only.',
      materiality: 'material',
    })
  }
  const acceptanceCases = interview?.acceptanceCases ?? []
  if (!acceptanceCases.length) {
    unresolvedItems.push({
      id: 'missing-acceptance-cases',
      description: 'No acceptance cases were preserved; derive them from the responsibility before implementation.',
      materiality: 'non-material',
    })
  }
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    moduleId: manifest.moduleId,
    moduleVersion: manifest.moduleVersion,
    moduleType: manifest.moduleType,
    runtimeLanguage: input.runtimeLanguage,
    deployableId: input.deployableId,
    ownedPaths: manifest.ownedPaths,
    editablePaths: manifest.ownedPaths,
    responsibility: manifest.responsibility,
    nonResponsibilities: manifest.excludedConcerns,
    providedOperations: manifest.providedOperations.map((op) => ({
      operationId: op.operationId,
      contractVersion: op.contractVersion,
    })),
    requiredOperations: manifest.requiredOperations.map((op) => ({
      operationId: op.operationId,
      acceptedContractRange: op.acceptedContractRange,
      reason: op.reason,
    })),
    providedPorts: manifest.providedOperations.map((op) => op.operationId),
    requiredPorts: manifest.requiredOperations.map((op) => op.operationId),
    canonicalSchemaRefs: (interview?.dataSchemas ?? []).map((schema) => schema.schemaId),
    generatedTypeTargets: [],
    rules: interview?.rules ?? [],
    invariants: [],
    examples: [],
    edgeCases: [],
    failureSemantics: [],
    performanceConstraints: [],
    cancellationExpectations: 'unspecified (migrated)',
    timeoutExpectations: 'unspecified (migrated)',
    concurrencyExpectations: 'unspecified (migrated)',
    lifecycleRegistration: 'request-job',
    configurationRefs: [],
    secretReferenceIds: [],
    persistenceExpectations: 'unspecified (migrated)',
    telemetryExpectations: 'unspecified (migrated)',
    healthExpectations: 'unspecified (migrated)',
    implementationSteps: [],
    acceptanceCases,
    acceptanceCommands: [],
    unresolvedItems,
  }
}

/** Build a reviewable 1.0 -> 2.0 migration preview (no writes). */
export function planCapabilityMigration(
  workspace: CapabilityWorkspace,
  projectId: string,
): CapabilityMigrationPlan {
  const root = workspace.root(projectId)
  const meta = readSchemaMeta(root)
  const fromVersion = meta?.schemaVersion ?? '1.0'
  const bindings = meta ? workspace.listBindings(projectId) : []
  const recordTransformations = bindings
    .filter((binding) => binding.approved || binding.draft)
    .map((binding) => ({
      recordId: binding.bindingId,
      kind: 'frontend-binding-to-inbound-binding',
      description: `Convert ui FrontendBinding ${binding.bindingId} to an InboundBinding (kind: ui).`,
    }))
  return {
    schemaVersion: '1.0',
    migrationPlanId: `migrate-${projectId}-${fromVersion}-to-${CURRENT_WORKSPACE_SCHEMA_VERSION}`,
    projectId,
    versions: {
      fromWorkspaceVersion: fromVersion,
      toWorkspaceVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
    },
    recordTransformations,
    fileTransformations: [
      {
        path: 'meta/schema-version.json',
        action: 'update',
        description: `Set workspace schema version to ${CURRENT_WORKSPACE_SCHEMA_VERSION}.`,
      },
    ],
    compatibilityShims: [
      'FrontendBinding (CAP-CONTRACT-013) retained; ui InboundBinding (CAP-CONTRACT-028) is its successor.',
    ],
    dataLossAssessment: { hasLoss: false, details: [] },
    blockedAmbiguities: [],
    previewHashes: [],
    backupInstructions: 'A snapshot of capabilities/ (excluding meta/backups) is taken before apply.',
    rollbackInstructions: 'Call rollbackCapabilityMigration with the returned backupId to restore the pre-migration snapshot.',
    conformanceCommands: ['npm run test --workspace=@engineering-ui-kit/core'],
  }
}

/** Apply the 1.0 -> 2.0 migration. Idempotent, snapshotted, and reversible. */
export function applyCapabilityMigration(
  workspace: CapabilityWorkspace,
  projectId: string,
  options: { deployableId?: string } = {},
): { plan: CapabilityMigrationPlan; evidence: MigrationEvidence; backupId?: string } {
  const root = workspace.root(projectId)
  const meta = readSchemaMeta(root)
  const fromVersion = meta?.schemaVersion ?? 'none'
  const plan = planCapabilityMigration(workspace, projectId)
  const now = new Date().toISOString()

  if (fromVersion === CURRENT_WORKSPACE_SCHEMA_VERSION) {
    return {
      plan,
      evidence: { fromVersion, toVersion: CURRENT_WORKSPACE_SCHEMA_VERSION, migratedAt: now, idempotent: true },
    }
  }

  workspace.ensureInitialized(projectId)
  const metaPath = path.join(root, 'meta', 'schema-version.json')
  const initializedAt = readSchemaMeta(root)?.initializedAt ?? now

  // 1) Snapshot the workspace to a target-local bundle OUTSIDE the workspace root
  //    (Node refuses to copy a directory into a subdirectory of itself).
  const backupId = `backup-${now.replace(/[:.]/g, '-')}`
  const backupsRoot = path.join(path.dirname(root), 'capability-backups')
  const backupDir = path.join(backupsRoot, backupId)
  fs.mkdirSync(backupDir, { recursive: true })
  fs.cpSync(root, backupDir, { recursive: true })

  // 2) Convert stored ui FrontendBindings to InboundBindings (additive).
  const deployableId = options.deployableId ?? 'ui'
  for (const { bindingId, draft, approved } of workspace.listBindings(projectId)) {
    for (const [phase, binding] of [['drafts', draft], ['approved', approved]] as const) {
      if (!binding) continue
      const inbound = frontendBindingToInboundBinding(binding, { deployableId })
      const dest = path.join(root, 'bindings', bindingId, 'inbound', phase, `${binding.version}.json`)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, JSON.stringify(inbound, null, 2) + '\n')
    }
  }

  // 3) Bump the workspace schema version.
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION, initializedAt }, null, 2) + '\n',
  )

  // 4) Write the rollback journal alongside the snapshot.
  const evidence: MigrationEvidence = {
    fromVersion,
    toVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
    migratedAt: now,
    idempotent: false,
  }
  fs.writeFileSync(
    path.join(backupsRoot, `${backupId}.journal.json`),
    JSON.stringify({ backupId, plan, evidence }, null, 2) + '\n',
  )

  return { plan, evidence, backupId }
}

/** Restore the pre-migration snapshot captured by applyCapabilityMigration. */
export function rollbackCapabilityMigration(
  workspace: CapabilityWorkspace,
  projectId: string,
  backupId: string,
): MigrationEvidence {
  const root = workspace.root(projectId)
  const backupDir = path.join(path.dirname(root), 'capability-backups', backupId)
  if (!fs.existsSync(backupDir)) {
    throw new Error(`rollback bundle not found: ${backupId}`)
  }
  const versionBefore = readSchemaMeta(root)?.schemaVersion ?? 'none'

  // Replace the entire workspace root with the pre-migration snapshot.
  fs.rmSync(root, { recursive: true, force: true })
  fs.cpSync(backupDir, root, { recursive: true })

  const restored = readSchemaMeta(root)?.schemaVersion ?? 'none'
  return {
    fromVersion: versionBefore,
    toVersion: restored,
    migratedAt: new Date().toISOString(),
    idempotent: false,
  }
}
