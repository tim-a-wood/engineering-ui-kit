/**
 * Injectable clock so dispatch-level deadline enforcement is deterministic
 * in tests. Browser-safe: uses only `Date.now()` by default, no `node:*`.
 */
export interface Clock {
  now(): number
}

export const SYSTEM_CLOCK: Clock = {
  now: () => Date.now(),
}
