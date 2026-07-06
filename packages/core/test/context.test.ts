import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildContext } from '../src/contextBuilder.js'
import { parseFlatfile } from '../src/flatfile.js'

let repo: string

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-repo-'))
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true })
  fs.mkdirSync(path.join(repo, 'node_modules', 'react'), { recursive: true })
  fs.mkdirSync(path.join(repo, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
    name: 'fixture-app',
    scripts: { dev: 'vite', build: 'tsc -b && vite build' },
    dependencies: { react: '^19.0.0' },
    devDependencies: { vite: '^6.0.0', typescript: '^5.0.0' },
  }))
  fs.writeFileSync(path.join(repo, 'package-lock.json'), '{}')
  fs.writeFileSync(path.join(repo, 'index.html'), '<!doctype html>\n')
  fs.writeFileSync(path.join(repo, 'src', 'App.tsx'), 'export default () => null\n')
  fs.writeFileSync(path.join(repo, 'src', 'styles.css'), 'body { margin: 0 }\n')
  fs.writeFileSync(path.join(repo, 'node_modules', 'react', 'index.js'), 'module.exports = {}\n')
  fs.writeFileSync(path.join(repo, 'dist', 'bundle.js'), 'var x=1\n')
  fs.writeFileSync(path.join(repo, '.env'), 'API_KEY=super-secret\n')
  fs.writeFileSync(path.join(repo, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]))
  fs.writeFileSync(path.join(repo, 'src', 'suspicious.ts'), 'const apiKey = "abcdefghijklmnop1234"\n')
})

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true })
})

describe('buildContext', () => {
  it('builds an inventory that excludes unsafe content with reasons', () => {
    const { inventory } = buildContext(repo, { projectId: 'p1', packetId: 'pkt1', sourceRepo: 'fixture-app' })
    expect(inventory.includedFiles).toContain('src/App.tsx')
    expect(inventory.includedFiles).toContain('package.json')
    expect(inventory.includedFiles).not.toContain('.env')
    expect(inventory.includedFiles).not.toContain('package-lock.json')
    expect(inventory.includedFiles.some((f) => f.startsWith('node_modules/'))).toBe(false)
    expect(inventory.includedFiles.some((f) => f.startsWith('dist/'))).toBe(false)
    expect(inventory.excludedPaths.find((e) => e.path === '.env')?.reason).toMatch(/environment/)
    expect(inventory.sourceFileCount).toBe(inventory.includedFileCount + inventory.excludedFileCount)
    expect(inventory.detectedFrameworks).toEqual(expect.arrayContaining(['react', 'vite', 'typescript']))
    expect(inventory.detectedPackageManager).toBe('npm')
    expect(inventory.packageScripts['build']).toBe('tsc -b && vite build')
  })

  it('surfaces secret-like content as warnings without excluding the file', () => {
    const { inventory } = buildContext(repo, { projectId: 'p1', packetId: 'pkt1', sourceRepo: 'fixture-app' })
    expect(inventory.includedFiles).toContain('src/suspicious.ts')
    expect(inventory.contextWarnings.some((w) => w.includes('src/suspicious.ts'))).toBe(true)
  })

  it('produces a contract-conformant flatfile that round-trips', () => {
    const { flatfileText, inventory } = buildContext(repo, {
      projectId: 'p1',
      packetId: 'pkt1',
      sourceRepo: 'fixture-app',
      now: () => new Date('2026-07-06T00:00:00Z'),
    })
    expect(flatfileText.startsWith('# Engineering UI Kit Repo Flatfile\n')).toBe(true)
    expect(flatfileText).toContain('# packet_id: pkt1')
    expect(flatfileText).toContain('# secrets_guarantee: none')

    const parsed = parseFlatfile(flatfileText)
    expect(parsed.header.packetId).toBe('pkt1')
    expect(parsed.header.includedFiles).toBe(inventory.includedFileCount)
    expect(parsed.entries.map((e) => e.path).sort()).toEqual([...inventory.includedFiles].sort())
    const app = parsed.entries.find((e) => e.path === 'src/App.tsx')
    expect(app?.content).toBe('export default () => null\n')
  })

  it('parses the real Phase 2 packet flatfile', () => {
    const packetFlatfile = path.resolve(
      import.meta.dirname,
      '../../../trials/vertical-slice-01/phase-2/packet/repo-flatfile.txt',
    )
    if (!fs.existsSync(packetFlatfile)) return
    const parsed = parseFlatfile(fs.readFileSync(packetFlatfile, 'utf8'))
    expect(parsed.header.packetId).toBe('vertical-slice-01-phase-2')
    expect(parsed.entries.length).toBe(11)
    expect(parsed.entries.map((e) => e.path)).toContain('src/taskPacket.ts')
  })
})
