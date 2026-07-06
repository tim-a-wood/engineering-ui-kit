import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { probeFreePort, runCommand } from '../src/commandRunner.js'

describe('runCommand', () => {
  it('records passing commands', async () => {
    const result = await runCommand({
      runId: 'r1',
      commandLabel: 'echo',
      commandText: 'node -e "console.log(42)"',
      workingDirectory: process.cwd(),
    })
    expect(result.status).toBe('passed')
    expect(result.exitCode).toBe(0)
  })

  it('records failing commands with exit code', async () => {
    const result = await runCommand({
      runId: 'r1',
      commandLabel: 'fail',
      commandText: 'node -e "process.exit(3)"',
      workingDirectory: process.cwd(),
    })
    expect(result.status).toBe('failed')
    expect(result.exitCode).toBe(3)
  })

  it('times out runaway commands', async () => {
    const result = await runCommand({
      runId: 'r1',
      commandLabel: 'hang',
      commandText: 'node -e "setTimeout(() => {}, 60000)"',
      workingDirectory: process.cwd(),
      timeoutMs: 500,
    })
    expect(result.status).toBe('timed-out')
  }, 10_000)

  it('captures output files when an output dir is given', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cmd-'))
    const result = await runCommand({
      runId: 'r1',
      commandLabel: 'typecheck',
      commandText: 'node -e "console.log(\'ok\'); console.error(\'warn\')"',
      workingDirectory: process.cwd(),
      outputDir: dir,
    })
    expect(result.stdoutPath && fs.readFileSync(result.stdoutPath, 'utf8')).toContain('ok')
    expect(result.stderrPath && fs.readFileSync(result.stderrPath, 'utf8')).toContain('warn')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('probeFreePort', () => {
  it('returns a usable ephemeral port', async () => {
    const port = await probeFreePort()
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThan(65536)
  })
})
