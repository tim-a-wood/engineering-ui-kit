/**
 * Self-alignment pass, phase A: the workbench runs its own GUI through its
 * own workflow. New Project → Prepare Context → Create Task Packet
 * (standards-refresh template, Scope carrying the audited violations of its
 * own standard pack) → Run in Copilot. The operator then authors the overlay
 * and applies it through the app (phase B).
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench, newestRunDir } from './driver.mjs'
import { REPO_ROOT } from './config.mjs'

const SELF_REPO = path.join(REPO_ROOT, 'apps', 'gui')

const SCOPE = [
  "Align the workbench's own GUI (this repo) with its own standard pack — presentation only. Four audited violations:",
  '1. LAY-SHELL-001 — the primary navigation sidebar must be collapsible: a « Collapse affordance at the foot of the rail collapses it to a 64px icon rail (labels hidden, icons remain, title attributes for labels), state persisted across sessions (localStorage), expanded by default. Files: src/App.tsx, src/styles.css.',
  '2. CMP-TABLE-DATA-TABLE — Projects list table craft: one-line rows (project name plus a single-line ellipsis-truncated meta line, never wrapped multi-line descriptions), timestamps never wrap (nowrap — "Yesterday, 8:27 PM" stays on one line), and condense the four wide per-row action buttons to the primary action (Start handoff / Open) plus a compact overflow menu ("More actions") holding Launch & evidence and Archive. Remove the filler status banner under the table. Files: src/views/ProjectsView.tsx, src/styles.css.',
  '3. RCP-DASH-001 — Settings: sibling panels in each grid row stretch to equal height, and each panel\'s Save changes action row pins to the panel foot so actions align across siblings. Files: the Settings view, src/styles.css.',
  '4. CMP-FORM-FIELD — control craft in Settings: compact 32px field heights for text inputs and selects, and the disabled "Preferred packet format" select renders as a real select (custom chrome with chevron, disabled tint), not a bare input.',
  'Do not change behavior, IPC/bridge contracts, workflow logic, or any view outside App shell, Projects, and Settings.',
].join('\n')

const REFERENCES = [
  'standard-pack.md (attached): LAY-SHELL-001, CMP-TABLE-DATA-TABLE, RCP-DASH-001, CMP-FORM-FIELD are the operative sections; the token table is the only color/spacing source.',
  'This app generated that standard pack — the audit screenshots under apps/desktop/validation-evidence/self-align/pass-1 are the calibration evidence.',
].join('\n')

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()

await page.getByRole('button', { name: 'New Project' }).first().click()
await page.locator('#np-name').fill('Workbench (self)')
await page.locator('#np-path').fill(SELF_REPO)
await page.locator('#np-desc').fill('The workbench GUI itself — dogfood pass aligning it with its own standard pack.')
await shot('self-new-project')
await page.getByRole('button', { name: 'Create Project' }).click()

await page.getByRole('heading', { name: 'Prepare Context' }).waitFor()
await page.getByRole('button', { name: 'Generate Context' }).click()
await waitForStatus(/Context generated/)
await shot('self-context-generated')
await page.getByRole('button', { name: 'Continue to Task Packet' }).click()

await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()
await page.locator('#template-select').selectOption('standards-refresh')
await page.getByRole('button', { name: 'Use template' }).click()
await waitForStatus(/Template applied/)

const editSection = async (title, id, value) => {
  const row = page.locator('li.row-item', { has: page.getByRole('heading', { name: title }) })
  await row.getByRole('button', { name: /^Edit/ }).click()
  await page.locator(`#edit-${id}`).fill(value)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}
await editSection('Scope', 'scope', SCOPE)
await editSection('References', 'references', REFERENCES)
await shot('self-sections-edited')

await page.getByRole('button', { name: 'Export Task Packet' }).click()
await waitForStatus(/Packet built/)
await shot('self-packet-built')
await page.getByRole('button', { name: 'Continue', exact: true }).click()

await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
await shot('self-run-in-copilot')

const runDir = newestRunDir()
console.log(`run dir: ${runDir}`)
for (const f of ['repo-flatfile.txt', 'task-and-standard-pack.md']) {
  const p = path.join(runDir, f)
  console.log(`  ${f}: ${fs.existsSync(p) ? `${fs.statSync(p).size} bytes` : 'MISSING'}`)
}
await app.close()
