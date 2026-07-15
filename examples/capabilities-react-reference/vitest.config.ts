import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// This example depends on `@engineering-ui-kit/capabilities-runtime` and its
// `/browser`, `/react`, and `/electron/*` subpaths exactly as any consumer
// would. The runtime package ships dist/ as a gitignored build artifact
// (packages/capabilities-runtime-ts is read-only for this packet), so rather
// than building it we alias each specifier straight to the runtime's TS
// source, resolved via a RELATIVE path within this worktree only (no
// node_modules/symlink involved) — the exact pattern already established by
// `examples/capabilities-ts-reference/vitest.config.ts` for `/node`. This
// keeps everything real: the actual `useOperation`/`OperationController`,
// `OperationClient`, Electron IPC channel/renderer-transport/preload-bridge/
// main-handler code — just resolved without a separate compile step.
const runtimeSrc = path.resolve(fileURLToPath(new URL('../../packages/capabilities-runtime-ts/src', import.meta.url)))

export default defineConfig({
  resolve: {
    alias: [
      // More specific subpaths MUST be listed before the bare package
      // specifier below, matching `examples/capabilities-ts-reference`'s
      // established ordering convention for string-prefix alias matching.
      {
        find: '@engineering-ui-kit/capabilities-runtime/electron/renderer',
        replacement: path.join(runtimeSrc, 'electron/renderer.ts'),
      },
      {
        find: '@engineering-ui-kit/capabilities-runtime/electron/preload',
        replacement: path.join(runtimeSrc, 'electron/preload.ts'),
      },
      {
        find: '@engineering-ui-kit/capabilities-runtime/electron/main',
        replacement: path.join(runtimeSrc, 'electron/main.ts'),
      },
      { find: '@engineering-ui-kit/capabilities-runtime/react', replacement: path.join(runtimeSrc, 'react.tsx') },
      { find: '@engineering-ui-kit/capabilities-runtime/browser', replacement: path.join(runtimeSrc, 'browser.ts') },
      { find: '@engineering-ui-kit/capabilities-runtime', replacement: path.join(runtimeSrc, 'index.ts') },
    ],
  },
  test: {
    include: ['**/test/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
