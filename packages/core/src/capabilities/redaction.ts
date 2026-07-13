/**
 * Safe diagnostic / secret redaction (CAP-PKT-030).
 */

const CANARY_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
  /\/Users\/[^\s"']+/g,
  /[A-Za-z]:\\[^\s"']+/g,
]

export function redactSensitiveText(text: string): string {
  let out = text
  for (const pattern of CANARY_PATTERNS) {
    out = out.replace(pattern, '[redacted]')
  }
  return out
}

export function assertNoCanaryLeak(payload: unknown, canaries: string[]): string[] {
  const serialized = JSON.stringify(payload)
  return canaries.filter((c) => serialized.includes(c))
}
