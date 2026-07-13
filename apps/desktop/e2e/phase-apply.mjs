/**
 * Phase B of a workflow pass: relaunch the workbench (resume the open run),
 * Apply Zip Overlay (inspection → warning acceptance → apply), then
 * Test (typecheck + build). The overlay zip must already exist
 * at the OVERLAY_ZIP path (see config.mjs) — authored from the exported
 * packet, playing the Copilot role.
 */

import fs from 'node:fs'
import { launchWorkbench } from './driver.mjs'
import { OVERLAY_ZIP } from './config.mjs'

if (!fs.existsSync(OVERLAY_ZIP)) {
  console.error(`overlay zip missing: ${OVERLAY_ZIP}`)
  process.exit(1)
}

const { app, page, shot, waitForStatus } = await launchWorkbench()

// ---- 1. Resume the open run from the hub -----------------------------------
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('heading', { name: 'Continue where you left off' }).waitFor()
await shot('hub-resume')
await page.getByRole('button', { name: /^Continue/ }).click()

// Run in Copilot is the persisted step; declare the overlay is ready.
await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
await page.getByRole('button', { name: 'I have the overlay — Continue' }).click()

// ---- 2. Inspect the overlay --------------------------------------------------
await page.getByRole('heading', { name: 'Apply Zip Overlay' }).waitFor()
await page.getByRole('button', { name: /Select ui-overlay\.zip/ }).click()
await waitForStatus(/Inspection verdict/)
await shot('overlay-inspected')

// Accept overwrite warnings when the gate is shown.
const gate = page.locator('input[type="checkbox"]')
if (await gate.count() > 0) {
  await gate.check()
  await shot('warnings-accepted')
}

// ---- 3. Apply ---------------------------------------------------------------
await page.getByRole('button', { name: 'Apply Overlay' }).click()
await waitForStatus(/Overlay applied/)
await shot('overlay-applied')
await page.getByRole('button', { name: 'Continue to Test' }).click()

// ---- 4. Verify ---------------------------------------------------------------
await page.getByRole('heading', { name: 'Test' }).waitFor()
await shot('verify-review')
await page.getByRole('button', { name: /^(Run checks|Re-run checks)$/ }).click()
// Rehydrated results may already show a verdict; wait for the fresh run first.
await waitForStatus(/Running verification commands/, { timeout: 30_000 })
const verdict = await waitForStatus(/All checks passed|checks? failed/, { timeout: 300_000 })
await shot('verification-result')

console.log('\nphase-apply complete')
console.log(`  verification: ${verdict.trim()}`)

await app.close()
