/**
 * Packet-regeneration turn (the Verify step's "Generate New Task Packet"
 * path): save reviewer feedback, regenerate the task packet, re-fill the
 * sections, export, and assert the exported packet carries the feedback
 * ("Reviewer Feedback (previous iteration)" section).
 *
 * Env: FEEDBACK (required), PACKET_SCOPE / PACKET_REFERENCES (as phase-prepare).
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench, newestRunDir } from './driver.mjs'

const FEEDBACK = process.env.FEEDBACK
if (!FEEDBACK) { console.error('FEEDBACK is required'); process.exit(1) }
const SCOPE = process.env.PACKET_SCOPE ?? ''
const REFERENCES = process.env.PACKET_REFERENCES ?? ''

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

// ---- 1. Feedback, then regenerate ------------------------------------------
await page.getByRole('button', { name: 'Add Feedback Manually' }).click()
await page.locator('#review-feedback').fill(FEEDBACK)
await page.getByRole('button', { name: 'Save Feedback' }).click()
await waitForStatus(/Feedback saved/)
await shot('regen-feedback-saved')

await page.getByRole('button', { name: 'Generate New Task Packet' }).click()
await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()
await shot('regen-task-packet')

// ---- 2. Re-fill sections (template + REPLACE edits, as in phase A) ----------
await page.locator('#template-select').selectOption('monolithic-web-app')
await page.getByRole('button', { name: 'Use template' }).click()
await waitForStatus(/Template applied|Applying the template/)
// A prior run's fields count as content; confirm the replace if asked.
const replaceButton = page.getByRole('button', { name: 'Replace content' })
if (await replaceButton.count() > 0) {
  await replaceButton.click()
  await waitForStatus(/Template applied/)
}

const editSection = async (title, value) => {
  if (!value) return
  const row = page.locator('li.row-item', { has: page.getByRole('heading', { name: title }) })
  await row.getByRole('button', { name: /^Edit/ }).click()
  await page.locator(`#edit-${title === 'Scope' ? 'scope' : 'references'}`).fill(value)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}
await editSection('Scope', SCOPE)
await editSection('References', REFERENCES)

await page.getByRole('button', { name: /Export Task Packet|Rebuild Task Packet/ }).click()
await waitForStatus(/Packet built/)
await shot('regen-packet-built')

// ---- 3. Assert the feedback made it into the exported packet ---------------
const packet = fs.readFileSync(path.join(newestRunDir(), 'task-packet.md'), 'utf8')
const carried = packet.includes('## Reviewer Feedback (previous iteration)')
console.log(`\nphase-regen complete — feedback section in packet: ${carried ? 'YES' : 'NO'}`)
if (!carried) process.exitCode = 1

await app.close()
