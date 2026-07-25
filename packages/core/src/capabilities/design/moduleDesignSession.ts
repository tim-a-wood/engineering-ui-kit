/**
 * EUC-04 — Module-design session (§9.3, §16.3, §18.1, §18.3).
 *
 * The six-step, resumable module-design session. Sessions are plain data
 * (`ModuleDesignSession`, §16.3) so they serialize cleanly to JSON for
 * persistence and restart (§25.3 EUC-13..17 "persistence restart restores
 * the module session and selected module").
 */

import type { ContextManifest, DesignAnswer, DesignDiagnostic, ModuleDesignSession, ModuleDesignSpecification, ModuleDesignStep } from './records.js'
import { MODULE_DESIGN_STEPS } from './records.js'
import { childId } from './identity.js'
import type { ModuleDesignCheckEvaluation } from './moduleDesign.js'

export type CreateModuleDesignSessionInput = {
  id?: string
  projectId: string
  moduleId: string
  baseArchitectureRevision: string
  baseModuleDesignRevision?: string
  sourceManifest: ContextManifest
  now: string
}

/** §9.3 — creates a session at step 1 ("Review boundary"), state `created`. */
export function createSession(input: CreateModuleDesignSessionInput): ModuleDesignSession {
  return {
    id: input.id ?? childId(input.projectId, 'module-design-session', input.moduleId),
    projectId: input.projectId,
    moduleId: input.moduleId,
    baseArchitectureRevision: input.baseArchitectureRevision,
    baseModuleDesignRevision: input.baseModuleDesignRevision,
    state: 'created',
    currentStep: 'boundary',
    completedSteps: [],
    sourceManifest: input.sourceManifest,
    answers: [],
    diagnostics: [],
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export type GoToStepResult = { ok: boolean; session: ModuleDesignSession; diagnostics: DesignDiagnostic[] }

/**
 * §9.3 — any completed step is openable, and the current step is always
 * openable. Returning to an earlier step never drops later draft data:
 * `answers` and `diagnostics` are never cleared by navigation.
 */
export function goToStep(session: ModuleDesignSession, step: ModuleDesignStep, now: string): GoToStepResult {
  const allowed = session.currentStep === step || session.completedSteps.includes(step)
  if (!allowed) {
    return {
      ok: false,
      session,
      diagnostics: [
        {
          id: `${session.id}.step.${step}.locked`,
          code: 'MODSESSION-STEP-LOCKED',
          severity: 'blocker',
          message: `step "${step}" is not open yet; complete the earlier steps first`,
          target: step,
        },
      ],
    }
  }
  return { ok: true, session: { ...session, currentStep: step, updatedAt: now }, diagnostics: [] }
}

export type AnswerSessionQuestionInput = {
  questionId: string
  step: ModuleDesignStep
  text: string
  answeredAt: string
}

/** Upserts one answer by `questionId`, preserving the position of an existing answer. */
export function answerSessionQuestion(session: ModuleDesignSession, answer: AnswerSessionQuestionInput): ModuleDesignSession {
  const nextAnswer: DesignAnswer = { questionId: answer.questionId, step: answer.step, text: answer.text, answeredAt: answer.answeredAt }
  const existingIndex = session.answers.findIndex((candidate) => candidate.questionId === answer.questionId)
  const answers =
    existingIndex >= 0
      ? session.answers.map((candidate, index) => (index === existingIndex ? nextAnswer : candidate))
      : [...session.answers, nextAnswer]
  return { ...session, answers, updatedAt: answer.answeredAt }
}

/**
 * §9.3 — marks `step` complete and, if it was the current step, advances to
 * the next step in the fixed six-step order. Marks the session `completed`
 * once every step has been completed at least once.
 */
export function completeStep(session: ModuleDesignSession, step: ModuleDesignStep, now: string): ModuleDesignSession {
  const completedSteps = session.completedSteps.includes(step) ? session.completedSteps : [...session.completedSteps, step]
  const stepIndex = MODULE_DESIGN_STEPS.indexOf(step)
  const nextStep = MODULE_DESIGN_STEPS[stepIndex + 1] ?? step
  const allCompleted = MODULE_DESIGN_STEPS.every((candidate) => completedSteps.includes(candidate))
  return {
    ...session,
    completedSteps,
    currentStep: session.currentStep === step ? nextStep : session.currentStep,
    state: allCompleted ? 'completed' : session.state === 'created' ? 'drafting' : session.state,
    updatedAt: now,
  }
}

/** §18.3 — the exact incomplete step a resume action should return to. */
export function resumePoint(session: ModuleDesignSession): ModuleDesignStep {
  for (const step of MODULE_DESIGN_STEPS) {
    if (!session.completedSteps.includes(step)) return step
  }
  return session.currentStep
}

function requiredOpenQuestionCount(design: ModuleDesignSpecification): number {
  return design.unresolvedItems.filter((item) => item.materiality === 'material' && !item.resolvedAt).length
}

/**
 * §9.3 — the single primary action label for the session. Examples:
 * `Create module draft`, `Answer 2 required questions`, `Review contracts`,
 * `Fix 1 design error`, `Approve module`, `Create Copilot handoff`.
 */
export function sessionPrimaryAction(
  session: ModuleDesignSession,
  design: ModuleDesignSpecification | undefined,
  checks: ModuleDesignCheckEvaluation | undefined,
): string {
  if (!design) return 'Create module draft'

  const requiredQuestions = requiredOpenQuestionCount(design)
  if (requiredQuestions > 0) {
    return `Answer ${requiredQuestions} required question${requiredQuestions === 1 ? '' : 's'}`
  }

  if (session.currentStep === 'contracts' && !session.completedSteps.includes('contracts')) {
    return 'Review contracts'
  }

  const blockerCount = checks?.diagnostics.filter((diagnostic) => diagnostic.severity === 'blocker').length ?? 0
  if (blockerCount > 0) {
    return `Fix ${blockerCount} design error${blockerCount === 1 ? '' : 's'}`
  }

  if (design.status === 'readyForReview') return 'Approve module'
  if (design.status === 'approved') return 'Create Copilot handoff'

  return 'Continue module design'
}
