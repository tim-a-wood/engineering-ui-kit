/**
 * An iteration turn inside Verify & Review: record reviewer feedback on the
 * open run, walk back to Apply Zip Overlay, select the corrected overlay
 * (EUIK_TEST_PICK_ZIP), accept any overwrite warnings, apply, and re-verify.
 *
 * Env: FEEDBACK — the reviewer note to save before iterating (optional).
 */

import { launchWorkbench } from './driver.mjs'

const FEEDBACK = process.env.FEEDBACK ?? ''

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

// ---- 1. Record what the iteration is fixing --------------------------------
if (FEEDBACK) {
  await page.getByRole('button', { name: 'Add Feedback Manually' }).click()
  await page.locator('#review-feedback').fill(FEEDBACK)
  await shot('feedback-entered')
  await page.getByRole('button', { name: 'Save Feedback' }).click()
  await waitForStatus(/Feedback saved/)
}

// ---- 2. Back to Apply, corrected overlay ------------------------------------
await page.locator('button.btn-secondary', { hasText: /^Back$/ }).click()
await page.getByRole('heading', { name: 'Apply Zip Overlay' }).waitFor()
await page.getByRole('button', { name: /Select (ui-overlay\.zip|different zip)/ }).click()
await waitForStatus(/Inspection verdict/)
await shot('iteration-inspected')

const gate = page.locator('input[type="checkbox"]')
if (await gate.count() > 0) {
  await gate.check()
  await shot('iteration-warnings-accepted')
}

await page.getByRole('button', { name: 'Apply Overlay' }).click()
await waitForStatus(/Overlay applied/)
await shot('iteration-applied')
await page.getByRole('button', { name: 'Continue to Verify & Review' }).click()

// ---- 3. Re-verify ------------------------------------------------------------
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()
await page.getByRole('button', { name: /^(Run checks|Re-run checks)$/ }).click()
// Rehydrated results may already show a verdict; wait for the fresh run first.
await waitForStatus(/Running verification commands/, { timeout: 30_000 })
const verdict = await waitForStatus(/All checks passed|checks? failed/, { timeout: 300_000 })
await shot('iteration-verified')

console.log('\nphase-iterate complete')
console.log(`  verification: ${verdict.trim()}`)

await app.close()
