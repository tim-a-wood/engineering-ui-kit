/**
 * Backward-compatible entry point for the authoritative packaged Capabilities
 * acceptance suite.
 *
 * The former CAP-TEST-040 script launched source-mode Electron and drove the
 * bridge from page.evaluate. That is useful IPC smoke coverage, but it is not
 * packaged user-workflow evidence. Keep old documentation and local commands
 * working while ensuring they execute the real visible packaged journeys.
 */

console.warn(
  'capabilities-packaged.mjs now delegates to capabilities-production-packaged.mjs (visible packaged journeys A-E).',
)

await import('./capabilities-production-packaged.mjs')
