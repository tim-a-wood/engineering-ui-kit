import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// This example depends on `@engineering-ui-kit/capabilities-runtime` (and its
// `/node` subpath) exactly as any consumer would. The runtime package ships
// dist/ as a gitignored build artifact (packages/capabilities-runtime-ts is
// read-only for this packet), so rather than building it we alias the two
// specifiers straight to the runtime's TS source, resolved via a RELATIVE
// path within this worktree only (no node_modules/symlink involved). This
// keeps everything real: the actual runtime source, the actual dispatch/
// Operation/Outcome/LifecycleContainer/node-host code — just resolved
// without a separate compile step.
const runtimeSrc = path.resolve(fileURLToPath(new URL('../../packages/capabilities-runtime-ts/src', import.meta.url)))

export default defineConfig({
  resolve: {
    alias: [
      { find: '@engineering-ui-kit/capabilities-runtime/node', replacement: path.join(runtimeSrc, 'node.ts') },
      { find: '@engineering-ui-kit/capabilities-runtime', replacement: path.join(runtimeSrc, 'index.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
