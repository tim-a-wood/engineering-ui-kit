/**
 * Use-case-led Capabilities workflow — design/ barrel.
 *
 * Re-exports the public API of every committed `design/*.ts` module
 * (EUC-01..EUC-17). Adapters (desktop IPC, CLI, machine API — EUC-13..17)
 * should import from this barrel rather than reaching into individual
 * module files.
 *
 * `diagramSemantics.ts`, `diagramLayout.ts`, and `providers.ts` are owned by
 * a concurrently edited packet; their export lines are included here for
 * barrel completeness but were not typechecked as part of this packet (see
 * the EUC-16 packet notes).
 */

export * from './records.js'
export * from './identity.js'
export * from './useCaseAnalysis.js'
export * from './applicationCompiler.js'
export * from './systemDesign.js'
export * from './contractRegistry.js'
export * from './designBaseline.js'
export * from './moduleDesign.js'
export * from './moduleDesignSession.js'
export * from './moduleDesignCompilers.js'
export * from './impactEngine.js'
export * from './verificationPlanner.js'
export * from './contextPacket.js'
export * from './deltaInspector.js'
export * from './designWorkspace.js'
export * from './designMigration.js'
export * from './operations.js'
export * from './diagramSemantics.js'
export * from './diagramLayout.js'
export * from './providers.js'
