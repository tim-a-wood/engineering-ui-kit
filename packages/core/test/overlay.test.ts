import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import AdmZip from 'adm-zip'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { inspectOverlay, applyOverlay } from '../src/overlay.js'

let workDir: string
let targetRoot: string

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-overlay-'))
  targetRoot = path.join(workDir, 'target')
  fs.mkdirSync(path.join(targetRoot, 'src'), { recursive: true })
  fs.writeFileSync(path.join(targetRoot, 'src', 'App.tsx'), 'export default function App() { return null }\n')
})

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true })
})

function makeZip(entries: Record<string, string>): string {
  const zip = new AdmZip()
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.from(content))
  }
  const zipPath = path.join(workDir, `overlay-${Math.random().toString(36).slice(2)}.zip`)
  zip.writeZip(zipPath)
  return zipPath
}

/**
 * Minimal raw ZIP writer (stored entries, no compression) so fixtures can
 * carry hostile entry names that AdmZip's addFile would sanitize at creation.
 */
function makeRawZip(entries: Record<string, string>): string {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const crcTable = (() => {
    const table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
    return table
  })()
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, 'utf8')
    const data = Buffer.from(content, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    chunks.push(local, nameBuf, data)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nameBuf)
    offset += local.length + nameBuf.length + data.length
  }
  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(Object.keys(entries).length, 8)
  eocd.writeUInt16LE(Object.keys(entries).length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  const zipPath = path.join(workDir, `raw-${Math.random().toString(36).slice(2)}.zip`)
  fs.writeFileSync(zipPath, Buffer.concat([...chunks, centralBuf, eocd]))
  return zipPath
}

const baseOptions = () => ({ runId: 'test-run', targetRoot })

