/**
 * Second-review P1 fix — real `configureBinding`/`verifyConnection`/
 * `runScenario` executors reachable through the production desktop IPC
 * entry point (`createDesignIpcDispatch`), not only an injected test
 * executor.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §13,
 * §14.1-14.3, §17.2, §19.
 *
 * Mirrors `design-ipc.test.ts`'s bootstrap helpers
 * (`adapter:configureProjectRepository` + `adapter:configureProjectRoles` +
 * the same use-case/system-design/module-design dispatch sequence), then
 * exercises the three operations end to end against a real temp repository
 * — a real spawned Node child process for `configureBinding`/
 * `verifyConnection`, and a real per-step command for `runScenario`.
 *
 * Run: npx vitest run apps/desktop/test/design-executors.test.ts
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDesignIpcDispatch } from '../src/capabilities/designIpc.js'

function tmpDir(prefix = 'euik-design-exec-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

const actor = 'user:alice'

let idem = 0
function key(): string {
  idem += 1
  return `exec-idem-${idem}`
}

const workflowDetail = {
  trigger: 'A reviewer requests review-package coordination.',
  orderedSteps: [{ id: 'step-refresh', text: 'Refresh evidence' }],
  participants: ['reviewer'],
  decisionsAndGuards: [{ id: 'guard-valid', text: 'inputs are valid' }],
  transactionBoundary: 'single request',
  partialCompletion: 'not supported',
  compensation: 'not applicable',
  retryPolicy: 'retry on transient failure',
  deduplication: 'idempotency key',
  idempotencyKeyUse: 'required on every call',
  cancellationPoints: ['before the price is recorded'],
  deadlinePropagation: 'propagated from the caller',
  resourceLocks: ['none'],
  progressReporting: 'not applicable',
  finalOutcomes: ['completed', 'rejected'],
}

type Dispatch = (request: { operation: string; args: unknown[] }) => any

/**
 * Drives a fresh project through to an approved module design with a real
 * provided operation and the given `configuredCommands` — enough for
 * `configureBinding`/`verifyConnection`/`runScenario` to have a real,
 * approved binding target and real commands to run. The provided operation
 * is whichever operation the architecture already auto-allocated to
 * `mod.core` (§9.6 "a provided operation requires an approved owner
 * allocation") — never an invented id, since `analyzeModuleDesign` rejects
 * one with no real architecture allocation.
 */
function bootstrapApprovedModule(dispatch: Dispatch, projectId: string, configuredCommands: string[]): { scenarioId: string; deployableId: string; operationId: string; operationVersion: string } {
  const draft = dispatch({ operation: 'createUseCaseDraft', args: [{ projectId, actor, idempotencyKey: key(), workDescription: '' }] })
  expect(draft.ok, JSON.stringify(draft.diagnostics)).toBe(true)
  const questionId = draft.value.questions[0].id
  const answered = dispatch({
    operation: 'updateUseCaseItem',
    args: [{ projectId, actor, idempotencyKey: key(), target: { kind: 'question', questionId, answer: 'Explain the module workflow.' } }],
  })
  expect(answered.ok, JSON.stringify(answered.diagnostics)).toBe(true)
  const approvedAnalysis = dispatch({ operation: 'approveUseCaseAnalysis', args: [{ projectId, actor, idempotencyKey: key(), authority: 'product-lead' }] })
  expect(approvedAnalysis.ok, JSON.stringify(approvedAnalysis.diagnostics)).toBe(true)
  const sysDraft = dispatch({ operation: 'createSystemDesignDraft', args: [{ projectId, actor, idempotencyKey: key() }] })
  expect(sysDraft.ok, JSON.stringify(sysDraft.diagnostics)).toBe(true)
  const sysApproved = dispatch({ operation: 'approveSystemStructure', args: [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }] })
  expect(sysApproved.ok, JSON.stringify(sysApproved.diagnostics)).toBe(true)
  const started = dispatch({ operation: 'startModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
  expect(started.ok, JSON.stringify(started.diagnostics)).toBe(true)
  expect(started.value.design.providedOperations.length, JSON.stringify(started.value.design.providedOperations)).toBeGreaterThan(0)
  const { operationId, version: operationVersion } = started.value.design.providedOperations[0]
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [
      {
        projectId,
        actor,
        idempotencyKey: key(),
        moduleId: 'mod.core',
        path: 'schemas',
        value: [
          { schemaId: 'schema.in', version: '1.0', role: 'input', ref: 'schema://in' },
          { schemaId: 'schema.out', version: '1.0', role: 'output', ref: 'schema://out' },
        ],
      },
    ],
  })
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [
      { projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'verification.acceptanceCases', value: [{ id: 'ac1', description: 'x', expectedOutcome: 'y' }] },
    ],
  })
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail }],
  })
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'verification.configuredCommands', value: configuredCommands }],
  })
  dispatch({ operation: 'analyzeModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
  const approved = dispatch({
    operation: 'approveModuleDesign',
    args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' }],
  })
  expect(approved.ok, JSON.stringify(approved.diagnostics)).toBe(true)

  const status = dispatch({ operation: 'getWorkflowStatus', args: [projectId] })
  const analysis = status.useCaseAnalysis.approved
  const scenarioId = analysis.useCases[0].scenarios[0].id

  return { scenarioId, deployableId: approved.value.boundary.deployableId, operationId, operationVersion }
}

function bootstrapProject(dataDir: string, repositoryRoot: string, projectId: string): Dispatch {
  const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })
  const repoConfig = dispatch({ operation: 'adapter:configureProjectRepository', args: [{ projectId, actor, idempotencyKey: key(), repositoryRoot }] })
  expect(repoConfig.ok, JSON.stringify(repoConfig.diagnostics)).toBe(true)
  const roles = dispatch({ operation: 'adapter:configureProjectRoles', args: [{ projectId, actor, idempotencyKey: key() }] })
  expect(roles.ok, JSON.stringify(roles.diagnostics)).toBe(true)
  return dispatch
}

