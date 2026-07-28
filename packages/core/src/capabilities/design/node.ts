/**
 * Node-safe canonical design-workflow surface.
 *
 * This separate package entry prevents the legacy Capabilities contracts and
 * the canonical design-workflow records from colliding in the root barrel.
 */
export * from './index.js'
export * from './repositoryAdapter.js'
export * from './connectExecutors.js'
