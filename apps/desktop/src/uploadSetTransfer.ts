/**
 * OS clipboard file-transfer payloads for the Copilot upload set.
 *
 * Electron's clipboard API has no cross-platform "write files" call, but each
 * platform accepts a raw buffer in its native format:
 *  - macOS: `NSFilenamesPboardType` — an XML plist array of absolute paths.
 *  - Windows: `CF_HDROP` — a DROPFILES header + double-null-terminated UTF-16LE list.
 *  - Linux: `text/uri-list` — file:// URIs (best-effort; file managers vary).
 *
 * Builders are pure so they can be exercised directly in tests without a
 * clipboard or a display server.
 */

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** macOS NSFilenamesPboardType payload. */
export function buildFilenamesPboardPlist(paths: string[]): Buffer {
  const items = paths.map((p) => `<string>${escapeXml(p)}</string>`).join('')
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` +
      `<plist version="1.0"><array>${items}</array></plist>`,
    'utf8',
  )
}

/** Windows CF_HDROP payload: 20-byte DROPFILES struct + wide-char path list. */
export function buildCfHdropBuffer(paths: string[]): Buffer {
  const header = Buffer.alloc(20)
  header.writeUInt32LE(20, 0) // pFiles: offset of the path list
  // pt (8 bytes) and fNC (4 bytes) stay zero.
  header.writeUInt32LE(1, 16) // fWide: UTF-16LE paths
  const list = Buffer.from(paths.map((p) => `${p}\0`).join('') + '\0', 'utf16le')
  return Buffer.concat([header, list])
}

/** Linux/freedesktop text/uri-list payload. */
export function buildUriList(paths: string[]): Buffer {
  const uris = paths.map((p) => `file://${p.split('/').map(encodeURIComponent).join('/')}`)
  return Buffer.from(uris.join('\r\n') + '\r\n', 'utf8')
}
