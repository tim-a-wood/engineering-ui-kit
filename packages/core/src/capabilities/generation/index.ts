/**
 * Pure generator boundary (CAP-ERA-001 §11.1): reference-profile selection,
 * evidence-based repository discovery, deployable proposal, generated-file
 * ownership, and deterministic `GenerationPlan` assembly.
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
