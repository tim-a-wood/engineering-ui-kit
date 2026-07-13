/**
 * Final turn: re-run verification (results are not rehydrated on revisit —
 * logged gap), approve & complete the handoff, and capture the completed
 * hub state.
 */

import { launchWorkbench } from './driver.mjs'

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Test' }).waitFor()

await page.getByRole('button', { name: /^(Run checks|Re-run checks)$/ }).click()
await waitForStatus(/All checks passed/, { timeout: 300_000 })

await page.getByRole('button', { name: /Approve & Complete Handoff/ }).click()
await waitForStatus(/Handoff approved and completed/)
await shot('handoff-approved')

await page.getByRole('button', { name: 'Copilot Handoff' }).click()
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await shot('hub-complete')

console.log('\nphase-approve complete — handoff approved')
await app.close()
