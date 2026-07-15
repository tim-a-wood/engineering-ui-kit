import { describe, expect, it } from 'vitest'
import { MapConfigurationReader } from '../src/configuration.js'
import { NEVER_CANCELLED } from '../src/cancellation.js'
import type { Context } from '../src/context.js'
import { dispatch } from '../src/dispatch.js'
import type { Operation } from '../src/operation.js'
import { isRejected, isSuccess, Outcome } from '../src/outcome.js'
import { NOOP_LOGGER } from '../src/telemetry.js'
import { TestSecretResolver } from '../src/testing.js'
import { AjvValidator } from '../src/validation.js'

// Canonical-shaped record schema (2020-12), mirroring the field/format
// conventions used by the repository's approved capability contract
// fixtures (e.g. packages/core/test/capabilities/fixtures/*-valid.json):
// a required id/name pair plus a bounded, formatted field.
const memberRecordSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'displayName'],
  properties: {
    id: { type: 'string', minLength: 1 },
    displayName: { type: 'string', minLength: 1 },
    contactEmail: { type: 'string', format: 'email' },
  },
} as const

interface MemberRecord {
  readonly id: string
  readonly displayName: string
  readonly contactEmail?: string
}

function testContext(): Context {
  return {
    correlationId: 'validation-test',
    cancellation: NEVER_CANCELLED,
    configuration: new MapConfigurationReader(),
    secretResolver: new TestSecretResolver(),
    logger: NOOP_LOGGER,
  }
}

describe('AJV-backed input validation via dispatch', () => {
  const echoOperation: Operation<MemberRecord, MemberRecord, never, never> = {
    code: 'echo-member',
    inputValidator: new AjvValidator<MemberRecord>(memberRecordSchema),
    execute(input) {
      return Outcome.success(input)
    },
  }

  it('accepts a valid record and runs the operation', async () => {
    const outcome = await dispatch(
      echoOperation,
      { id: 'member-1', displayName: 'Ada Lovelace', contactEmail: 'ada@example.com' },
      testContext(),
    )

    expect(isSuccess(outcome)).toBe(true)
    if (isSuccess(outcome)) {
      expect(outcome.value.displayName).toBe('Ada Lovelace')
    }
  })

  it('rejects an invalid record as a domain rejection, not an exception', async () => {
    const invalidRecord = { id: '', contactEmail: 'not-an-email' } as unknown as MemberRecord

    const outcome = await dispatch(echoOperation, invalidRecord, testContext())

    expect(isRejected(outcome)).toBe(true)
    if (isRejected(outcome)) {
      expect(outcome.code).toBe('validation-rejected')
      expect(outcome.details.errors.length).toBeGreaterThan(0)
    }
  })
})
