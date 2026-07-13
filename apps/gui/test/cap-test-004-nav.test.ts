import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '../src/appState'

describe('CAP-TEST-004 Capabilities is a top-level destination', () => {
  it('places Capabilities beside Build & Test in navigation', () => {
    const ids = NAV_ITEMS.map((n) => n.id)
    expect(ids.indexOf('capabilities')).toBeGreaterThan(ids.indexOf('copilot-handoff'))
    expect(NAV_ITEMS.find((n) => n.id === 'capabilities')?.label).toBe('Capabilities')
  })
})
