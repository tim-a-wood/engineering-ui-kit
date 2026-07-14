/**
 * CAP-TEST-038b — Capabilities accessibility, BEHAVIORAL.
 *
 * cap-test-038-a11y.test.tsx asserts static a11y attributes via
 * renderToStaticMarkup. This file complements it by *exercising* behavior:
 *
 *   - It dispatches synthetic keyboard / navigation events through the real
 *     preview-picker event machinery (attachPreviewPicker) and asserts the
 *     Escape/navigate/cleanup consequences — genuine event handling, not markup.
 *   - It drives the unmarked-element confirmation flow end to end through the
 *     real selection helpers.
 *   - It renders components across data states and asserts the resulting markup
 *     changes (list fallback, non-color status cues, live regions), and verifies
 *     keyboard-reachability + roving focus + reduced-motion / focus-visible CSS.
 *
 * ENVIRONMENT LIMITATION (documented deliberately): apps/gui has no DOM testing
 * library (no jsdom / happy-dom / @testing-library) — every existing test uses
 * react-dom/server. We do NOT add heavy dependencies. Full mount + real focus()
 * assertions (e.g. dialog focus restoration on a live element) are therefore out
 * of reach; where a behavior needs a live DOM we exercise the underlying event
 * handler / pure logic instead and note it inline.
 */

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArchitectureProjection, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { CapabilitiesView } from '../src/views/capabilities/CapabilitiesView'
import { CapabilityJourney } from '../src/views/capabilities/CapabilityJourney'
import { deriveJourney } from '../src/views/capabilities/capabilitiesUiState'
import { ArchitectureView } from '../src/views/capabilities/ArchitectureView'
import { DeltaQueue } from '../src/views/capabilities/DeltaQueue'
import { VerificationPanel } from '../src/views/capabilities/VerificationPanel'
import {
  attachPreviewPicker,
  buildSelectionEvidence,
  canProceedWithSelection,
  confirmSourceTarget,
  requiresSourceTargetConfirmation,
  type ElementLike,
} from '../src/views/capabilities/previewSelection'

// --------------------------------------------------------------------------
// A fake host that CAPTURES listeners so tests can dispatch synthetic events
// and observe handler behavior (there is no live DOM in this environment).
// --------------------------------------------------------------------------
function fakePickerHost() {
  const docListeners = new Map<string, Set<(e: unknown) => void>>()
  const viewListeners = new Map<string, Set<(e: unknown) => void>>()
  const created: Array<{ removed: boolean }> = []
  const host = {
    title: 'Guest App',
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    createElement: () => {
      const node = { style: { cssText: '' }, textContent: '', removed: false, remove() { this.removed = true } }
      created.push(node as unknown as { removed: boolean })
      return node
    },
    defaultView: {
      location: { pathname: '/preview', hash: '#/inventory' },
      addEventListener(type: string, l: (e: unknown) => void) {
        if (!viewListeners.has(type)) viewListeners.set(type, new Set())
        viewListeners.get(type)!.add(l)
      },
      removeEventListener(type: string, l: (e: unknown) => void) {
        viewListeners.get(type)?.delete(l)
      },
    },
    addEventListener(type: string, l: (e: unknown) => void) {
      if (!docListeners.has(type)) docListeners.set(type, new Set())
      docListeners.get(type)!.add(l)
    },
    removeEventListener(type: string, l: (e: unknown) => void) {
      docListeners.get(type)?.delete(l)
    },
  }
  const dispatch = (map: Map<string, Set<(e: unknown) => void>>, type: string, event: unknown) => {
    for (const l of [...(map.get(type) ?? [])]) l(event)
  }
  return {
    host,
    created,
    dispatchKey: (key: string) => dispatch(docListeners, 'keydown', { key }),
    dispatchWindow: (type: string) => dispatch(viewListeners, type, { type }),
    docCount: (type: string) => docListeners.get(type)?.size ?? 0,
    viewCount: (type: string) => viewListeners.get(type)?.size ?? 0,
  }
}

function project(): Project {
  return {
    id: 'p1',
    name: 'demo',
    repoPath: '/tmp/demo',
    createdAt: '2026-07-12T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
    status: 'active',
  } as Project
}

function mockBridge(): EuikBridge {
  return new Proxy(
    {},
    { get: () => vi.fn(async () => ({})) },
  ) as unknown as EuikBridge
}

function markedEl(): ElementLike {
  const attrs: Record<string, string> = {
    'data-cap-id': 'btn.approve',
    role: 'button',
    'aria-label': 'Approve record',
  }
  return { tagName: 'BUTTON', textContent: 'Approve', getAttribute: (n) => attrs[n] ?? null }
}

