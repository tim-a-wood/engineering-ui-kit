import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EuikBridge } from '../src/bridge'
import { NAV_ITEMS } from '../src/appState'
import { CapabilitiesView } from '../src/views/capabilities/CapabilitiesView'

describe('CAP-TEST-004 Capabilities is a top-level destination', () => {
  it('places Capabilities beside Build & Test in navigation', () => {
    const ids = NAV_ITEMS.map((n) => n.id)
    expect(ids.indexOf('capabilities')).toBeGreaterThan(ids.indexOf('copilot-handoff'))
    expect(NAV_ITEMS.find((n) => n.id === 'capabilities')?.label).toBe('Capabilities')
  })

  it('identifies the available feature as experimental', () => {
    const html = renderToStaticMarkup(
      createElement(CapabilitiesView, { bridge: {} as EuikBridge, projects: [] }),
    )

    expect(html).toContain('>Experimental</span>')
  })
})
