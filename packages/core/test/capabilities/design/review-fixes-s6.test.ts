/**
 * Second-review P1 fix (S6) — real executors for `configureBinding`,
 * `verifyConnection`, and `runScenario` (`capabilities/design/
 * connectExecutors.ts`).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §13,
 * §14.1-14.3, §17.2, §19.
 *
 * Every check below runs a REAL process: a real temp repository directory,
 * a real spawned Node child process (`runConfiguredCommandSync`), and for
 * the http case a real ephemeral `node:http` server reached with a real
 * `fetch` from a child probe process. Nothing here injects a fake executor
 * result — this is the "operations-level entry point" the second-review
 * finding said was missing (only an injected test executor proved S26/S27
 * before this fix).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { createDesignOperations } from '../../../src/capabilities/design/operations.js'
import { buildSampleAuditHub } from '../../../src/capabilities/design/sampleAuditHub.js'
import { createConnectExecutors, type ConnectExecutorDeps } from '../../../src/capabilities/design/connectExecutors.js'
import * as VerificationPlanner from '../../../src/capabilities/design/verificationPlanner.js'
import { probeFreePort } from '../../../src/commandRunner.js'
import type { CliInboundBinding, HttpInboundBinding, UiInboundBinding } from '../../../src/capabilities/types.js'
import type { ModuleDesignSpecification } from '../../../src/capabilities/design/records.js'

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeScript(repositoryRoot: string, relPath: string, content: string): void {
  const abs = path.join(repositoryRoot, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

const SCREENSHOT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function visualStepScript(exitCode: number): string {
  return `require('node:fs').writeFileSync(process.env.EUIK_SCREENSHOT_PATH, Buffer.concat([Buffer.from('${SCREENSHOT_PNG_BASE64}', 'base64'), Buffer.from(process.env.EUIK_STEP_ID || '')]));\nprocess.exit(${exitCode});\n`
}

function duplicateVisualStepScript(): string {
  return `require('node:fs').writeFileSync(process.env.EUIK_SCREENSHOT_PATH, Buffer.from('${SCREENSHOT_PNG_BASE64}', 'base64'));\nprocess.exit(0);\n`
}

/** A fresh workspace + one approved module design + one approved operation contract — the minimum `configureBinding` needs to accept a real binding. */
function buildFixture() {
  const sample = buildSampleAuditHub()
  const dataDir = tmpDir('euik-s6-data-')
  const repositoryRoot = tmpDir('euik-s6-repo-')
  const workspace = new DesignWorkspace(dataDir)

  workspace.saveUseCaseAnalysisDraft(sample.projectId, sample.useCaseAnalysis)
  workspace.approveUseCaseAnalysis(sample.projectId, sample.useCaseAnalysis)

  const moduleDesign = Object.values(sample.approvedModuleDesigns)[0]!
  workspace.saveModuleDesignDraft(sample.projectId, moduleDesign.module.moduleId, moduleDesign)
  workspace.approveModuleDesign(sample.projectId, moduleDesign.module.moduleId, moduleDesign)

  const approvedContract = sample.operationContracts.contracts.find((c) => c.status === 'approved')!
  workspace.saveContract(sample.projectId, approvedContract)

  const deps: ConnectExecutorDeps = {
    dataDir,
    repositoryRoot,
    getModuleDesign: (projectId, moduleId) => workspace.getApprovedModuleDesign(projectId, moduleId) ?? workspace.getModuleDesignDraft(projectId, moduleId),
    listApprovedOperations: (projectId) =>
      workspace
        .listContracts(projectId)
        .filter((c) => c.status === 'approved')
        .map((c) => ({ operationId: c.operationId, version: c.version })),
    listApprovedModuleDesigns: () => [moduleDesign],
  }

  return { sample, dataDir, repositoryRoot, workspace, moduleDesign, approvedContract, deps }
}

