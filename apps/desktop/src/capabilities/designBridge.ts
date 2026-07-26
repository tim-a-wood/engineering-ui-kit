/**
 * EUC-16 — desktop IPC bridge contract for the use-case-led Capabilities
 * design workflow (§17, §25.3 "IPC, CLI, and machine API return the same
 * structured result for the same operation").
 *
 * A single operation-envelope channel, not one channel per operation: the
 * renderer sends `{ operation, args }` and gets back exactly what the named
 * `DesignOperationsService` method (packages/core
 * `capabilities/design/operations.ts`) returns for those `args` — a §17.1
 * read value or a §17.3 `DesignOperationResult`. `designIpc.ts` is the only
 * file that dispatches this envelope to the real service; this file only
 * declares the wire contract, so it stays trivially serializable (no
 * functions) and importable from the renderer-safe side of the bridge too.
 */

/** The one IPC channel every design-workflow operation travels over. */
export const DESIGN_CHANNEL = 'design:operation' as const

/**
 * Every §17.1 read + §17.2 change operation exported by `DesignOperationsService`
 * (`packages/core/src/capabilities/design/operations.ts`, `createDesignOperations`
 * return value), spelled exactly as the service exports them. `designIpc.ts`
 * validates every incoming request's `operation` against this list before
 * calling the service — the adapter never adds an operation the service does
 * not already expose, so no channel can bypass the service's own approval
 * checks (§20.2 "no approval shortcut for agents").
 */
export const DESIGN_OPERATIONS = [
  // §17.1 read operations
  'getWorkflowStatus',
  'getValidNextActions',
  'getSystemDesign',
  'listModuleDesigns',
  'getModuleDesign',
  'getModuleContext',
  'getModuleImpact',
  'getImplementationWaves',
  'getScenarioCoverage',
  'getVerificationEvidence',
  // §17.2 change operations
  'createUseCaseDraft',
  'updateUseCaseItem',
  'approveUseCaseAnalysis',
  'reopenUseCaseAnalysis',
  'createSystemDesignDraft',
  'applySystemDesignDecision',
  'approveSystemStructure',
  'startModuleDesign',
  'answerModuleDesignQuestion',
  'updateModuleDesignItem',
  'analyzeModuleDesign',
  'approveModuleDesign',
  'reopenModuleDesign',
  'createDesignBaseline',
  'approveDesignBaseline',
  'proposeVisualChange',
  'analyzeVisualChange',
  'approveChangePlan',
  'executeChangePlan',
  'createModuleImplementationPacket',
  'importAgentDelta',
  'inspectAgentDelta',
  'approveAgentDelta',
  'applyAgentDelta',
  'verifyModule',
  'configureBinding',
  'verifyConnection',
  'runScenario',
  'approveVerification',
] as const

export type DesignOperationName = (typeof DESIGN_OPERATIONS)[number]

/**
 * Operation-envelope request. `args` is spread positionally onto the named
 * `DesignOperationsService` method — e.g. `{ operation: 'getWorkflowStatus',
 * args: ['project-1'] }`, or `{ operation: 'createUseCaseDraft', args: [{
 * projectId, actor, idempotencyKey, workDescription }] }` for a §17.2 change
 * operation (which always takes one input object).
 */
export type DesignBridgeRequest = {
  operation: string
  args: unknown[]
}

/**
 * The result is exactly what the named service method returns — no
 * envelope wrapping, no channel-specific reshaping — plus the one adapter-only
 * case (`operation` not in `DESIGN_OPERATIONS`), which returns a structured
 * `{ ok: false, diagnostics: [...] }` error rather than throwing.
 */
export type DesignBridgeResponse = unknown

