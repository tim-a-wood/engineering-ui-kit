import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import AdmZip from 'adm-zip'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import {
  countMarkupElements,
  diffCensusLosses,
  assessReplacementLoss,
  isCensusableFile,
  formatLosses,
} from '../src/fidelity.js'
import { inspectOverlay } from '../src/overlay.js'
import { captureEvidence, loadEvidenceCapture } from '../src/evidence.js'
import { buildReviewContactSheetHtml, buildChangesZip } from '../src/reviewEvidence.js'

const RICH_APP = `
export default function App() {
  return (
    <main>
      <svg viewBox="0 0 16 16"><path d="M1 1h14" /></svg>
      <svg viewBox="0 0 16 16"><path d="M1 8h14" /></svg>
      <img src="./logo.png" alt="logo" />
      <button type="button">Run</button>
      <input value="x" />
      <MyIcon name="gear" />
    </main>
  )
}
`

const STRIPPED_APP = `
export default function App() {
  return (
    <main>
      <button type="button">Run</button>
      <input value="x" />
    </main>
  )
}
`

describe('countMarkupElements', () => {
  it('counts concrete elements, not custom components', () => {
    const census = countMarkupElements(RICH_APP)
    expect(census['svg']).toBe(2)
    expect(census['img']).toBe(1)
    expect(census['button']).toBe(1)
    expect(census['input']).toBe(1)
    expect(census['a']).toBe(0)
  })

  it('does not overcount prefixed tags', () => {
    // <a> must not match <aside>, <input> must not match <inputx>
    const census = countMarkupElements('<aside><a href="/x">link</a></aside><inputx/>')
    expect(census['a']).toBe(1)
    expect(census['input']).toBe(0)
  })
})

describe('census diff', () => {
  it('reports only losses', () => {
    const losses = assessReplacementLoss(RICH_APP, STRIPPED_APP)
    expect(losses).toEqual([
      { element: 'svg', before: 2, after: 0 },
      { element: 'img', before: 1, after: 0 },
    ])
    expect(formatLosses(losses)).toBe('svg 2→0, img 1→0')
  })

  it('is empty when nothing is lost', () => {
    expect(assessReplacementLoss(STRIPPED_APP, RICH_APP)).toEqual([])
    expect(diffCensusLosses({ svg: 1 }, { svg: 1 })).toEqual([])
  })
})

describe('isCensusableFile', () => {
  it('accepts markup-bearing extensions and rejects others', () => {
    expect(isCensusableFile('src/App.tsx')).toBe(true)
    expect(isCensusableFile('index.html')).toBe(true)
    expect(isCensusableFile('src/styles.css')).toBe(false)
    expect(isCensusableFile('README.md')).toBe(false)
  })
})

describe('inspectOverlay fidelity gate (AI-HANDOFF-048)', () => {
  let workDir: string
  let targetRoot: string

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-fidelity-'))
    targetRoot = path.join(workDir, 'target')
    fs.mkdirSync(path.join(targetRoot, 'src'), { recursive: true })
    fs.writeFileSync(path.join(targetRoot, 'src', 'App.tsx'), RICH_APP)
  })

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true })
  })

  it('warns when a replacement drops svg/img elements', () => {
    const zip = new AdmZip()
    zip.addFile('src/App.tsx', Buffer.from(STRIPPED_APP))
    const zipPath = path.join(workDir, 'overlay.zip')
    zip.writeZip(zipPath)

    const summary = inspectOverlay(zipPath, { runId: 'r1', targetRoot })
    const loss = summary.warnings.find((w) => w.ruleId === 'AI-HANDOFF-048')
    expect(loss).toBeDefined()
    expect(loss?.path).toBe('src/App.tsx')
    expect(loss?.message).toContain('svg 2→0')
    expect(loss?.message).toContain('img 1→0')
    expect(summary.canApply).toBe(true) // warning, not blocker
  })

  it('stays silent when elements survive', () => {
    const zip = new AdmZip()
    zip.addFile('src/App.tsx', Buffer.from(RICH_APP.replace('Run', 'Execute')))
    const zipPath = path.join(workDir, 'overlay.zip')
    zip.writeZip(zipPath)

    const summary = inspectOverlay(zipPath, { runId: 'r1', targetRoot })
    expect(summary.warnings.some((w) => w.ruleId === 'AI-HANDOFF-048')).toBe(false)
  })

  it('labels small image assets distinctly from opaque binaries', () => {
    const zip = new AdmZip()
    zip.addFile('src/assets/icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))
    const zipPath = path.join(workDir, 'overlay.zip')
    zip.writeZip(zipPath)

    const summary = inspectOverlay(zipPath, { runId: 'r1', targetRoot })
    const binary = summary.warnings.find((w) => w.ruleId === 'AI-HANDOFF-047')
    expect(binary?.message).toContain('image asset')
  })
})

