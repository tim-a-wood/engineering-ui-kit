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