function baseBindingFields(fixture: ReturnType<typeof buildFixture>) {
  return {
    schemaVersion: '1.0' as const,
    version: '1.0.0',
    projectId: fixture.sample.projectId,
    deployableId: fixture.moduleDesign.boundary.deployableId,
    operationId: fixture.approvedContract.operationId,
    operationVersion: fixture.approvedContract.version,
    inputMappings: [],
    outputMappings: [],
    validationBehavior: 'show inline error',
    domainRejectionBehavior: 'show inline error',
    technicalFailureBehavior: 'show toast',
    timeoutBehavior: 'show toast',
    cancellationBehavior: 'no-op',
    retryBehavior: 'manual',
    duplicateSubmissionBehavior: 'disable button',
    exposure: 'private' as const,
    generatedTargets: [] as string[],
    approvalState: 'draft',
  }
}

// ---------------------------------------------------------------------------
// configureBinding
// ---------------------------------------------------------------------------

describe('connectExecutors.configureBinding', () => {
  it('rejects a garbage bindingConfig with real diagnostics and persists nothing', () => {
    const fixture = buildFixture()
    const executors = createConnectExecutors(fixture.deps)
    const result = executors.configureBinding!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: { nope: true } }, {})
    expect(result.ok).toBe(false)
    expect(result.diagnostics?.length ?? 0).toBeGreaterThan(0)
    const bindingsDir = path.join(fixture.dataDir, 'projects', fixture.sample.projectId, 'design-adapter', 'bindings')
    expect(fs.existsSync(bindingsDir)).toBe(false)
  })

  it('rejects a binding naming an operation that is not an approved contract', () => {
    const fixture = buildFixture()
    const executors = createConnectExecutors(fixture.deps)
    const binding: CliInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'cli',
      bindingId: 'bind.unapproved',
      operationId: 'op.does-not-exist',
      command: 'node scripts/probe.js',
    }
    const result = executors.configureBinding!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: binding }, {})
    expect(result.ok).toBe(false)
    expect(result.diagnostics?.map((d) => d.code)).toContain('EUC16-CONNECT-OPERATION-NOT-APPROVED')
  })

  it('validates and atomically persists a real cli binding under design-adapter/bindings/', () => {
    const fixture = buildFixture()
    const executors = createConnectExecutors(fixture.deps)
    const binding: CliInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'cli',
      bindingId: 'bind.cli.1',
      command: `${process.execPath} scripts/cli-probe.js`,
    }
    const result = executors.configureBinding!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: binding }, {})
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    expect(result.value).toMatchObject({ bindingId: 'bind.cli.1', kind: 'cli', moduleId: fixture.moduleDesign.module.moduleId })

    const file = path.join(fixture.dataDir, 'projects', fixture.sample.projectId, 'design-adapter', 'bindings', 'bind.cli.1.json')
    expect(fs.existsSync(file)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(persisted.bindingId).toBe('bind.cli.1')
    expect(persisted.moduleId).toBe(fixture.moduleDesign.module.moduleId)
  })
})

// ---------------------------------------------------------------------------
// verifyConnection — cli
// ---------------------------------------------------------------------------