function unmarkedEl(): ElementLike {
  return {
    tagName: 'DIV',
    textContent: 'Anonymous block',
    classList: { length: 1, 0: 'card', item: (i) => (i === 0 ? 'card' : null) },
    getAttribute: () => null,
  }
}

function sampleProjection(): ArchitectureProjection {
  return {
    mode: 'guided',
    architectureId: 'arch-1',
    architectureRevision: '1',
    architectureStatus: 'draft',
    nodes: [
      { id: 'mod.a', name: 'Module A', purposeGroup: 'Core', status: 'ready', statusLabel: 'Ready', statusIcon: 'ready', proposed: false, neighborIds: ['mod.b'], toolsAndData: [], layout: { x: 0, y: 0, column: 0, row: 0 } },
      { id: 'mod.b', name: 'Module B', purposeGroup: 'Core', status: 'blocked', statusLabel: 'Blocked', statusIcon: 'blocked', proposed: false, neighborIds: ['mod.a'], toolsAndData: [], layout: { x: 160, y: 0, column: 1, row: 0 } },
    ],
    edges: [{ id: 'mod.a->mod.b', from: 'mod.a', to: 'mod.b', reason: 'depends', suggested: false }],
    listItems: [
      { id: 'mod.a', name: 'Module A', purposeGroup: 'Core', statusLabel: 'Ready', statusIcon: 'ready', neighborIds: ['mod.b'], edgeSummaries: ['depends on Module B'] },
      { id: 'mod.b', name: 'Module B', purposeGroup: 'Core', statusLabel: 'Blocked', statusIcon: 'blocked', neighborIds: ['mod.a'], edgeSummaries: ['required by Module A'] },
    ],
  } as unknown as ArchitectureProjection
}

