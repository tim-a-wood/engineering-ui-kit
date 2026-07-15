/**
 * CLI inbound adapter foundation (§7.1, §10.3). Typed parsing of `argv`,
 * nonzero exit codes on rejection/failure, results on stdout, diagnostics
 * on stderr, and cancellation on `SIGINT`/`SIGTERM`.
 *
 * This is a foundation, not a full argument-parsing framework: command
 * lookup is by exact first-token match and argument parsing is delegated
 * to each command's injected `parseArgs`. Generated code layers help text
 * and richer argument schemas on top.
 */

import { dispatch } from '../dispatch.js'
import type { Operation } from '../operation.js'
import { Outcome } from '../outcome.js'
import type { ConfigurationReader } from '../configuration.js'
import type { SecretResolver } from '../secrets.js'
import type { Logger } from '../telemetry.js'
import { NOOP_LOGGER } from '../telemetry.js'
import { CancellationController } from '../cancellation.js'
import { createNodeContext } from './context.js'
import { createCorrelationId, runWithCorrelationId } from './correlation.js'

export interface CliParseError {
  readonly message: string
}

export interface CliCommand<Input = unknown> {
  readonly name: string
  readonly operation: Operation<Input, unknown, unknown, unknown>
  /** Parses the remaining argv tokens (after the command name) into the operation's input, or returns a parse error. */
  parseArgs(args: ReadonlyArray<string>): { ok: true; input: Input } | { ok: false; error: CliParseError }
}

export interface CliSignalSource {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown
  off(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown
}

export interface CliWritable {
  write(chunk: string): unknown
}

export interface RunCliOptions {
  readonly commands: ReadonlyArray<CliCommand<never>>
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  readonly logger?: Logger
  readonly stdout?: CliWritable
  readonly stderr?: CliWritable
  /** Defaults to `process`; inject a fake in tests to avoid registering real OS signal handlers. */
  readonly signals?: CliSignalSource
}

export const CLI_EXIT_USAGE_ERROR = 2
export const CLI_EXIT_REJECTED = 1
export const CLI_EXIT_FAILED = 1
export const CLI_EXIT_CANCELLED_SIGINT = 130
export const CLI_EXIT_CANCELLED_SIGTERM = 143
export const CLI_EXIT_TIMED_OUT = 1
export const CLI_EXIT_SUCCESS = 0

/** Runs a CLI invocation. Returns the process exit code; never calls `process.exit` itself. */
export async function runCli(argv: ReadonlyArray<string>, options: RunCliOptions): Promise<number> {
  const logger = options.logger ?? NOOP_LOGGER
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const signals = options.signals ?? (process as unknown as CliSignalSource)

  const [commandName, ...rest] = argv
  if (!commandName) {
    stderr.write('Usage: <command> [args...]\n')
    return CLI_EXIT_USAGE_ERROR
  }

  const command = options.commands.find((candidate) => candidate.name === commandName)
  if (!command) {
    stderr.write(`Unknown command: "${commandName}"\n`)
    return CLI_EXIT_USAGE_ERROR
  }

  const parsed = command.parseArgs(rest)
  if (!parsed.ok) {
    stderr.write(`${parsed.error.message}\n`)
    return CLI_EXIT_USAGE_ERROR
  }

  const correlationId = createCorrelationId()
  const cancellation = new CancellationController()
  let signalExitCode = CLI_EXIT_CANCELLED_SIGINT
  const onSigint = (): void => {
    signalExitCode = CLI_EXIT_CANCELLED_SIGINT
    cancellation.cancel('SIGINT')
  }
  const onSigterm = (): void => {
    signalExitCode = CLI_EXIT_CANCELLED_SIGTERM
    cancellation.cancel('SIGTERM')
  }
  signals.on('SIGINT', onSigint)
  signals.on('SIGTERM', onSigterm)

  try {
    return await runWithCorrelationId(correlationId, async () => {
      const context = createNodeContext({
        correlationId,
        configuration: options.configuration,
        secretResolver: options.secretResolver,
        cancellation,
        logger,
      })
      const outcome = await dispatch(command.operation, parsed.input, context)

      if (Outcome.isSuccess(outcome)) {
        stdout.write(`${JSON.stringify(outcome.value)}\n`)
        return CLI_EXIT_SUCCESS
      }
      if (Outcome.isRejected(outcome)) {
        stderr.write(`${JSON.stringify({ code: outcome.code, details: outcome.details })}\n`)
        return CLI_EXIT_REJECTED
      }
      if (Outcome.isCancelled(outcome)) {
        stderr.write(`Cancelled: ${outcome.reason}\n`)
        return signalExitCode
      }
      if (Outcome.isTimedOut(outcome)) {
        stderr.write(`Timed out at deadline ${outcome.deadline}\n`)
        return CLI_EXIT_TIMED_OUT
      }
      stderr.write(`${JSON.stringify({ code: outcome.code, safeMessage: outcome.safeMessage })}\n`)
      return CLI_EXIT_FAILED
    })
  } finally {
    signals.off('SIGINT', onSigint)
    signals.off('SIGTERM', onSigterm)
  }
}
