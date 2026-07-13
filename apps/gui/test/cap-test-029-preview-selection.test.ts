/**
 * CAP-TEST-029 — Preview selection evidence (marked / unmarked / cancel / navigate).
 */
import { describe, expect, it, vi } from 'vitest'
import {
  attachPreviewPicker,
  buildSelectionEvidence,
  canProceedWithSelection,
  confirmSourceTarget,
  requiresSourceTargetConfirmation,
  type ElementLike,
} from '../src/views/capabilities/previewSelection'
import type { SelectionEvidence } from '@engineering-ui-kit/core'

function el(partial: Partial<ElementLike> & { tagName: string; attrs?: Record<string, string> }): ElementLike {
  const attrs = partial.attrs ?? {}
  return {
    tagName: partial.tagName,
    id: partial.id,
    classList: partial.classList,
    textContent: partial.textContent ?? '',
    parentElement: partial.parentElement ?? null,
    children: partial.children,
    getAttribute: (name: string) => attrs[name] ?? null,
  }
}

describe('CAP-TEST-029 Preview selection evidence', () => {
  it('marked element proceeds with stableMarker and does not require confirmation', () => {
    const marked = el({
      tagName: 'BUTTON',
      textContent: 'Save',
      attrs: { 'data-cap-id': 'btn.save', role: 'button', 'aria-label': 'Save record' },
    })
    const evidence = buildSelectionEvidence(marked, {
      route: '/#/inventory',
      documentTitle: 'Inventory',
      captureTime: '2026-07-12T12:00:00.000Z',
    })
    expect(evidence.stableMarker).toBe('data-cap-id=btn.save')
    expect(evidence.elementTag).toBe('button')
    expect(evidence.role).toBe('button')
    expect(evidence.name).toBe('Save record')
    expect(evidence.route).toBe('/#/inventory')
    expect(evidence.documentTitle).toBe('Inventory')
    expect(evidence.selector.length).toBeGreaterThan(0)
    expect(requiresSourceTargetConfirmation(evidence)).toBe(false)
    expect(canProceedWithSelection(evidence)).toBe(true)
  })

  it('accepts data-testid as stable marker', () => {
    const marked = el({
      tagName: 'INPUT',
      attrs: { 'data-testid': 'field.qty' },
    })
    const evidence = buildSelectionEvidence(marked, {
      route: '/',
      documentTitle: '',
      captureTime: '2026-07-12T12:00:00.000Z',
    })
    expect(evidence.stableMarker).toBe('data-testid=field.qty')
    expect(canProceedWithSelection(evidence)).toBe(true)
  })

  it('unmarked element requires source-target confirmation before proceeding', () => {
    const unmarked = el({
      tagName: 'DIV',
      textContent: 'Anonymous block',
      classList: { length: 1, 0: 'card', item: (i) => (i === 0 ? 'card' : null) },
    })
    const evidence = buildSelectionEvidence(unmarked, {
      route: '/preview',
      documentTitle: 'App',
      captureTime: '2026-07-12T12:00:00.000Z',
    })
    expect(evidence.stableMarker).toBeUndefined()
    expect(requiresSourceTargetConfirmation(evidence)).toBe(true)
    expect(canProceedWithSelection(evidence)).toBe(false)

    const confirmed = confirmSourceTarget(evidence, 'src/components/Card.tsx')
    expect(confirmed.sourceTargetConfirmed).toBe(true)
    expect(confirmed.proposedSourceTarget).toBe('src/components/Card.tsx')
    expect(canProceedWithSelection(confirmed)).toBe(true)
  })

  it('cancel/escape cleans up listeners', () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const host = {
      title: 'Guest',
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: () => ({
        style: { cssText: '' },
        textContent: '',
        remove: vi.fn(),
      }),
      defaultView: {
        location: { pathname: '/', hash: '' },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(listener)
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.get(type)?.delete(listener)
      },
    }

    const onCancel = vi.fn()
    const session = attachPreviewPicker(host as never, {
      onPicked: vi.fn(),
      onCancel,
    })
    expect(session.active).toBe(true)
    expect(listeners.get('click')?.size).toBe(1)
    expect(listeners.get('keydown')?.size).toBe(1)

    session.cancel()
    expect(session.active).toBe(false)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(listeners.get('click')?.size ?? 0).toBe(0)
    expect(listeners.get('keydown')?.size ?? 0).toBe(0)
    expect(listeners.get('mousemove')?.size ?? 0).toBe(0)
  })

  it('navigate/reload cancels and cleans listeners', () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const viewListeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const host = {
      title: 'Guest',
      body: { appendChild: vi.fn() },
      createElement: () => ({
        style: { cssText: '' },
        remove: vi.fn(),
      }),
      defaultView: {
        location: { pathname: '/', hash: '' },
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          if (!viewListeners.has(type)) viewListeners.set(type, new Set())
          viewListeners.get(type)!.add(listener)
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          viewListeners.get(type)?.delete(listener)
        },
      },
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(listener)
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.get(type)?.delete(listener)
      },
    }

    const onCancel = vi.fn()
    const session = attachPreviewPicker(host as never, {
      onPicked: vi.fn(),
      onCancel,
    })
    expect(viewListeners.get('hashchange')?.size).toBe(1)

    const nav = [...(viewListeners.get('hashchange') ?? [])][0] as EventListener
    nav(new Event('hashchange'))

    expect(onCancel).toHaveBeenCalled()
    expect(session.active).toBe(false)
    expect(listeners.get('click')?.size ?? 0).toBe(0)
    expect(viewListeners.get('hashchange')?.size ?? 0).toBe(0)
  })

  it('keeps selection evidence bounded to CAP-CONTRACT-013 fields', () => {
    const marked = el({
      tagName: 'A',
      textContent: 'Open',
      attrs: { 'data-testid': 'link.open', href: '/x' },
    })
    const evidence: SelectionEvidence = buildSelectionEvidence(marked, {
      route: '/r',
      documentTitle: 'T',
      captureTime: '2026-07-12T12:00:00.000Z',
    })
    const keys = Object.keys(evidence).sort()
    expect(keys).toEqual(
      [
        'captureTime',
        'documentTitle',
        'elementTag',
        'name',
        'role',
        'route',
        'selector',
        'stableMarker',
        'visibleText',
      ].sort(),
    )
  })
})