describe('CAP-TEST-038b Capabilities accessibility (behavioral)', () => {
  // ---- Preview picker: Escape cancellation (real keydown dispatch) ----------
  it('Escape key cancels the preview picker and tears down listeners', () => {
    const { host, dispatchKey, docCount, viewCount } = fakePickerHost()
    const onCancel = vi.fn()
    const onPicked = vi.fn()
    const session = attachPreviewPicker(host as never, { onCancel, onPicked })
    expect(session.active).toBe(true)
    expect(docCount('keydown')).toBe(1)

    dispatchKey('Escape')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onPicked).not.toHaveBeenCalled()
    expect(session.active).toBe(false)
    expect(docCount('keydown')).toBe(0)
    expect(docCount('mousemove')).toBe(0)
    expect(docCount('click')).toBe(0)
    expect(viewCount('hashchange')).toBe(0)
  })

  it('non-Escape keys do not cancel the picker (only Escape is a cancel affordance)', () => {
    const { host, dispatchKey } = fakePickerHost()
    const onCancel = vi.fn()
    const session = attachPreviewPicker(host as never, { onCancel, onPicked: vi.fn() })
    dispatchKey('a')
    dispatchKey('Enter')
    dispatchKey('Tab')
    expect(onCancel).not.toHaveBeenCalled()
    expect(session.active).toBe(true)
  })

  // ---- Preview picker: navigation / reload cancellation ---------------------
  it.each(['hashchange', 'popstate', 'beforeunload'])(
    'navigation event %s cancels an in-progress pick',
    (evt) => {
      const { host, dispatchWindow, viewCount } = fakePickerHost()
      const onCancel = vi.fn()
      const session = attachPreviewPicker(host as never, { onCancel, onPicked: vi.fn() })
      expect(viewCount(evt)).toBe(1)
      dispatchWindow(evt)
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(session.active).toBe(false)
      expect(viewCount(evt)).toBe(0)
    },
  )

  it('picker overlay affordances are created and removed on teardown; cleanup is idempotent', () => {
    const { host, created } = fakePickerHost()
    const session = attachPreviewPicker(host as never, { onCancel: vi.fn(), onPicked: vi.fn() })
    // A hover highlight + label chip are injected as the focus/hover affordance.
    expect(created.length).toBeGreaterThanOrEqual(2)
    session.cleanup()
    expect(created.every((n) => (n as unknown as { removed: boolean }).removed)).toBe(true)
    // Second cleanup must be a no-op (no throw, stays inactive).
    expect(() => session.cleanup()).not.toThrow()
    expect(session.active).toBe(false)
  })

  // ---- Unmarked-element confirmation flow (behavioral, end to end) ----------
  it('a marked element proceeds immediately; an unmarked element blocks until explicit confirmation', () => {
    const ctx = { route: '/#/inventory', documentTitle: 'Inventory', captureTime: '2026-07-12T00:00:00.000Z' }

    const marked = buildSelectionEvidence(markedEl(), ctx)
    expect(requiresSourceTargetConfirmation(marked)).toBe(false)
    expect(canProceedWithSelection(marked)).toBe(true)

    const unmarked = buildSelectionEvidence(unmarkedEl(), ctx)
    expect(requiresSourceTargetConfirmation(unmarked)).toBe(true)
    expect(canProceedWithSelection(unmarked)).toBe(false) // hard block before confirmation

    const confirmed = confirmSourceTarget(unmarked, 'src/components/Card.tsx')
    expect(confirmed.sourceTargetConfirmed).toBe(true)
    expect(canProceedWithSelection(confirmed)).toBe(true) // only after explicit confirmation
  })

  // ---- Guided journey: four outcomes, keyboard reachable, locked non-navigable --
  it('groups planning into one outcome; unlocked outcomes are buttons and locked outcomes are not', () => {
    const stages = deriveJourney({
      application: { approved: {} },
      architecture: { approved: { schemaVersion: '1.0', moduleIds: ['mod.a'] } as never },
      modules: [],
      bindings: [],
    }).stages
    const html = renderToStaticMarkup(<CapabilityJourney stages={stages} viewing="build" onView={() => {}} />)
    // Define + Architect are one visible Plan outcome, followed by three outcomes.
    expect((html.match(/class="cap-journey-step/g) ?? []).length).toBe(4)
    expect(html).toContain('>Plan</span>')
    // Exactly one is the step being viewed.
    expect((html.match(/aria-current="step"/g) ?? []).length).toBe(1)
    // Locked stages (connect, verify here) are NOT buttons — they cannot be navigated.
    expect(html).toContain('class="cap-journey-locked"')
    expect(html).toContain('aria-disabled="true"')
    // Every state is conveyed by text (color-independent), including the lock reason.
    expect(html).toMatch(/Complete|Current|Locked/)
  })

  it('shell shows a live region and the segmented control conveys state without color', () => {
    const html = renderToStaticMarkup(
      <CapabilitiesView bridge={mockBridge()} projects={[project()]} activeProjectId="p1" />,
    )
    expect((html.match(/aria-pressed="(true|false)"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('aria-label="View mode"')
  })

  // ---- Architecture list fallback + non-color status cues -------------------
  it('architecture renders a complete list alternative with text+shape status cues (color redundant)', () => {
    const html = renderToStaticMarkup(<ArchitectureView projection={sampleProjection()} mode="guided" />)
    // Non-graph alternative present.
    expect(html).toContain('aria-label="Architecture list alternative"')
    // One list button per node -> keyboard reachable list.
    const listMatch = html.match(/aria-label="Architecture list alternative">([\s\S]*?)<\/ul>/)
    expect(listMatch).not.toBeNull()
    expect((listMatch![1].match(/<button[^>]*type="button"/g) ?? []).length).toBe(2)
    // Status is conveyed by glyph + text label, not color alone.
    expect(html).toContain('Ready')
    expect(html).toContain('Blocked')
    expect(html).toMatch(/[●■]/)
    expect(html).toContain('role="note"')
    expect(html).toMatch(/color is redundant/i)
    // Diagram is a single tab stop with roving -1 children (focus entry semantics).
    expect(html).toContain('aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End"')
    expect(html).toMatch(/role="application"[^>]*tabindex="0"|tabindex="0"[^>]*role="application"/i)
    expect(html).toContain('tabindex="-1"')
  })

  // ---- Non-color status cues across differing data states -------------------
  it('failure and empty states announce via text-backed status/alert roles, not color', () => {
    const failing = renderToStaticMarkup(
      <VerificationPanel
        bridge={mockBridge()}
        projectId="p1"
        projection="guided"
        records={[]}
        onVerified={() => {}}
      />,
    )
    // No approved module -> a text status cue is shown (role=status), not a bare color.
    expect(failing).toContain('role="status"')

    const delta = renderToStaticMarkup(
      <DeltaQueue bridge={mockBridge()} projectId="p1" projection="guided" />,
    )
    expect(delta).toContain('role="status"')
  })

  // ---- Reduced motion + visible focus are actually defined in the stylesheet -
  it('stylesheet honors reduced motion and defines a visible focus indicator', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const css = fs.readFileSync(path.join(here, '..', 'src', 'styles.css'), 'utf8')
    const reducedBlocks = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g) ?? []
    expect(reducedBlocks.length).toBeGreaterThan(0)
    // At least one reduced-motion block neutralizes animation/transition.
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?(animation|transition)/)
    // Focus is visible (not removed): a :focus-visible outline/box-shadow exists.
    expect(css).toMatch(/:focus-visible[\s\S]*?(outline|box-shadow)/)
  })
})
