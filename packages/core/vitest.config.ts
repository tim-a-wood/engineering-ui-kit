import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The suite mixes pure unit tests with integration tests that spawn real
    // processes (git, verification commands) and a real Chromium (evidence
    // capture). Under parallel load the 5s default produces flaky timeouts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
