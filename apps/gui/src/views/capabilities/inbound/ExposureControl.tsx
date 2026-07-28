/**
 * Deliberate exposure-elevation control (CAP-ERA-001 §5.1/§15.2). Every
 * inbound binding defaults to `private`; reaching `protected`/`public`
 * requires an explicit, separate action — never a side effect of any other
 * field change.
 */

import type { ChangeEvent } from 'react'
import type { ExposureLevel } from '@engineering-ui-kit/core'
import { DEFAULT_EXPOSURE } from './inboundBinding'

type Props = {
  exposure: ExposureLevel
  onChange: (next: ExposureLevel) => void
}

const ELEVATED_LEVELS: ExposureLevel[] = ['protected', 'public']

export function ExposureControl({ exposure, onChange }: Props) {
  const elevated = exposure !== DEFAULT_EXPOSURE

  function changeExternalAccess(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.checked ? 'protected' : DEFAULT_EXPOSURE)
  }

  function changeExposure(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value as ExposureLevel)
  }

  return (
    <div className="cap-exposure-control" role="group" aria-label="Exposure">
      <p className="capabilities-note">
        Private by default — reachable only from inside this application.
      </p>
      <label className="hstack" style={{ gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={elevated}
          aria-label="Allow external access"
          onChange={changeExternalAccess}
        />
        Allow external access
      </label>
      {elevated ? (
        <label className="cap-connect-field">
          Exposure level
          <select
            aria-label="Exposure level"
            value={exposure}
            onChange={changeExposure}
          >
            {ELEVATED_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level === 'protected' ? 'Protected: trusted callers' : 'Public: all callers'}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