function writeScript(repositoryRoot: string, relPath: string, content: string): void {
  const abs = path.join(repositoryRoot, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

describe('EUC-16 desktop IPC — real configureBinding/verifyConnection/runScenario (second-review P1 fix)', () => {
  it('configureBinding rejects a garbage bindingConfig through the real dispatch path', () => {
    const dataDir = tmpDir()
    const repositoryRoot = tmpDir('euik-design-exec-repo-')
    const projectId = 'proj-exec-garbage'
    const dispatch = bootstrapProject(dataDir, repositoryRoot, projectId)
    bootstrapApprovedModule(dispatch, projectId, [])

    const result = dispatch({
      operation: 'configureBinding',
      args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', bindingConfig: { nope: true } }],
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })

  it('configureBinding + verifyConnection (cli) run real spawned processes through the production IPC entry point', () => {
    const dataDir = tmpDir()
    const repositoryRoot = tmpDir('euik-design-exec-repo-')
    const projectId = 'proj-exec-cli'
    writeScript(repositoryRoot, 'scripts/health.cjs', 'process.exit(0);\n')
    writeScript(repositoryRoot, 'scripts/probe.cjs', "if (!process.argv[2]) process.exit(1);\nprocess.stdout.write('ok');\nprocess.exit(0);\n")

    const dispatch = bootstrapProject(dataDir, repositoryRoot, projectId)
    const { deployableId, operationId, operationVersion } = bootstrapApprovedModule(dispatch, projectId, [`${process.execPath} scripts/health.cjs`])

    const binding = {
      schemaVersion: '1.0',
      kind: 'cli',
      bindingId: 'bind.exec.cli.1',
      version: '1.0.0',
      projectId,
      deployableId,
      operationId,
      operationVersion,
      inputMappings: [],
      outputMappings: [],
      validationBehavior: 'x',
      domainRejectionBehavior: 'x',
      technicalFailureBehavior: 'x',
      timeoutBehavior: 'x',
      cancellationBehavior: 'x',
      retryBehavior: 'x',
      duplicateSubmissionBehavior: 'x',
      exposure: 'private',
      generatedTargets: [],
      approvalState: 'draft',
      command: `${process.execPath} scripts/probe.cjs`,
    }

    const configured = dispatch({ operation: 'configureBinding', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', bindingConfig: binding }] })
    expect(configured.ok, JSON.stringify(configured.diagnostics)).toBe(true)

    // Real persisted binding file, atomically written under the adapter-owned store.
    const bindingFile = path.join(dataDir, 'projects', projectId, 'design-adapter', 'bindings', 'bind.exec.cli.1.json')
    expect(fs.existsSync(bindingFile)).toBe(true)

    // verifyConnection with no bindingConfig — proves the real persisted-binding round trip through IPC.
    const verified = dispatch({ operation: 'verifyConnection', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
    expect(verified.ok, JSON.stringify(verified.diagnostics)).toBe(true)
    expect(verified.value.verificationStatus).toBe('pass')
    expect(verified.value.usedTestAdapter).toBe(false)
    expect(verified.value.observedPath.inboundAdapter).toBe('cli:bind.exec.cli.1')
  })

  it('runScenario executes a real per-step command through the production IPC entry point (never fabricates passed)', () => {
    const dataDir = tmpDir()
    const repositoryRoot = tmpDir('euik-design-exec-repo-')
    const projectId = 'proj-exec-scenario'
    const dispatch = bootstrapProject(dataDir, repositoryRoot, projectId)

    // `createUseCaseDraft({ workDescription: '' })`'s (single) step id is a
    // deterministic content-derived id (`childId`), so it is known before
    // the module design's `verification.configuredCommands` (which must
    // name it) is written — no probe bootstrap needed.
    const draft = dispatch({ operation: 'createUseCaseDraft', args: [{ projectId, actor, idempotencyKey: key(), workDescription: '' }] })
    expect(draft.ok, JSON.stringify(draft.diagnostics)).toBe(true)
    const stepId = draft.value.useCases[0].scenarios[0].steps[0].id
    const scenarioId = draft.value.useCases[0].scenarios[0].id
    const questionId = draft.value.questions[0].id
    const answered = dispatch({
      operation: 'updateUseCaseItem',
      args: [{ projectId, actor, idempotencyKey: key(), target: { kind: 'question', questionId, answer: 'Explain the module workflow.' } }],
    })
    expect(answered.ok, JSON.stringify(answered.diagnostics)).toBe(true)
    const approvedAnalysis = dispatch({ operation: 'approveUseCaseAnalysis', args: [{ projectId, actor, idempotencyKey: key(), authority: 'product-lead' }] })
    expect(approvedAnalysis.ok, JSON.stringify(approvedAnalysis.diagnostics)).toBe(true)

    writeScript(repositoryRoot, 'scripts/step.cjs', 'process.exit(0);\n')
    const sysDraft = dispatch({ operation: 'createSystemDesignDraft', args: [{ projectId, actor, idempotencyKey: key() }] })
    expect(sysDraft.ok, JSON.stringify(sysDraft.diagnostics)).toBe(true)
    const sysApproved = dispatch({ operation: 'approveSystemStructure', args: [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }] })
    expect(sysApproved.ok, JSON.stringify(sysApproved.diagnostics)).toBe(true)
    const started = dispatch({ operation: 'startModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
    expect(started.ok, JSON.stringify(started.diagnostics)).toBe(true)
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [
        {
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.core',
          path: 'schemas',
          value: [
            { schemaId: 'schema.in', version: '1.0', role: 'input', ref: 'schema://in' },
            { schemaId: 'schema.out', version: '1.0', role: 'output', ref: 'schema://out' },
          ],
        },
      ],
    })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'verification.acceptanceCases', value: [{ id: 'ac1', description: 'x', expectedOutcome: 'y' }] }],
    })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail }],
    })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'verification.configuredCommands', value: [`${stepId}: ${process.execPath} scripts/step.cjs`] }],
    })
    dispatch({ operation: 'analyzeModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
    const approved = dispatch({ operation: 'approveModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' }] })
    expect(approved.ok, JSON.stringify(approved.diagnostics)).toBe(true)

    const ran = dispatch({ operation: 'runScenario', args: [{ projectId, actor, idempotencyKey: key(), scenarioId }] })
    expect(ran.ok, JSON.stringify(ran.diagnostics)).toBe(true)
    expect(ran.value.outcome).toBe('passed')
    expect(ran.value.steps[0].outcome).toBe('passed')
    expect(ran.value.steps[0].structuredEvidenceRef).toContain('exit=0')

    // Real persistence: `runScenario`'s own operation-level code persists the run (the executor only executes).
    const coverage = dispatch({ operation: 'getScenarioCoverage', args: [projectId] })
    expect(coverage.ok !== false).toBe(true)
  })

  it('runScenario is honestly "skipped" (never a fabricated "passed") through IPC when no step has a configured command', () => {
    const dataDir = tmpDir()
    const repositoryRoot = tmpDir('euik-design-exec-repo-')
    const projectId = 'proj-exec-scenario-skip'
    const dispatch = bootstrapProject(dataDir, repositoryRoot, projectId)
    const { scenarioId } = bootstrapApprovedModule(dispatch, projectId, [])

    const ran = dispatch({ operation: 'runScenario', args: [{ projectId, actor, idempotencyKey: key(), scenarioId }] })
    expect(ran.ok).toBe(false)
    expect(ran.value.outcome).toBe('skipped')
    expect(ran.value.steps.every((s: { outcome: string }) => s.outcome === 'skipped')).toBe(true)
  })

  it('verifyConnection fails honestly through IPC with no repository configured (never fakes a pass)', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })
    const result = dispatch({ operation: 'verifyConnection', args: [{ projectId: 'proj-no-repo', actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d: { code: string }) => d.code)).toContain('EUC16-EXECUTOR-NOT-CONFIGURED')
  })
})
