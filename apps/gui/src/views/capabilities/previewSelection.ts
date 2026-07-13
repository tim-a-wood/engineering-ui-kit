/**
 * Preview selection evidence helpers (CAP-PKT-023 / CAP-UX-005).
 * No React fiber or source-map inspection.
 */

import type { SelectionEvidence } from '@engineering-ui-kit/core'

export const STABLE_MARKER_ATTRS = ['data-cap-id', 'data-testid'] as const

export type PreviewPickResult = SelectionEvidence | null

export type ElementLike = {
  tagName: string
  id?: string
  classList?: { length: number; [index: number]: string; item?: (i: number) => string | null }
  getAttribute?: (name: string) => string | null
  textContent?: string | null
  parentElement?: ElementLike | null
  children?: ArrayLike<ElementLike>
}

export function readStableMarker(el: ElementLike): string | undefined {
  for (const attr of STABLE_MARKER_ATTRS) {
    const value = el.getAttribute?.(attr)?.trim()
    if (value) return `${attr}=${value}`
  }
  return undefined
}

export function describeSelector(el: ElementLike): string {
  const parts: string[] = []
  let node: ElementLike | null | undefined = el
  for (let i = 0; node && i < 4; i += 1) {
    let part = (node.tagName || 'unknown').toLowerCase()
    if (node.id) {
      parts.unshift(`${part}#${node.id}`)
      break
    }
    const classes: string[] = []
    const list = node.classList
    if (list) {
      const len = Math.min(2, list.length)
      for (let c = 0; c < len; c += 1) {
        const name = list.item?.(c) ?? list[c]
        if (name) classes.push(name)
      }
    }
    if (classes.length) part += `.${classes.join('.')}`
    const parent: ElementLike | null | undefined = node.parentElement
    if (parent?.children) {
      const siblings = Array.from(parent.children).filter(
        (c: ElementLike) => (c.tagName || '').toLowerCase() === (node!.tagName || '').toLowerCase(),
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(node) + 1
        part += `:nth-of-type(${index})`
      }
    }
    parts.unshift(part)
    node = parent ?? null
  }
  return parts.join(' > ')
}

export function accessibleName(el: ElementLike): string | undefined {
  const labelled = el.getAttribute?.('aria-label')?.trim()
  if (labelled) return labelled
  const labelledBy = el.getAttribute?.('aria-labelledby')?.trim()
  if (labelledBy) return labelledBy
  const title = el.getAttribute?.('title')?.trim()
  if (title) return title
  return undefined
}

export type BuildEvidenceContext = {
  route: string
  documentTitle: string
  captureTime?: string
}

export function buildSelectionEvidence(
  el: ElementLike,
  ctx: BuildEvidenceContext,
): SelectionEvidence {
  const role = el.getAttribute?.('role')?.trim() || undefined
  const name = accessibleName(el)
  const stableMarker = readStableMarker(el)
  return {
    route: ctx.route || '/',
    documentTitle: ctx.documentTitle || '',
    selector: describeSelector(el),
    visibleText: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    elementTag: (el.tagName || 'unknown').toLowerCase(),
    role,
    name,
    stableMarker,
    captureTime: ctx.captureTime ?? new Date().toISOString(),
  }
}

export function requiresSourceTargetConfirmation(evidence: SelectionEvidence): boolean {
  return !evidence.stableMarker
}

export function canProceedWithSelection(evidence: SelectionEvidence): boolean {
  return Boolean(evidence.stableMarker) || evidence.sourceTargetConfirmed === true
}

export function confirmSourceTarget(
  evidence: SelectionEvidence,
  proposedSourceTarget: string,
): SelectionEvidence {
  return {
    ...evidence,
    proposedSourceTarget,
    sourceTargetConfirmed: true,
  }
}

export type PickerSession = {
  active: boolean
  cleanup: () => void
  cancel: () => void
}

export type PickerHost = {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => void
  body?: { appendChild: (node: unknown) => unknown; removeChild?: (node: unknown) => unknown }
  createElement?: (tag: string) => {
    style: { cssText: string; left?: string; top?: string; width?: string; height?: string }
    textContent?: string
    remove?: () => void
  }
  defaultView?: { location?: { hash?: string; pathname?: string } } | null
  title?: string
}

/**
 * Attach hover/click/Escape picker listeners. Cleanup is mandatory on cancel,
 * select, navigation, or reload.
 */
