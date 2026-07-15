import { describe, expect, it } from 'vitest'
import { MapConfigurationReader } from '../src/configuration.js'
import { Outcome } from '../src/outcome.js'
import type { Operation } from '../src/operation.js'
import { TestSecretResolver } from '../src/testing.js'
import {
  CLI_EXIT_FAILED,
  CLI_EXIT_REJECTED,
  CLI_EXIT_SUCCESS,
  CLI_EXIT_USAGE_ERROR,
  runCli,
  type CliCommand,
  type CliSignalSource,
  type CliWritable,
} from '../src/node/cli.js'

const configuration = new MapConfigurationReader()
const secretResolver = new TestSecretResolver()

function fakeSignals(): CliSignalSource {
  return {
    on: () => undefined,
    off: () => undefined,
  }
}

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

describe('runCli', () => {
  it('maps argv to an operation and exits 0 with the result on stdout for success', async () => {
    const doubleCommand: CliCommand<{ value: number }> = {
      name: 'double',
      operation: {
        code: 'double',
        execute(input: { value: number }) {
          return Outcome.success(input.value * 2)
        },
      },
      parseArgs(args) {
        const raw = args[0]
        const value = raw !== undefined ? Number(raw) : NaN
        if (Number.isNaN(value)) return { ok: false, error: { message: 'expected a numeric argument' } }
        return { ok: true, input: { value } }
      },
    }

    const stdout = captureWritable()
    const stderr = captureWritable()
    const exitCode = await runCli(['double', '21'], {
      commands: [doubleCommand as unknown as CliCommand<never>],
      configuration,
      secretResolver,
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(CLI_EXIT_SUCCESS)
    expect(stdout.lines.join('')).toContain('42')
    expect(stderr.lines).toEqual([])
  })

  it('exits nonzero on a domain rejection', async () => {
    const rejectCommand: CliCommand<void> = {
      name: 'reject',
      operation: {
        code: 'reject-me',
        execute() {
          return Outcome.rejected('duplicate-email', { field: 'email' })
        },
      },
      parseArgs() {
        return { ok: true, input: undefined }
      },
    }

    const stdout = captureWritable()
    const stderr = captureWritable()
    const exitCode = await runCli(['reject'], {
      commands: [rejectCommand as unknown as CliCommand<never>],
      configuration,
      secretResolver,
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(CLI_EXIT_REJECTED)
    expect(stderr.lines.join('')).toContain('duplicate-email')
  })

  it('exits nonzero on a technical failure without leaking a stack trace', async () => {
    const boomCommand: CliCommand<void> = {
      name: 'boom',
      operation: {
        code: 'boom',
        execute() {
          throw new Error('leaking a raw stack trace and secret-value-should-never-appear-cli456')
        },
      },
      parseArgs() {
        return { ok: true, input: undefined }
      },
    }

    const stdout = captureWritable()
    const stderr = captureWritable()
    const exitCode = await runCli(['boom'], {
      commands: [boomCommand as unknown as CliCommand<never>],
      configuration,
      secretResolver,
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(CLI_EXIT_FAILED)
    const combined = stderr.lines.join('')
    expect(combined).not.toContain('secret-value-should-never-appear-cli456')
    expect(combined).not.toContain('.ts:')
  })

  it('exits with a usage error for an unknown command, never invoking dispatch', async () => {
    const stdout = captureWritable()
    const stderr = captureWritable()
    const exitCode = await runCli(['does-not-exist'], {
      commands: [],
      configuration,
      secretResolver,
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(CLI_EXIT_USAGE_ERROR)
    expect(stdout.lines).toEqual([])
  })

  it('exits with a usage error and diagnostic on stderr when parseArgs rejects the arguments', async () => {
    const doubleCommand: CliCommand<{ value: number }> = {
      name: 'double',
      operation: {
        code: 'double',
        execute(input: { value: number }) {
          return Outcome.success(input.value * 2)
        },
      },
      parseArgs(args) {
        const raw = args[0]
        const value = raw !== undefined ? Number(raw) : NaN
        if (Number.isNaN(value)) return { ok: false, error: { message: 'expected a numeric argument' } }
        return { ok: true, input: { value } }
      },
    }

    const stdout = captureWritable()
    const stderr = captureWritable()
    const exitCode = await runCli(['double', 'not-a-number'], {
      commands: [doubleCommand as unknown as CliCommand<never>],
      configuration,
      secretResolver,
      stdout: stdout.writable,
      stderr: stderr.writable,
      signals: fakeSignals(),
    })

    expect(exitCode).toBe(CLI_EXIT_USAGE_ERROR)
    expect(stderr.lines.join('')).toContain('expected a numeric argument')
  })
})
