/**
 * Playwright-Electron driver for the workbench.
 *
 * Launches the REAL desktop app (real preload bridge, real IPC, real
 * filesystem effects) in EUIK_TEST_MODE so the two native pickers read
 * their answers from the environment; everything else is genuine UI
 * interaction: clicks, typing, and window screenshots.
 */

import fs from 'node:fs'
import path from 'node:path'
import { _electron as electron } from 'playwright'
import electronPath from 'electron'
import { REPO_ROOT, DATA_DIR, EVIDENCE_DIR, OVERLAY_ZIP, TARGET_REPO } from './config.mjs'

export async function launchWorkbench(overrides = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  fs.mkdirSync(path.dirname(OVERLAY_ZIP), { recursive: true })

  const app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(REPO_ROOT, 'apps', 'desktop')],
    env: {
      ...process.env,
      EUIK_TEST_MODE: '1',
      EUIK_DATA_DIR: DATA_DIR,
      EUIK_TEST_PICK_DIR: TARGET_REPO,
      EUIK_TEST_PICK_ZIP: OVERLAY_ZIP,
      ...overrides,
    },
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Sequential screenshot numbering continues across phases of a pass.
  let shotIndex = fs.readdirSync(EVIDENCE_DIR).filter((f) => /^\d\d-.*\.png$/.test(f)).length

  /** Capture the whole window into the pass evidence directory. */
  const shot = async (name) => {
    shotIndex += 1
    const file = path.join(EVIDENCE_DIR, `${String(shotIndex).padStart(2, '0')}-${name}.png`)
    await page.screenshot({ path: file })
    console.log(`  [shot] ${path.basename(file)}`)
    return file
  }

  /** Wait until the shared StatusLine shows success (or throw on error tone). */
  const waitForStatus = async (matcher, { timeout = 120_000 } = {}) => {
    const line = page.locator('.status-line', { hasText: matcher })
    await line.waitFor({ state: 'visible', timeout })
    return line.innerText()
  }

  return { app, page, shot, waitForStatus }
}

/** The most recently touched run directory in the workspace (run ids are UUIDs — sort by mtime, not name). */
export function newestRunDir() {
  const runsRoot = path.join(DATA_DIR, 'runs')
  const runs = fs.readdirSync(runsRoot)
    .map((d) => path.join(runsRoot, d))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
  if (runs.length === 0) throw new Error('no runs recorded yet')
  return runs[runs.length - 1]
}
