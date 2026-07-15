/**
 * Named capability bridge operations (CAP-PKT-005+).
 * Privileged filesystem/tool work stays in the desktop process.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ipcMain, nativeImage, safeStorage } from 'electron'
import {
  CapabilityRunStore,
  CapabilityWorkspace,
  buildCapabilityHandoffMarkdown,
  buildModuleImplementationBrief,
  buildImplementationPacket,
  buildInterviewPacket,
  buildNeedsAttention,
  buildDeltaPacket,
  calculateImpact,
  deltaQueueState,
  discoverRepositoryImplementationContext,
  assertTargetExportable,
  buildCapabilityGraph,
  calculateFreshness,
  canonicalHash,
  runModuleVerification,
  runCommand,
  selectVerificationSuites,
  evaluateArchitectureGate,
  evaluateModuleInterview,
  evaluateModuleGate,
  evaluateProductGate,
  importProductInterviewResponse,
  moduleInterviewOpeningGuidance,
  inspectOverlay,
  applyOverlay,
  invokeLocalRuntime,
  rebuildRegistry,
  resolveProvider,
  resolveProjectRelativePath,
  isRealPathWithinProjectRoot,
  successResult,
  technicalFailureResult,
  sanitizeBoundaryError,
  transitionJob,
  type ApplicationSpecification,
  type ArchitectureSpecification,
  type CapabilityHandoffMarkdownInput,
  type CapabilityRunScope,
  type FreshnessRecord,
  type FrontendBinding,
  type JobRecord,
  type InterviewPacket,
  type ModuleManifest,
  type ModuleInterviewResponse,
  type ResultEnvelope,
} from '@engineering-ui-kit/core'
import type { Workspace } from '@engineering-ui-kit/core'
import { createMatlabAdapter } from './matlabAdapter.js'
import { discover as azureDiscover, importWorkItem as azureImportWorkItem } from './azureAdapter.js'

const CAP_CHANNELS = {
  ensureInitialized: 'capabilities:ensure-initialized',
  getApplication: 'capabilities:get-application',
  saveApplicationDraft: 'capabilities:save-application-draft',
  approveApplication: 'capabilities:approve-application',
  evaluateProductGate: 'capabilities:evaluate-product-gate',
  getArchitecture: 'capabilities:get-architecture',
  saveArchitectureDraft: 'capabilities:save-architecture-draft',
  approveArchitecture: 'capabilities:approve-architecture',
  evaluateArchitectureGate: 'capabilities:evaluate-architecture-gate',
  saveModuleDraft: 'capabilities:save-module-draft',
  approveModule: 'capabilities:approve-module',
  listModules: 'capabilities:list-modules',
  listBindings: 'capabilities:list-bindings',
  evaluateModuleGate: 'capabilities:evaluate-module-gate',
  buildInterviewPacket: 'capabilities:build-interview-packet',
  exportInterviewPacket: 'capabilities:export-interview-packet',
  exportImplementationPacket: 'capabilities:export-implementation-packet',
  startHandoffDrag: 'capabilities:start-handoff-drag',
  importInterviewResponse: 'capabilities:import-interview-response',
  buildImplementationPacket: 'capabilities:build-implementation-packet',
  listCapabilityRuns: 'capabilities:list-runs',
  createCapabilityRun: 'capabilities:create-run',
  inspectCapabilityOverlay: 'capabilities:inspect-overlay',
  applyCapabilityOverlay: 'capabilities:apply-overlay',
  calculateFreshness: 'capabilities:calculate-freshness',
  listNeedsAttention: 'capabilities:list-needs-attention',
  calculateImpact: 'capabilities:calculate-impact',
  approveImpact: 'capabilities:approve-impact',
  listImpacts: 'capabilities:list-impacts',
  deltaQueueState: 'capabilities:delta-queue-state',
  exportDeltaPacket: 'capabilities:export-delta-packet',
  markDeltaTargetComplete: 'capabilities:mark-delta-target-complete',
  runModuleVerification: 'capabilities:run-module-verification',
  verifyApprovedModule: 'capabilities:verify-approved-module',
  filesystemRead: 'capabilities:filesystem-read',
  filesystemWrite: 'capabilities:filesystem-write',
  secretPut: 'capabilities:secret-put',
  secretValidate: 'capabilities:secret-validate',
  matlabSessionStatus: 'capabilities:matlab-session-status',
  matlabInvoke: 'capabilities:matlab-invoke',
  azureDiscover: 'capabilities:azure-discover',
  azureImportWorkItem: 'capabilities:azure-import-work-item',
  invokeOperation: 'capabilities:invoke-operation',
  saveBindingDraft: 'capabilities:save-binding-draft',
  approveBinding: 'capabilities:approve-binding',
} as const

export type CapabilityBridgeChannels = typeof CAP_CHANNELS

const jobs = new Map<string, JobRecord>()
const secretIndex = new Map<string, { label: string; providerKind: string; createdAt: string }>()
const CAPABILITY_DRAG_BADGE = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAT0lEQVR4nGNgQAL60f//UwMzYAPUMhyrJdQ2HMUSWhkOt2R4WvDj1x+y8AiyYOhH8pTFO4jCI9iCkRPJxATVMLVgaEUyzatMulT6tGy2AAANzMpqChPiLwAAAABJRU5ErkJggg==',
)

type PersistedOverlayReview = {
  archiveSha256: string
  inspection: ReturnType<typeof inspectOverlay>
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function implementationHash(repoRoot: string, ownedPaths: readonly string[]): string {
  const root = path.resolve(repoRoot)
  const entries: { path: string; sha256: string | 'missing' }[] = []

  const visit = (absolutePath: string, relativePath: string): void => {
    if (!absolutePath.startsWith(root + path.sep)) throw new Error('owned path escaped project root')
    if (!fs.existsSync(absolutePath)) {
      entries.push({ path: relativePath, sha256: 'missing' })
      return
    }
    const stat = fs.lstatSync(absolutePath)
    if (stat.isSymbolicLink()) throw new Error(`owned path contains a symbolic link: ${relativePath}`)
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absolutePath).sort((a, b) => a.localeCompare(b))) {
        visit(path.join(absolutePath, child), path.posix.join(relativePath, child))
      }
      return
    }
    if (stat.isFile()) entries.push({ path: relativePath, sha256: sha256File(absolutePath) })
  }

  for (const ownedPath of [...ownedPaths].sort((a, b) => a.localeCompare(b))) {
    const normalized = ownedPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
    if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
      throw new Error(`invalid owned path: ${ownedPath}`)
    }
    visit(path.resolve(root, ...normalized.split('/')), normalized)
  }
  return canonicalHash(entries)
}

function factValue(packet: InterviewPacket, prefix: string): string | undefined {
  return packet.inputContext.facts.find((fact) => fact.startsWith(prefix))?.slice(prefix.length)
}

function interactiveInterviewPrompt(packet: InterviewPacket): string {
  const completionRule = packet.outputSchemaRef === 'CAP-CONTRACT-003'
    ? 'Every required answer must contain a concrete answer and no answer may have status "unresolved". Every provided operation must have one matching operationContracts entry at the same version, and its inputSchemaRef and outputSchemaRef must resolve to concrete dataSchemas entries.'
    : packet.outputSchemaRef === 'CAP-CONTRACT-002'
      ? 'The final response must assign every module a name, moduleType, and responsibility; give every dependency edge a concrete reason; cover every module in a workflow trace and moduleNeedTrace; and contain an empty unresolvedQuestions array.'
      : 'The final response must contain an empty unresolvedQuestions array. Do not leave proposals or assumptions awaiting confirmation.'
  const moduleOpeningGuidance = moduleInterviewOpeningGuidance(packet)
  return `Run the interview defined by the embedded capability packet as a live conversation with the user.

Interview protocol:
1. Start by reviewing the supplied context and identifying only the approval-blocking gaps.
2. Ask at most three closely related questions in one message, then stop and wait for the user's answers.
3. Continue in further question-and-answer rounds until every blocking gap has been answered, explicitly accepted as a reasonable default, or deliberately removed from scope.
4. If the user is unsure, offer a concrete default and ask them to accept or change it. Never silently invent approval.
5. Before emitting JSON, silently audit the response against the completion rule, repair mechanical omissions, and do not emit while any approval-blocking item remains. A per-turn question limit is not a total interview limit.
6. Never mark the interview complete and never return a response that merely records questions the user has not answered.
7. ${completionRule}
${moduleOpeningGuidance}

After the interview is genuinely complete, return only a new ${packet.outputFileName} using the exact template below. Do not design beyond the interview boundary, implement source code, or approve the application's separate review gate.`
}

/** Exact importer-facing starter, embedded in the one-file interview handoff. */
function interviewResponseStarter(packet: InterviewPacket): unknown {
  if (packet.outputSchemaRef === 'CAP-CONTRACT-002') {
    const applicationId = packet.inputContext.recordIds[0] ?? 'app.current'
    return {
      architecture: {
        schemaVersion: '1.0', projectId: packet.projectId, id: 'arch.proposed', revision: '1', status: 'proposed',
        applicationSpecId: applicationId,
        applicationSpecRevision: packet.inputContext.revisions[0] ?? '1',
        applicationSpecHash: packet.inputContext.hashes[0] ?? 'pending',
        capabilityProjections: [{ id: 'capability.example', name: 'Replace with a capability', moduleIds: ['mod.example'] }],
        moduleIds: ['mod.example'],
        moduleDefinitions: [{
          moduleId: 'mod.example', name: 'Replace with a clear module name', moduleType: 'domain',
          responsibility: 'Replace with the single responsibility owned by this module',
        }],
        dependencyEdges: [],
        operationAllocations: [], adapterAllocations: [],
        workflowTraces: [{ useCaseId: 'replace-with-use-case-id', moduleIds: ['mod.example'] }],
        proposals: [], unresolvedQuestions: [],
        gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'pending',
      },
      moduleNeedTraces: [{ moduleId: 'mod.example', needIds: ['replace-with-use-case-id'] }],
      moduleJustifications: [{ moduleId: 'mod.example', justification: 'distinct-rules' }],
    }
  }
  if (packet.outputSchemaRef === 'CAP-CONTRACT-003') {
    const moduleId = packet.inputContext.recordIds[1] ?? 'mod.example'
    const moduleType = factValue(packet, 'moduleType:') ?? 'domain'
    return {
      moduleId, moduleType, name: 'Replace with module name', moduleVersion: '1.0.0',
      responsibility: 'Replace with one clear responsibility', ownedConcerns: [], excludedConcerns: [],
      providedOperations: [], requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded',
      events: [], ownedPaths: [`capabilities/modules/${moduleId}/`], configurationSchemaRef: null,
      operationContracts: [], dataSchemas: [],
      answers: packet.inputContext.facts.filter((fact) => fact.startsWith('detail:')).map((fact) => ({
        id: fact.slice('detail:'.length), text: 'Replace with a concrete answer', status: 'proposed',
      })),
      acceptanceCases: [{ id: 'ac-1', description: 'Replace with an acceptance case', expectedOutcome: 'Replace with the expected outcome' }],
      rules: [],
    }
  }
  return {
    schemaVersion: '1.0', projectId: packet.projectId, id: 'app.proposed', revision: '1', status: 'proposed',
    purpose: 'Replace with the application purpose', outcomes: ['Replace with a measurable outcome'],
    actors: [{ id: 'actor-1', text: 'Replace with an actor' }],
    goals: [{ id: 'goal-1', text: 'Replace with an actor goal' }],
    useCases: [{ id: 'use-case-1', text: 'Replace with a complete use case' }], scenarios: [],
    information: [], rules: [], externalSystems: [], constraints: [],
    scope: { inScope: ['Replace with an in-scope item'], outOfScope: [] },
    acceptanceCases: [{ id: 'ac-1', description: 'Replace with an acceptance case', expectedOutcome: 'Replace with the expected outcome' }],
    sources: [], unresolvedQuestions: [], contentHash: 'pending',
  }
}