describe('connectExecutors.verifyConnection — cli', () => {
  it('launches the real configured health command and probes the real cli binding (pass path, observedPath populated)', () => {
    const fixture = buildFixture()
    writeScript(fixture.repositoryRoot, 'scripts/cli-health.js', 'process.exit(0);\n')
    writeScript(
      fixture.repositoryRoot,
      'scripts/cli-probe.js',
      "const arg = process.argv[2];\nif (!arg) { process.exit(1); }\nprocess.stdout.write('probe received: ' + arg);\nprocess.exit(0);\n",
    )
    const design: ModuleDesignSpecification = {
      ...fixture.moduleDesign,
      verification: { ...fixture.moduleDesign.verification, configuredCommands: [`${process.execPath} scripts/cli-health.js`] },
    }
    const deps: ConnectExecutorDeps = { ...fixture.deps, getModuleDesign: () => design, listApprovedModuleDesigns: () => [design] }
    const executors = createConnectExecutors(deps)

    const binding: CliInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'cli',
      bindingId: 'bind.cli.pass',
      command: `${process.execPath} scripts/cli-probe.js`,
    }
    // Persist first (configureBinding), then verify WITHOUT re-supplying
    // bindingConfig — proves the real persisted-binding round trip.
    const configured = executors.configureBinding!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: binding }, {})
    expect(configured.ok, JSON.stringify(configured.diagnostics)).toBe(true)

    const result = executors.verifyConnection!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId }, {})
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    const record = result.value as any
    expect(record.verificationStatus).toBe('pass')
    expect(record.usedTestAdapter).toBe(false)
    expect(record.triggerKind).toBe('cli')
    expect(record.observedPath.inboundAdapter).toBe('cli:bind.cli.pass')
    expect(record.observedPath.operation).toBe(`${fixture.approvedContract.operationId}@${fixture.approvedContract.version}`)
    expect(record.durationMs).toBeGreaterThanOrEqual(0)
    expect(record.launchCommand).toContain('cli-health.js')
  })

  it('reports a real failure (never fabricated pass) when the cli probe exits nonzero', () => {
    const fixture = buildFixture()
    writeScript(fixture.repositoryRoot, 'scripts/cli-health.js', 'process.exit(0);\n')
    writeScript(fixture.repositoryRoot, 'scripts/cli-probe-fail.js', 'process.exit(3);\n')
    const design: ModuleDesignSpecification = {
      ...fixture.moduleDesign,
      verification: { ...fixture.moduleDesign.verification, configuredCommands: [`${process.execPath} scripts/cli-health.js`] },
    }
    const deps: ConnectExecutorDeps = { ...fixture.deps, getModuleDesign: () => design, listApprovedModuleDesigns: () => [design] }
    const executors = createConnectExecutors(deps)

    const binding: CliInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'cli',
      bindingId: 'bind.cli.fail',
      command: `${process.execPath} scripts/cli-probe-fail.js`,
    }
    const result = executors.verifyConnection!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: binding }, {})
    expect(result.ok).toBe(false)
    const record = result.value as any
    expect(record.verificationStatus).toBe('fail')
    expect(record.reasonCodes).toContain('cli-probe-failed')
  })

  it('fails honestly (names exactly what is missing) when the module design has no configured commands', () => {
    const fixture = buildFixture()
    const design: ModuleDesignSpecification = { ...fixture.moduleDesign, verification: { ...fixture.moduleDesign.verification, configuredCommands: [] } }
    const deps: ConnectExecutorDeps = { ...fixture.deps, getModuleDesign: () => design }
    const executors = createConnectExecutors(deps)
    const binding: CliInboundBinding = { ...baseBindingFields(fixture), kind: 'cli', bindingId: 'bind.cli.nocmd', command: 'node scripts/probe.js' }
    const result = executors.verifyConnection!({ projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: binding }, {})
    expect(result.ok).toBe(false)
    expect(result.diagnostics?.map((d) => d.code)).toContain('EUC16-CONNECT-NO-CONFIGURED-COMMANDS')
  })
})

// ---------------------------------------------------------------------------
// verifyConnection — http
// ---------------------------------------------------------------------------

describe('connectExecutors.verifyConnection — http', () => {
  it('launches a real ephemeral node:http server via the configured command and probes it with a real fetch', async () => {
    const fixture = buildFixture()
    const port = await probeFreePort()
    writeScript(
      fixture.repositoryRoot,
      'scripts/http-server.js',
      [
        "const http = require('node:http');",
        `const port = ${port};`,
        'const server = http.createServer((req, res) => {',
        "  res.writeHead(200, { 'content-type': 'application/json' });",
        "  res.end(JSON.stringify({ ok: true, path: req.url }));",
        '});',
        'server.listen(port);',
      ].join('\n'),
    )
    const design: ModuleDesignSpecification = {
      ...fixture.moduleDesign,
      verification: { ...fixture.moduleDesign.verification, configuredCommands: [`${process.execPath} scripts/http-server.js`] },
    }
    const deps: ConnectExecutorDeps = { ...fixture.deps, getModuleDesign: () => design, listApprovedModuleDesigns: () => [design] }
    const executors = createConnectExecutors(deps)

    const binding: HttpInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'http',
      bindingId: 'bind.http.1',
      method: 'GET',
      path: '/api/ping',
    }
    const result = executors.verifyConnection!(
      { projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: { ...binding, localBaseUrl: `http://127.0.0.1:${port}` } },
      {},
    )
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    const record = result.value as any
    expect(record.verificationStatus).toBe('pass')
    expect(record.usedTestAdapter).toBe(false)
    expect(record.triggerKind).toBe('http')
    expect(record.healthState).toBe('healthy')
    expect(record.outcomeSummary).toContain('HTTP 200')
  }, 20_000)

  it('rejects a non-localhost localBaseUrl (no network beyond localhost)', () => {
    const fixture = buildFixture()
    const design: ModuleDesignSpecification = {
      ...fixture.moduleDesign,
      verification: { ...fixture.moduleDesign.verification, configuredCommands: [`${process.execPath} scripts/http-server.js`] },
    }
    const deps: ConnectExecutorDeps = { ...fixture.deps, getModuleDesign: () => design }
    const executors = createConnectExecutors(deps)
    const binding: HttpInboundBinding = { ...baseBindingFields(fixture), kind: 'http', bindingId: 'bind.http.remote', method: 'GET', path: '/api/ping' }
    const result = executors.verifyConnection!(
      { projectId: fixture.sample.projectId, moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: { ...binding, localBaseUrl: 'http://example.com' } },
      {},
    )
    expect(result.ok).toBe(false)
    const record = result.value as any
    expect(record.reasonCodes).toContain('local-base-url-invalid')
  })
})

