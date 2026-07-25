export * from './parity.js'
export * from './hash.js'
export * from './types.js'
export * from './diagnostics.js'
export * from './validation.js'
export * from './gates.js'
export * from './graph.js'
export * from './architectureProjection.js'
export * from './persistence.js'
export * from './runs.js'
export * from './freshness.js'
export * from './impact.js'
export * from './packets.js'
export * from './implementationBrief.js'
export * from './foundation.js'
export * from './repositoryContext.js'
export * from './interview.js'
export * from './registry.js'
export * from './runtime.js'
export * from './localRuntimeHost.js'
export * from './filesystem.js'
export * from './jobs.js'
export * from './redaction.js'
export * from './migration.js'
export * from './attention.js'
export * from './architectureInterview.js'
export * from './moduleInterview.js'
export * from './verification.js'
export * from './verificationRunner.js'
export * from './binding.js'
export * from './perfFixture.js'
export * from './journeys.js'
export * from './generation/index.js'
export * from './generationApply.js'
export * from './generationAssembly.js'
export * from './integrationState.js'
export * from './integrationStore.js'
export * from './connectEntryPoints.js'
export * from './batchPlanning.js'
export * from './implementationWave.js'
export * from './frontendBrief.js'
// EUC-16 adapter-layer wiring (packet deviation — see final packet message
// "contract-change requests"): the design/ barrel was committed by EUC-13..15
// but never re-exported here, so `@engineering-ui-kit/core` (the "." entry
// apps/desktop imports) could not resolve `DesignWorkspace`/
// `createDesignOperations`. This line is additive only (no existing export
// changed) and is never pulled into the renderer bundle — `./browser.js` is a
// separately curated barrel that does not reference this file or `./design/`.
// `./design/records.js` declares its own `ImplementationWavePlan` (§11.8
// design-workflow wave planning), which collides with the pre-existing
// `./batchPlanning.js` type of the same name already relied on by
// `apps/desktop/src/capabilities/ipc.ts` and `bridgeApi.ts`. The explicit
// re-export below keeps that existing name resolving to the pre-existing
// `./batchPlanning.js` type (no behavior change for existing consumers); the
// design-workflow variant stays reachable via a qualified relative import
// (`capabilities/design/records.js`) inside `packages/core`.
export * from './design/index.js'
export type { ImplementationWavePlan } from './batchPlanning.js'
// `./design/repositoryAdapter.js` (EUC-15) is deliberately excluded from the
// `./design/index.js` barrel itself (it is the Node-`fs`/`child_process`
// filesystem-and-process adapter, not a design-record module), but the
// EUC-16 desktop IPC adapter (`apps/desktop/src/capabilities/designIpc.ts`)
// needs `applyDeltaTransactionally` to wire the `applyDelta` executor, and
// can only reach it through this package's "." export. Same additive-only,
// browser-bundle-isolated reasoning as above.
export * from './design/repositoryAdapter.js'
