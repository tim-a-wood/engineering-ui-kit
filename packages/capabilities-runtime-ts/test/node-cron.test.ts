import { describe, expect, it } from 'vitest'
import { nextRunAfter, parseCron, zonedParts } from '../src/node/cron.js'

describe('parseCron / nextRunAfter (in-house, dependency-free)', () => {
  it('rejects an expression that does not have exactly five fields', () => {
    expect(() => parseCron('* * * *')).toThrow(/exactly 5 fields/)
    expect(() => parseCron('* * * * * *')).toThrow(/exactly 5 fields/)
  })

  it('computes the next top-of-hour run under an injected clock (UTC)', () => {
    // 2026-07-15T10:23:00Z -> next "0 * * * *" run is 2026-07-15T11:00:00Z
    const after = Date.UTC(2026, 6, 15, 10, 23, 0)
    const next = nextRunAfter('0 * * * *', 'UTC', after)
    expect(next).toBe(Date.UTC(2026, 6, 15, 11, 0, 0))
  })

  it('computes the next run for a step expression', () => {
    // "*/15 * * * *" after 10:23 -> 10:30
    const after = Date.UTC(2026, 6, 15, 10, 23, 0)
    const next = nextRunAfter('*/15 * * * *', 'UTC', after)
    expect(next).toBe(Date.UTC(2026, 6, 15, 10, 30, 0))
  })

  it('rolls over into the next day when no later run matches today', () => {
    // "0 9 * * *" after 10:00 today -> 09:00 tomorrow
    const after = Date.UTC(2026, 6, 15, 10, 0, 0)
    const next = nextRunAfter('0 9 * * *', 'UTC', after)
    expect(next).toBe(Date.UTC(2026, 6, 16, 9, 0, 0))
  })

  it('treats day-of-month and day-of-week as a union when both are restricted', () => {
    // 2026-07-15 is a Wednesday. "0 0 1 * 1" = midnight on the 1st OR any Monday.
    const schedule = parseCron('0 0 1 * 1')
    // Monday 2026-07-20 00:00 matches via day-of-week even though day-of-month is 20.
    expect(schedule.matches({ minute: 0, hour: 0, dayOfMonth: 20, month: 7, dayOfWeek: 1, year: 2026 })).toBe(true)
    // The 1st of the month matches via day-of-month even on a non-Monday.
    expect(schedule.matches({ minute: 0, hour: 0, dayOfMonth: 1, month: 8, dayOfWeek: 6, year: 2026 })).toBe(true)
    // Neither field matches.
    expect(schedule.matches({ minute: 0, hour: 0, dayOfMonth: 15, month: 7, dayOfWeek: 3, year: 2026 })).toBe(false)
  })

  it('normalizes day-of-week 7 to Sunday (0)', () => {
    const schedule = parseCron('0 0 * * 7')
    expect(schedule.matches({ minute: 0, hour: 0, dayOfMonth: 5, month: 7, dayOfWeek: 0, year: 2026 })).toBe(true)
  })

  it('computes the correct next run in a non-UTC IANA timezone', () => {
    // "0 9 * * *" in America/New_York; pick an instant after 09:00 local time
    // on 2026-07-15 (EDT, UTC-4), so the next run is 09:00 local the next day.
    const after = Date.UTC(2026, 6, 15, 15, 0, 0) // 11:00 EDT
    const next = nextRunAfter('0 9 * * *', 'America/New_York', after)
    const parts = zonedParts(next, 'America/New_York')
    expect(parts.hour).toBe(9)
    expect(parts.minute).toBe(0)
    expect(parts.dayOfMonth).toBe(16)
  })

  it('rejects an out-of-range field value', () => {
    expect(() => parseCron('60 * * * *')).toThrow(/invalid cron minute value/)
    expect(() => parseCron('* 24 * * *')).toThrow(/invalid cron hour value/)
  })
})
