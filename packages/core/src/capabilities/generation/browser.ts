/**
 * Browser-safe re-export of the pure generator boundary.
 *
 * Every module under `generation/` is pure and filesystem-independent (no
 * `node:*` imports — enforced by CAP-TEST-053), so the full surface is safe
 * to bundle in the renderer without a reduced subset.
 */
export * from './index.js'