describe('inspectOverlay hard blockers', () => {
  it('blocks external overlays from generated-owned paths', () => {
    const zipPath = makeZip({ 'src/generated/http-api/types.g.ts': 'hostile overwrite' })
    const summary = inspectOverlay(zipPath, {
      ...baseOptions(),
      capabilityAllowedPaths: ['src'],
      protectedPaths: ['src/generated/http-api/types.g.ts'],
    })
    expect(summary.canApply).toBe(false)
    expect(summary.hardBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'CAP-OVERLAY-OWNERSHIP-001' }),
    ]))
  })

  it('blocks absolute unix paths (AI-HANDOFF-031)', () => {
    const zipPath = makeRawZip({ '/etc/passwd': 'x' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.canApply).toBe(false)
    expect(summary.hardBlockers.some((b) => b.ruleId === 'AI-HANDOFF-031')).toBe(true)
  })

  it('blocks absolute windows paths (AI-HANDOFF-031)', () => {
    const zipPath = makeZip({ 'C:\\work\\app\\src\\App.tsx': 'x' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.canApply).toBe(false)
    expect(summary.hardBlockers.some((b) => b.ruleId === 'AI-HANDOFF-031')).toBe(true)
  })

  it('blocks traversal paths (AI-HANDOFF-032)', () => {
    const zipPath = makeRawZip({ '../outside.txt': 'x' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.canApply).toBe(false)
    expect(summary.hardBlockers.some((b) => b.ruleId === 'AI-HANDOFF-032')).toBe(true)
  })

  it('blocks .git content (AI-HANDOFF-035)', () => {
    const zipPath = makeZip({ '.git/config': 'x' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.hardBlockers.some((b) => b.ruleId === 'AI-HANDOFF-035')).toBe(true)
  })

  it('blocks dependency and build folders (AI-HANDOFF-036)', () => {
    const zipPath = makeZip({ 'node_modules/react/index.js': 'x', 'dist/bundle.js': 'x' })
    const summary = inspectOverlay(zipPath, baseOptions())
    const ids = summary.hardBlockers.map((b) => b.ruleId)
    expect(ids.filter((id) => id === 'AI-HANDOFF-036').length).toBe(2)
  })

  it('blocks env and key files (AI-HANDOFF-037)', () => {
    const zipPath = makeZip({ '.env': 'SECRET=1', 'certs/server.pem': 'key' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.hardBlockers.filter((b) => b.ruleId === 'AI-HANDOFF-037').length).toBe(2)
  })

  it('blocks full-repo dumps (AI-HANDOFF-038)', () => {
    const entries: Record<string, string> = {}
    for (let i = 0; i < 30; i++) entries[`src/file-${i}.ts`] = 'x'
    const zipPath = makeZip(entries)
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.hardBlockers.some((b) => b.ruleId === 'AI-HANDOFF-038')).toBe(true)
  })

  it('blocks malformed archives (AI-HANDOFF-030)', () => {
    const bad = path.join(workDir, 'not-a-zip.zip')
    fs.writeFileSync(bad, 'this is not a zip')
    const summary = inspectOverlay(bad, baseOptions())
    expect(summary.canApply).toBe(false)
    expect(summary.hardBlockers.some((b) => b.ruleId === 'AI-HANDOFF-030')).toBe(true)
  })
})

describe('inspectOverlay warnings', () => {
  it('warns on overwrite, out-of-scope, and large files', () => {
    const zipPath = makeZip({
      'src/App.tsx': 'changed',
      'src/extra-panel.tsx': 'new file',
      'src/big.css': 'x'.repeat(250 * 1024),
    })
    const summary = inspectOverlay(zipPath, {
      ...baseOptions(),
      expectedFiles: ['src/App.tsx', 'src/styles.css', 'src/tokens.css'],
    })
    expect(summary.canApply).toBe(true)
    const ids = summary.warnings.map((w) => w.ruleId)
    expect(ids).toContain('AI-HANDOFF-040')
    expect(ids).toContain('AI-HANDOFF-043')
    expect(ids).toContain('AI-HANDOFF-044')
  })

  it('warns on package manifest and build config changes', () => {
    const zipPath = makeZip({ 'package.json': '{}', 'vite.config.ts': 'export default {}' })
    const summary = inspectOverlay(zipPath, baseOptions())
    const ids = summary.warnings.map((w) => w.ruleId)
    expect(ids).toContain('AI-HANDOFF-041')
    expect(ids).toContain('AI-HANDOFF-042')
  })

  it('warns on binary content (AI-HANDOFF-047)', () => {
    const zip = new AdmZip()
    zip.addFile('src/logo.dat', Buffer.from([0, 1, 2, 3, 0, 255]))
    const zipPath = path.join(workDir, 'binary.zip')
    zip.writeZip(zipPath)
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.warnings.some((w) => w.ruleId === 'AI-HANDOFF-047')).toBe(true)
  })
})

describe('applyOverlay', () => {
  it('refuses to apply blocked overlays', () => {
    const zipPath = makeZip({ '.env': 'SECRET=1' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(() => applyOverlay(zipPath, summary, { runId: 'test-run', targetRoot, acceptWarnings: true })).toThrow(/hard blockers/)
  })

  it('refuses warned overlays without explicit acceptance', () => {
    const zipPath = makeZip({ 'src/App.tsx': 'changed content\n' })
    const summary = inspectOverlay(zipPath, baseOptions())
    expect(summary.warnings.length).toBeGreaterThan(0)
    expect(() => applyOverlay(zipPath, summary, { runId: 'test-run', targetRoot, acceptWarnings: false })).toThrow(/not explicitly accepted/)
  })

  it('applies valid overlays and records created/overwritten/unchanged', () => {
    fs.writeFileSync(path.join(targetRoot, 'src', 'same.css'), 'body {}\n')
    const zipPath = makeZip({
      'src/App.tsx': 'changed content\n',
      'src/tokens.css': ':root {}\n',
      'src/same.css': 'body {}\n',
    })
    const summary = inspectOverlay(zipPath, baseOptions())
    const applied = applyOverlay(zipPath, summary, { runId: 'test-run', targetRoot, acceptWarnings: true })
    const byPath = Object.fromEntries(applied.files.map((f) => [f.relativePath, f.action]))
    expect(byPath['src/App.tsx']).toBe('overwritten')
    expect(byPath['src/tokens.css']).toBe('created')
    expect(byPath['src/same.css']).toBe('unchanged')
    expect(fs.readFileSync(path.join(targetRoot, 'src', 'App.tsx'), 'utf8')).toBe('changed content\n')
    expect(fs.readFileSync(path.join(targetRoot, 'src', 'tokens.css'), 'utf8')).toBe(':root {}\n')
  })

  it('never deletes files absent from the overlay', () => {
    const zipPath = makeZip({ 'src/tokens.css': ':root {}\n' })
    const summary = inspectOverlay(zipPath, baseOptions())
    applyOverlay(zipPath, summary, { runId: 'test-run', targetRoot, acceptWarnings: true })
    expect(fs.existsSync(path.join(targetRoot, 'src', 'App.tsx'))).toBe(true)
  })
})
