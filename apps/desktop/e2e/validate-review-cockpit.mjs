/**
 * Validate F29: the Test step rebuilt as a preview-centric cockpit.
 *
 * Asserts the full loop the redesign promises:
 *  1. Health checks run autonomously on arrival (no clicks) and the toolbar
 *     chip reports the result; details live in a dialog.
 *  2. Comment mode injects a picker into the <webview> guest; clicking a real
 *     component in the previewed app opens a composer anchored to that
 *     element's selector, and saving appends a structured review note.
 *  3. "New Task Packet" carries the component comment into the follow-on
 *     packet via the existing iterate-on-feedback prefill (F16).
 *
 * The target run is pinned by createdAt bump (hub Continue resumes the newest
 * open run) and its stored verification results are cleared so the autonomous
 * check path runs live rather than rehydrating.
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench } from './driver.mjs'
import { DATA_DIR } from './config.mjs'

const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

// Pin the AeroPlan verify-review run as the hub's Continue target and force
// the autonomous-check path.
const runsRoot = path.join(DATA_DIR, 'runs')
const runFiles = fs.readdirSync(runsRoot)
  .map((d) => path.join(runsRoot, d, 'handoff-run.json'))
  .filter((p) => fs.existsSync(p))
  .map((p) => ({ p, run: JSON.parse(fs.readFileSync(p, 'utf8')) }))
const aeroPlan = runFiles
  .filter(({ run }) => run.currentStep === 'verify-review')
  .sort((a, b) => Date.parse(b.run.createdAt) - Date.parse(a.run.createdAt))[0]
if (!aeroPlan) throw new Error('no verify-review run found to validate against')
aeroPlan.run.createdAt = new Date().toISOString()
delete aeroPlan.run.verificationResultPaths
fs.writeFileSync(aeroPlan.p, JSON.stringify(aeroPlan.run, null, 2))
console.log(`pinned run ${path.basename(path.dirname(aeroPlan.p))} (project ${aeroPlan.run.projectId.slice(0, 8)})`)

const { app, page, shot } = await launchWorkbench()
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).first().click()
await page.getByRole('heading', { name: 'Test' }).waitFor()

// 1 · Autonomous health checks: the chip must reach a verdict without clicks.
const checksChip = page.locator('.review-chip', { hasText: /^Checks/ })
await checksChip.waitFor()
const early = await checksChip.innerText()
await page.locator('.review-chip', { hasText: /Checks · \d+\/\d+ passed|Checks · \d+ failed/ }).waitFor({ timeout: 240_000 })
const verdict = await checksChip.innerText()
record('CHECKS-AUTONOMOUS', /passed|failed/.test(verdict), `chip went "${early.trim()}" → "${verdict.trim()}" with zero clicks`)
record('CHECKS-GREEN', /\d+\/\d+ passed/.test(verdict), `verdict: ${verdict.trim()}`)

// Wait for the preview guest.
const webview = page.locator('webview.app-preview-frame')
await webview.waitFor({ state: 'visible', timeout: 120_000 })
await page.waitForTimeout(2_000)

// 2 · Component comment: enter comment mode, click a component in the guest.
const notesChipText = await page.locator('.review-chip', { hasText: /Notes · \d+/ }).innerText()
const notesBefore = Number(notesChipText.match(/\d+/)?.[0] ?? '0')

await page.getByRole('button', { name: 'Comment', exact: true }).click()
await page.getByRole('button', { name: 'Click a component…' }).waitFor()
await page.waitForTimeout(800) // let the picker install its listeners

const dispatched = await app.evaluate(async ({ webContents }) => {
  const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
  if (!wc) return false
  return wc.executeJavaScript(
    "(() => { const el = document.querySelector('main h1') || document.querySelector('h1'); if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true })()",
  )
})
record('PICKER-CLICK-DISPATCHED', dispatched === true, 'clicked the app h1 inside the guest')

await page.getByRole('heading', { name: 'Comment on component' }).waitFor({ timeout: 15_000 })
const anchor = await page.locator('.dialog code').first().innerText()
record('COMPOSER-ANCHORED', anchor.length > 0 && /h1/.test(anchor), `composer anchored to \`${anchor}\``)
// The guest composites above host DOM, so the preview must hide behind dialogs.
const previewHidden = await page.evaluate(() => {
  const el = document.querySelector('.app-preview')
  return el ? getComputedStyle(el).visibility === 'hidden' : false
})
record('DIALOG-OBSCURES-PREVIEW', previewHidden, `preview visibility with dialog open: ${previewHidden ? 'hidden' : 'visible (guest would bleed through)'}`)
await shot('cockpit-composer')

await page.locator('#component-comment').fill('Add the schema version badge next to this heading.')
await page.getByRole('button', { name: 'Save Comment' }).click()
await page.locator('.review-chip', { hasText: `Notes · ${notesBefore + 1}` }).waitFor({ timeout: 15_000 })
record('COMMENT-SAVED', true, `notes chip ${notesBefore} → ${notesBefore + 1}`)

// The saved entry appears in the notes dialog with its anchor.
await page.locator('.review-chip', { hasText: /Notes · \d+/ }).click()
await page.getByRole('heading', { name: 'Review notes' }).waitFor()
const entryVisible = await page.locator('.dialog').getByText('Component comment', { exact: false }).first().isVisible()
const bodyVisible = await page.locator('.dialog').getByText('schema version badge', { exact: false }).first().isVisible()
record('NOTE-STRUCTURED', entryVisible && bodyVisible, `dialog shows anchored entry (header: ${entryVisible}, body: ${bodyVisible})`)
await shot('cockpit-notes-dialog')
await page.keyboard.press('Escape')

// Checks dialog observability.
await checksChip.click()
await page.getByRole('heading', { name: 'Health checks' }).waitFor()
const rows = await page.locator('.dialog table tbody tr').count()
record('CHECKS-DIALOG', rows >= 2, `results table lists ${rows} checks`)
await shot('cockpit-checks-dialog')
await page.keyboard.press('Escape')
await shot('cockpit-overview')

// 3 · Follow-on packet: the comment must prefill the next task packet.
await page.getByRole('button', { name: 'New Task Packet' }).click()
await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()
await page.waitForTimeout(1_000)
// Sections render as read-only cards; the comment (anchor + body) must land in
// Scope and the template must have auto-switched to the iteration category.
const prefilled = await page.evaluate(() => ({
  anchor: document.body.innerText.includes('Component comment'),
  body: document.body.innerText.includes('schema version badge'),
  template: [...document.querySelectorAll('select')].some((s) => /iterate/i.test(s.selectedOptions[0]?.textContent ?? '')),
}))
record(
  'REPAIR-PACKET-PREFILL',
  prefilled.anchor && prefilled.body && prefilled.template,
  `scope carries anchored comment (anchor: ${prefilled.anchor}, body: ${prefilled.body}), template auto-switched: ${prefilled.template}`,
)
await shot('cockpit-repair-prefill')

await app.close()
console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