function exportCapabilityPacketFiles(input: {
  caps: CapabilityWorkspace
  runs: CapabilityRunStore
  run: CapabilityRunScope & { kind: CapabilityHandoffMarkdownInput['kind'] }
  packet: CapabilityHandoffMarkdownInput['packet']
  recommendedPrompt: string
  responseTemplate?: { fileName: string; value: unknown }
  supportingRecord?: { fileName: string; value: unknown }
}) {
  input.runs.createRun(input.run)
  const handoffDir = path.join(input.caps.root(input.run.projectId), 'runs', input.run.runId, 'handoff')
  fs.mkdirSync(handoffDir, { recursive: true })
  const content = buildCapabilityHandoffMarkdown({
    kind: input.run.kind,
    packet: input.packet,
    recommendedPrompt: input.recommendedPrompt,
    responseTemplate: input.responseTemplate,
    supportingRecord: input.supportingRecord,
  })
  const filePath = path.join(handoffDir, `capability-${input.run.kind}-handoff.md`)
  fs.writeFileSync(filePath, content)
  const files = [{
    path: filePath,
    bytes: Buffer.byteLength(content),
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
  }]
  const packetRefs = files.map((file) => path.relative(input.caps.root(input.run.projectId), file.path).replace(/\\/g, '/'))
  input.runs.updateRun(input.run.projectId, input.run.runId, {
    packetRefs,
    artifactRefs: packetRefs,
    lifecycleState: 'packet-exported',
    transitionHistory: [{
      at: input.run.createdAt,
      actor: 'desktop',
      fromState: 'draft',
      toState: 'packet-exported',
      evidenceIds: packetRefs,
    }],
  })
  return {
    runId: input.run.runId,
    packetId: input.packet.packetId,
    recommendedPrompt: input.recommendedPrompt,
    files,
    uploadFiles: files.map((file) => file.path),
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid ${name}`)
  return value
}

function approvedContractContext(
  caps: CapabilityWorkspace,
  projectId: string,
  architecture: ArchitectureSpecification,
) {
  const interviews = architecture.moduleIds
    .map((moduleId) => caps.getApprovedModuleInterview(projectId, moduleId))
    .filter((response): response is ModuleInterviewResponse => Boolean(response))
  return {
    availableOperationContracts: interviews.flatMap((response) => response.operationContracts ?? []),
    availableDataSchemas: interviews.flatMap((response) => response.dataSchemas ?? []),
  }
}

function secretsDir(dataDir: string): string {
  return path.join(dataDir, 'secrets')
}

export function registerCapabilityIpcHandlers(workspace: Workspace, dataDir: string): void {
  const caps = new CapabilityWorkspace(dataDir)
  const runs = new CapabilityRunStore(caps)
  // Real production MATLAB adapter (CAP-DEC-012). Falls back to a deterministic fake worker
  // only under EUIK_TEST_MODE=1 or genuine Engine unavailability; the real matlab.engine path
  // is present and reachable when the Engine exists. The renderer never receives an engine handle.
  const matlab = createMatlabAdapter({
    rootDir: (projectId: string) => caps.root(projectId),
    forceFakeMode: process.env.EUIK_TEST_MODE === '1',
    registerExitShutdown: true,
  })
  const matlabLastSnapshot = new Map<string, string>()

  // Azure DevOps read-only adapter wiring. The PAT is decrypted in-process only and never
  // returned to the renderer; org/project are non-secret adapter configuration.
  const azureConfigOf = (cfg?: { organization: string; project?: string }) =>
    cfg && cfg.organization ? cfg : { organization: 'example-org' as string, project: cfg?.project }
  const readAzurePat = (opaqueSecretId?: string): string | undefined => {
    if (!opaqueSecretId) return undefined
    const file = path.join(secretsDir(dataDir), `${opaqueSecretId}.bin`)
    if (!fs.existsSync(file)) return undefined
    return safeStorage.decryptString(fs.readFileSync(file))
  }
  const azureSecretMissing = () =>
    technicalFailureResult(
      {
        schemaVersion: '1.0',
        code: 'CAP-AZURE-AUTH',
        category: 'authorization',
        safeMessage: 'secret reference is missing or invalid',
        retryability: 'manual',
        relatedIds: [],
        diagnosticRefs: [],
      },
      { source: 'azure', recordedAt: new Date().toISOString() },
    )

  ipcMain.handle(CAP_CHANNELS.ensureInitialized, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    return caps.ensureInitialized(projectId)
  })

  ipcMain.handle(CAP_CHANNELS.getApplication, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    return {
      draft: caps.getApplicationDraft(projectId),
      approved: caps.getApprovedApplication(projectId),
    }
  })

  ipcMain.handle(CAP_CHANNELS.saveApplicationDraft, (_e, projectId: string, draft: ApplicationSpecification) => {
    requireString(projectId, 'projectId')
    caps.saveApplicationDraft(projectId, draft)
    return { ok: true }
  })

  ipcMain.handle(CAP_CHANNELS.approveApplication, (_e, projectId: string, draft: ApplicationSpecification) => {
    requireString(projectId, 'projectId')
    const gate = evaluateProductGate(draft)
    if (!gate.passed) return { ok: false as const, gate }
    return { ok: true as const, approved: caps.approveApplication(projectId, draft), gate }
  })

  ipcMain.handle(CAP_CHANNELS.evaluateProductGate, (_e, spec: ApplicationSpecification) => evaluateProductGate(spec))

  ipcMain.handle(CAP_CHANNELS.getArchitecture, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    return {
      draft: caps.getArchitectureDraft(projectId),
      approved: caps.getApprovedArchitecture(projectId),
    }
  })

  ipcMain.handle(CAP_CHANNELS.saveArchitectureDraft, (_e, projectId: string, draft: ArchitectureSpecification) => {
    requireString(projectId, 'projectId')
    caps.saveArchitectureDraft(projectId, draft)
    return { ok: true }
  })

  ipcMain.handle(CAP_CHANNELS.approveArchitecture, (_e, projectId: string, draft: ArchitectureSpecification) => {
    requireString(projectId, 'projectId')
    const gate = evaluateArchitectureGate(draft)
    if (!gate.passed) return { ok: false as const, gate }
    return { ok: true as const, approved: caps.approveArchitecture(projectId, draft), gate }
  })

  ipcMain.handle(CAP_CHANNELS.evaluateArchitectureGate, (_e, arch: ArchitectureSpecification) =>
    evaluateArchitectureGate(arch),
  )

  ipcMain.handle(CAP_CHANNELS.saveModuleDraft, (
    _e,
    projectId: string,
    draft: ModuleManifest,
    interviewResponse?: ModuleInterviewResponse,
  ) => {
    requireString(projectId, 'projectId')
    caps.saveModuleDraft(projectId, draft, interviewResponse)
    return { ok: true }
  })

  ipcMain.handle(CAP_CHANNELS.approveModule, (
    _e,
    projectId: string,
    draft: ModuleManifest,
    interviewResponse?: ModuleInterviewResponse,
  ) => {
    requireString(projectId, 'projectId')
    const detailedResponse = interviewResponse ?? caps.getModuleInterviewDraft(projectId, draft.moduleId)
    const gate = detailedResponse ? evaluateModuleInterview(detailedResponse) : evaluateModuleGate(draft)
    if (!gate.passed) return { ok: false as const, gate }
    return { ok: true as const, approved: caps.approveModule(projectId, draft, interviewResponse), gate }
  })

  ipcMain.handle(CAP_CHANNELS.listModules, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    caps.ensureInitialized(projectId)
    const architecture = caps.getApprovedArchitecture(projectId) ?? caps.getArchitectureDraft(projectId)
    return caps.listModules(projectId, architecture?.moduleIds).map((record) => ({
      ...record,
      freshness: runs.getFreshness(projectId, record.moduleId),
    }))
  })

  ipcMain.handle(CAP_CHANNELS.listBindings, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    caps.ensureInitialized(projectId)
    return caps.listBindings(projectId)
  })

  ipcMain.handle(CAP_CHANNELS.evaluateModuleGate, (_e, manifest: ModuleManifest) => evaluateModuleGate(manifest))

  ipcMain.handle(CAP_CHANNELS.buildInterviewPacket, (_e, input: Parameters<typeof buildInterviewPacket>[0]) =>
    buildInterviewPacket(input),
  )

  ipcMain.handle(CAP_CHANNELS.exportInterviewPacket, (_e, packetInput: Parameters<typeof buildInterviewPacket>[0]) => {
    const projectId = requireString(packetInput.projectId, 'projectId')
    const packet = buildInterviewPacket(packetInput)
    const now = new Date().toISOString()
    const runId = `cap-interview-${crypto.randomUUID()}`
    return exportCapabilityPacketFiles({
      caps,
      runs,
      run: {
        schemaVersion: '1.0', runId, kind: 'interview', projectId,
        targetOwnerId: packet.interviewBoundary, lifecycleState: 'draft',
        inputRevisions: Object.fromEntries(
          packet.inputContext.recordIds.map((id, index) => [id, packet.inputContext.revisions[index] ?? 'unknown']),
        ),
        inputHashes: Object.fromEntries(
          packet.inputContext.recordIds.map((id, index) => [id, packet.inputContext.hashes[index] ?? 'unknown']),
        ),
        allowedPaths: [], expectedPaths: [], protectedPaths: [], packetRefs: [], artifactRefs: [],
        transitionHistory: [], createdAt: now, updatedAt: now,
      },
      packet,
      recommendedPrompt: interactiveInterviewPrompt(packet),
      responseTemplate: { fileName: packet.outputFileName, value: interviewResponseStarter(packet) },
    })
  })

  ipcMain.handle(
    CAP_CHANNELS.startHandoffDrag,
    (event, input: { projectId: string; runId: string }): { files: number } => {
      const projectId = requireString(input.projectId, 'projectId')
      const runId = requireString(input.runId, 'runId')
      const run = runs.getRun(projectId, runId)
      if (!run) throw new Error('capability run not found')
      const root = caps.root(projectId)
      const files = run.packetRefs.map((ref) => path.resolve(root, ref))
      if (files.length !== 1 || !files.every((file) => file.startsWith(root + path.sep) && fs.existsSync(file))) {
        throw new Error('capability handoff file is missing')
      }
      event.sender.startDrag({ file: files[0]!, files, icon: CAPABILITY_DRAG_BADGE })
      return { files: files.length }
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.exportImplementationPacket,
    (_e, input: { projectId: string; moduleId: string }) => {
      const projectId = requireString(input.projectId, 'projectId')
      const moduleId = requireString(input.moduleId, 'moduleId')
      const manifest = caps.getApprovedModule(projectId, moduleId)
      const architecture = caps.getApprovedArchitecture(projectId)
      const project = workspace.getProject(projectId)
      if (!manifest) throw new Error(`approved module not found: ${moduleId}`)
      if (!architecture) throw new Error('approved architecture not found')
      if (!project) throw new Error('project not found')
      const interview = caps.getApprovedModuleInterview(projectId, moduleId)
      const repository = discoverRepositoryImplementationContext({
        repoRoot: project.repoPath,
        allowedPaths: manifest.ownedPaths,
        verificationCommands: project.verificationCommands,
      })
      const brief = buildModuleImplementationBrief({
        manifest,
        interview,
        architecture,
        repository,
        ...approvedContractContext(caps, projectId, architecture),
      })
      const packet = buildImplementationPacket({
        packetId: `pkt-implementation-${moduleId}-${Date.now()}`,
        projectId,
        targetKind: manifest.moduleType === 'connection' ? 'connection' : 'module',
        targetId: moduleId,
        manifest,
        architectureVersion: architecture.revision,
        architectureHash: architecture.contentHash,
        inputHashes: {
          specification: canonicalHash(manifest),
          architecture: architecture.contentHash,
          dependencies: canonicalHash(manifest.requiredOperations),
        },
        acceptanceCases: interview?.acceptanceCases?.length
          ? interview.acceptanceCases
          : [{
              id: `accept-${moduleId}`,
              description: manifest.responsibility,
              expectedOutcome: 'All declared verification suites pass',
            }],
        unchangedBehavior: manifest.excludedConcerns.map((concern) => `Do not add responsibility for ${concern}`),
      })
      const now = new Date().toISOString()
      const runId = `cap-implementation-${crypto.randomUUID()}`
      const providedOperations = manifest.providedOperations.map((operation) => operation.operationId).join(', ') || 'none'
      const requiredOperations = manifest.requiredOperations.map((operation) => operation.operationId).join(', ') || 'none'
      const exported = exportCapabilityPacketFiles({
        caps,
        runs,
        run: {
          schemaVersion: '1.0', runId, kind: 'implementation', projectId,
          targetOwnerId: moduleId, lifecycleState: 'draft',
          inputRevisions: { module: manifest.moduleVersion, architecture: architecture.revision },
          inputHashes: packet.inputHashes, allowedPaths: packet.allowedPaths,
          expectedPaths: packet.expectedPaths, protectedPaths: packet.protectedPaths,
          packetRefs: [], artifactRefs: [], transitionHistory: [], createdAt: now, updatedAt: now,
        },
        packet,
        recommendedPrompt: `Implement production source code and tests for “${manifest.name}” (${moduleId}). Its approved responsibility is: ${manifest.responsibility}. Implement its provided operations (${providedOperations}) and consume its required operations (${requiredOperations}) only through the approved architecture boundaries. Follow the implementation plan, precedence rules, detailed interview evidence, reference architecture, and live repository context in the embedded implementation brief. Work only within allowedPaths, preserve unchanged behavior, run the required tests, and return only ${packet.requiredOutput}.`,
        supportingRecord: {
          fileName: 'module-implementation-brief.json',
          value: brief,
        },
      })
      return { ...exported, readiness: brief.readiness }
    },
  )

  ipcMain.handle(CAP_CHANNELS.importInterviewResponse, (_e, projectId: string, raw: string | object) => {
    requireString(projectId, 'projectId')
    const approved = caps.getApprovedApplication(projectId)
    const approvedSnapshot = approved ? structuredClone(approved) : undefined
    const imported = importProductInterviewResponse(raw, { projectId, approved })
    caps.saveApplicationDraft(projectId, imported.draft)
    const approvedAfter = caps.getApprovedApplication(projectId)
    return {
      ...imported,
      approvedUnchanged: approvedAfter,
      approvedRevisionUnchanged:
        JSON.stringify(approvedSnapshot ?? null) === JSON.stringify(approvedAfter ?? null),
    }
  })

  ipcMain.handle(CAP_CHANNELS.buildImplementationPacket, (_e, input: Parameters<typeof buildImplementationPacket>[0]) =>
    buildImplementationPacket(input),
  )

  ipcMain.handle(CAP_CHANNELS.listCapabilityRuns, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    return runs.listRuns(projectId)
  })

  ipcMain.handle(CAP_CHANNELS.createCapabilityRun, (_e, run: CapabilityRunScope) => runs.createRun(run))

  ipcMain.handle(
    CAP_CHANNELS.inspectCapabilityOverlay,
    async (_e, input: { projectId: string; runId: string; zipPath: string }) => {
      requireString(input.projectId, 'projectId')
      requireString(input.runId, 'runId')
      requireString(input.zipPath, 'zipPath')
      const project = workspace.getProject(input.projectId)
      if (!project) throw new Error('project not found')
      const run = runs.getRun(input.projectId, input.runId)
      if (!run) throw new Error('capability run not found')
      const inspection = inspectOverlay(input.zipPath, {
        runId: input.runId,
        targetRoot: project.repoPath,
        expectedFiles: run.expectedPaths.length ? run.expectedPaths : undefined,
        capabilityAllowedPaths: run.allowedPaths,
      })
      const inspectionRef = runs.saveRunArtifact(
        input.projectId,
        input.runId,
        'overlay-inspection.json',
        {
          archiveSha256: sha256File(input.zipPath),
          inspection,
        } satisfies PersistedOverlayReview,
      )
      const at = new Date().toISOString()
      runs.updateRun(input.projectId, input.runId, {
        lifecycleState: 'overlay-inspected',
        inspectionRef,
        transitionHistory: [
          ...run.transitionHistory,
          {
            at,
            actor: 'desktop',
            fromState: run.lifecycleState,
            toState: 'overlay-inspected',
            evidenceIds: [inspectionRef],
          },
        ],
        updatedAt: at,
      })
      return inspection
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.applyCapabilityOverlay,
    async (
      _e,
      input: {
        projectId: string
        runId: string
        zipPath: string
        acceptWarnings: boolean
        explicit: boolean
      },
    ) => {
      if (!input.explicit) throw new Error('capability overlay apply requires explicit user action')
      requireString(input.projectId, 'projectId')
      requireString(input.runId, 'runId')
      requireString(input.zipPath, 'zipPath')
      const project = workspace.getProject(input.projectId)
      if (!project) throw new Error('project not found')
      const run = runs.getRun(input.projectId, input.runId)
      if (!run) throw new Error('capability run not found')
      if (!run.inspectionRef) throw new Error('inspect the capability overlay before applying')
      const previousReview = runs.getRunArtifact<PersistedOverlayReview>(
        input.projectId,
        run.inspectionRef,
      )
      if (!previousReview) throw new Error('persisted capability overlay inspection is missing')
      if (previousReview.inspection.zipFilename !== path.basename(input.zipPath)) {
        throw new Error('selected overlay does not match the persisted inspection')
      }
      if (previousReview.archiveSha256 !== sha256File(input.zipPath)) {
        throw new Error('overlay contents changed after inspection; inspect it again')
      }

      // Inspect immediately before apply so an archive changed after review
      // cannot widen the persisted capability scope or bypass safety rules.
      const currentInspection = inspectOverlay(input.zipPath, {
        runId: input.runId,
        targetRoot: project.repoPath,
        expectedFiles: run.expectedPaths.length ? run.expectedPaths : undefined,
        capabilityAllowedPaths: run.allowedPaths,
      })
      const applied = applyOverlay(input.zipPath, currentInspection, {
        runId: input.runId,
        targetRoot: project.repoPath,
        acceptWarnings: input.acceptWarnings,
      })
      const applicationRef = runs.saveRunArtifact(
        input.projectId,
        input.runId,
        'applied-files.json',
        applied,
      )
      const at = new Date().toISOString()
      runs.updateRun(input.projectId, input.runId, {
        lifecycleState: 'overlay-applied',
        applicationRef,
        verificationRef: undefined,
        artifactRefs: [...new Set([...run.artifactRefs, applicationRef])],
        transitionHistory: [
          ...run.transitionHistory,
          {
            at,
            actor: 'desktop',
            fromState: run.lifecycleState,
            toState: 'overlay-applied',
            evidenceIds: [applicationRef],
          },
        ],
        updatedAt: at,
      })
      const manifest = caps.getApprovedModule(input.projectId, run.targetOwnerId)
      const architecture = caps.getApprovedArchitecture(input.projectId)
      if (manifest && architecture) {
        const bindings = caps.listBindings(input.projectId)
          .map((record) => record.approved)
          .filter((binding): binding is FrontendBinding => Boolean(binding))
          .filter((binding) => manifest.providedOperations.some((operation) => operation.operationId === binding.operationId))
        runs.saveFreshness(input.projectId, calculateFreshness({
          moduleId: manifest.moduleId,
          moduleVersion: manifest.moduleVersion,
          specificationHash: canonicalHash(manifest),
          implementationHash: implementationHash(project.repoPath, manifest.ownedPaths),
          architectureHash: architecture.contentHash,
          dependencyHash: canonicalHash(manifest.requiredOperations),
          adapterHash: canonicalHash(architecture.adapterAllocations.filter((allocation) => allocation.moduleId === manifest.moduleId)),
          bindingHash: canonicalHash(bindings),
          verificationSuiteHash: canonicalHash(selectVerificationSuites(manifest.moduleType, manifest)),
          verification: null,
        }))
      }
      return applied
    },
  )

  ipcMain.handle(CAP_CHANNELS.calculateFreshness, (_e, input: Parameters<typeof calculateFreshness>[0]) =>
    calculateFreshness(input),
  )

  ipcMain.handle(CAP_CHANNELS.listNeedsAttention, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    caps.ensureInitialized(projectId)
    const arch = caps.getApprovedArchitecture(projectId) ?? caps.getArchitectureDraft(projectId)
    const index = caps.getIndex(projectId)
    const moduleIds =
      arch?.moduleIds?.length ? arch.moduleIds : Object.keys(index.modules).sort((a, b) => a.localeCompare(b))
    const freshness: FreshnessRecord[] = moduleIds.map((moduleId) => {
      const existing = runs.getFreshness(projectId, moduleId)
      if (existing) return existing
      const approved = caps.getApprovedModule(projectId, moduleId)
      return calculateFreshness({
        moduleId,
        moduleVersion: approved?.moduleVersion ?? '0.0.0',
        specificationHash: approved ? `spec:${approved.moduleId}@${approved.moduleVersion}` : 'pending',
        implementationHash: 'pending',
        architectureHash: arch?.contentHash ?? 'pending',
        dependencyHash: 'pending',
        adapterHash: 'pending',
        bindingHash: 'pending',
        verificationSuiteHash: 'pending',
        verification: null,
      })
    })
    return buildNeedsAttention(freshness, {
      schemaVersion: '1.0',
      changeId: `attention-${projectId}`,
      initiatingRecordId: arch?.id ?? projectId,
      initiatingRevision: arch?.revision ?? '0',
      classification: 'required-additive',
      affectedModules: [],
      unaffectedModules: [],
      proposedPacketOrder: moduleIds,
      recalculationEvidence: [],
    })
  })

  ipcMain.handle(
    CAP_CHANNELS.calculateImpact,
    (_e, input: { projectId: string; changedModuleIds: string[]; classification: import('@engineering-ui-kit/core').ImpactClassification }) => {
      const projectId = requireString(input.projectId, 'projectId')
      const architecture = caps.getApprovedArchitecture(projectId)
      if (!architecture) throw new Error('approved architecture not found')
      const manifests = caps.listModules(projectId, architecture.moduleIds)
        .map((record) => record.approved)
        .filter((manifest): manifest is ModuleManifest => Boolean(manifest))
      const unknown = input.changedModuleIds.filter((id) => !architecture.moduleIds.includes(id))
      if (unknown.length) throw new Error(`changed modules are not allocated: ${unknown.join(', ')}`)
      return calculateImpact({
        changeId: `impact-${crypto.randomUUID()}`,
        initiatingRecordId: input.changedModuleIds[0] ?? architecture.id,
        initiatingRevision: architecture.revision,
        classification: input.classification,
        graph: buildCapabilityGraph(architecture, manifests),
        manifests,
        changedModuleIds: input.changedModuleIds,
      })
    },
  )

  ipcMain.handle(CAP_CHANNELS.approveImpact, (_e, projectId: string, impact: import('@engineering-ui-kit/core').ImpactRecord) => {
    requireString(projectId, 'projectId')
    const approved = {
      ...impact,
      userApproval: { approved: true, at: new Date().toISOString(), by: 'user' },
    }
    runs.saveImpact(projectId, approved)
    return approved
  })

  ipcMain.handle(CAP_CHANNELS.listImpacts, (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    return runs.listImpacts(projectId)
  })

  ipcMain.handle(
    CAP_CHANNELS.deltaQueueState,
    (_e, input: { projectId: string; changeId: string }) => {
      const projectId = requireString(input.projectId, 'projectId')
      const changeId = requireString(input.changeId, 'changeId')
      const impact = runs.getImpact(projectId, changeId)
      if (!impact) throw new Error(`impact not found: ${changeId}`)
      const progress = runs.getDeltaProgress(projectId, changeId)
      return deltaQueueState(impact, progress.completedTargets)
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.exportDeltaPacket,
    (_e, input: { projectId: string; changeId: string; targetId: string }) => {
      const projectId = requireString(input.projectId, 'projectId')
      const changeId = requireString(input.changeId, 'changeId')
      const targetId = requireString(input.targetId, 'targetId')
      const impact = runs.getImpact(projectId, changeId)
      if (!impact) throw new Error(`impact not found: ${changeId}`)
      if (!impact.userApproval?.approved) {
        throw new Error('impact must be explicitly approved before delta export')
      }
      const progress = runs.getDeltaProgress(projectId, changeId)
      // Hard-block: only the next actionable target may export.
      assertTargetExportable(impact, progress.completedTargets, targetId)

      const manifest = caps.getApprovedModule(projectId, targetId)
      const architecture = caps.getApprovedArchitecture(projectId)
      const project = workspace.getProject(projectId)
      if (!manifest) throw new Error(`approved module not found: ${targetId}`)
      if (!architecture) throw new Error('approved architecture not found')
      if (!project) throw new Error('project not found')
      const interview = caps.getApprovedModuleInterview(projectId, targetId)
      const repository = discoverRepositoryImplementationContext({
        repoRoot: project.repoPath,
        allowedPaths: manifest.ownedPaths,
        verificationCommands: project.verificationCommands,
      })
      const brief = buildModuleImplementationBrief({
        manifest,
        interview,
        architecture,
        repository,
        ...approvedContractContext(caps, projectId, architecture),
      })

      const base = buildImplementationPacket({
        packetId: `pkt-delta-${targetId}-${Date.now()}`,
        projectId,
        targetKind: manifest.moduleType === 'connection' ? 'connection' : 'module',
        targetId,
        manifest,
        architectureVersion: architecture.revision,
        architectureHash: architecture.contentHash,
        inputHashes: {
          specification: canonicalHash(manifest),
          architecture: architecture.contentHash,
          dependencies: canonicalHash(manifest.requiredOperations),
        },
        acceptanceCases: interview?.acceptanceCases?.length
          ? interview.acceptanceCases
          : [{
              id: `accept-delta-${targetId}`,
              description: manifest.responsibility,
              expectedOutcome: 'All declared verification suites pass after the change',
            }],
        unchangedBehavior: manifest.excludedConcerns.map((concern) => `Do not add responsibility for ${concern}`),
      })

      const targetContractVersions = Object.fromEntries(
        manifest.providedOperations.map((op) => [op.operationId, op.contractVersion]),
      )
      const delta = buildDeltaPacket(base, {
        impactRecordId: impact.changeId,
        changeReason: `Propagate ${impact.classification} change from ${impact.initiatingRecordId}@${impact.initiatingRevision}`,
        previousContractVersions: { [targetId]: impact.initiatingRevision },
        targetContractVersions:
          Object.keys(targetContractVersions).length > 0
            ? targetContractVersions
            : { [targetId]: manifest.moduleVersion },
        preserveBehavior: manifest.ownedConcerns.map((concern) => `Preserve existing behavior for ${concern}`),
        addBehavior:
          impact.classification === 'implementation-only'
            ? []
            : [`Apply ${impact.classification} contract change to ${targetId}`],
        changeBehavior:
          impact.classification === 'breaking'
            ? [`Update ${targetId} to the new breaking contract`]
            : [],
        newTests: manifest.verificationSuiteIds,
        unchangedModuleIds: impact.unaffectedModules.map((m) => m.moduleId),
      })

      const now = new Date().toISOString()
      const runId = `cap-delta-${crypto.randomUUID()}`
      const exported = exportCapabilityPacketFiles({
        caps,
        runs,
        run: {
          schemaVersion: '1.0', runId, kind: 'delta', projectId,
          targetOwnerId: targetId, lifecycleState: 'draft',
          inputRevisions: { module: manifest.moduleVersion, architecture: architecture.revision, impact: impact.changeId },
          inputHashes: delta.inputHashes, allowedPaths: delta.allowedPaths,
          expectedPaths: delta.expectedPaths, protectedPaths: delta.protectedPaths,
          packetRefs: [], artifactRefs: [], transitionHistory: [], createdAt: now, updatedAt: now,
        },
        packet: delta,
        recommendedPrompt: `Apply the approved delta for “${manifest.name}” (${targetId}) as production source code and tests. The embedded delta packet and module implementation brief are requirements, not outputs. Follow the approved interview evidence, reference architecture, live repository context, and implementation plan. Preserve the listed behavior, change only what is required, add the new tests, leave unchanged modules untouched, and return only ${delta.requiredOutput}.`,
        supportingRecord: {
          fileName: 'module-implementation-brief.json',
          value: brief,
        },
      })
      return { ...exported, readiness: brief.readiness }
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.markDeltaTargetComplete,
    (_e, input: { projectId: string; changeId: string; targetId: string; verificationId: string; explicit: boolean }) => {
      if (!input.explicit) throw new Error('marking a delta target complete requires explicit user action')
      const projectId = requireString(input.projectId, 'projectId')
      const changeId = requireString(input.changeId, 'changeId')
      const targetId = requireString(input.targetId, 'targetId')
      const verificationId = requireString(input.verificationId, 'verificationId')
      const impact = runs.getImpact(projectId, changeId)
      if (!impact) throw new Error(`impact not found: ${changeId}`)
      // Advancement is gated on a real passing verification for this exact target.
      const verification = runs.getVerification(projectId, verificationId)
      if (!verification) throw new Error(`verification not found: ${verificationId}`)
      if (verification.moduleId !== targetId) {
        throw new Error('verification does not match the delta target')
      }
      if (verification.outcome !== 'passed') {
        throw new Error(`cannot complete target ${targetId}; verification outcome is ${verification.outcome}`)
      }
      runs.markDeltaTargetComplete(projectId, changeId, targetId)
      const progress = runs.getDeltaProgress(projectId, changeId)
      return deltaQueueState(impact, progress.completedTargets)
    },
  )

  ipcMain.handle(CAP_CHANNELS.runModuleVerification, (_e, input: Parameters<typeof runModuleVerification>[0]) => {
    requireString(input.projectId, 'projectId')
    requireString(input.verificationId, 'verificationId')
    requireString(input.moduleId, 'moduleId')
    const result = runModuleVerification(input)
    runs.saveVerification(input.projectId, result.record)
    const hashes = input.inputHashes
    const freshness = calculateFreshness({
      moduleId: input.moduleId,
      moduleVersion: input.manifest?.moduleVersion ?? '1.0.0',
      specificationHash: hashes.specification ?? 'pending',
      implementationHash: hashes.implementation ?? 'pending',
      architectureHash: hashes.architecture ?? 'pending',
      dependencyHash: hashes.dependencies ?? 'pending',
      adapterHash: hashes.adapters ?? 'pending',
      bindingHash: hashes.bindings ?? 'pending',
      verificationSuiteHash: hashes.verificationSuites ?? 'pending',
      verification: result.record,
    })
    runs.saveFreshness(input.projectId, freshness)
    return result
  })

  ipcMain.handle(
    CAP_CHANNELS.verifyApprovedModule,
    async (_e, input: { projectId: string; moduleId: string; explicit: boolean }) => {
      if (!input.explicit) throw new Error('module verification requires explicit user action')
      const projectId = requireString(input.projectId, 'projectId')
      const moduleId = requireString(input.moduleId, 'moduleId')
      const project = workspace.getProject(projectId)
      if (!project) throw new Error('project not found')
      const manifest = caps.getApprovedModule(projectId, moduleId)
      if (!manifest) throw new Error(`approved module not found: ${moduleId}`)
      const architecture = caps.getApprovedArchitecture(projectId)
      if (!architecture) throw new Error('approved architecture not found')

      const suites = selectVerificationSuites(manifest.moduleType, manifest)
      const bindings = Object.keys(caps.getIndex(projectId).bindings)
        .map((bindingId) => caps.getApprovedBinding(projectId, bindingId))
        .filter((binding): binding is FrontendBinding => Boolean(binding))
        .filter((binding) =>
          manifest.providedOperations.some((operation) => operation.operationId === binding.operationId),
        )
      const inputHashes: Record<string, string> = {
        specification: canonicalHash(manifest),
        implementation: implementationHash(project.repoPath, manifest.ownedPaths),
        architecture: architecture.contentHash,
        dependencies: canonicalHash(manifest.requiredOperations),
        adapters: canonicalHash(
          architecture.adapterAllocations.filter((allocation) => allocation.moduleId === moduleId),
        ),
        bindings: canonicalHash(bindings),
        verificationSuites: canonicalHash({ suites, commands: project.verificationCommands ?? {} }),
      }
      for (const suite of suites) inputHashes[`suite:${suite}`] = canonicalHash(suite)

      const verificationId = `ver-${moduleId}-${crypto.randomUUID()}`
      const outputDir = path.join(caps.root(projectId), 'evidence', 'verification-output', verificationId)
      const startedAt = new Date().toISOString()
      const commandEntries = Object.entries(project.verificationCommands ?? {})
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1].trim()))
        .sort(([a], [b]) => a.localeCompare(b))
      const commands: Parameters<typeof runModuleVerification>[0]['commands'] = []

      if (!fs.existsSync(path.join(project.repoPath, 'package.json'))) {
        commands.push({
          label: 'project-setup',
          exitCode: 1,
          passed: false,
          kind: 'setup',
          outputSummary: 'package.json is missing from the selected project folder',
        })
      } else {
        for (const [label, commandText] of commandEntries) {
          const result = await runCommand({
            runId: verificationId,
            commandLabel: label,
            commandText,
            workingDirectory: project.repoPath,
            timeoutMs: workspace.getSettings().defaultCommandTimeoutMinutes * 60 * 1000,
            outputDir,
          })
          commands.push({
            label,
            exitCode: result.exitCode ?? -1,
            passed: result.status === 'passed',
            kind: 'technical',
            outputSummary: result.status,
          })
        }
      }

      const completedAt = new Date().toISOString()
      const result = runModuleVerification({
        verificationId,
        projectId,
        moduleId,
        moduleType: manifest.moduleType,
        manifest,
        inputHashes,
        currentHashes: inputHashes,
        commands,
        architectureVersion: architecture.revision,
        architectureHash: architecture.contentHash,
        startedAt,
        completedAt,
        artifacts: fs.existsSync(outputDir)
          ? [path.relative(caps.root(projectId), outputDir).replace(/\\/g, '/')]
          : [],
      })
      runs.saveVerification(projectId, result.record)
      runs.saveFreshness(
        projectId,
        calculateFreshness({
          moduleId,
          moduleVersion: manifest.moduleVersion,
          specificationHash: inputHashes.specification!,
          implementationHash: inputHashes.implementation!,
          architectureHash: inputHashes.architecture!,
          dependencyHash: inputHashes.dependencies!,
          adapterHash: inputHashes.adapters!,
          bindingHash: inputHashes.bindings!,
          verificationSuiteHash: inputHashes.verificationSuites!,
          verification: result.record,
        }),
      )
      return result
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.filesystemRead,
    async (_e, input: { projectId: string; relativePath: string; explicit: boolean }) => {
      if (!input.explicit) throw new Error('consequential filesystem read requires explicit user action')
      const project = workspace.getProject(requireString(input.projectId, 'projectId'))
      if (!project) throw new Error('project not found')
      const policy = {
        roots: {
          source: 'capabilities/modules',
          'generated-output': 'capabilities/generated',
          configuration: 'capabilities/config',
          'input-data': 'data',
          artifacts: 'artifacts',
        },
      } as const
      const resolved = resolveProjectRelativePath(policy, input.relativePath, [
        'source',
        'generated-output',
        'configuration',
        'input-data',
        'artifacts',
      ])
      if (!resolved.ok) {
        return technicalFailureResult(
          {
            schemaVersion: '1.0',
            code: 'CAP-FS-003',
            category: 'authorization',
            safeMessage: 'path outside policy roots',
            retryability: 'none',
            relatedIds: [],
            diagnosticRefs: resolved.diagnostics.map((d) => d.code),
          },
          { source: 'filesystem', recordedAt: new Date().toISOString() },
        ) satisfies ResultEnvelope
      }
      const abs = path.resolve(project.repoPath, resolved.relativePath)
      if (!isRealPathWithinProjectRoot(project.repoPath, abs)) {
        throw new Error('path escaped project root')
      }
      const content = fs.readFileSync(abs)
      return successResult(
        {
          relativePath: resolved.relativePath,
          checksum: crypto.createHash('sha256').update(content).digest('hex'),
          byteSize: content.byteLength,
          text: content.toString('utf8'),
        },
        { source: 'filesystem', recordedAt: new Date().toISOString() },
      )
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.filesystemWrite,
    async (_e, input: { projectId: string; relativePath: string; text: string; explicit: boolean }) => {
      if (!input.explicit) throw new Error('consequential filesystem write requires explicit user action')
      const project = workspace.getProject(requireString(input.projectId, 'projectId'))
      if (!project) throw new Error('project not found')
      const policy = {
        roots: {
          source: 'capabilities/modules',
          'generated-output': 'capabilities/generated',
          configuration: 'capabilities/config',
          'input-data': 'data',
          artifacts: 'artifacts',
        },
      } as const
      const resolved = resolveProjectRelativePath(policy, input.relativePath, [
        'generated-output',
        'configuration',
        'artifacts',
      ])
      if (!resolved.ok) {
        return technicalFailureResult(
          {
            schemaVersion: '1.0',
            code: 'CAP-FS-003',
            category: 'authorization',
            safeMessage: 'write path outside policy roots',
            retryability: 'none',
            relatedIds: [],
            diagnosticRefs: [],
          },
          { source: 'filesystem', recordedAt: new Date().toISOString() },
        )
      }
      const abs = path.resolve(project.repoPath, resolved.relativePath)
      if (!isRealPathWithinProjectRoot(project.repoPath, abs)) {
        throw new Error('path escaped project root')
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      if (!isRealPathWithinProjectRoot(project.repoPath, abs)) {
        throw new Error('path escaped project root')
      }
      fs.writeFileSync(abs, input.text)
      return successResult(
        { relativePath: resolved.relativePath },
        { source: 'filesystem', recordedAt: new Date().toISOString() },
      )
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.secretPut,
    (_e, input: { opaqueId: string; label: string; secret: string; explicit: boolean }) => {
      if (!input.explicit) throw new Error('secret storage requires explicit user action')
      requireString(input.opaqueId, 'opaqueId')
      if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable')
      const dir = secretsDir(dataDir)
      fs.mkdirSync(dir, { recursive: true })
      const encrypted = safeStorage.encryptString(input.secret)
      fs.writeFileSync(path.join(dir, `${input.opaqueId}.bin`), encrypted)
      const meta = {
        label: input.label,
        providerKind: 'safeStorage',
        createdAt: new Date().toISOString(),
      }
      secretIndex.set(input.opaqueId, meta)
      return {
        schemaVersion: '1.0',
        kind: 'secret-reference' as const,
        opaqueId: input.opaqueId,
        providerKind: 'safeStorage',
        label: input.label,
        createdAt: meta.createdAt,
      }
    },
  )

  ipcMain.handle(CAP_CHANNELS.secretValidate, (_e, opaqueId: string) => {
    requireString(opaqueId, 'opaqueId')
    const file = path.join(secretsDir(dataDir), `${opaqueId}.bin`)
    return { ok: fs.existsSync(file), providerKind: 'safeStorage' }
  })

  ipcMain.handle(CAP_CHANNELS.matlabSessionStatus, async (_e, projectId: string) => {
    requireString(projectId, 'projectId')
    return matlab.getStatus(projectId)
  })

  ipcMain.handle(
    CAP_CHANNELS.matlabInvoke,
    async (
      _e,
      input: {
        projectId: string
        operation: 'start' | 'stop' | 'eval-allowlisted' | 'snapshot-save' | 'snapshot-restore'
        expression?: string
        variables?: string[]
        explicit: boolean
      },
    ) => {
      if (!input.explicit) throw new Error('MATLAB operation requires explicit user action')
      const projectId = requireString(input.projectId, 'projectId')
      switch (input.operation) {
        case 'start':
          return matlab.start(projectId)
        case 'stop':
          return matlab.stop(projectId)
        case 'eval-allowlisted':
          return matlab.evalExpression(projectId, { expression: input.expression ?? '' })
        case 'snapshot-save': {
          const envelope = await matlab.snapshotSave(projectId, { variables: input.variables ?? [] })
          const value = (envelope as { value?: { snapshotId?: string } }).value
          if (value?.snapshotId) matlabLastSnapshot.set(projectId, value.snapshotId)
          return envelope
        }
        case 'snapshot-restore': {
          const snapshotId = input.expression ?? matlabLastSnapshot.get(projectId)
          if (!snapshotId) {
            return technicalFailureResult(
              {
                schemaVersion: '1.0',
                code: 'CAP-MATLAB-SNAPSHOT',
                category: 'configuration',
                safeMessage: 'no snapshot available to restore; session left usable',
                retryability: 'manual',
                relatedIds: [projectId],
                diagnosticRefs: [],
              },
              { source: 'matlab', recordedAt: new Date().toISOString() },
            )
          }
          return matlab.snapshotRestore(projectId, { snapshotId })
        }
        default:
          return technicalFailureResult(
            sanitizeBoundaryError(new Error('unknown operation')),
            { source: 'matlab', recordedAt: new Date().toISOString() },
          )
      }
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.azureDiscover,
    async (
      _e,
      input: {
        projectId: string
        opaqueSecretId: string
        azureConfig?: { organization: string; project?: string }
        explicit: boolean
      },
    ) => {
      if (!input.explicit) throw new Error('Azure discovery requires explicit user action')
      const config = azureConfigOf(input.azureConfig)
      // Fake mode never needs a real PAT; the real path decrypts it in-process only.
      if (process.env.EUIK_TEST_MODE === '1') return azureDiscover(config, '')
      const pat = readAzurePat(input.opaqueSecretId)
      if (pat === undefined) return azureSecretMissing()
      return azureDiscover(config, pat)
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.azureImportWorkItem,
    async (
      _e,
      input: {
        projectId: string
        opaqueSecretId?: string
        azureConfig?: { organization: string; project?: string }
        externalId: string
        revision: string
        content: Record<string, string>
        explicit: boolean
      },
    ) => {
      if (!input.explicit) throw new Error('Azure import requires explicit user action')
      const config = azureConfigOf(input.azureConfig)
      const args = { externalId: input.externalId, revision: input.revision, fields: input.content }
      if (process.env.EUIK_TEST_MODE === '1') return azureImportWorkItem(config, '', args)
      const pat = readAzurePat(input.opaqueSecretId)
      if (pat === undefined) return azureSecretMissing()
      return azureImportWorkItem(config, pat, args)
    },
  )

  ipcMain.handle(
    CAP_CHANNELS.invokeOperation,
    async (
      _e,
      input: {
        projectId: string
        operationId: string
        args?: unknown
        dataMode?: string
        explicit: boolean
      },
    ) => {
      const provenance = { source: 'runtime', recordedAt: new Date().toISOString() }
      if (input.dataMode && input.dataMode !== 'connected') {
        return successResult(
          { simulated: true, dataMode: input.dataMode, operationId: input.operationId },
          { ...provenance, source: 'runtime-simulated' },
        )
      }
      if (!input.explicit) throw new Error('connected invoke requires explicit user action')
      const projectId = requireString(input.projectId, 'projectId')
      const operationId = requireString(input.operationId, 'operationId')
      const project = workspace.getProject(projectId)
      if (!project) throw new Error('project not found')
      const architecture = caps.getApprovedArchitecture(projectId)
      if (!architecture) {
        return technicalFailureResult(
          {
            schemaVersion: '1.0',
            code: 'CAP-RESOLVE-ARCHITECTURE',
            category: 'configuration',
            safeMessage: 'approved architecture is required before connected invocation',
            retryability: 'manual',
            relatedIds: [operationId],
            diagnosticRefs: [],
          },
          provenance,
        )
      }
      const manifests = caps
        .listModules(projectId, architecture.moduleIds)
        .map((record) => record.approved)
        .filter((manifest): manifest is ModuleManifest => Boolean(manifest))
      const freshnessByModule = Object.fromEntries(
        manifests.map((manifest) => [manifest.moduleId, runs.getFreshness(projectId, manifest.moduleId)]),
      )
      const registry = rebuildRegistry(manifests, freshnessByModule, {})
      const resolved = resolveProvider(registry, { operationId })
      if (!resolved.ok) {
        const category = resolved.failure === 'ambiguous'
          ? 'conflict'
          : resolved.failure === 'unconfigured'
            ? 'configuration'
            : 'dependency'
        return technicalFailureResult(
          {
            schemaVersion: '1.0',
            code: `CAP-RESOLVE-${resolved.failure.toUpperCase()}`,
            category,
            safeMessage: resolved.diagnostics[0]?.message ?? 'operation provider could not be resolved',
            retryability: 'manual',
            relatedIds: [operationId],
            diagnosticRefs: resolved.diagnostics.map((diagnostic) => diagnostic.code),
          },
          provenance,
        )
      }
      if (resolved.entry.runtimeAllocation !== 'local-embedded') {
        return technicalFailureResult(
          {
            schemaVersion: '1.0',
            code: 'CAP-RUNTIME-ADAPTER-ROUTE',
            category: 'configuration',
            safeMessage: 'external provider must use its approved named adapter operation',
            retryability: 'manual',
            relatedIds: [resolved.entry.moduleId, operationId],
            diagnosticRefs: [],
          },
          provenance,
        )
      }
      const manifest = manifests.find((candidate) => candidate.moduleId === resolved.entry.moduleId)!
      try {
        const value = await invokeLocalRuntime({
          repoRoot: project.repoPath,
          moduleId: manifest.moduleId,
          ownedPaths: manifest.ownedPaths,
          operationId,
          args: input.args,
        })
        return successResult(value, {
          ...provenance,
          refs: [manifest.moduleId, manifest.moduleVersion, operationId],
        })
      } catch (cause) {
        return technicalFailureResult(sanitizeBoundaryError(cause), {
          ...provenance,
          refs: [manifest.moduleId, operationId],
        })
      }
    },
  )

  ipcMain.handle(CAP_CHANNELS.saveBindingDraft, (_e, projectId: string, draft: FrontendBinding) => {
    requireString(projectId, 'projectId')
    caps.saveBindingDraft(projectId, draft)
    return { ok: true }
  })

  ipcMain.handle(CAP_CHANNELS.approveBinding, (_e, projectId: string, draft: FrontendBinding) => {
    requireString(projectId, 'projectId')
    if (!draft.selectionEvidence.stableMarker && !draft.selectionEvidence.sourceTargetConfirmed) {
      return {
        ok: false as const,
        diagnostics: [
          {
            code: 'CAP-BIND-001',
            message: 'stable marker or explicit source-target confirmation is required',
          },
        ],
      }
    }
    const required = [
      draft.loadingBehavior,
      draft.validationBehavior,
      draft.domainRejectionBehavior,
      draft.technicalFailureBehavior,
      draft.cancellationBehavior,
      draft.duplicateSubmissionBehavior,
    ]
    if (required.some((v) => !v?.trim())) {
      return { ok: false as const, diagnostics: [{ code: 'CAP-BIND-002', message: 'all behavior mappings are required' }] }
    }
    return { ok: true as const, approved: caps.approveBinding(projectId, draft) }
  })

  // Keep transitionJob referenced for job API completeness in later packets.
  void transitionJob
  void jobs
}

export { CAP_CHANNELS }
