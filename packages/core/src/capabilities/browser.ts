/**
 * Browser-safe capability surface (CAP package boundary).
 *
 * This barrel contains ONLY contracts and pure logic that are safe to bundle in
 * the renderer. Node-owned modules — persistence, filesystem, runs, migration,
 * journeys, and the Playwright journey harness — must never be re-exported here,
 * or the renderer bundle will pull `node:*`/Playwright/fsevents (see the GUI
 * production build). Desktop/core code continues to import those Node modules
 * from `./index.js` or directly.
 */

export * from './hash.js'
export * from './parity.js'
export * from './types.js'
export * from './diagnostics.js'
export * from './validation.js'
export * from './gates.js'
export * from './graph.js'
export * from './architectureProjection.js'
export * from './freshness.js'
export * from './impact.js'
export * from './packets.js'
export * from './interview.js'
export * from './registry.js'
export * from './runtime.js'
export * from './jobs.js'
export * from './redaction.js'
export * from './attention.js'
export * from './architectureInterview.js'
export * from './moduleInterview.js'
export * from './verification.js'
export * from './binding.js'
export * from './perfFixture.js'
