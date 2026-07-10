/**
 * Phase A of a workflow pass: first launch → New Project → Prepare Context →
 * Create Task Packet (monolithic-web-app template, REPLACE sections filled)
 * → Run in Copilot. Ends with the upload set exported; the operator (acting
 * as Copilot) then authors ui-overlay.zip and runs phase-apply.mjs.
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench, newestRunDir } from './driver.mjs'
import { TARGET, TARGET_REPO } from './config.mjs'

const PROJECT_NAME = process.env.PROJECT_NAME ?? 'GaugeLab'
const PROJECT_DESC = process.env.PROJECT_DESC
  ?? 'Monolithic web app built from REQUIREMENTS.md via the workbench.'

const SCOPE = process.env.PACKET_SCOPE ?? [
  `Implement ${PROJECT_NAME} exactly as specified by REQUIREMENTS.md (in the repo flatfile): a dashboard answering overdue / due soon / in service / out of service at a glance, an instruments page with search, filters, and next-due sorting, an instrument detail view with the calibration history, a log-calibration flow, and new/edit instrument forms with validation.`,
  'Frontend: app shell (top bar, primary navigation, page header), the core screens, semantic token entry stylesheet.',
  'Backend: minimal Node server with a typed JSON API and JSON-file persistence, seeded with realistic sample records.',
  'Shared TypeScript types between client and server in one module.',
].join('\n')

const REFERENCES = process.env.PACKET_REFERENCES ?? [
  'REQUIREMENTS.md at the repo root (inside repo-flatfile.txt) — the complete product specification; every numbered requirement is in scope.',
  'standard-pack.md (attached): rule IDs, component IDs, token table.',
].join('\n')

const { app, page, shot, waitForStatus } = await launchWorkbench()

// ---- 1. Hub, first run ----------------------------------------------------
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await shot('hub-first-run')

// ---- 2. New Project -------------------------------------------------------
await page.getByRole('button', { name: 'New Project' }).first().click()
await page.locator('#np-name').fill(PROJECT_NAME)
await page.locator('#np-path').fill(TARGET_REPO)
await page.locator('#np-desc').fill(PROJECT_DESC)
await shot('new-project-dialog')
await page.getByRole('button', { name: 'Create Project' }).click()

// Creating the project starts a run and lands on Prepare Context.
await page.getByRole('heading', { name: 'Prepare Context' }).waitFor()
await shot('prepare-context')

// ---- 3. Generate context --------------------------------------------------
await page.getByRole('button', { name: 'Generate Context' }).click()
await waitForStatus(/Context generated/)
await shot('context-generated')
await page.getByRole('button', { name: 'Continue to Task Packet' }).click()

// ---- 4. Task packet from the monolithic-web-app template -------------------
await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()
await page.locator('#template-select').selectOption('monolithic-web-app')
await page.getByRole('button', { name: 'Use template' }).click()
await waitForStatus(/Template applied/)
await shot('template-applied')

// Replace the REPLACE-marked sections through the row editors.
const editSection = async (title, value) => {
  const row = page.locator('li.row-item', { has: page.getByRole('heading', { name: title }) })
  await row.getByRole('button', { name: /^Edit/ }).click()
  const area = page.locator(`#edit-${title === 'Scope' ? 'scope' : 'references'}`)
  await area.fill(value)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}
await editSection('Scope', SCOPE)
await editSection('References', REFERENCES)
await shot('sections-edited')

// ---- 5. Preview, export ----------------------------------------------------
await page.getByRole('button', { name: 'Preview Task Packet' }).click()
await page.getByRole('heading', { name: 'Task Packet Preview' }).waitFor()
await shot('packet-preview')
await page.getByRole('button', { name: 'Close', exact: true }).click()

await page.getByRole('button', { name: 'Export Task Packet' }).click()
await waitForStatus(/Packet built/)
await shot('packet-built')
await page.getByRole('button', { name: 'Continue', exact: true }).click()

// ---- 6. Run in Copilot ------------------------------------------------------
await page.getByRole('heading', { name: 'Run in Copilot' }).waitFor()
await shot('run-in-copilot')

const runDir = newestRunDir()
console.log('\nphase-prepare complete')
console.log(`  run dir: ${runDir}`)
for (const f of ['repo-flatfile.txt', 'task-and-standard-pack.md', 'recommended-prompt.txt']) {
  const p = path.join(runDir, f)
  console.log(`  ${f}: ${fs.existsSync(p) ? `${fs.statSync(p).size} bytes` : 'MISSING'}`)
}

await app.close()
