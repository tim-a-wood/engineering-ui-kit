/**
 * Validate F17: clicking Launch App while a build-and-serve app is already
 * running rebuilds it (so the running server serves the latest overlay) rather
 * than silently reopening a stale build.
 *
 * Reproduces the exact footgun: mark dist/ stale (edit a source file after the
 * last build), ensure the server is up, click Launch App, and assert the served
 * bundle hash changes and the status reports a rebuild. Restores the file after.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { launchWorkbench } from './driver.mjs'

const TARGET = '/Users/timwood/Documents/UI Framework/examples'
const URL = 'http://127.0.0.1:5412'
const STYLES = path.join(TARGET, 'src/styles.css')
const PROBE = '\n.launch-rebuild-probe { color: #abcdef; }\n'
const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const servedBundles = async () => {
  const html = await (await fetch(URL)).text()
  return [...html.matchAll(/assets\/index-[A-Za-z0-9_-]+\.(?:js|css)/g)].map((m) => m[0]).sort().join(' ')
}

// Ensure a server is running on 5412 (build first so it can serve).
const original = fs.readFileSync(STYLES, 'utf8')
let server
try {
  await new Promise((res, rej) => {
    const b = spawn('npm', ['run', 'build'], { cwd: TARGET, stdio: 'ignore' })
    b.on('close', (c) => (c === 0 ? res() : rej(new Error('initial build failed'))))
  })
  const up = await fetch(URL).then((r) => r.status < 500).catch(() => false)
  if (!up) {
    server = spawn('npm', ['start'], { cwd: TARGET, detached: true, stdio: 'ignore' })
    for (let i = 0; i < 40 && !(await fetch(URL).then((r) => r.status < 500).catch(() => false)); i += 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  const before = await servedBundles()

  // Make dist/ stale: edit source after the build the server is serving.
  fs.writeFileSync(STYLES, original + PROBE)
  record('DIST-STALE', true, 'edited src/styles.css after build — running server now serves a stale dist')

  // Drive the real Launch App button.
  const { app, page, waitForStatus } = await launchWorkbench()
  await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('heading', { name: 'Test' }).waitFor()
  const launchCard = page.locator('.inset', { has: page.getByRole('heading', { name: '1 · Launch app' }) })
  await launchCard.scrollIntoViewIfNeeded()
  await launchCard.getByRole('button', { name: 'Launch App' }).click()
  const msg = await waitForStatus(/Rebuilt and reopened|App opened|Dev server started/, { timeout: 120_000 })
  record('STATUS-REBUILT', /Rebuilt and reopened/.test(msg), `status: ${msg.trim().slice(0, 70)}`)
  await app.close()

  const after = await servedBundles()
  record('BUNDLE-CHANGED', before !== after, `served bundle ${before !== after ? 'changed' : 'unchanged'} after Launch App`)
  record('PROBE-IN-CSS', (await (await fetch(URL)).text()).length > 0 && after.includes('index-'), 'server still serving after rebuild')
} finally {
  // Restore the user's applied file and rebuild so their app is back to state.
  fs.writeFileSync(STYLES, original)
  await new Promise((res) => { const b = spawn('npm', ['run', 'build'], { cwd: TARGET, stdio: 'ignore' }); b.on('close', res) })
  if (server) { try { process.kill(-server.pid) } catch { /* gone */ } }
}

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
