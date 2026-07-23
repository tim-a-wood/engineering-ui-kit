/**
 * Versioned machine surface for LLMs and automation.
 *
 * Operations return one stable envelope, never require UI navigation, and
 * persist idempotent mutation results so retries cannot duplicate work.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Workspace } from './persistence.js'
import { deriveProjectWorkOverview } from './work.js'
import { lintTaskPacket, type TaskPacketLintFields } from './packetLint.js'
import {
  buildModuleImplementationBrief,
  CapabilityRunStore,
  CapabilityWorkspace,
  canonicalHash,
  compileFrontendBrief,
  discoverRepositoryImplementationContext,
  evaluateModuleGate,
  planImplementationWaves,
  proposeArchitectureModuleBatch,
  type ArchitectureSpecification,
  type FrontendBinding,
  type InboundBinding,
  type ModuleManifest,
} from './capabilities/index.js'

export const MACHINE_API_VERSION = '1.0' as const

export type MachineOperationName =
  | 'project.overview.get'
  | 'modules.batch.propose'
  | 'modules.batch.approve'
  | 'implementation.waves.plan'
  | 'implementation.brief.compile'
  | 'frontend.brief.compile'
  | 'frontend.build.create'
  | 'packet.lint'

export type MachineOperationDescriptor = {
  operation: MachineOperationName
  summary: string
  mutation: boolean
  requiresIdempotencyKey: boolean
  requiresExplicitApproval: boolean
  inputSchema: Record<string, string>
}

export type MachineOperationRequest = {
  apiVersion: typeof MACHINE_API_VERSION
  requestId: string
  operation: MachineOperationName
  idempotencyKey?: string
  input: Record<string, unknown>
}

export type MachineDiagnostic = {
  code: string
  severity: 'info' | 'warning' | 'blocking'
  message: string
  relatedIds?: string[]
}

export type MachineResultManifest = {
  operation: MachineOperationName
  affectedTargets: string[]
  producedRecords: { kind: string; id: string; revision?: string; state: string }[]
  artifactRefs: string[]
  nextOperations: MachineOperationName[]
}

export type MachineOperationResult = {
  apiVersion: typeof MACHINE_API_VERSION
  requestId: string
  operation: MachineOperationName
  status: 'succeeded' | 'blocked' | 'failed'
  replayed: boolean
  completedAt: string
  resultHash: string
  result?: unknown
  diagnostics: MachineDiagnostic[]
  manifest: MachineResultManifest
}

const DESCRIPTORS: MachineOperationDescriptor[] = [
  {
    operation: 'project.overview.get',
    summary: 'Read unified capability and frontend coverage, history, and deterministic next actions.',
    mutation: false,
    requiresIdempotencyKey: false,
    requiresExplicitApproval: false,
    inputSchema: { projectId: 'string' },
  },
  {
    operation: 'modules.batch.propose',
    summary: 'Propose all architecture-allocated module manifests without replacing existing records.',
    mutation: true,
    requiresIdempotencyKey: true,
    requiresExplicitApproval: false,
    inputSchema: { projectId: 'string' },
  },
  {
    operation: 'modules.batch.approve',
    summary: 'Explicitly gate and approve selected module proposals.',
    mutation: true,
    requiresIdempotencyKey: true,
    requiresExplicitApproval: true,
    inputSchema: { projectId: 'string', moduleIds: 'string[]', explicit: 'true' },
  },
  {
    operation: 'implementation.waves.plan',
    summary: 'Plan dependency-safe implementation waves for approved modules.',
    mutation: false,
    requiresIdempotencyKey: false,
    requiresExplicitApproval: false,
    inputSchema: { projectId: 'string' },
  },
  {
    operation: 'implementation.brief.compile',
    summary: 'Compile an implementation-ready module brief with live repository context.',
    mutation: false,
    requiresIdempotencyKey: false,
    requiresExplicitApproval: false,
    inputSchema: { projectId: 'string', moduleId: 'string' },
  },
  {
    operation: 'frontend.brief.compile',
    summary: 'Compile approved product, capability, operation, and binding truth into editable task fields.',
    mutation: false,
    requiresIdempotencyKey: false,
    requiresExplicitApproval: false,
    inputSchema: { projectId: 'string', targetModuleIds: 'string[]?' },
  },
  {
    operation: 'frontend.build.create',
    summary: 'Compile a frontend brief and create one resumable frontend build run.',
    mutation: true,
    requiresIdempotencyKey: true,
    requiresExplicitApproval: true,
    inputSchema: { projectId: 'string', targetModuleIds: 'string[]?', explicit: 'true' },
  },
  {
    operation: 'packet.lint',
    summary: 'Lint task packet fields for missing content, placeholders, and boundary contradictions.',
    mutation: false,
    requiresIdempotencyKey: false,
    requiresExplicitApproval: false,
    inputSchema: { fields: 'TaskPacketLintFields' },
  },
]

export function describeMachineOperations(): {
  apiVersion: typeof MACHINE_API_VERSION
  operations: MachineOperationDescriptor[]
} {
  return { apiVersion: MACHINE_API_VERSION, operations: DESCRIPTORS.map((value) => ({ ...value })) }
}

function stringInput(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must be a non-empty string`)
  return value
}

function stringArrayInput(input: Record<string, unknown>, key: string): string[] {
  const value = input[key]
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error(`${key} must be an array of non-empty strings`)
  }
  return [...new Set(value)]
}

function optionalStringArrayInput(input: Record<string, unknown>, key: string): string[] | undefined {
  return input[key] === undefined ? undefined : stringArrayInput(input, key)
}

function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(temporary, filePath)
}

function idempotencyPath(dataDir: string, key: string): string {
  const digest = crypto.createHash('sha256').update(key).digest('hex')
  return path.join(dataDir, 'machine-operations', `${digest}.json`)
}

type StoredMachineResult = {
  requestHash: string
  response: MachineOperationResult
}

function emptyManifest(operation: MachineOperationName): MachineResultManifest {
  return { operation, affectedTargets: [], producedRecords: [], artifactRefs: [], nextOperations: [] }
}

function finish(
  request: MachineOperationRequest,
  status: MachineOperationResult['status'],
  result: unknown,
  diagnostics: MachineDiagnostic[],
  manifest: MachineResultManifest,
): MachineOperationResult {
  const completedAt = new Date().toISOString()
  const resultHash = canonicalHash({ status, result, diagnostics, manifest })
  return {
    apiVersion: MACHINE_API_VERSION,
    requestId: request.requestId,
    operation: request.operation,
    status,
    replayed: false,
    completedAt,
    resultHash,
    ...(result === undefined ? {} : { result }),
    diagnostics,
    manifest,
  }
}

function activeBindings(caps: CapabilityWorkspace, projectId: string): (InboundBinding | FrontendBinding)[] {
  const inbound = caps.listInboundBindings(projectId)
    .map((record) => record.approved)
    .filter((binding): binding is InboundBinding => Boolean(binding))
  const canonicalIds = new Set(inbound.map((binding) => binding.bindingId))
  const legacy = caps.listBindings(projectId)
    .map((record) => record.approved)
    .filter((binding): binding is FrontendBinding =>
      Boolean(binding) && !canonicalIds.has(binding!.bindingId))
  return [...inbound, ...legacy]
}

function approvedModules(
  caps: CapabilityWorkspace,
  projectId: string,
  architecture: ArchitectureSpecification,
): ModuleManifest[] {
  return caps.listModules(projectId, architecture.moduleIds)
    .map((record) => record.approved)
    .filter((manifest): manifest is ModuleManifest => Boolean(manifest))
}

function compileFrontend(
  caps: CapabilityWorkspace,
  projectId: string,
  targetModuleIds?: string[],
) {
  const architecture = caps.getApprovedArchitecture(projectId)
  if (!architecture) throw new Error('approved architecture not found')
  return compileFrontendBrief({
    projectId,
    application: caps.getApprovedApplication(projectId),
    architecture,
    modules: approvedModules(caps, projectId, architecture),
    bindings: activeBindings(caps, projectId),
    targetModuleIds,
  })
}

export async function executeMachineOperation(
  request: MachineOperationRequest,
  options: { dataDir: string },
): Promise<MachineOperationResult> {
  if (request.apiVersion !== MACHINE_API_VERSION) {
    return finish(request, 'failed', undefined, [{
      code: 'MACHINE-API-VERSION',
      severity: 'blocking',
      message: `Unsupported API version ${String(request.apiVersion)}; expected ${MACHINE_API_VERSION}.`,
    }], emptyManifest(request.operation))
  }
  if (!request.requestId?.trim()) {
    return finish(request, 'failed', undefined, [{
      code: 'MACHINE-REQUEST-ID',
      severity: 'blocking',
      message: 'requestId is required.',
    }], emptyManifest(request.operation))
  }
  const descriptor = DESCRIPTORS.find((candidate) => candidate.operation === request.operation)
  if (!descriptor) {
    return finish(request, 'failed', undefined, [{
      code: 'MACHINE-OPERATION',
      severity: 'blocking',
      message: `Unknown machine operation: ${String(request.operation)}.`,
    }], emptyManifest(request.operation))
  }
  if (descriptor.requiresIdempotencyKey && !request.idempotencyKey?.trim()) {
    return finish(request, 'failed', undefined, [{
      code: 'MACHINE-IDEMPOTENCY-REQUIRED',
      severity: 'blocking',
      message: `${request.operation} requires an idempotencyKey.`,
    }], emptyManifest(request.operation))
  }
  if (descriptor.requiresExplicitApproval && request.input['explicit'] !== true) {
    return finish(request, 'blocked', undefined, [{
      code: 'MACHINE-EXPLICIT-APPROVAL',
      severity: 'blocking',
      message: `${request.operation} requires input.explicit=true.`,
    }], emptyManifest(request.operation))
  }

  const requestHash = canonicalHash({ operation: request.operation, input: request.input })
  const storedPath = request.idempotencyKey ? idempotencyPath(options.dataDir, request.idempotencyKey) : undefined
  if (descriptor.mutation && storedPath && fs.existsSync(storedPath)) {
    const stored = JSON.parse(fs.readFileSync(storedPath, 'utf8')) as StoredMachineResult
    if (stored.requestHash !== requestHash) {
      return finish(request, 'failed', undefined, [{
        code: 'MACHINE-IDEMPOTENCY-CONFLICT',
        severity: 'blocking',
        message: 'The idempotencyKey was already used for different operation input.',
      }], emptyManifest(request.operation))
    }
    return { ...stored.response, requestId: request.requestId, replayed: true }
  }

  const workspace = new Workspace(options.dataDir)
  const caps = new CapabilityWorkspace(options.dataDir)
  const runs = new CapabilityRunStore(caps)
  let response: MachineOperationResult
  try {
    switch (request.operation) {
      case 'project.overview.get': {
        const projectId = stringInput(request.input, 'projectId')
        const project = workspace.getProject(projectId)
        if (!project) throw new Error(`project not found: ${projectId}`)
        caps.ensureInitialized(projectId)
        const architecture = {
          draft: caps.getArchitectureDraft(projectId),
          approved: caps.getApprovedArchitecture(projectId),
        }
        const activeArchitecture = architecture.approved ?? architecture.draft
        const overview = deriveProjectWorkOverview({
          projectId,
          application: {
            draft: caps.getApplicationDraft(projectId),
            approved: caps.getApprovedApplication(projectId),
          },
          architecture,
          modules: caps.listModules(projectId, activeArchitecture?.moduleIds).map((record) => ({
            ...record,
            freshness: runs.getFreshness(projectId, record.moduleId),
          })),
          capabilityRuns: runs.listRuns(projectId),
          handoffRuns: workspace.listRuns(projectId),
          requiresFrontend: project.developmentScope !== 'capabilities',
        })
        response = finish(request, 'succeeded', overview, [], {
          operation: request.operation,
          affectedTargets: overview.targets.map((target) => target.targetId),
          producedRecords: [],
          artifactRefs: [],
          nextOperations: [],
        })
        break
      }
      case 'modules.batch.propose': {
        const projectId = stringInput(request.input, 'projectId')
        const architecture = caps.getApprovedArchitecture(projectId)
        if (!architecture) throw new Error('approved architecture not found')
        const existing = caps.listModules(projectId, architecture.moduleIds)
        const batch = proposeArchitectureModuleBatch({ projectId, architecture, existing })
        const savedDraftModuleIds: string[] = []
        const preservedModuleIds: string[] = []
        for (const proposal of batch.proposals) {
          const record = existing.find((candidate) => candidate.moduleId === proposal.moduleId)
          if (record?.draft || record?.approved) {
            preservedModuleIds.push(proposal.moduleId)
          } else {
            caps.saveModuleDraft(projectId, proposal.manifest)
            savedDraftModuleIds.push(proposal.moduleId)
          }
        }
        response = finish(request, 'succeeded', {
          ...batch,
          savedDraftModuleIds,
          preservedModuleIds,
        }, batch.proposals.flatMap((proposal) => proposal.exceptionReasons.map((message) => ({
          code: 'MODULE-PROPOSAL-EXCEPTION',
          severity: 'warning' as const,
          message,
          relatedIds: [proposal.moduleId],
        }))), {
          operation: request.operation,
          affectedTargets: batch.proposals.map((proposal) => proposal.moduleId),
          producedRecords: savedDraftModuleIds.map((moduleId) => ({
            kind: 'module',
            id: moduleId,
            state: 'draft',
          })),
          artifactRefs: [],
          nextOperations: ['modules.batch.approve'],
        })
        break
      }
      case 'modules.batch.approve': {
        const projectId = stringInput(request.input, 'projectId')
        const moduleIds = stringArrayInput(request.input, 'moduleIds')
        const architecture = caps.getApprovedArchitecture(projectId)
        if (!architecture) throw new Error('approved architecture not found')
        const outcomes = moduleIds.map((moduleId) => {
          if (!architecture.moduleIds.includes(moduleId)) {
            return { moduleId, status: 'not-allocated' as const, ok: false as const }
          }
          const approved = caps.getApprovedModule(projectId, moduleId)
          if (approved) return { moduleId, status: 'already-approved' as const, ok: true as const, approved }
          const draft = caps.getModuleDraft(projectId, moduleId)
          if (!draft) return { moduleId, status: 'missing' as const, ok: false as const }
          const gate = evaluateModuleGate(draft)
          if (!gate.passed) return { moduleId, status: 'blocked' as const, ok: false as const, gate }
          return {
            moduleId,
            status: 'approved' as const,
            ok: true as const,
            gate,
            approved: caps.approveModule(projectId, draft),
          }
        })
        const blocked = outcomes.filter((outcome) => !outcome.ok)
        response = finish(request, blocked.length ? 'blocked' : 'succeeded', { outcomes }, blocked.map((outcome) => ({
          code: 'MODULE-APPROVAL-BLOCKED',
          severity: 'blocking' as const,
          message: `${outcome.moduleId} could not be approved (${outcome.status}).`,
          relatedIds: [outcome.moduleId],
        })), {
          operation: request.operation,
          affectedTargets: moduleIds,
          producedRecords: outcomes.filter((outcome) => outcome.ok).map((outcome) => ({
            kind: 'module',
            id: outcome.moduleId,
            revision: outcome.approved?.moduleVersion,
            state: 'approved',
          })),
          artifactRefs: [],
          nextOperations: blocked.length ? ['modules.batch.propose'] : ['implementation.waves.plan', 'frontend.brief.compile'],
        })
        break
      }
      case 'implementation.waves.plan': {
        const projectId = stringInput(request.input, 'projectId')
        const architecture = caps.getApprovedArchitecture(projectId)
        if (!architecture) throw new Error('approved architecture not found')
        const plan = planImplementationWaves({
          projectId,
          architecture,
          modules: caps.listModules(projectId, architecture.moduleIds),
        })
        response = finish(request, plan.blockedCycles.length ? 'blocked' : 'succeeded', plan,
          plan.blockedCycles.map((cycle) => ({
            code: 'IMPLEMENTATION-DEPENDENCY-CYCLE',
            severity: 'blocking' as const,
            message: `Dependency cycle: ${cycle.join(' → ')}`,
            relatedIds: cycle,
          })), {
            operation: request.operation,
            affectedTargets: plan.waves.flatMap((wave) => wave.targets.map((target) => target.moduleId)),
            producedRecords: [],
            artifactRefs: [],
            nextOperations: ['implementation.brief.compile'],
          })
        break
      }
      case 'implementation.brief.compile': {
        const projectId = stringInput(request.input, 'projectId')
        const moduleId = stringInput(request.input, 'moduleId')
        const project = workspace.getProject(projectId)
        const architecture = caps.getApprovedArchitecture(projectId)
        const manifest = caps.getApprovedModule(projectId, moduleId)
        if (!project) throw new Error(`project not found: ${projectId}`)
        if (!architecture) throw new Error('approved architecture not found')
        if (!manifest) throw new Error(`approved module not found: ${moduleId}`)
        const interviews = architecture.moduleIds
          .map((candidate) => caps.getApprovedModuleInterview(projectId, candidate))
          .filter((value): value is NonNullable<typeof value> => Boolean(value))
        const brief = buildModuleImplementationBrief({
          manifest,
          interview: caps.getApprovedModuleInterview(projectId, moduleId),
          architecture,
          repository: discoverRepositoryImplementationContext({
            repoRoot: project.repoPath,
            allowedPaths: manifest.ownedPaths,
            verificationCommands: project.verificationCommands,
          }),
          availableOperationContracts: interviews.flatMap((value) => value.operationContracts ?? []),
          availableDataSchemas: interviews.flatMap((value) => value.dataSchemas ?? []),
        })
        response = finish(request, brief.readiness.status === 'blocked' ? 'blocked' : 'succeeded', brief,
          brief.readiness.issues.map((issue) => ({
            code: issue.code,
            severity: issue.severity === 'blocking' ? 'blocking' as const : 'warning' as const,
            message: issue.message,
            relatedIds: [moduleId],
          })), {
            operation: request.operation,
            affectedTargets: [moduleId],
            producedRecords: [],
            artifactRefs: [],
            nextOperations: [],
          })
        break
      }
      case 'frontend.brief.compile': {
        const projectId = stringInput(request.input, 'projectId')
        const brief = compileFrontend(caps, projectId, optionalStringArrayInput(request.input, 'targetModuleIds'))
        response = finish(request,
          brief.gaps.some((gap) => gap.severity === 'blocking') ? 'blocked' : 'succeeded',
          brief,
          brief.gaps.map((gap) => ({ ...gap, severity: gap.severity })),
          {
            operation: request.operation,
            affectedTargets: brief.coverage.moduleIds,
            producedRecords: [],
            artifactRefs: [],
            nextOperations: ['frontend.build.create', 'packet.lint'],
          })
        break
      }
      case 'frontend.build.create': {
        const projectId = stringInput(request.input, 'projectId')
        const project = workspace.getProject(projectId)
        if (!project) throw new Error(`project not found: ${projectId}`)
        const brief = compileFrontend(caps, projectId, optionalStringArrayInput(request.input, 'targetModuleIds'))
        if (brief.gaps.some((gap) => gap.severity === 'blocking')) {
          response = finish(request, 'blocked', brief, brief.gaps.map((gap) => ({
            ...gap,
            severity: gap.severity,
          })), {
            operation: request.operation,
            affectedTargets: brief.coverage.moduleIds,
            producedRecords: [],
            artifactRefs: [],
            nextOperations: ['frontend.brief.compile'],
          })
          break
        }
        const run = workspace.createRun({
          projectId,
          currentStep: 'prepare-context',
          taskTitle: brief.fields.taskTitle,
          taskTemplateId: 'new-ui-from-requirements',
          taskPacketFields: brief.fields,
        })
        response = finish(request, 'succeeded', { brief, run }, brief.gaps.map((gap) => ({
          ...gap,
          severity: gap.severity,
        })), {
          operation: request.operation,
          affectedTargets: brief.coverage.moduleIds,
          producedRecords: [{ kind: 'frontend-run', id: run.id, state: 'draft' }],
          artifactRefs: [],
          nextOperations: ['packet.lint'],
        })
        break
      }
      case 'packet.lint': {
        const fields = request.input['fields']
        if (!fields || typeof fields !== 'object') throw new Error('fields must be a task packet object')
        const lint = lintTaskPacket(fields as TaskPacketLintFields)
        response = finish(request, lint.valid ? 'succeeded' : 'blocked', lint,
          lint.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: diagnostic.severity === 'blocker' ? 'blocking' as const : 'warning' as const,
            message: diagnostic.message,
          })), {
            operation: request.operation,
            affectedTargets: [],
            producedRecords: [],
            artifactRefs: [],
            nextOperations: [],
          })
        break
      }
    }
  } catch (error) {
    response = finish(request, 'failed', undefined, [{
      code: 'MACHINE-OPERATION-FAILED',
      severity: 'blocking',
      message: error instanceof Error ? error.message : String(error),
    }], emptyManifest(request.operation))
  }

  if (descriptor.mutation && storedPath) {
    atomicWriteJson(storedPath, { requestHash, response } satisfies StoredMachineResult)
  }
  return response
}
