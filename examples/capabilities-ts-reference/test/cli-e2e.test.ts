/**
 * REAL end-to-end test (handoff §19, §10.3 — CAP-TEST-058): drives the
 * ACTUAL CLI host (`runCli` from `@engineering-ui-kit/capabilities-runtime/node`)
 * with real argv arrays through the real composition root, asserting the
 * exit code and the stdout/stderr split. This traverses argv → parseArgs →
 * `dispatch` → the `greet` operation exactly as a real process invocation
 * would (a fake `signals` source is injected only to avoid registering real
 * OS `SIGINT`/`SIGTERM` handlers in the test process, per `runCli`'s own
 * documented injection seam — the argv parsing, dispatch, and outcome
 * mapping are all real).
 */
import { describe, expect, it } from 'vitest'
import type { CliSignalSource, CliWritable } from '@engineering-ui-kit/capabilities-runtime/node'
import { runReferenceCli } from '../src/cli/app.js'

function captureWritable(): { writable: CliWritable; lines: string[] } {
  const lines: string[] = []
  return {
    lines,
    writable: {
      write(chunk: string) {
        lines.push(chunk)
        return true
      },
    },
  }
}

function fakeSignals(): CliSignalSource {
  return {
    on: () => undefined,
    off: () => undefined,
  }
}

describe('capabilities-ts-reference CLI slice (real end-to-end)', () => {
  it('maps argv to the greet operation through the composition root: exit 0, result on stdout', async () => {
    const stdout = captureWritable()
    const stderr = captureWritable()

    const exitCode = await runReferenceCli(['greet', 'Grace'], {
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(0)
    expect(stdout.lines.join('')).toContain('Hello, Grace!')
    expect(stderr.lines).toEqual([])
  })

  it('exits nonzero and writes the blank-name domain rejection to stderr only', async () => {
    const stdout = captureWritable()
    const stderr = captureWritable()

    const exitCode = await runReferenceCli(['greet', '   '], {
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(1)
    expect(stdout.lines).toEqual([])
    expect(stderr.lines.join('')).toContain('blank-name')
  })

  it('exits with a usage error for a missing name argument, never reaching dispatch', async () => {
    const stdout = captureWritable()
    const stderr = captureWritable()

    const exitCode = await runReferenceCli(['greet'], {
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(2)
    expect(stdout.lines).toEqual([])
    expect(stderr.lines.join('')).toContain('Usage: greet <name>')
  })

  it('exits with a usage error for an unknown command', async () => {
    const stdout = captureWritable()
    const stderr = captureWritable()

    const exitCode = await runReferenceCli(['does-not-exist'], {
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(2)
    expect(stderr.lines.join('')).toContain('Unknown command')
  })
})
