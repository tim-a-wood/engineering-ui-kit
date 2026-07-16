/**
 * Safe diagnostic / secret redaction (CAP-PKT-030).
 */

const CANARY_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
  /\/Users\/[^\s"']+/g,
  /[A-Za-z]:\\[^\s"']+/g,
]

const QUOTED_SECRET_VALUE = /((?:"|')?(?:api[_-]?key|token|password|secret|authorization|credential)(?:"|')?\s*:\s*)(["'])(.*?)(\2)/gi

export function redactSensitiveText(text: string): string {
  let out = text.replace(QUOTED_SECRET_VALUE, '$1$2[redacted]$4')
  for (const pattern of CANARY_PATTERNS) {
    out = out.replace(pattern, '[redacted]')
  }
  return out
}

export function assertNoCanaryLeak(payload: unknown, canaries: string[]): string[] {
  const serialized = JSON.stringify(payload)
  return canaries.filter((c) => serialized.includes(c))
}
