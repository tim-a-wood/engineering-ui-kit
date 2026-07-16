import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// This example depends on `@engineering-ui-kit/capabilities-runtime` and its
// `/browser` and `/react` subpaths exactly as any consumer would. The
// runtime package ships dist/ as a gitignored build artifact
// (packages/capabilities-runtime-ts is read-only for this packet), so
// rather than building it we alias each specifier straight to the
// runtime's TS source, resolved via a RELATIVE path within this worktree
// only (no node_modules/symlink involved) — the exact "RUNTIME-DIST
// workaround" already established by
// `examples/capabilities-ts-reference/vitest.config.ts` and
// `examples/capabilities-react-reference/vitest.config.ts`. This keeps
// everything real: the actual `OperationClient`/`Transport`/`useOperation`
// code — just resolved without a separate compile step.
const runtimeSrc = path.resolve(fileURLToPath(new URL('../../packages/capabilities-runtime-ts/src', import.meta.url)))

export default defineConfig({
  resolve: {
    alias: [
      // More specific subpaths MUST be listed before the bare package
      // specifier below, matching the established ordering convention for
      // string-prefix alias matching.
      { find: '@engineering-ui-kit/capabilities-runtime/react', replacement: path.join(runtimeSrc, 'react.tsx') },
      { find: '@engineering-ui-kit/capabilities-runtime/browser', replacement: path.join(runtimeSrc, 'browser.ts') },
      { find: '@engineering-ui-kit/capabilities-runtime', replacement: path.join(runtimeSrc, 'index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
