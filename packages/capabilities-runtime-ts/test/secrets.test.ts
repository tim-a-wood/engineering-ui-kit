import { describe, expect, it } from 'vitest'
import { NEVER_CANCELLED } from '../src/cancellation.js'
import { MapConfigurationReader } from '../src/configuration.js'
import type { Context } from '../src/context.js'
import { dispatch } from '../src/dispatch.js'
import type { Operation } from '../src/operation.js'
import { isSuccess, Outcome } from '../src/outcome.js'
import { secretReference } from '../src/secrets.js'
import { NOOP_LOGGER } from '../src/telemetry.js'
import { TestSecretResolver } from '../src/testing.js'

// An obvious canary value: not a real credential, but distinctive enough
// that its accidental appearance in a serialized outcome/log is unmistakable.
const FAKE_SECRET_CANARY = 'fake-secret-canary-do-not-leak-9f3c2a'

describe('secret references never leak', () => {
  it('never appears in a resolved secret\'s toString/toJSON/serialized form', async () => {
    const resolver = new TestSecretResolver()
    resolver.register('DATABASE_PASSWORD', FAKE_SECRET_CANARY)

    const resolved = await resolver.resolve(secretReference('DATABASE_PASSWORD'))

    expect(String(resolved)).not.toContain(FAKE_SECRET_CANARY)
    expect(JSON.stringify(resolved)).not.toContain(FAKE_SECRET_CANARY)
    expect(resolved.reveal()).toBe(FAKE_SECRET_CANARY)
  })

  it('never appears in a dispatched outcome even when the operation resolves a secret internally', async () => {
    const resolver = new TestSecretResolver()
    resolver.register('API_TOKEN', FAKE_SECRET_CANARY)

    const context: Context = {
      correlationId: 'secret-canary-test',
      cancellation: NEVER_CANCELLED,
      configuration: new MapConfigurationReader(),
      secretResolver: resolver,
      logger: NOOP_LOGGER,
    }

    const loggedMessages: string[] = []
    const capturingLogger = {
      debug: () => {},
      info: (message: string) => loggedMessages.push(message),
      warn: () => {},
      error: () => {},
    }

    const operation: Operation<void, { hasToken: boolean }, never, never> = {
      code: 'use-secret',
      async execute(_input, ctx) {
        const secret = await ctx.secretResolver.resolve(secretReference('API_TOKEN'))
        ctx.logger.info(`resolved token: ${secret}`) // redacted by ResolvedSecret.toString()
        return Outcome.success({ hasToken: secret.reveal().length > 0 })
      },
    }

    const outcome = await dispatch(operation, undefined, { ...context, logger: capturingLogger })

    expect(isSuccess(outcome)).toBe(true)
    const serializedOutcome = JSON.stringify(outcome)
    expect(serializedOutcome).not.toContain(FAKE_SECRET_CANARY)
    for (const message of loggedMessages) {
      expect(message).not.toContain(FAKE_SECRET_CANARY)
    }
  })

  it('throws rather than resolving an unregistered reference to a guessable default', () => {
    const resolver = new TestSecretResolver()
    expect(() => resolver.resolve(secretReference('NEVER_REGISTERED'))).toThrow()
  })
})
