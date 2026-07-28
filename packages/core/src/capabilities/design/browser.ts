/**
 * Browser-safe design-workflow barrel (EUC-17 GUI foundation packet).
 *
 * Re-exports ONLY the design-workflow modules that are safe to bundle in the
 * renderer: pure record contracts, identity helpers, and pure business logic.
 * `designWorkspace.ts`, `repositoryAdapter.ts`, and `operations.ts` are
 * filesystem-backed (Node-only) and are intentionally NOT re-exported here —
 * desktop/CLI adapters continue to import those directly from
 * `./index.js` or the individual module files. `designMigration.ts` and
 * `moduleDesignCompilers.ts` are not re-exported here either; the GUI
 * foundation packet does not need them (module-design compilation and legacy
 * migration stay adapter-side concerns).
 *
 * This file does not import `./index.ts` (the full design barrel), so it
 * never pulls in the fs-backed modules transitively.
 */

export * from './records.js'
export * from './identity.js'
export * from './moduleDesign.js'
export * from './moduleDesignSession.js'
export * from './systemDesign.js'
export * from './designBaseline.js'
export * from './contractRegistry.js'
export * from './useCaseAnalysis.js'
export * from './applicationCompiler.js'
export * from './impactEngine.js'
export * from './verificationPlanner.js'
export * from './diagramSemantics.js'
export * from './diagramLayout.js'
export * from './contextPacket.js'
export * from './deltaInspector.js'
export * from './providers.js'
export * from './sampleAuditHub.js'
