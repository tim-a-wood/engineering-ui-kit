// @vitest-environment jsdom
/**
 * §8.2 architecture canvas tests: every module placed once, focus mode
 * default (selected-module neighborhood only) with an explicit all-links
 * toggle, keyboard node selection opening the detail modal with focus
 * containment and focus return, and the text relationship list alternative.
 */

import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildSampleAuditHub, computeModuleDesignProgress, type ModuleDesignProgress } from '@engineering-ui-kit/core/design-browser'
import { layoutSystemCanvas, SystemCanvas } from '../src/views/design/SystemCanvas'

afterEach(cleanup)

function sample() {
  const built = buildSampleAuditHub()
  const progress: ModuleDesignProgress = computeModuleDesignProgress(built.architecture, built.moduleDesigns, built.sessions, {})
  return { architecture: built.architecture, progress }
}

function Harness(props: { selectedModuleId?: string; focusMode?: boolean }) {
  const { architecture, progress } = sample()
  const [selectedModuleId, setSelectedModuleId] = useState(props.selectedModuleId)
  const [focusMode, setFocusMode] = useState(props.focusMode ?? true)
  const [listView, setListView] = useState(false)
  return (
    <SystemCanvas
      architecture={architecture}
      progress={progress}
      selectedModuleId={selectedModuleId}
      onSelectModule={setSelectedModuleId}
      focusMode={focusMode}
      onFocusModeChange={setFocusMode}
      listView={listView}
      onListViewChange={setListView}
    />
  )
}

describe('System canvas (§8.2)', () => {
  it('routes the real DO-178 architecture through the verified UML engine', async () => {
    const { architecture } = sample()
    const result = await layoutSystemCanvas(architecture)

    expect(result.layout.nodes).toHaveLength(17)
    expect(result.layout.edges).toHaveLength(26)
    // Every remaining orthogonal crossover is rendered with a line bridge.
    // The router must still hold the dense real sample below double digits.
    expect(result.quality.crossings).toBeLessThanOrEqual(7)
    expect(result.quality.overlappingConnectorPairs).toBe(0)
    expect(result.quality.nodeOverlaps).toBe(0)
    expect(result.quality.edgeNodeClearanceViolations).toBe(0)
    expect(result.quality.labelNodeOverlaps).toBe(0)
    expect(result.quality.labelLabelOverlaps).toBe(0)
    expect(result.quality.connectorLabelOverlaps).toBe(0)
    expect(result.quality.canvasBoundsViolations).toBe(0)
    const minX = Math.min(...result.layout.nodes.map((node) => node.x))
    const minY = Math.min(...result.layout.nodes.map((node) => node.y))
    const maxX = Math.max(...result.layout.nodes.map((node) => node.x + node.width))
    const maxY = Math.max(...result.layout.nodes.map((node) => node.y + node.height))
    const contentAspectRatio = (maxX - minX) / (maxY - minY)
    expect(contentAspectRatio).toBeGreaterThan(0.85)
    expect(contentAspectRatio).toBeLessThan(1.7)
  })

  it('places every module once when nothing is focused down', () => {
    const { architecture } = sample()
    render(<Harness />)
    const nodes = document.querySelectorAll('[data-node-id]')
    expect(nodes.length).toBe(architecture.moduleIds.length)
    expect(nodes.length).toBe(17)
  })

  it('defaults to focus mode: a selected module shows only its neighborhood, with an explicit all-links toggle', () => {
    render(<Harness selectedModuleId="mod.evidence-graph" />)
    let nodes = document.querySelectorAll('[data-node-id]')
    // Evidence Graph: 1 dependency + 5 consumers + itself = 7.
    expect(nodes.length).toBe(7)

    const toggle = screen.getByRole('button', { name: /Show all links/ })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)

    nodes = document.querySelectorAll('[data-node-id]')
    expect(nodes.length).toBe(17)
  })

  it('supports keyboard selection: Enter on a focused node selects it and opens the detail modal with focus containment and focus return', () => {
    render(<Harness />)
    const node = document.querySelector('[data-node-id="system.element.mod.evidence-store"]') as SVGGElement
    node.focus()
    expect(document.activeElement).toBe(node)

    fireEvent.keyDown(node, { key: 'Enter' })

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    // Focus containment: focus moved into the dialog, not left on the node.
    expect(document.activeElement).not.toBe(node)
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Focus return (§18.4): closing the dialog returns focus to the control that opened it.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.activeElement).toBe(node)
  })

  it('provides a text relationship list alternative to the SVG canvas', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /List view/ }))
    expect(document.querySelector('svg')).toBeNull()
    expect(screen.getAllByText(/depends on/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Evidence Graph').length).toBeGreaterThan(0)
  })

  it('never breaks selection or the toggle affordances at 200% zoom', () => {
    render(<Harness selectedModuleId="mod.evidence-graph" />)
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' })
    for (let i = 0; i < 5; i++) fireEvent.click(zoomIn) // 100% -> 200%
    expect(screen.getByText('200%')).toBeTruthy()
    // The canvas surface and its controls remain operable at 200%.
    expect(document.querySelectorAll('[data-node-id]').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Show all links/ })).toBeTruthy()
  })
})
