/** @type {import('vitest/config').UserConfig} */
export default {
  test: {
    environment: 'node',
    isolate: true,
    fileParallelism: false,
  },
}