/**
 * Reviewer P1 fix (designIpc.ts ~line 54) — adapter-level project-repository
 * configuration. These two operation names are deliberately **not** part of
 * `DESIGN_OPERATIONS`: they configure *this desktop adapter's* per-project
 * repository root (§11.6 "if the workspace changes after inspection, the
 * product shall require a new inspection", §12.2 "verify the base workspace
 * revision" / "apply ... against the real filesystem", §17.3, §25.3) so the
 * `applyDelta`/`verifyModule`/`readRepositoryContext` executors `designIpc.ts`
 * builds for a project operate on that project's real repository instead of
 * the workspace's own data directory — no `DesignOperationsService` method is
 * added or bypassed by adding these two adapter operations.
 *
 * They still travel over the same `DESIGN_CHANNEL` envelope (`{ operation,
 * args }`) so the renderer/preload surface needs only one IPC channel; the
 * `'adapter:'` prefix keeps them unambiguously distinct from every real §17
 * operation name (none of which contain a colon) and DESIGN_OPERATIONS'
 * own drift guard (`design-ipc.test.ts` "DESIGN_OPERATIONS matches exactly
 * what the committed service exports") stays meaningful because these are
 * never added to that list.
 */
export const ADAPTER_OPERATIONS = [
  'adapter:configureProjectRepository',
  'adapter:getProjectRepository',
  'adapter:configureProjectRoles',
  'adapter:getProjectRoles',
  'adapter:getPrincipal',
  'adapter:getProjectSource',
  'adapter:getConnectionState',
  'adapter:getEvidenceArtifact',
] as const

export type AdapterOperationName = (typeof ADAPTER_OPERATIONS)[number]

/**
 * `adapter:configureProjectRepository` request payload. `actor` is validated
 * the same way every §17.2 change-operation actor is (`"user:<id>"`,
 * `"agent:<id>"`, or `"service:<id>"`) — but unlike a §17.2 change operation,
 * only a `user:` actor may configure a project's repository root; an
 * `agent:` (or `service:`) actor is rejected, mirroring §20.2 "external
 * agents shall receive a packet, not unrestricted project authority".
 */
export type ConfigureProjectRepositoryInput = {
  projectId: string
  actor: string
  idempotencyKey: string
  /** Absolute path to the project's real repository root (never the design workspace data directory). */
  repositoryRoot: string
}

/** `adapter:getProjectRepository` request payload — a read, so no actor/idempotencyKey is required (consistent with every §17.1 read operation). */
export type GetProjectRepositoryInput = {
  projectId: string
}

export type GetEvidenceArtifactInput = {
  projectId: string
  /** Opaque `design-evidence://<execution>/<file>` reference from a persisted run. */
  ref: string
}

export type GetProjectRolesInput = {
  projectId: string
}

export type GetProjectSourceInput = {
  projectId: string
  /** Repository-relative reference captured in the use-case analysis. */
  ref: string
}

export type GetConnectionStateInput = {
  projectId: string
  moduleId: string
}

export type ProjectSourceResponse =
  | {
      ok: true
      projectId: string
      ref: string
      fileName: string
      mediaType: 'text/plain' | 'application/json'
      sha256: string
      bytes: number
      content: string
      truncated: boolean
    }
  | { ok: false; diagnostics: { id: string; code: string; severity: 'blocker' | 'warning' | 'info'; message: string; target?: string }[] }

export type ProjectRolesResponse =
  | { ok: true; projectId: string; principal: string; authorities: string[]; configuredAt?: string }
  | { ok: false; diagnostics: { id: string; code: string; severity: 'blocker' | 'warning' | 'info'; message: string; target?: string }[] }

export type ConnectionStateResponse =
  | { ok: true; projectId: string; moduleId: string; binding?: unknown; verification?: unknown }
  | { ok: false; diagnostics: { id: string; code: string; severity: 'blocker' | 'warning' | 'info'; message: string; target?: string }[] }

export type EvidenceArtifactResponse =
  | {
      ok: true
      projectId: string
      ref: string
      mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/json' | 'text/plain'
      sha256: string
      bytes: number
      encoding: 'base64' | 'utf8'
      content: string
      fileName: string
    }
  | { ok: false; diagnostics: { id: string; code: string; severity: 'blocker' | 'warning' | 'info'; message: string; target?: string }[] }

/** Structured response shape both adapter operations return — never a throw. */
export type AdapterConfigurationResponse =
  | { ok: true; projectId: string; repositoryRoot: string; auditEventId?: string; idempotentReplay?: boolean }
  | { ok: false; diagnostics: { id: string; code: string; severity: 'blocker' | 'warning' | 'info'; message: string; target?: string }[] }
