/**
 * Self-alignment pass, phase B: resume the "Workbench (self)" run, apply the
 * authored overlay through the app's own Apply Zip Overlay step, and let the
 * review cockpit's autonomous checks verify it (typecheck + build of the
 * workbench GUI itself).
 */

import fs from 'node:fs'
import { launchWorkbench } from './driver.mjs'
import { OVERLAY_ZIP } from './config.mjs'

if (!fs.existsSync(OVERLAY_ZIP)) {
  console.error(`overlay zip missing: ${OVERLAY_ZIP}`)
  process.exit(1)
}

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).first().click()

await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
await page.getByRole('button', { name: 'I have the overlay — Continue' }).click()

await page.getByRole('heading', { name: 'Apply Zip Overlay' }).waitFor()
await page.getByRole('button', { name: /Select ui-overlay\.zip/ }).click()
await waitForStatus(/Inspection verdict/)
await shot('self-overlay-inspected')

const gate = page.locator('input[type="checkbox"]')
if (await gate.count() > 0) await gate.check()

await page.getByRole('button', { name: 'Apply Overlay' }).click()
await waitForStatus(/Overlay applied/)
await shot('self-overlay-applied')
await page.getByRole('button', { name: 'Continue to Test' }).click()

// The cockpit runs health checks autonomously; wait for the chip verdict.
await page.getByRole('heading', { name: 'Test' }).waitFor()
const chip = page.locator('.review-chip', { hasText: /Checks · \d+\/\d+ passed|Checks · \d+ failed/ })
await chip.waitFor({ timeout: 300_000 })
const verdict = (await chip.innerText()).trim()
await shot('self-verify-cockpit')

console.log(`self-align apply complete — ${verdict}`)
await app.close()
if (!/passed/.test(verdict)) process.exitCode = 1
