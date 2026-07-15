/**
 * CAP-TEST-047 — secret canaries never survive redaction, and migrated records
 * carry secret references only (never raw values).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertNoCanaryLeak, redactSensitiveText } from '../../src/capabilities/redaction.js'
import { frontendBindingToInboundBinding } from '../../src/capabilities/binding.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures')

describe('CAP-TEST-047 secret canaries never survive redaction', () => {
  it('detects a leak before redaction and confirms none survives after', () => {
    const canary = 'CANARY-TOKEN-9Z'
    const payload = { note: `token=${canary}`, auth: `Bearer ${canary}` }
    // Positive control: the raw payload leaks the canary.
    expect(assertNoCanaryLeak(payload, [canary])).toContain(canary)
    // After redaction the canary is gone.
    const redacted = { note: redactSensitiveText(payload.note), auth: redactSensitiveText(payload.auth) }
    expect(assertNoCanaryLeak(redacted, [canary])).toEqual([])
  })

  it('migrated InboundBinding records carry no secret value', () => {
    const binding: FrontendBinding = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'frontend-binding-valid.json'), 'utf8'),
    )
    const inbound = frontendBindingToInboundBinding(binding, { deployableId: 'web' })
    const serialized = JSON.stringify(inbound)
    expect(/(?:api[_-]?key|password|token|secret)\s*[:=]\s*\S/i.test(serialized)).toBe(false)
    expect(assertNoCanaryLeak(inbound, ['CANARY-TOKEN-9Z'])).toEqual([])
  })
})
