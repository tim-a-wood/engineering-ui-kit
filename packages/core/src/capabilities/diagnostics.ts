/**
 * Deterministic capability diagnostics (CAP-PKT-002).
 */

export type CapDiagnostic = {
  code: string
  message: string
  fieldPath?: string
  ruleId?: string
  relatedIds?: string[]
}

export function sortDiagnostics(diagnostics: CapDiagnostic[]): CapDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const code = a.code.localeCompare(b.code)
    if (code !== 0) return code
    const path = (a.fieldPath ?? '').localeCompare(b.fieldPath ?? '')
    if (path !== 0) return path
    return a.message.localeCompare(b.message)
  })
}

export function diagnostic(
  code: string,
  message: string,
  extras: Partial<Omit<CapDiagnostic, 'code' | 'message'>> = {},
): CapDiagnostic {
  return { code, message, ...extras }
}