describe('buildChangesZip', () => {
  it('bundles existing files and reports missing ones', () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-chzip-'))
    try {
      fs.mkdirSync(path.join(workDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(workDir, 'src', 'a.tsx'), 'export {}')
      const out = path.join(workDir, 'changes.zip')
      const result = buildChangesZip(workDir, [{ relativePath: 'src/a.tsx' }, { relativePath: 'src/gone.tsx' }], out)
      expect(result.added).toEqual(['src/a.tsx'])
      expect(result.missing).toEqual(['src/gone.tsx'])
      const zip = new AdmZip(out)
      expect(zip.getEntries().map((e) => e.entryName)).toEqual(['src/a.tsx'])
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true })
    }
  })
})

describe('buildReviewContactSheetHtml', () => {
  it('renders cover, view pages, losses, and escapes content', () => {
    const html = buildReviewContactSheetHtml({
      runId: 'run-7',
      projectName: 'sample <app>',
      taskTitle: 'Restyle & harden',
      acceptanceCriteria: 'AC-1: dark-first\nAC-2: tokens only',
      standardsPackage: 'engineering-ui-kit',
      standardsVersion: '0.4.0',
      generatedAt: '2026-07-06T00:00:00.000Z',
      views: [
        {
          id: 'home',
          label: 'Home',
          path: '/',
          losses: [{ element: 'svg', before: 4, after: 0 }],
        },
      ],
      changedFiles: [{ relativePath: 'src/App.tsx', action: 'overwritten', sizeBytes: 1234 }],
      verificationSummary: 'typecheck exit 0; build exit 0',
    })
    expect(html).toContain('Restyle &amp; harden')
    expect(html).toContain('sample &lt;app&gt;')
    expect(html).toContain('svg 4→0')
    expect(html).toContain('src/App.tsx')
    expect(html).toContain('No baseline captured for this view')
    expect(html).not.toContain('<app>')
  })
})

describe('captureEvidence (integration, real browser)', () => {
  it('captures screenshots and a rendered census from a live target', { timeout: 90_000 }, async () => {
    const page = `<!doctype html><html><body>
      <svg viewBox="0 0 8 8"><path d="M0 0h8"/></svg>
      <svg viewBox="0 0 8 8"><path d="M0 4h8"/></svg>
      <button>Go</button>
    </body></html>`
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as AddressInfo).port
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-evidence-'))

    try {
      const capture = await captureEvidence({
        runId: 'run-cap',
        phase: 'before',
        outputDir,
        baseUrl: `http://127.0.0.1:${port}`,
        views: [{ id: 'home', label: 'Home', path: '/' }],
      })
      expect(capture.ok).toBe(true)
      expect(capture.views).toHaveLength(1)
      expect(capture.views[0].census?.['svg']).toBe(2)
      expect(capture.views[0].census?.['button']).toBe(1)
      expect(fs.existsSync(path.join(outputDir, 'home.png'))).toBe(true)

      const reloaded = loadEvidenceCapture(outputDir)
      expect(reloaded?.phase).toBe('before')
      expect(reloaded?.views[0].screenshotFile).toBe('home.png')
    } finally {
      server.close()
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
  })
})
