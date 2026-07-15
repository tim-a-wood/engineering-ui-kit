/**
 * Browser-safe correlation-id generation and propagation (§10.3, §15.4).
 * Browser-safe: uses only `globalThis.crypto` when available, with a
 * dependency-free fallback — no `node:*` import.
 */

const HEX = '0123456789abcdef'

function fallbackRandomUuid(): string {
  // RFC 4122 v4-shaped identifier without relying on `crypto.randomUUID`,
  // for environments where the Web Crypto API is unavailable (e.g. very
  // old browsers or restrictive embedding contexts). Not cryptographically
  // strong; correlation ids are diagnostic identifiers, not secrets.
  let out = ''
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-'
    } else if (i === 14) {
      out += '4'
    } else if (i === 19) {
      out += HEX[8 + Math.floor(Math.random() * 4)]
    } else {
      out += HEX[Math.floor(Math.random() * 16)]
    }
  }
  return out
}

/** Generates a new correlation id, preferring the platform's `crypto.randomUUID` when present. */
export function createCorrelationId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }
  return fallbackRandomUuid()
}

/** Header name used to propagate a correlation id across a transport boundary. */
export const CORRELATION_ID_HEADER = 'x-correlation-id'
