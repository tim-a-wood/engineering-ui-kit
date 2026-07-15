/**
 * CLI slice entry point: builds the real CLI host from
 * `@engineering-ui-kit/capabilities-runtime/node`'s `runCli`, wiring its
 * single `greet` command to the SAME composition root the HTTP slice uses.
 * `runCli` — not this file — parses argv, calls `dispatch`, and maps the
 * outcome to an exit code plus stdout/stderr.
 */
import {
  runCli,
  type CliCommand,
  type CliParseError,
  type CliSignalSource,
  type CliWritable,
} from '@engineering-ui-kit/capabilities-runtime/node'
import type { ConfigurationReader } from '@engineering-ui-kit/capabilities-runtime'
import type { SecretResolver } from '@engineering-ui-kit/capabilities-runtime'
import {
  createCompositionRoot,
  GREET_OPERATION_TOKEN,
  CONFIGURATION_TOKEN,
  SECRET_RESOLVER_TOKEN,
} from '../composition-root.js'
import type { GreetInput } from '../domain/greet.js'

function parseGreetArgs(
  args: ReadonlyArray<string>,
): { ok: true; input: GreetInput } | { ok: false; error: CliParseError } {
  const name = args[0]
  if (name === undefined) {
    return { ok: false, error: { message: 'Usage: greet <name>' } }
  }
  return { ok: true, input: { name } }
}

export interface CliApp {
  readonly commands: ReadonlyArray<CliCommand<never>>
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
}

/** Builds a fresh composition root and the CLI commands wired from it. */
export function createCliApp(): CliApp {
  const { rootScope } = createCompositionRoot()
  const operation = rootScope.resolve(GREET_OPERATION_TOKEN)
  const configuration = rootScope.resolve(CONFIGURATION_TOKEN)
  const secretResolver = rootScope.resolve(SECRET_RESOLVER_TOKEN)

  const greetCommand: CliCommand<GreetInput> = {
    name: 'greet',
    operation,
    parseArgs: parseGreetArgs,
  }

  return {
    commands: [greetCommand as unknown as CliCommand<never>],
    configuration,
    secretResolver,
  }
}

export interface RunReferenceCliOverrides {
  readonly stdout?: CliWritable
  readonly stderr?: CliWritable
  readonly signals?: CliSignalSource
}

/**
 * Runs the CLI slice for a real argv, through the real `runCli` host adapter
 * and the real composition root. Returns the process exit code; never calls
 * `process.exit` itself (same contract as `runCli`).
 */
export async function runReferenceCli(
  argv: ReadonlyArray<string>,
  overrides: RunReferenceCliOverrides = {},
): Promise<number> {
  const app = createCliApp()
  return runCli(argv, {
    commands: app.commands,
    configuration: app.configuration,
    secretResolver: app.secretResolver,
    ...overrides,
  })
}
