/**
 * Evidence turn: configure Launch & evidence for the project through the
 * Projects UI, start the target app (the workbench UI has no launch-command
 * field yet — a logged workflow gap), capture "after" visual evidence with
 * the rendered element census, and generate the Copilot review packet
 * (markdown + PDF contact sheet).
 *
 * Env: LAUNCH_URL (default http://127.0.0.1:5410), PROJECT_NAME.
 */

import { spawn } from 'node:child_process'
import { launchWorkbench } from './driver.mjs'
import { TARGET_REPO } from './config.mjs'

const LAUNCH_URL = process.env.LAUNCH_URL ?? 'http://127.0.0.1:5410'
const PROJECT_NAME = process.env.PROJECT_NAME ?? 'GaugeLab'

// ---- 0. Start the target app (external — no launch command in the UI yet) --
const server = spawn('npm', ['start'], { cwd: TARGET_REPO, detached: true, stdio: 'ignore' })
const ready = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(LAUNCH_URL, { signal: AbortSignal.timeout(1500) })
      if (res.status < 500) return
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`target app not reachable at ${LAUNCH_URL}`)
}
await ready()

// Build evidence views against live data: include the worst overdue instrument's detail page.
const instruments = (await (await fetch(`${LAUNCH_URL}/api/instruments`)).json()).instruments
const overdueDetail = instruments.find((i) => i.assetTag === 'PG-0107') ?? instruments[0]
const VIEWS = [
  'Dashboard | /',
  'Instruments | /#/instruments',
  `Instrument detail | /#/instruments/${overdueDetail.id}`,
  'New instrument | /#/instruments/new',
].join('\n')

const { app, page, shot, waitForStatus } = await launchWorkbench()

try {
  // ---- 1. Configure Launch & evidence through the Projects view --------------
  await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
  await page.getByRole('button', { name: 'Projects' }).click()
  const row = page.locator('li, tr, article, div.project-card', { hasText: PROJECT_NAME })
    .locator('button', { hasText: /launch url/i }).first()
  await row.click()
  await page.locator('#launch-url').fill(LAUNCH_URL)
  await page.locator('#evidence-views').fill(VIEWS)
  await shot('launch-evidence-config')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await waitForStatus(/Launch & evidence settings saved/)

  // ---- 2. Into the run: capture after-evidence -------------------------------
  await page.getByRole('button', { name: 'Copilot Handoff' }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

  const evidenceSection = page.locator('section', { has: page.getByRole('heading', { name: 'Visual evidence — before / after' }) })
  await evidenceSection.scrollIntoViewIfNeeded()
  await evidenceSection.getByRole('button', { name: /Capture After/ }).click()
  await waitForStatus(/captured with rendered element census|failed to capture/, { timeout: 180_000 })
  await shot('evidence-captured')

  // ---- 3. Review packet (markdown + PDF contact sheet) ------------------------
  await page.getByRole('button', { name: 'Generate Copilot Review Packet' }).click()
  await page.getByRole('heading', { name: 'Generate Copilot Review Packet' }).waitFor()
  await shot('review-packet')
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  console.log('\nphase-evidence complete')
} finally {
  await app.close()
  try { process.kill(-server.pid) } catch { /* already gone */ }
}