export function attachPreviewPicker(
  host: Document | PickerHost,
  options: {
    onPicked: (evidence: SelectionEvidence) => void
    onCancel: () => void
    now?: () => string
  },
): PickerSession {
  let cleaned = false
  const doc = host as Document
  const highlight =
    typeof doc.createElement === 'function' ? doc.createElement('div') : undefined
  const tag = typeof doc.createElement === 'function' ? doc.createElement('div') : undefined
  if (highlight) {
    highlight.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2a5a8c;background:rgba(42,90,140,0.14);border-radius:4px;left:0;top:0;width:0;height:0'
  }
  if (tag) {
    tag.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;background:#2a5a8c;color:#fff;font:600 11px system-ui;padding:2px 8px;border-radius:4px;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  }
  if (highlight && tag && doc.body?.appendChild) {
    doc.body.appendChild(highlight)
    doc.body.appendChild(tag)
  }

  let current: Element | null = null

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    doc.removeEventListener('mousemove', onMove, true)
    doc.removeEventListener('click', onClick, true)
    doc.removeEventListener('keydown', onKey, true)
    doc.defaultView?.removeEventListener?.('hashchange', onNavigate)
    doc.defaultView?.removeEventListener?.('popstate', onNavigate)
    doc.defaultView?.removeEventListener?.('beforeunload', onNavigate)
    highlight?.remove?.()
    tag?.remove?.()
  }

  const cancel = () => {
    cleanup()
    options.onCancel()
  }

  const onNavigate = () => {
    cancel()
  }

  const onMove = (event: Event) => {
    const e = event as MouseEvent
    const el = e.target
    if (!(el instanceof Element) || el === highlight || el === tag) return
    current = el
    if (highlight && 'getBoundingClientRect' in el) {
      const r = el.getBoundingClientRect()
      highlight.style.left = `${r.left}px`
      highlight.style.top = `${r.top}px`
      highlight.style.width = `${r.width}px`
      highlight.style.height = `${r.height}px`
    }
    if (tag) {
      tag.textContent = describeSelector(el as unknown as ElementLike)
      if (highlight && 'getBoundingClientRect' in el) {
        const r = el.getBoundingClientRect()
        tag.style.left = `${r.left}px`
        tag.style.top = `${r.top > 26 ? r.top - 24 : r.bottom + 4}px`
      }
    }
  }

  const onClick = (event: Event) => {
    const e = event as MouseEvent
    e.preventDefault?.()
    e.stopPropagation?.()
    const el = (e.target instanceof Element ? e.target : current) as Element | null
    cleanup()
    if (!(el instanceof Element)) {
      options.onCancel()
      return
    }
    const location = doc.defaultView?.location
    const evidence = buildSelectionEvidence(el as unknown as ElementLike, {
      route: location?.hash || location?.pathname || '/',
      documentTitle: doc.title || '',
      captureTime: options.now?.() ?? new Date().toISOString(),
    })
    options.onPicked(evidence)
  }

  const onKey = (event: Event) => {
    const e = event as KeyboardEvent
    if (e.key === 'Escape') cancel()
  }

  doc.addEventListener('mousemove', onMove, true)
  doc.addEventListener('click', onClick, true)
  doc.addEventListener('keydown', onKey, true)
  doc.defaultView?.addEventListener?.('hashchange', onNavigate)
  doc.defaultView?.addEventListener?.('popstate', onNavigate)
  doc.defaultView?.addEventListener?.('beforeunload', onNavigate)

  return {
    get active() {
      return !cleaned
    },
    cleanup,
    cancel,
  }
}

/** Injected script string for Electron <webview> guests (extends legacy PICKER_JS). */
export const PREVIEW_BINDING_PICKER_JS = `new Promise((resolve) => {
  const hl = document.createElement('div');
  hl.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2a5a8c;background:rgba(42,90,140,0.14);border-radius:4px;left:0;top:0;width:0;height:0';
  const tag = document.createElement('div');
  tag.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#2a5a8c;color:#fff;font:600 11px system-ui;padding:2px 8px;border-radius:4px;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  document.body.append(hl, tag);
  let current = null;
  const markerAttrs = ['data-cap-id', 'data-testid'];
  const readMarker = (el) => {
    for (const attr of markerAttrs) {
      const v = el.getAttribute(attr);
      if (v && v.trim()) return attr + '=' + v.trim();
    }
    return undefined;
  };
  const describe = (el) => {
    const parts = [];
    let node = el;
    for (let i = 0; node && node !== document.body && i < 4; i += 1) {
      let part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(part + '#' + node.id); break; }
      const cls = [...node.classList].slice(0, 2).join('.');
      if (cls) part += '.' + cls;
      const siblings = node.parentElement ? [...node.parentElement.children].filter((c) => c.tagName === node.tagName) : [];
      if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const onMove = (e) => {
    const el = e.target;
    if (!(el instanceof Element) || el === hl || el === tag) return;
    current = el;
    const r = el.getBoundingClientRect();
    hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px';
    hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
    tag.textContent = describe(el);
    tag.style.left = r.left + 'px';
    tag.style.top = (r.top > 26 ? r.top - 24 : r.bottom + 4) + 'px';
  };
  const cleanup = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('hashchange', onNav);
    window.removeEventListener('popstate', onNav);
    window.removeEventListener('beforeunload', onNav);
    hl.remove(); tag.remove();
  };
  const onNav = () => { cleanup(); resolve(null); };
  const onClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = (e.target instanceof Element ? e.target : current);
    cleanup();
    if (!(el instanceof Element)) { resolve(null); return; }
    resolve({
      route: location.hash || location.pathname || '/',
      documentTitle: document.title || '',
      selector: describe(el),
      visibleText: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
      elementTag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      name: el.getAttribute('aria-label') || el.getAttribute('title') || undefined,
      stableMarker: readMarker(el),
      captureTime: new Date().toISOString(),
    });
  };
  const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('hashchange', onNav);
  window.addEventListener('popstate', onNav);
  window.addEventListener('beforeunload', onNav);
})`
