/**
 * Deliberate exposure-elevation control (CAP-ERA-001 §5.1/§15.2). Every
 * inbound binding defaults to `private`; reaching `protected`/`public`
 * requires an explicit, separate action — never a side effect of any other
 * field change.
 */

import type { ExposureLevel } from '@engineering-ui-kit/core'
import { DEFAULT_EXPOSURE } from './inboundBinding'

type Props = {
  exposure: ExposureLevel
  onChange: (next: ExposureLevel) => void
}

const ELEVATED_LEVELS: ExposureLevel[] = ['protected', 'public']

export function ExposureControl({ exposure, onChange }: Props) {
  const elevated = exposure !== DEFAULT_EXPOSURE

  return (
    <div className="cap-exposure-control" role="group" aria-label="Exposure">
      <p className="capabilities-note">
        Private by default — reachable only from inside this application.
      </p>
      <label className="hstack" style={{ gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={elevated}
          aria-label="Allow this entry point to be reached from outside this application"
          onChange={(e) => onChange(e.target.checked ? 'protected' : DEFAULT_EXPOSURE)}
        />
        Allow this entry point to be reached from outside this application
      </label>
      {elevated ? (
        <label className="cap-connect-field">
          Exposure level
          <select
            aria-label="Exposure level"
            value={exposure}
            onChange={(e) => onChange(e.target.value as ExposureLevel)}
          >
            {ELEVATED_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level === 'protected' ? 'Protected (trusted callers only)' : 'Public (any caller)'}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
