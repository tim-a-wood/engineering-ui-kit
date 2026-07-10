/** Shared number/label formatting — mono tabular figures throughout the UI. */

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function formatSigned(value: number): string {
  const rounded = Math.round(value)
  return (rounded > 0 ? '+' : '') + rounded.toLocaleString('en-US')
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${formatNumber(value, 1)} %`
  if (unit === '°C') return `${formatSigned(value)} °C`
  const signed = unit === 'ft' && value < 0
  return `${signed ? formatSigned(value) : formatInt(value)} ${unit}`
}

export function statusLabel(status: 'within-limits' | 'caution' | 'out-of-limits'): string {
  return status === 'within-limits' ? 'Within limits' : status === 'caution' ? 'Caution' : 'Out of limits'
}
