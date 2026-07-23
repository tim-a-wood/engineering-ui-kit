import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

const runtimeSource = path.resolve(
  fileURLToPath(new URL('../../packages/capabilities-runtime-ts/src', import.meta.url)),
)

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@engineering-ui-kit/capabilities-runtime/node',
        replacement: path.join(runtimeSource, 'node.ts'),
      },
      {
        find: '@engineering-ui-kit/capabilities-runtime',
        replacement: path.join(runtimeSource, 'index.ts'),
      },
    ],
  },
  test: {
    include: ['server/tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
