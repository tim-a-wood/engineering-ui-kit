import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NodeProcessAdapter, ProcessAdapterError } from '../src/node/process-adapter.js'

describe('NodeProcessAdapter', () => {
  let workingRoot: string

  beforeEach(() => {
    workingRoot = mkdtempSync(path.join(tmpdir(), 'cap-runtime-process-adapter-'))
  })

  afterEach(() => {
    rmSync(workingRoot, { recursive: true, force: true })
  })

  it('runs an allow-listed executable with an argv array and captures stdout', async () => {
    const adapter = new NodeProcessAdapter({
      allowedExecutables: [process.execPath],
      allowedWorkingRoots: [workingRoot],
    })

    const result = await adapter.run({
      executable: process.execPath,
      args: ['-e', 'process.stdout.write("hello from argv array")'],
      cwd: workingRoot,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('hello from argv array')
    expect(result.timedOut).toBe(false)
  })

  it('rejects an executable that is not in the allow-list', async () => {
    const adapter = new NodeProcessAdapter({
      allowedExecutables: [process.execPath],
      allowedWorkingRoots: [workingRoot],
    })

    await expect(
      adapter.run({ executable: '/bin/sh', args: [], cwd: workingRoot }),
    ).rejects.toBeInstanceOf(ProcessAdapterError)
  })

  it('rejects a working directory outside the allowed roots', async () => {
    const adapter = new NodeProcessAdapter({
      allowedExecutables: [process.execPath],
      allowedWorkingRoots: [workingRoot],
    })

    await expect(
      adapter.run({ executable: process.execPath, args: ['-e', '1'], cwd: tmpdir() }),
    ).rejects.toBeInstanceOf(ProcessAdapterError)
  })

  it('rejects an argument containing a shell metacharacter instead of allowing shell interpolation', async () => {
    const adapter = new NodeProcessAdapter({
      allowedExecutables: [process.execPath],
      allowedWorkingRoots: [workingRoot],
    })

    await expect(
      adapter.run({
        executable: process.execPath,
        args: ['-e', '1; rm -rf /tmp/should-not-run'],
        cwd: workingRoot,
      }),
    ).rejects.toMatchObject({ code: 'unsafe-argument' })
  })

  it('bounds execution with a timeout and reports timedOut', async () => {
    const adapter = new NodeProcessAdapter({
      allowedExecutables: [process.execPath],
      allowedWorkingRoots: [workingRoot],
      timeoutMs: 50,
    })

    const result = await adapter.run({
      executable: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 5000)'],
      cwd: workingRoot,
    })

    expect(result.timedOut).toBe(true)
  }, 10_000)
})
