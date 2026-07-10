/**
 * Visual evidence capture (PRD roadmap R1).
 *
 * Captures per-view screenshots and a rendered element census of a target app
 * at two workflow moments: `before` (Prepare Context baseline) and `after`
 * (Verify & Review). The pair is the ground truth for "what did this handoff
 * actually change" and feeds the review contact sheet and the census-loss
 * checks.
 *
 * Browser automation uses Playwright's bundled Chromium via dynamic import so
 * the core library keeps no hard Playwright dependency (same contract as
 * `visualPack.ts`). Callers without Playwright get a clear, actionable error.
 *
 * Serving contract: `baseUrl` is always required (the URL views resolve
 * against). If `serveCommand` is provided, it is spawned first and killed
 * afterwards; readiness is an HTTP probe against `baseUrl`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { CENSUS_ELEMENTS, type ElementCensus } from './fidelity.js'
import type { EvidenceViewSpec } from './types.js'

export type EvidencePhase = 'before' | 'after'

export type CapturedViewEvidence = {
  viewId: string
  label: string
  path: string
  /** Screenshot filename relative to the capture output directory. */
  screenshotFile?: string
  /** Rendered element census (authoritative, unlike static file censuses). */
  census?: ElementCensus
  ok: boolean
  error?: string
}

export type EvidenceCapture = {
  runId: string
  phase: EvidencePhase
  capturedAt: string
  baseUrl: string
  viewport: { width: number; height: number }
  views: CapturedViewEvidence[]
  /** True when every requested view captured successfully. */
  ok: boolean
}

export type CaptureEvidenceOptions = {
  runId: string
  phase: EvidencePhase
  /** Directory receiving `<viewId>.png` files and `evidence.json`. */
  outputDir: string
  views: EvidenceViewSpec[]
  /** Base URL the view paths resolve against, e.g. `http://localhost:5173`. */
  baseUrl: string
  /** Optional command that serves `baseUrl`; spawned before and killed after. */
  serveCommand?: string
  serveCwd?: string
  readyTimeoutMs?: number
  viewport?: { width: number; height: number }
  now?: () => Date
}

const DEFAULT_VIEWPORT = { width: 1440, height: 960 }
const DEFAULT_READY_TIMEOUT_MS = 45_000
const VIEW_LOAD_TIMEOUT_MS = 20_000
const VIEW_SETTLE_MS = 350

async function importPlaywright(): Promise<typeof import('playwright')> {
  try {
    return await import('playwright')
  } catch {
    throw new Error(
      "Evidence capture requires the optional 'playwright' package. Install it in the workspace (npm install -D playwright && npx playwright install chromium) to enable screenshots.",
    )
  }
}

async function probeReady(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError = 'no response'
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(3_000) })
      if (res.status < 500) return
      lastError = `HTTP ${res.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`target app not reachable at ${baseUrl} within ${timeoutMs}ms (${lastError})`)
}

function spawnServer(command: string, cwd: string | undefined): ChildProcess {
  return spawn(command, {
    cwd,
    shell: true,
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  })
}

function killServer(child: ChildProcess): void {
  if (child.pid === undefined) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

/** Count rendered census elements inside the page. */
const RENDERED_CENSUS_SCRIPT = `(() => {
  const elements = ${JSON.stringify([...CENSUS_ELEMENTS])};
  const census = {};
  for (const el of elements) census[el] = document.querySelectorAll(el).length;
  return census;
})()`

export async function captureEvidence(options: CaptureEvidenceOptions): Promise<EvidenceCapture> {
  if (options.views.length === 0) {
    throw new Error('no target views configured; add at least one view (label + path) to the project')
  }
  const playwright = await importPlaywright()
  const viewport = options.viewport ?? DEFAULT_VIEWPORT

  fs.mkdirSync(options.outputDir, { recursive: true })

  let server: ChildProcess | undefined
  if (options.serveCommand) {
    server = spawnServer(options.serveCommand, options.serveCwd)
  }

  const capture: EvidenceCapture = {
    runId: options.runId,
    phase: options.phase,
    capturedAt: (options.now?.() ?? new Date()).toISOString(),
    baseUrl: options.baseUrl,
    viewport,
    views: [],
    ok: false,
  }

  try {
    await probeReady(options.baseUrl, options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS)

    const browser = await playwright.chromium.launch()
    try {
      const page = await browser.newPage({ viewport })
      for (const view of options.views) {
        const result: CapturedViewEvidence = {
          viewId: view.id,
          label: view.label,
          path: view.path,
          ok: false,
        }
        try {
          const url = new URL(view.path, options.baseUrl).toString()
          await page.goto(url, { waitUntil: 'networkidle', timeout: VIEW_LOAD_TIMEOUT_MS })
          await page.waitForTimeout(VIEW_SETTLE_MS)
          const screenshotFile = `${view.id}.png`
          await page.screenshot({ path: path.join(options.outputDir, screenshotFile) })
          result.screenshotFile = screenshotFile
          result.census = (await page.evaluate(RENDERED_CENSUS_SCRIPT)) as ElementCensus
          result.ok = true
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
        }
        capture.views.push(result)
      }
    } finally {
      await browser.close()
    }
  } finally {
    if (server) killServer(server)
  }

  capture.ok = capture.views.length > 0 && capture.views.every((v) => v.ok)
  fs.writeFileSync(path.join(options.outputDir, 'evidence.json'), JSON.stringify(capture, null, 2))
  return capture
}

/** Load a persisted capture record written by `captureEvidence`. */
export function loadEvidenceCapture(outputDir: string): EvidenceCapture | null {
  const file = path.join(outputDir, 'evidence.json')
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as EvidenceCapture
}
