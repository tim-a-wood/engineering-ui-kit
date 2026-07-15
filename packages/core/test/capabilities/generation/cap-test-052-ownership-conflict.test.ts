/**
 * CAP-TEST-052 — tampering with an ownership hash blocks regeneration of the
 * affected file.
 */
import { describe, expect, it } from 'vitest'
import { buildOwnershipManifest, detectOwnershipConflicts, generatedContentHash } from '../../../src/capabilities/generation/ownership.js'
import { buildGenerationPlan, type GenerationPlanInput } from '../../../src/capabilities/generation/plan.js'

describe('CAP-TEST-052 ownership tampering blocks regeneration', () => {
  const filePath = 'src/composition/api.ts'
  const originalContent = 'export const composition = () => {}\n'

  function baseManifest() {
    return buildOwnershipManifest({
      projectId: 'proj-1',
      filePath,
      content: originalContent,
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      sourceContractHashes: ['arch-hash'],
      deployableId: 'http-api',
      moduleIds: ['mod.domain.orders'],
      lastAppliedPlanId: 'plan-0000',
      safeToDelete: false,
    })
  }

  it('detects no conflict when the current hash still matches the last-applied hash', () => {
    const manifest = baseManifest()
    const conflicts = detectOwnershipConflicts([manifest], { [filePath]: manifest.contentHash })
    expect(conflicts).toEqual([])
  })

  it('detects a conflict when the file was modified outside generation', () => {
    const manifest = baseManifest()
    const tamperedHash = generatedContentHash('// hand-edited, no longer matches the generated content\n')
    const conflicts = detectOwnershipConflicts([manifest], { [filePath]: tamperedHash })
    expect(conflicts).toEqual([{ path: filePath, expectedHash: manifest.contentHash, actualHash: tamperedHash }])
  })

  it('a GenerationPlan excludes the tampered file from fileChanges and records a blocker', () => {
    const manifest = baseManifest()
    const tamperedHash = generatedContentHash('// hand-edited, no longer matches the generated content\n')
    const input: GenerationPlanInput = {
      planId: 'plan-0001',
      projectId: 'proj-1',
      inputRecords: [],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: '.', cleanState: 'clean' },
      dependencyChanges: [],
      fileChanges: [
        { path: filePath, action: 'update', ownership: 'generated', reason: 'regenerate composition root' },
        { path: 'src/domain/orders.ts', action: 'create', ownership: 'editable', reason: 'new module scaffold' },
      ],
      commands: [],
      rollbackStrategy: 'staged-rename-with-journal',
      ownershipManifests: [manifest],
      currentContentHashesByPath: { [filePath]: tamperedHash },
    }

    const plan = buildGenerationPlan(input)
    expect(plan.fileChanges.map((change) => change.path)).toEqual(['src/domain/orders.ts'])
    expect(plan.blockers.some((message) => message.includes(filePath))).toBe(true)
  })

  it('an explicit conflict decision (resolvedConflictPaths) unblocks regeneration of that file', () => {
    const manifest = baseManifest()
    const tamperedHash = generatedContentHash('// hand-edited\n')
    const input: GenerationPlanInput = {
      planId: 'plan-0002',
      projectId: 'proj-1',
      inputRecords: [],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: '.', cleanState: 'clean' },
      dependencyChanges: [],
      fileChanges: [
        { path: filePath, action: 'update', ownership: 'generated', reason: 'regenerate composition root' },
      ],
      commands: [],
      rollbackStrategy: 'staged-rename-with-journal',
      ownershipManifests: [manifest],
      currentContentHashesByPath: { [filePath]: tamperedHash },
      resolvedConflictPaths: [filePath],
    }
    const plan = buildGenerationPlan(input)
    expect(plan.fileChanges.map((change) => change.path)).toEqual([filePath])
    expect(plan.blockers).toEqual([])
  })

  it('a brand-new generated file (no prior ownership manifest) is never blocked', () => {
    const input: GenerationPlanInput = {
      planId: 'plan-0003',
      projectId: 'proj-1',
      inputRecords: [],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: '.', cleanState: 'clean' },
      dependencyChanges: [],
      fileChanges: [
        { path: 'src/composition/new-file.ts', action: 'create', ownership: 'generated', reason: 'first generation' },
      ],
      commands: [],
      rollbackStrategy: 'staged-rename-with-journal',
    }
    const plan = buildGenerationPlan(input)
    expect(plan.fileChanges).toHaveLength(1)
    expect(plan.blockers).toEqual([])
  })
})
