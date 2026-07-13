/**
 * Validate the F16 iteration prefill: on a run with an applied overlay,
 * saving feedback and returning to Create Task Packet must auto-switch to
 * the "Iterate on the previous design" category with Scope prefilled from
 * the new feedback and iteration constraints in place — and the exported
 * packet must carry all of it.
 *
 * Run against a workspace whose newest open run sits at Test
 * (e.g. EXPERIMENT=launch-fix PASS=launch-fix).
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench, newestRunDir } from './driver.mjs'

const FEEDBACK = 'Make the overdue badge bolder and increase the asset-tag font size in the instruments table.'
const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Test' }).waitFor()

// ---- save fresh feedback ----------------------------------------------------
await page.getByRole('button', { name: 'Add Feedback Manually' }).click()
await page.locator('#review-feedback').fill(FEEDBACK)
await page.getByRole('button', { name: 'Save Feedback' }).click()
await waitForStatus(/Feedback saved/)

// ---- return to the packet step ------------------------------------------------
await page.getByRole('button', { name: 'Generate New Task Packet' }).click()
await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()
await waitForStatus(/Iteration packet prefilled/)
await shot('iteration-prefilled')

record('AUTO-CATEGORY', (await page.locator('#template-select').inputValue()) === 'iterate-on-feedback',
  `template select = ${await page.locator('#template-select').inputValue()}`)
record('AUTO-TITLE', (await page.locator('#task-title').inputValue()).startsWith('Iterate on'),
  `title = ${await page.locator('#task-title').inputValue()}`)

const scopeRow = page.locator('li.row-item', { has: page.getByRole('heading', { name: 'Scope' }) })
record('AUTO-SCOPE-FEEDBACK', (await scopeRow.innerText()).includes('overdue badge bolder'),
  'Scope carries the saved feedback text')

const constraintsRow = page.locator('li.row-item', { has: page.getByRole('heading', { name: 'Constraints' }) })
record('AUTO-CONSTRAINTS', (await constraintsRow.innerText()).includes('Address only the feedback points'),
  'Constraints pinned to the iteration contract')

// ---- export and check the packet ---------------------------------------------
await page.getByRole('button', { name: /Export Task Packet|Rebuild Task Packet/ }).click()
await waitForStatus(/Packet built/)
const packet = fs.readFileSync(path.join(newestRunDir(), 'task-packet.md'), 'utf8')
record('PACKET-ITERATION-GOAL', packet.includes('Refine the UI previously delivered'), 'packet goal is the iteration goal')
record('PACKET-SCOPE-FEEDBACK', packet.includes('overdue badge bolder'), 'packet scope carries the feedback')
record('PACKET-HOLD-STEADY', packet.includes('Preserve the previously delivered structure'), 'packet constraints preserve the delivered design')

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
await app.close()
