/** @type {import('vitest/config').UserConfig} */
export default {
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    isolate: true,
    fileParallelism: false,
  },
}
