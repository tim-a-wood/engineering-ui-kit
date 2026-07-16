/** Build a self-contained, read-only hit-test for an authorized Preview click. */
export function buildPreviewSelectionEvidenceScript(x: number, y: number): string {
  return `(() => {
    const element = document.elementFromPoint(${JSON.stringify(x)}, ${JSON.stringify(y)});
    if (!(element instanceof Element)) return null;
    const marker = (target) => {
      for (const attr of ['data-cap-id', 'data-testid']) {
        const value = target.getAttribute(attr);
        if (value && value.trim()) return attr + '=' + value.trim();
      }
      return undefined;
    };
    const selector = (target) => {
      const parts = [];
      let node = target;
      for (let depth = 0; node && node !== document.body && depth < 4; depth += 1) {
        let part = node.tagName.toLowerCase();
        if (node.id) { parts.unshift(part + '#' + node.id); break; }
        const stable = marker(node);
        if (stable) {
          const separator = stable.indexOf('=');
          parts.unshift('[' + stable.slice(0, separator) + '=\"' + stable.slice(separator + 1) + '\"]');
          break;
        }
        const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((item) => item.tagName === node.tagName) : [];
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
        parts.unshift(part);
        node = node.parentElement;
      }
      return parts.join(' > ');
    };
    return {
      route: location.hash || location.pathname || '/',
      documentTitle: document.title || '',
      selector: selector(element),
      visibleText: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
      elementTag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || undefined,
      name: element.getAttribute('aria-label') || element.getAttribute('title') || undefined,
      stableMarker: marker(element),
      captureTime: new Date().toISOString(),
    };
  })()`
}
