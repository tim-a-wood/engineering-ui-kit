/**
 * Validate the blocked-overlay fix-prompt affordance: select a hostile zip
 * (traversal + .git + node_modules), confirm the inspector refuses it, copy
 * the fix prompt, and assert the clipboard carries every blocker plus the
 * corrected-zip contract. Run phase-prepare first (PASS=fix-prompt).
 */

import path from 'node:path'
import { launchWorkbench } from './driver.mjs'
import { SCRATCH_ROOT } from './config.mjs'

const BLOCKED_ZIP = process.env.BLOCKED_ZIP ?? path.join(SCRATCH_ROOT, 'blocked-overlay.zip')
const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const { app, page, shot, waitForStatus } = await launchWorkbench({ EUIK_TEST_PICK_ZIP: BLOCKED_ZIP })

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
await page.getByRole('button', { name: 'I have the overlay — Continue' }).click()
await page.getByRole('heading', { name: 'Apply Zip Overlay' }).waitFor()

await page.getByRole('button', { name: /Select ui-overlay\.zip/ }).click()
await waitForStatus(/Inspection verdict: blocked/)
record('BLOCKED-VERDICT', true, 'inspector refused the hostile zip')

const badge = await page.locator('.badge-danger').innerText()
record('BLOCKED-BADGE', /Blocked/.test(badge), `badge: ${badge.trim()}`)
record('APPLY-DISABLED', await page.getByRole('button', { name: 'Apply Overlay' }).isDisabled(), 'Apply Overlay button disabled')

const blockerPanel = page.locator('.validation-summary')
await blockerPanel.scrollIntoViewIfNeeded()
await shot('blocked-overlay')

await blockerPanel.getByRole('button', { name: /Copy Fix Prompt for Copilot/ }).click()
await page.getByRole('button', { name: /Copied/ }).waitFor()
await shot('fix-prompt-copied')

const clipboard = await app.evaluate(({ clipboard }) => clipboard.readText())
record('PROMPT-BLOCKERS', /AI-HANDOFF-03\d/.test(clipboard) && clipboard.includes('.git') && clipboard.includes('node_modules'),
  `prompt names the blockers (${clipboard.split('\n').filter((l) => /^\d+\./.test(l)).length} listed)`)
record('PROMPT-CONTRACT', clipboard.includes('corrected `ui-overlay.zip`') && clipboard.includes('repo-relative paths'),
  'prompt restates the corrected-zip contract')
record('PROMPT-REATTACH', clipboard.includes('repo-flatfile.txt') && clipboard.includes('task-and-standard-pack.md'),
  'prompt tells Copilot the upload set is re-attached')

// The escape hatch back to the upload step for re-attaching files.
await blockerPanel.getByRole('button', { name: /Reopen Run in Copilot/ }).click()
await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
record('REOPEN-LINK', true, 'blocked panel links back to Run in Copilot')
await shot('reopen-run-in-copilot')

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
await app.close()
