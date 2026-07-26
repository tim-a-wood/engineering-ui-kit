/**
 * EUC-04 — six-step module-design session (§9.3, §16.3, §18.3).
 */
import { describe, expect, it } from 'vitest'
import {
  answerSessionQuestion,
  completeStep,
  createSession,
  goToStep,
  resumePoint,
  sessionPrimaryAction,
} from '../../../src/capabilities/design/moduleDesignSession.js'
import {
  applyModuleDesignChecks,
  createModuleDesignDraft,
  evaluateModuleDesignChecks,
} from '../../../src/capabilities/design/moduleDesign.js'
import { MODULE_DESIGN_STEPS } from '../../../src/capabilities/design/records.js'
import type { ContextManifest, ModuleDesignStep } from '../../../src/capabilities/design/records.js'
import type { ArchitectureSpecification } from '../../../src/capabilities/types.js'

function manifestFixture(): ContextManifest {
  return { id: 'ctx-1', targetRecordId: 'mod.domain', targetRevision: 'r1', tokenOrByteLimit: 8000, totalBytes: 0, entries: [], omitted: [], contentHash: 'ctx-hash' }
}

function architectureFixture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: 'r1',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: 'r1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.domain'],
    moduleDefinitions: [{ moduleId: 'mod.domain', name: 'Domain module', moduleType: 'domain', responsibility: 'Own domain rules' }],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
  }
}

describe('EUC-04 createSession', () => {
  it('starts at step "boundary" with no completed steps', () => {
    const session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(session.currentStep).toBe('boundary')
    expect(session.completedSteps).toEqual([])
    expect(session.state).toBe('created')
  })

  it('is deterministic for the same input', () => {
    const input = {
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    }
    expect(createSession(input).id).toBe(createSession(input).id)
  })

  it('serializes cleanly to JSON for persistence', () => {
    const session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    const withAnswer = answerSessionQuestion(session, { questionId: 'q1', step: 'boundary', text: 'yes', answeredAt: '2026-01-01T00:01:00.000Z' })
    const roundTripped = JSON.parse(JSON.stringify(withAnswer))
    expect(roundTripped).toEqual(withAnswer)
  })
})

describe('EUC-04 goToStep', () => {
  it('opens any completed step', () => {
    const session0 = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    const session1 = completeStep(session0, 'boundary', '2026-01-01T00:01:00.000Z')
    const session2 = completeStep(session1, 'behavior', '2026-01-01T00:02:00.000Z')
    expect(session2.currentStep).toBe('contracts')

    const back = goToStep(session2, 'boundary', '2026-01-01T00:03:00.000Z')
    expect(back.ok).toBe(true)
    expect(back.session.currentStep).toBe('boundary')
  })

  it('refuses to open a step that is not yet reached', () => {
    const session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    const result = goToStep(session, 'approval', '2026-01-01T00:01:00.000Z')
    expect(result.ok).toBe(false)
    expect(result.session).toBe(session)
    expect(result.diagnostics[0]?.code).toBe('MODSESSION-STEP-LOCKED')
  })

  it('preserves later draft data when returning to an earlier step', () => {
    let session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    session = completeStep(session, 'boundary', '2026-01-01T00:01:00.000Z')
    session = answerSessionQuestion(session, { questionId: 'behavior.q1', step: 'behavior', text: 'the answer', answeredAt: '2026-01-01T00:02:00.000Z' })
    session = completeStep(session, 'behavior', '2026-01-01T00:03:00.000Z')

    const back = goToStep(session, 'boundary', '2026-01-01T00:04:00.000Z')
    expect(back.ok).toBe(true)
    // Later draft data (the behavior-step answer, and the behavior completion) is untouched.
    expect(back.session.answers).toEqual(session.answers)
    expect(back.session.completedSteps).toEqual(session.completedSteps)
    expect(back.session.answers.find((a) => a.questionId === 'behavior.q1')?.text).toBe('the answer')
  })
})

describe('EUC-04 answerSessionQuestion', () => {
  it('upserts an answer by questionId, preserving its position', () => {
    let session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    session = answerSessionQuestion(session, { questionId: 'q1', step: 'boundary', text: 'first', answeredAt: '2026-01-01T00:01:00.000Z' })
    session = answerSessionQuestion(session, { questionId: 'q2', step: 'boundary', text: 'second', answeredAt: '2026-01-01T00:02:00.000Z' })
    session = answerSessionQuestion(session, { questionId: 'q1', step: 'boundary', text: 'first-updated', answeredAt: '2026-01-01T00:03:00.000Z' })

    expect(session.answers.map((a) => a.questionId)).toEqual(['q1', 'q2'])
    expect(session.answers[0]?.text).toBe('first-updated')
  })
})

