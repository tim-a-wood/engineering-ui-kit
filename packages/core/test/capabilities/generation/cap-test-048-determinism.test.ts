/**
 * CAP-TEST-048 — shuffled-but-equivalent inputs yield byte-identical plans
 * (and discovery/deployable output) and an identical `planHash`.
 */
import { describe, expect, it } from 'vitest'
import { discoverRepository, type RepositoryEvidence } from '../../../src/capabilities/generation/repositoryDiscovery.js'
import { proposeDeployables } from '../../../src/capabilities/generation/deployables.js'
import { buildGenerationPlan, type GenerationPlanInput } from '../../../src/capabilities/generation/plan.js'
import { EXISTING_REPO_EVIDENCE, EXISTING_REPO_MODULE_DEFINITIONS, EXISTING_REPO_MODULE_IDS } from './fixtures.js'

function reverseEvidence(evidence: RepositoryEvidence): RepositoryEvidence {
  return {
    repositoryId: evidence.repositoryId,
    files: [...evidence.files].reverse(),
    manifests: [...(evidence.manifests ?? [])].reverse(),
    ciConfigs: [...(evidence.ciConfigs ?? [])].reverse(),
  }
}

describe('CAP-TEST-048 deterministic plans under shuffled-equivalent input', () => {
  it('repository discovery is independent of file/manifest array order', () => {
    const forward = discoverRepository(EXISTING_REPO_EVIDENCE)
    const reversed = discoverRepository(reverseEvidence(EXISTING_REPO_EVIDENCE))
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it('deployable proposal is independent of module-id array order', () => {
    const discovery = discoverRepository(EXISTING_REPO_EVIDENCE)
    const forward = proposeDeployables({
      architectureModuleIds: EXISTING_REPO_MODULE_IDS,
      architectureModuleDefinitions: EXISTING_REPO_MODULE_DEFINITIONS,
      discovery,
    })
    const shuffled = proposeDeployables({
      architectureModuleIds: [...EXISTING_REPO_MODULE_IDS].reverse(),
      architectureModuleDefinitions: [...EXISTING_REPO_MODULE_DEFINITIONS].reverse(),
      discovery,
    })
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(forward))
  })

  it('GenerationPlan and planHash are byte-identical for shuffled equivalent collections', () => {
    const basePlanInput: GenerationPlanInput = {
      planId: 'plan-0001',
      projectId: 'proj-1',
      inputRecords: [
        { recordId: 'architecture', revision: '1', hash: 'arch-hash' },
        { recordId: 'module.mod.domain.orders', revision: '1', hash: 'module-hash' },
      ],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: '.', cleanState: 'clean' },
      dependencyChanges: [
        { packageName: 'fastify', language: 'typescript', toVersion: '5.0.0', reason: 'http host' },
        { packageName: 'pydantic', language: 'python', toVersion: '2.9.0', reason: 'model validation' },
      ],
      fileChanges: [
        { path: 'src/composition/api.ts', action: 'create', ownership: 'generated', reason: 'composition root' },
        { path: 'src/domain/orders.ts', action: 'update', ownership: 'editable', reason: 'domain module scaffold' },
      ],
      commands: ['npm install', 'npm test'],
      warnings: ['dependency upgrade available: fastify'],
      ambiguityQuestions: [{ id: 'source-root', question: 'Which source root?', choices: ['src', 'app'] }],
      rollbackStrategy: 'staged-rename-with-journal',
    }

    const shuffledPlanInput: GenerationPlanInput = {
      ...basePlanInput,
      inputRecords: [...basePlanInput.inputRecords].reverse(),
      dependencyChanges: [...basePlanInput.dependencyChanges].reverse(),
      fileChanges: [...basePlanInput.fileChanges].reverse(),
      warnings: [...(basePlanInput.warnings ?? [])].reverse(),
      ambiguityQuestions: (basePlanInput.ambiguityQuestions ?? []).map((question) => ({
        ...question,
        choices: [...question.choices].reverse(),
      })),
    }

    const planA = buildGenerationPlan(basePlanInput)
    const planB = buildGenerationPlan(shuffledPlanInput)

    expect(JSON.stringify(planB)).toBe(JSON.stringify(planA))
    expect(planB.planHash).toBe(planA.planHash)
    expect(planA.planHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
