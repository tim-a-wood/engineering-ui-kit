import { describe, expect, it } from 'vitest'
import { analyzePreviewPreflight, type PreviewPreflightInput } from '../src/index.js'

const base: PreviewPreflightInput = {
  projectId: 'project-1',
  repoPath: '/workspace/app',
  launchUrl: 'http://127.0.0.1:4182',
  launchCommand: 'npm run build && npm start',
  packageJsonExists: true,
  dependenciesInstalled: true,
  detectedPackageManager: 'npm',
  packageScripts: { build: 'vite build', start: 'node server.mjs' },
  probes: [{ url: 'http://127.0.0.1:4182', reachable: false, latencyMs: 25 }],
}

describe('analyzePreviewPreflight', () => {
  it('is ready when the configured app can be started even before it is reachable', () => {
    const result = analyzePreviewPreflight(base)
    expect(result.status).toBe('ready')
    expect(result.checks.find((check) => check.id === 'package-scripts')?.status).toBe('pass')
  })

  it('distinguishes an app running on another port and offers a one-click URL repair', () => {
    const result = analyzePreviewPreflight({
      ...base,
      probes: [
        { url: 'http://127.0.0.1:4182', reachable: false, latencyMs: 25 },
        { url: 'http://127.0.0.1:4183', reachable: true, latencyMs: 3 },
      ],
    })
    expect(result.status).toBe('repairable')
    expect(result.detectedUrl).toBe('http://127.0.0.1:4183')
    expect(result.repairs).toContainEqual(expect.objectContaining({
      id: 'use-detected-url',
      projectPatch: { launchUrl: 'http://127.0.0.1:4183' },
    }))
  })

  it('reports missing scripts and proposes a compatible command from package.json', () => {
    const result = analyzePreviewPreflight({
      ...base,
      launchCommand: 'npm start',
      packageScripts: { dev: 'vite --host 127.0.0.1' },
    })
    expect(result.status).toBe('repairable')
    expect(result.checks.find((check) => check.id === 'package-scripts')).toMatchObject({
      status: 'fail',
      detail: expect.stringContaining('start'),
    })
    expect(result.repairs).toContainEqual(expect.objectContaining({
      id: 'configure-launch-command',
      projectPatch: { launchCommand: 'npm run dev' },
    }))
  })

  it('reports missing dependencies separately from launch and port failures', () => {
    const result = analyzePreviewPreflight({ ...base, dependenciesInstalled: false })
    expect(result.status).toBe('repairable')
    expect(result.checks.find((check) => check.id === 'dependencies')?.status).toBe('fail')
    expect(result.repairs.some((repair) => repair.id === 'install-dependencies')).toBe(true)
  })

  it('blocks when there is no runnable package or mechanical repair', () => {
    const result = analyzePreviewPreflight({
      ...base,
      launchCommand: undefined,
      packageJsonExists: false,
      dependenciesInstalled: false,
      packageScripts: {},
    })
    expect(result.status).toBe('blocked')
    expect(result.summary).toMatch(/blocked/i)
  })
})
