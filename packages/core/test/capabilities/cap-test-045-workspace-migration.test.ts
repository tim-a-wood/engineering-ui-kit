/**
 * CAP-TEST-045 — workspace schema 1.0 -> 2.0 migration is idempotent and reversible.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import {
  applyCapabilityMigration,
  promoteInterviewToModuleImplementationSpecification,
  rollbackCapabilityMigration,
} from '../../src/capabilities/migration.js'
import { evaluateModuleImplementationSte } from '../../src/capabilities/simplifiedTechnicalEnglish.js'
import type { FrontendBinding, ModuleManifest } from '../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadFrontendBinding(): FrontendBinding {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'fixtures', 'frontend-binding-valid.json'), 'utf8'),
  )
}

function schemaVersion(ws: CapabilityWorkspace, projectId: string): string {
  const metaPath = path.join(ws.root(projectId), 'meta', 'schema-version.json')
  return JSON.parse(fs.readFileSync(metaPath, 'utf8')).schemaVersion
}

describe('CAP-TEST-045 workspace 1.0 -> 2.0 migration', () => {
  it('migrates approved and draft Connect-era records into the Build read model, is idempotent, and is reversible', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-045-'))
    const ws = new CapabilityWorkspace(dir)
    const binding = loadFrontendBinding()
    ws.approveBinding('proj-1', binding)
    const revisedDraft: FrontendBinding = {
      ...binding,
      version: '1.0.1',
      loadingBehavior: 'Keep the approved behavior visible while revising it.',
      dataMode: 'dependency-unavailable',
    }
    ws.saveBindingDraft('proj-1', revisedDraft)
    expect(schemaVersion(ws, 'proj-1')).toBe('1.0')

    const first = applyCapabilityMigration(ws, 'proj-1', { deployableId: 'web' })
    expect(first.evidence.idempotent).toBe(false)
    expect(first.evidence.toVersion).toBe('2.0')
    expect(first.backupId).toBeDefined()
    expect(schemaVersion(ws, 'proj-1')).toBe('2.0')
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(false)

    const inboundPath = path.join(
      ws.root('proj-1'),
      'inbound-bindings',
      binding.bindingId,
      'approved',
      `${binding.version}.json`,
    )
    expect(fs.existsSync(inboundPath)).toBe(true)
    const migrated = ws.listInboundBindings('proj-1')
    expect(migrated).toHaveLength(1)
    expect(migrated[0]?.bindingId).toBe(binding.bindingId)
    expect(migrated[0]?.approved).toMatchObject({
      bindingId: binding.bindingId,
      version: binding.version,
      kind: 'ui',
      deployableId: 'web',
      operationId: binding.operationId,
      operationVersion: binding.operationVersion,
      exposure: 'private',
      approvalState: 'migrated',
      selectionEvidence: binding.selectionEvidence,
      dataMode: binding.dataMode,
    })
    expect(migrated[0]?.draft).toMatchObject({
      bindingId: binding.bindingId,
      version: revisedDraft.version,
      loadingBehavior: revisedDraft.loadingBehavior,
      dataMode: revisedDraft.dataMode,
      exposure: 'private',
      approvalState: 'migrated',
    })

    // Idempotent: re-applying at 2.0 is a no-op.
    const second = applyCapabilityMigration(ws, 'proj-1', { deployableId: 'web' })
    expect(second.evidence.idempotent).toBe(true)
    expect(schemaVersion(ws, 'proj-1')).toBe('2.0')
    expect(ws.listInboundBindings('proj-1')).toEqual(migrated)

    // Reversible: rollback restores 1.0, the original binding, and drops the inbound artifact.
    rollbackCapabilityMigration(ws, 'proj-1', first.backupId!)
    expect(schemaVersion(ws, 'proj-1')).toBe('1.0')
    expect(fs.existsSync(inboundPath)).toBe(false)
    expect(ws.getApprovedBinding('proj-1', binding.bindingId)).toEqual(binding)
    expect(ws.getBindingDraft('proj-1', binding.bindingId)).toEqual(revisedDraft)
    expect(ws.listInboundBindings('proj-1')).toEqual([])
  })

  it('uses the STE profile for prose in a promoted module specification', () => {
    const manifest: ModuleManifest = {
      schemaVersion: '1.0',
      architectureVersion: '1.0',
      moduleId: 'module-1',
      moduleVersion: '1.0.0',
      moduleType: 'domain',
      name: 'Test module',
      responsibility: 'Provide a test operation.',
      ownedConcerns: ['test'],
      excludedConcerns: [],
      providedOperations: [],
      requiredOperations: [],
      configurationSchemaRef: null,
      verificationSuiteIds: [],
      runtimeAllocation: 'local-embedded',
      events: [],
      ownedPaths: ['src/modules/module-1/'],
    }
    const specification = promoteInterviewToModuleImplementationSpecification({
      manifest,
      projectId: 'project-1',
      deployableId: 'deployable-1',
      runtimeLanguage: 'typescript',
    })

    expect(evaluateModuleImplementationSte(specification).diagnostics).toEqual([])
    expect(specification.unresolvedItems).toEqual([
      expect.objectContaining({
        id: 'missing-interview',
        description: 'The module has no preserved interview. The specification uses only manifest fields.',
      }),
      expect.objectContaining({
        id: 'missing-acceptance-cases',
        description: 'The module has no preserved acceptance case. Add an acceptance case before implementation.',
      }),
    ])
  })
})
