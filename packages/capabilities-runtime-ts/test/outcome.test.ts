import { describe, expect, it } from 'vitest'
import { Outcome, isCancelled, isFailed, isRejected, isSuccess, isTimedOut } from '../src/outcome.js'

describe('Outcome constructors and type guards', () => {
  it('constructs and guards success', () => {
    const outcome = Outcome.success({ id: '1' })
    expect(isSuccess(outcome)).toBe(true)
    expect(isRejected(outcome)).toBe(false)
    expect(isFailed(outcome)).toBe(false)
    expect(isCancelled(outcome)).toBe(false)
    expect(isTimedOut(outcome)).toBe(false)
    if (isSuccess(outcome)) {
      expect(outcome.value).toEqual({ id: '1' })
    }
  })

  it('constructs and guards rejected with code and details', () => {
    const outcome = Outcome.rejected('duplicate-email', { field: 'email' })
    expect(isRejected(outcome)).toBe(true)
    if (isRejected(outcome)) {
      expect(outcome.code).toBe('duplicate-email')
      expect(outcome.details).toEqual({ field: 'email' })
    }
  })

  it('constructs and guards failed with safe message, retryable, and optional causeRef', () => {
    const withoutCauseRef = Outcome.failed('db-unavailable', 'The database is temporarily unavailable.', true)
    expect(isFailed(withoutCauseRef)).toBe(true)
    if (isFailed(withoutCauseRef)) {
      expect(withoutCauseRef.code).toBe('db-unavailable')
      expect(withoutCauseRef.safeMessage).toBe('The database is temporarily unavailable.')
      expect(withoutCauseRef.retryable).toBe(true)
      expect(withoutCauseRef.causeRef).toBeUndefined()
    }

    const withCauseRef = Outcome.failed('db-unavailable', 'The database is temporarily unavailable.', true, 'evidence-ref-123')
    if (isFailed(withCauseRef)) {
      expect(withCauseRef.causeRef).toBe('evidence-ref-123')
    }
  })

  it('constructs and guards cancelled', () => {
    const outcome = Outcome.cancelled('user requested cancellation')
    expect(isCancelled(outcome)).toBe(true)
    if (isCancelled(outcome)) {
      expect(outcome.reason).toBe('user requested cancellation')
    }
  })

  it('constructs and guards timedOut', () => {
    const outcome = Outcome.timedOut(1_700_000_000_000)
    expect(isTimedOut(outcome)).toBe(true)
    if (isTimedOut(outcome)) {
      expect(outcome.deadline).toBe(1_700_000_000_000)
    }
  })

  it('discriminates the five outcome kinds exhaustively', () => {
    const outcomes = [
      Outcome.success(1),
      Outcome.rejected('code', {}),
      Outcome.failed('code', 'message', false),
      Outcome.cancelled('reason'),
      Outcome.timedOut(0),
    ]
    const kinds = outcomes.map((outcome) => outcome.kind)
    expect(kinds).toEqual(['success', 'rejected', 'failed', 'cancelled', 'timedOut'])
  })
})
