/**
 * Narrow picker evaluated inside an app-preview guest by Electron main.
 * It observes one rendered click and returns serializable selection evidence;
 * it cannot access the host renderer, bridge, filesystem, or IPC surface.
 */
export const DESKTOP_PREVIEW_PICKER_JS = `(() => {
  const stateKey = '__euikPreviewPickerV1';
  const previous = globalThis[stateKey];
  if (previous && typeof previous.cancel === 'function') previous.cancel();
  const state = { done: false, value: null, cancel: null };
  globalThis[stateKey] = state;
  const highlight = document.createElement('div');
  highlight.setAttribute('data-euik-picker-ready', 'true');
  highlight.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2a5a8c;background:rgba(42,90,140,0.14);border-radius:4px;left:0;top:0;width:0;height:0';
  document.body.append(highlight);
  const markerAttrs = ['data-cap-id', 'data-testid'];
  const marker = (element) => {
    for (const attr of markerAttrs) {
      const value = element.getAttribute(attr);
      if (value && value.trim()) return attr + '=' + value.trim();
    }
    return undefined;
  };
  const selector = (element) => {
    const parts = [];
    let node = element;
    for (let depth = 0; node && node !== document.body && depth < 4; depth += 1) {
      let part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(part + '#' + node.id); break; }
      const stable = marker(node);
      if (stable) { parts.unshift('[' + stable.replace('=', '=\"') + '\"]'); break; }
      const siblings = node.parentElement ? [...node.parentElement.children].filter((item) => item.tagName === node.tagName) : [];
      if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const cleanup = () => {
    document.removeEventListener('mousemove', move, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', key, true);
    window.removeEventListener('beforeunload', cancel);
    highlight.remove();
  };
  const finish = (value) => {
    if (state.done) return;
    cleanup();
    state.value = value;
    state.done = true;
  };
  const cancel = () => finish(null);
  state.cancel = cancel;
  const move = (event) => {
    if (!(event.target instanceof Element) || event.target === highlight) return;
    const box = event.target.getBoundingClientRect();
    highlight.style.left = box.left + 'px'; highlight.style.top = box.top + 'px';
    highlight.style.width = box.width + 'px'; highlight.style.height = box.height + 'px';
  };
  const click = (event) => {
    event.preventDefault(); event.stopPropagation();
    const element = event.target;
    if (!(element instanceof Element)) { finish(null); return; }
    finish({
      route: location.hash || location.pathname || '/',
      documentTitle: document.title || '',
      selector: selector(element),
      visibleText: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
      elementTag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || undefined,
      name: element.getAttribute('aria-label') || element.getAttribute('title') || undefined,
      stableMarker: marker(element),
      captureTime: new Date().toISOString(),
    });
  };
  const key = (event) => { if (event.key === 'Escape') cancel(); };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', key, true);
  window.addEventListener('beforeunload', cancel);
  return true;
})()`

export const DESKTOP_PREVIEW_PICKER_RESULT_JS = `(() => {
  const state = globalThis.__euikPreviewPickerV1;
  return state && state.done ? { done: true, value: state.value } : { done: false };
})()`

export const DESKTOP_PREVIEW_PICKER_CANCEL_JS = `(() => {
  const state = globalThis.__euikPreviewPickerV1;
  if (state && typeof state.cancel === 'function') state.cancel();
  delete globalThis.__euikPreviewPickerV1;
  return true;
})()`
