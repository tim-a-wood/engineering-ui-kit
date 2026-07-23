/**
 * Browser-safe entry point for `@engineering-ui-kit/core`.
 *
 * The renderer imports capability VALUES from `@engineering-ui-kit/core/browser`
 * so the main entry (which re-exports Node-owned modules such as the Playwright
 * journey harness, filesystem, and persistence) is only ever type-imported and
 * therefore fully erased from the renderer bundle.
 */
export * from './capabilities/browser.js'
export * from './work.js'
export * from './packetLint.js'
export * from './preview.js'
export * from './completion.js'