describe('connectExecutors.verifyConnection — ui', () => {
  it('opens a real local UI and captures a mapped scenario observation', () => {
    const fixture = buildFixture()
    const entry = VerificationPlanner.buildScenarioTestPlan(fixture.sample.useCaseAnalysis).entries[0]!
    const stepId = entry.actions[0]!.stepId
    writeScript(
      fixture.repositoryRoot,
      'dist/index.html',
      `<!doctype html><main><button data-scenario-step="${stepId}">Run task</button><p data-scenario-result="${stepId}" hidden>Task complete</p></main><script>document.querySelector('button').onclick=()=>document.querySelector('p').hidden=false</script>`,
    )
    const binding: UiInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'ui',
      bindingId: 'bind.ui.1',
      transport: 'browser-local',
      trigger: 'activate',
      launchUrl: 'dist/index.html',
      readinessSelector: 'main',
      captureSelector: 'main',
      stepActions: [{
        stepId,
        actionSelector: `[data-scenario-step="${stepId}"]`,
        expectedSelector: `[data-scenario-result="${stepId}"]`,
        expectedText: 'Task complete',
      }],
    }
    const executors = createConnectExecutors(fixture.deps)
    const configured = executors.configureBinding!({
      projectId: fixture.sample.projectId,
      moduleId: fixture.moduleDesign.module.moduleId,
      bindingConfig: binding,
    }, {})
    expect(configured.ok, JSON.stringify(configured.diagnostics)).toBe(true)

    const verified = executors.verifyConnection!({
      projectId: fixture.sample.projectId,
      moduleId: fixture.moduleDesign.module.moduleId,
    }, {})
    expect(verified.ok, JSON.stringify(verified.diagnostics)).toBe(true)
    expect(verified.value).toMatchObject({
      triggerKind: 'ui',
      verificationStatus: 'pass',
      evidenceArtifactRefs: [expect.stringMatching(/^design-evidence:\/\//)],
    })

    const result = executors.runScenario!({ entry, analysis: fixture.sample.useCaseAnalysis }, {})
    const observed = result.steps.find((step) => step.stepId === stepId)
    expect(observed).toMatchObject({
      outcome: 'passed',
      screenshotRef: expect.stringMatching(/^design-evidence:\/\//),
      executionTrace: {
        entryPointKind: 'ui',
        actionTarget: `[data-scenario-step="${stepId}"]`,
        observationTarget: `[data-scenario-result="${stepId}"]`,
      },
    })
  }, 30_000)
})

// ---------------------------------------------------------------------------
// runScenario
// ---------------------------------------------------------------------------

describe('connectExecutors.runScenario', () => {
  it('executes real per-step configured commands, records honest per-step evidence, and never fabricates passed for an unmapped step', () => {
    const fixture = buildFixture()
    const testPlan = VerificationPlanner.buildScenarioTestPlan(fixture.sample.useCaseAnalysis)
    const entry = testPlan.entries[0]!
    const useCase = fixture.sample.useCaseAnalysis.useCases.find((u) => u.id === entry.useCaseId)!
    const scenario = useCase.scenarios.find((s) => s.id === entry.scenarioId)!
    expect(scenario.steps.length).toBeGreaterThan(0)

    const passStep = scenario.steps[0]!
    const failStep = scenario.steps[1]

    writeScript(fixture.repositoryRoot, 'scripts/step-pass.js', visualStepScript(0))
    const configuredCommands = [`${passStep.id}: ${process.execPath} scripts/step-pass.js`]
    if (failStep) {
      writeScript(fixture.repositoryRoot, 'scripts/step-fail.js', visualStepScript(1))
      configuredCommands.push(`${failStep.id}: ${process.execPath} scripts/step-fail.js`)
    }
    const design: ModuleDesignSpecification = { ...fixture.moduleDesign, verification: { ...fixture.moduleDesign.verification, configuredCommands } }
    const deps: ConnectExecutorDeps = { ...fixture.deps, listApprovedModuleDesigns: () => [design] }
    const executors = createConnectExecutors(deps)

    const result = executors.runScenario!({ entry, analysis: fixture.sample.useCaseAnalysis }, {})
    expect(result.steps.length).toBe(scenario.steps.length)

    const passEvidence = result.steps.find((s) => s.stepId === passStep.id)!
    expect(passEvidence.outcome).toBe('passed')
    expect(passEvidence.structuredEvidenceRef).toMatch(/^design-evidence:\/\//)
    expect(passEvidence.screenshotRef).toMatch(/^design-evidence:\/\//)
    expect(passEvidence.artifacts?.every((artifact) => artifact.status === 'available')).toBe(true)

    if (failStep) {
      const failEvidence = result.steps.find((s) => s.stepId === failStep.id)!
      expect(failEvidence.outcome).toBe('failed')
      expect(failEvidence.structuredEvidenceRef).toMatch(/^design-evidence:\/\//)
    }

    const mappedStepIds = new Set([passStep.id, ...(failStep ? [failStep.id] : [])])
    const unmapped = result.steps.filter((s) => !mappedStepIds.has(s.stepId))
    for (const step of unmapped) {
      expect(step.outcome).toBe('skipped')
      expect(step.structuredEvidenceRef).toMatch(/^design-evidence:\/\//)
    }

    // §19 "never fabricate success" — overall outcome reflects the real
    // per-step results, never a blanket 'passed'.
    if (failStep) {
      expect(result.outcome).toBe('failed')
    } else if (unmapped.length === scenario.steps.length - 1) {
      expect(result.outcome).toBe('passed')
    }
  })

  it('reports outcome "skipped" (never "passed") when no step has any configured command', () => {
    const fixture = buildFixture()
    const testPlan = VerificationPlanner.buildScenarioTestPlan(fixture.sample.useCaseAnalysis)
    const entry = testPlan.entries[0]!
    const design: ModuleDesignSpecification = { ...fixture.moduleDesign, verification: { ...fixture.moduleDesign.verification, configuredCommands: [] } }
    const deps: ConnectExecutorDeps = { ...fixture.deps, listApprovedModuleDesigns: () => [design] }
    const executors = createConnectExecutors(deps)

    const result = executors.runScenario!({ entry, analysis: fixture.sample.useCaseAnalysis }, {})
    expect(result.outcome).toBe('skipped')
    expect(result.steps.every((s) => s.outcome === 'skipped')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Operations-level end-to-end (proves the second-review finding is fixed:
// S26/S27 now work through a real executor, not only an injected test
// executor).
// ---------------------------------------------------------------------------

describe('operations-level: configureBinding + verifyConnection + runScenario with the real connectExecutors', () => {
  it('runs configureBinding, verifyConnection, and runScenario through createDesignOperations end to end', () => {
    const fixture = buildFixture()
    writeScript(fixture.repositoryRoot, 'scripts/cli-health.js', 'process.exit(0);\n')
    writeScript(fixture.repositoryRoot, 'scripts/cli-probe.js', "process.stdout.write('ok');\nprocess.exit(0);\n")
    const testPlan = VerificationPlanner.buildScenarioTestPlan(fixture.sample.useCaseAnalysis)
    const entry = testPlan.entries[0]!
    const useCase = fixture.sample.useCaseAnalysis.useCases.find((u) => u.id === entry.useCaseId)!
    const scenario = useCase.scenarios.find((s) => s.id === entry.scenarioId)!
    writeScript(fixture.repositoryRoot, 'scripts/step.js', visualStepScript(0))
    const configuredCommands = [`${process.execPath} scripts/cli-health.js`, ...scenario.steps.map((s) => `${s.id}: ${process.execPath} scripts/step.js`)]
    const design: ModuleDesignSpecification = { ...fixture.moduleDesign, verification: { ...fixture.moduleDesign.verification, configuredCommands } }
    const deps: ConnectExecutorDeps = { ...fixture.deps, getModuleDesign: () => design, listApprovedModuleDesigns: () => [design] }
    const executors = createConnectExecutors(deps)

    fixture.workspace.saveProjectRoles(fixture.sample.projectId, { 'user:alice': ['software-architect', 'verification-lead'] } as any)
    const ops = createDesignOperations({ workspace: fixture.workspace, executors })
    const actor = 'user:alice'
    let idem = 0
    const key = () => `s6-op-${(idem += 1)}`

    const binding: CliInboundBinding = {
      ...baseBindingFields(fixture),
      kind: 'cli',
      bindingId: 'bind.ops.1',
      command: `${process.execPath} scripts/cli-probe.js`,
    }
    const configured = ops.configureBinding({ projectId: fixture.sample.projectId, actor, idempotencyKey: key(), moduleId: fixture.moduleDesign.module.moduleId, bindingConfig: binding })
    expect(configured.ok, JSON.stringify(configured.diagnostics)).toBe(true)

    const verified = ops.verifyConnection({ projectId: fixture.sample.projectId, actor, idempotencyKey: key(), moduleId: fixture.moduleDesign.module.moduleId })
    expect(verified.ok, JSON.stringify(verified.diagnostics)).toBe(true)
    expect((verified.value as any).usedTestAdapter).toBe(false)

    const ran = ops.runScenario({ projectId: fixture.sample.projectId, actor, idempotencyKey: key(), scenarioId: entry.scenarioId })
    expect(ran.ok, JSON.stringify(ran.diagnostics)).toBe(true)
    expect(ran.value!.outcome).toBe('passed')
    // operations.runScenario persists the ScenarioRun itself (the executor
    // only executes) — confirms the real persistence path still runs.
    expect(fixture.workspace.getScenarioRun(fixture.sample.projectId, ran.value!.runId)).toBeDefined()
  })

  it('blocks a run when different visible steps reuse the same original screenshot', () => {
    const fixture = buildFixture()
    const testPlan = VerificationPlanner.buildScenarioTestPlan(fixture.sample.useCaseAnalysis)
    const entry = testPlan.entries.find((candidate) => {
      const useCase = fixture.sample.useCaseAnalysis.useCases.find((item) => item.id === candidate.useCaseId)
      return (useCase?.scenarios.find((scenario) => scenario.id === candidate.scenarioId)?.steps.length ?? 0) > 1
    })!
    const useCase = fixture.sample.useCaseAnalysis.useCases.find((item) => item.id === entry.useCaseId)!
    const scenario = useCase.scenarios.find((item) => item.id === entry.scenarioId)!
    writeScript(fixture.repositoryRoot, 'scripts/reused-shot.js', duplicateVisualStepScript())
    const configuredCommands = scenario.steps.map((step) => `${step.id}: ${process.execPath} scripts/reused-shot.js`)
    const design: ModuleDesignSpecification = {
      ...fixture.moduleDesign,
      verification: { ...fixture.moduleDesign.verification, configuredCommands },
    }
    const executors = createConnectExecutors({
      ...fixture.deps,
      getModuleDesign: () => design,
      listApprovedModuleDesigns: () => [design],
    })
    fixture.workspace.saveProjectRoles(fixture.sample.projectId, { 'user:alice': ['verification-lead'] } as any)
    const ops = createDesignOperations({ workspace: fixture.workspace, executors })

    const result = ops.runScenario({
      projectId: fixture.sample.projectId,
      actor: 'user:alice',
      idempotencyKey: 's6-duplicate-shot',
      scenarioId: entry.scenarioId,
    })

    expect(result.ok).toBe(false)
    expect(result.value?.outcome).toBe('failed')
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('EUC16-SCENARIO-DUPLICATE-SCREENSHOT')
    expect(result.value?.steps.some((step) => step.actualResult.includes('Evidence integrity failure'))).toBe(true)
  })
})
