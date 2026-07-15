/**
 * Pure generator boundary (CAP-ERA-001 §11.1): reference-profile selection,
 * evidence-based repository discovery, deployable proposal, generated-file
 * ownership, deterministic `GenerationPlan` assembly, and (WP3B-gen)
 * canonical schema/operation TS planning (`contracts.ts`), composition-root
 * planning (`composition.ts`), inbound-adapter planning (`inbound.ts`), and
 * their shared deterministic virtual-file emission helpers (`typescript.ts`).
 *
 * Every module in this directory is filesystem-independent (no `node:*`
 * imports) and safe to bundle in the renderer; see `./browser.js`.
 */

export * from './paths.js'
export * from './profile.js'
export * from './repositoryDiscovery.js'
export * from './deployables.js'
export * from './ownership.js'
export * from './plan.js'
export * from './existingRepoMigration.js'
export * from './typescript.js'
export * from './contracts.js'
export * from './composition.js'
export * from './inbound.js'