describe('EUC-04 completeStep and resumePoint (§18.3)', () => {
  it('resumes at exactly the first incomplete step', () => {
    let session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(resumePoint(session)).toBe('boundary')

    session = completeStep(session, 'boundary', '2026-01-01T00:01:00.000Z')
    expect(resumePoint(session)).toBe('behavior')

    session = completeStep(session, 'behavior', '2026-01-01T00:02:00.000Z')
    session = completeStep(session, 'contracts', '2026-01-01T00:03:00.000Z')
    expect(resumePoint(session)).toBe('diagrams')

    for (const step of MODULE_DESIGN_STEPS) {
      session = completeStep(session, step, '2026-01-01T00:04:00.000Z')
    }
    expect(session.state).toBe('completed')
    expect(resumePoint(session)).toBe(session.currentStep)
  })

  it('does not skip ahead if a later step is completed out of order', () => {
    let session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    // Only "behavior" is marked complete; "boundary" is still open.
    session = { ...session, completedSteps: ['behavior'] }
    expect(resumePoint(session)).toBe('boundary')
  })
})

describe('EUC-04 sessionPrimaryAction (§9.3)', () => {
  const baseSession = () =>
    createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifestFixture(),
      now: '2026-01-01T00:00:00.000Z',
    })

  it('suggests creating a module draft when there is no design yet', () => {
    expect(sessionPrimaryAction(baseSession(), undefined, undefined)).toBe('Create module draft')
  })

  it('suggests answering required questions when material items are open', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const design = {
      ...draft,
      unresolvedItems: [
        { id: 'q1', description: 'a', materiality: 'material' as const },
        { id: 'q2', description: 'b', materiality: 'material' as const },
      ],
    }
    expect(sessionPrimaryAction(baseSession(), design, undefined)).toBe('Answer 2 required questions')
  })

  it('suggests reviewing contracts while on the contracts step', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    let session = baseSession()
    session = completeStep(session, 'boundary', '2026-01-01T00:01:00.000Z')
    session = completeStep(session, 'behavior', '2026-01-01T00:02:00.000Z')
    expect(session.currentStep).toBe('contracts')
    expect(sessionPrimaryAction(session, draft, undefined)).toBe('Review contracts')
  })

  it('suggests fixing design errors when checks fail', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const { design, evaluation } = applyModuleDesignChecks(draft)
    let session = baseSession()
    session = { ...session, currentStep: 'checks', completedSteps: ['boundary', 'behavior', 'contracts', 'diagrams'] }
    const label = sessionPrimaryAction(session, design, evaluation)
    expect(label).toMatch(/^Fix \d+ design errors?$/)
  })

  it('runs the first checks pass before presenting preview blockers as fixes', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const evaluation = evaluateModuleDesignChecks(draft)
    const session = {
      ...baseSession(),
      currentStep: 'checks' as const,
      completedSteps: ['boundary', 'behavior', 'contracts', 'diagrams'] as ModuleDesignStep[],
    }
    expect(evaluation.blockerCount).toBeGreaterThan(0)
    expect(draft.gates).toEqual([])
    expect(sessionPrimaryAction(session, draft, evaluation)).toBe('Run design checks')
  })

  it('requires the explicit checks step before approval even when the record is already ready', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const readyDesign = {
      ...draft,
      status: 'readyForReview' as const,
      module: { ...draft.module, responsibility: 'ok' },
      unresolvedItems: [],
    }
    let session = baseSession()
    session = { ...session, currentStep: 'checks', completedSteps: ['boundary', 'behavior', 'contracts', 'diagrams'] }
    const passingChecks = { gateId: 'EUC-04-MODULE-DESIGN-CHECKS' as const, passed: true, diagnostics: [], blockerCount: 0, warningCount: 0 }
    expect(sessionPrimaryAction(session, readyDesign, passingChecks)).toBe('Run design checks')
    session = completeStep(session, 'checks', '2026-01-01T00:03:00.000Z')
    expect(sessionPrimaryAction(session, readyDesign, passingChecks)).toBe('Approve module')
  })

  it('suggests creating an implementation handoff once the module is approved', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const approvedDesign = { ...draft, status: 'approved' as const, unresolvedItems: [] }
    let session = baseSession()
    session = { ...session, completedSteps: [...MODULE_DESIGN_STEPS] }
    const passingChecks = { gateId: 'EUC-04-MODULE-DESIGN-CHECKS' as const, passed: true, diagnostics: [], blockerCount: 0, warningCount: 0 }
    expect(sessionPrimaryAction(session, approvedDesign, passingChecks)).toBe('Create implementation handoff')
  })
})
