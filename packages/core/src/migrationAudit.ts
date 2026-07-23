import fs from 'node:fs'
import path from 'node:path'
import { Workspace } from './persistence.js'
import { normalizeWorkLifecycleState } from './work.js'
import {
  CapabilityRunStore,
  CapabilityWorkspace,
  CURRENT_WORKSPACE_SCHEMA_VERSION,
  SUPPORTED_WORKSPACE_SCHEMA_VERSIONS,
  planCapabilityMigration,
  type SchemaMeta,
} from './capabilities/index.js'

export type ProjectMigrationAudit = {
  projectId: string
  projectName: string
  status: 'not-initialized' | 'current' | 'migration-available' | 'read-only' | 'attention'
  workspaceVersion?: string
  targetVersion: string
  legacyFrontendBindings: number
  canonicalInboundBindings: number
  unknownLifecycleRuns: { runId: string; value: string }[]
  dataLossRisk: boolean
  diagnostics: string[]
}

export type WorkspaceMigrationAudit = {
  schemaVersion: '1.0'
  auditedAt: string
  dataDir: string
  projects: ProjectMigrationAudit[]
  summary: Record<ProjectMigrationAudit['status'], number>
}

/** Read-only audit. It never initializes, migrates, or rewrites a project. */
export function auditWorkspaceMigrations(
  dataDir: string,
  auditedAt = new Date().toISOString(),
): WorkspaceMigrationAudit {
  const workspace = new Workspace(dataDir)
  const caps = new CapabilityWorkspace(dataDir)
  const runs = new CapabilityRunStore(caps)
  const projects = workspace.listProjects().map((project): ProjectMigrationAudit => {
    const root = caps.root(project.id)
    const metaPath = path.join(root, 'meta', 'schema-version.json')
    if (!fs.existsSync(metaPath)) {
      return {
        projectId: project.id,
        projectName: project.name,
        status: 'not-initialized',
        targetVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
        legacyFrontendBindings: 0,
        canonicalInboundBindings: 0,
        unknownLifecycleRuns: [],
        dataLossRisk: false,
        diagnostics: [],
      }
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as SchemaMeta
    const supported = (SUPPORTED_WORKSPACE_SCHEMA_VERSIONS as readonly string[]).includes(meta.schemaVersion)
    if (!supported) {
      return {
        projectId: project.id,
        projectName: project.name,
        status: 'read-only',
        workspaceVersion: meta.schemaVersion,
        targetVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
        legacyFrontendBindings: 0,
        canonicalInboundBindings: 0,
        unknownLifecycleRuns: [],
        dataLossRisk: false,
        diagnostics: [`Workspace version ${meta.schemaVersion} is not supported by this build.`],
      }
    }
    const legacyFrontendBindings = caps.listBindings(project.id)
      .filter((record) => record.draft || record.approved).length
    const canonicalInboundBindings = caps.listInboundBindings(project.id)
      .filter((record) => record.draft || record.approved).length
    const unknownLifecycleRuns = runs.listRuns(project.id).flatMap((run) => {
      const normalized = normalizeWorkLifecycleState(run.lifecycleState)
      return normalized.condition === 'legacy-unknown'
        ? [{ runId: run.runId, value: String(run.lifecycleState) }]
        : []
    })
    const plan = planCapabilityMigration(caps, project.id)
    const migrationAvailable = meta.schemaVersion !== CURRENT_WORKSPACE_SCHEMA_VERSION
    const diagnostics = [
      ...plan.blockedAmbiguities.map((value) => String(value)),
      ...unknownLifecycleRuns.map((run) => `${run.runId} has unknown lifecycle value ${run.value}.`),
      ...(legacyFrontendBindings > 0 && canonicalInboundBindings === 0
        ? ['Legacy frontend bindings have not been projected into canonical inbound bindings.']
        : []),
    ]
    const status: ProjectMigrationAudit['status'] =
      plan.dataLossAssessment.hasLoss || diagnostics.length > 0 ? 'attention'
        : migrationAvailable ? 'migration-available'
          : 'current'
    return {
      projectId: project.id,
      projectName: project.name,
      status,
      workspaceVersion: meta.schemaVersion,
      targetVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
      legacyFrontendBindings,
      canonicalInboundBindings,
      unknownLifecycleRuns,
      dataLossRisk: plan.dataLossAssessment.hasLoss,
      diagnostics,
    }
  })
  const summary: WorkspaceMigrationAudit['summary'] = {
    'not-initialized': 0,
    current: 0,
    'migration-available': 0,
    'read-only': 0,
    attention: 0,
  }
  for (const project of projects) summary[project.status] += 1
  return { schemaVersion: '1.0', auditedAt, dataDir, projects, summary }
}
