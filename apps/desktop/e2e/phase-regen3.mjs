/**
 * Pass-3 validation turn for the round-2 improvements:
 *   F9 — "Generate New Task Packet" must arrive prefilled with the last
 *        exported sections (no template re-application, no retyping);
 *   F10 — after applying the next overlay, Verify must demand a fresh run
 *        instead of showing the pre-overlay verdict.
 * Then the corrected overlay is applied and verified as usual.
 *
 * Env: FEEDBACK (required).
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench, newestRunDir } from './driver.mjs'

const FEEDBACK = process.env.FEEDBACK
if (!FEEDBACK) { console.error('FEEDBACK is required'); process.exit(1) }
const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

// ---- feedback, then regenerate ----------------------------------------------
await page.getByRole('button', { name: 'Add Feedback Manually' }).click()
await page.locator('#review-feedback').fill(FEEDBACK)
await page.getByRole('button', { name: 'Save Feedback' }).click()
await waitForStatus(/Feedback saved/)

await page.getByRole('button', { name: 'Generate New Task Packet' }).click()
await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()

// F9: sections must already be filled from the last export.
const scopeRow = page.locator('li.row-item', { has: page.getByRole('heading', { name: 'Scope' }) })
const scopeText = await scopeRow.innerText()
record('F9-PREFILL', scopeText.includes('Implement GaugeLab exactly as specified'), 'Scope arrives prefilled from the previous packet')
await shot('regen3-prefilled')

await page.getByRole('button', { name: /Export Task Packet|Rebuild Task Packet/ }).click()
await waitForStatus(/Packet built/)

const packet = fs.readFileSync(path.join(newestRunDir(), 'task-packet.md'), 'utf8')
record('F3-FEEDBACK', packet.includes('## Reviewer Feedback (previous iteration)'), 'regenerated packet carries the reviewer feedback')
record('F9-CONTENT', packet.includes('Implement GaugeLab exactly as specified'), 'regenerated packet keeps the previous scope without retyping')

// ---- corrected overlay --------------------------------------------------------
await page.getByRole('button', { name: 'Continue', exact: true }).click()
await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
await page.getByRole('button', { name: 'I have the overlay — Continue' }).click()
await page.getByRole('heading', { name: 'Apply Zip Overlay' }).waitFor()
await page.getByRole('button', { name: /Select (ui-overlay\.zip|different zip)/ }).click()
await waitForStatus(/Inspection verdict/)
const gate = page.locator('input[type="checkbox"]')
if (await gate.count() > 0) await gate.check()
await page.getByRole('button', { name: 'Apply Overlay' }).click()
await waitForStatus(/Overlay applied/)
await page.getByRole('button', { name: 'Continue to Verify & Review' }).click()
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

// F10: stale verdict must be gone — the step demands a fresh run.
await page.waitForTimeout(600)
const runButton = await page.locator('section:has(h2.sr-only) button.btn-compact').first().innerText().catch(() => '')
const freshDemanded = /^Run checks$/.test(runButton.trim())
record('F10-INVALIDATED', freshDemanded, `verification button after new apply reads "${runButton.trim()}"`)
await shot('regen3-fresh-verify')

await page.getByRole('button', { name: /^(Run checks|Re-run checks)$/ }).click()
const verdict = await waitForStatus(/All checks passed|checks? failed/, { timeout: 300_000 })
await shot('regen3-verified')
record('VERIFY', /All checks passed/.test(verdict), verdict.trim().slice(0, 60))

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
await app.close()
