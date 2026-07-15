/**
 * In-house, dependency-free five-field cron parser and next-run
 * calculator (§7.1, §10.3). No cron package is installed; this module
 * implements the standard `minute hour day-of-month month day-of-week`
 * grammar (`*`, lists, ranges, steps) plus explicit-timezone next-run
 * search using `Intl.DateTimeFormat`, so results are correct across DST
 * transitions without a bundled timezone database.
 */

export interface ZonedParts {
  readonly minute: number
  readonly hour: number
  readonly dayOfMonth: number
  readonly month: number
  /** 0 = Sunday .. 6 = Saturday. */
  readonly dayOfWeek: number
  readonly year: number
}

export interface CronSchedule {
  readonly expression: string
  matches(parts: ZonedParts): boolean
}

function parseField(field: string, min: number, max: number, fieldName: string): Set<number> {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart !== undefined ? Number(stepPart) : 1
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`invalid cron ${fieldName} step in "${part}"`)
    }
    let start: number
    let end: number
    if (rangePart === '*' || rangePart === undefined || rangePart === '') {
      start = min
      end = max
    } else if (rangePart.includes('-')) {
      const [startText, endText] = rangePart.split('-')
      start = Number(startText)
      end = Number(endText)
    } else {
      start = Number(rangePart)
      end = start
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`invalid cron ${fieldName} value "${part}" (expected ${min}-${max})`)
    }
    for (let value = start; value <= end; value += step) {
      values.add(value)
    }
  }
  return values
}

/**
 * Parses a five-field cron expression (`minute hour day-of-month month
 * day-of-week`). Standard cron semantics apply when both day-of-month and
 * day-of-week are restricted (not `*`): a run matches if EITHER field
 * matches (union), not both (intersection).
 */
export function parseCron(expression: string): CronSchedule {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(`cron expression must have exactly 5 fields, got ${fields.length}: "${expression}"`)
  }
  const [minuteField, hourField, domField, monthField, dowField] = fields as [
    string,
    string,
    string,
    string,
    string,
  ]

  const minutes = parseField(minuteField, 0, 59, 'minute')
  const hours = parseField(hourField, 0, 23, 'hour')
  const daysOfMonth = parseField(domField, 1, 31, 'day-of-month')
  const months = parseField(monthField, 1, 12, 'month')
  const daysOfWeekRaw = parseField(dowField, 0, 7, 'day-of-week')
  const daysOfWeek = new Set(Array.from(daysOfWeekRaw, (value) => (value === 7 ? 0 : value)))

  const domRestricted = domField !== '*'
  const dowRestricted = dowField !== '*'

  return {
    expression,
    matches(parts: ZonedParts): boolean {
      if (!minutes.has(parts.minute)) return false
      if (!hours.has(parts.hour)) return false
      if (!months.has(parts.month)) return false
      if (domRestricted && dowRestricted) {
        return daysOfMonth.has(parts.dayOfMonth) || daysOfWeek.has(parts.dayOfWeek)
      }
      if (domRestricted) return daysOfMonth.has(parts.dayOfMonth)
      if (dowRestricted) return daysOfWeek.has(parts.dayOfWeek)
      return true
    },
  }
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Decomposes `epochMs` into wall-clock fields within `timeZone` (an IANA name, e.g. `'UTC'`, `'America/New_York'`). */
export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts = formatter.formatToParts(new Date(epochMs))
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  // Some environments render midnight as "24" for hour12:false; normalize to 0-23.
  const hour = Number(get('hour')) % 24
  return {
    minute: Number(get('minute')),
    hour,
    dayOfMonth: Number(get('day')),
    month: Number(get('month')),
    dayOfWeek: WEEKDAY_INDEX[get('weekday')] ?? 0,
    year: Number(get('year')),
  }
}

/** Bounds the next-run search so a pathological expression cannot loop forever (~5 years of minutes). */
const MAX_SEARCH_ITERATIONS = 5 * 366 * 24 * 60

/**
 * Returns the epoch-millisecond instant of the next run strictly after
 * `afterEpochMs`, evaluated in `timeZone`. Deterministic under an injected
 * clock: callers pass `clock.now()` as `afterEpochMs`.
 */
export function nextRunAfter(cronExpression: string, timeZone: string, afterEpochMs: number): number {
  const schedule = parseCron(cronExpression)
  let candidate = Math.ceil((afterEpochMs + 1) / 60_000) * 60_000
  for (let iteration = 0; iteration < MAX_SEARCH_ITERATIONS; iteration += 1) {
    const parts = zonedParts(candidate, timeZone)
    if (schedule.matches(parts)) return candidate
    candidate += 60_000
  }
  throw new Error(`no matching run found for cron expression "${cronExpression}" within the search bound`)
}
