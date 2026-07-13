/**
 * Validate: opening a project resumes the open run at its persisted visible
 * step (Build or Test), and the two-step stepper navigates between them —
 * visited/reachable steps are clickable; the current step and locked future
 * steps are static.
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench } from './driver.mjs'
import { DATA_DIR } from './config.mjs'

const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

function visibleHeading(step) {
  return step === 'verify-review' || step === 'complete' ? 'Test' : 'Build'
}

const STEP_ORDER = ['prepare-context', 'create-task-packet', 'run-in-copilot', 'apply-zip-overlay', 'verify-review']
const runsRoot = path.join(DATA_DIR, 'runs')
const aeroProjectPrefix = '54ced64e'
const openRuns = fs.readdirSync(runsRoot)
  .map((d) => path.join(runsRoot, d, 'handoff-run.json'))
  .filter((p) => fs.existsSync(p))
  .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')))
  .filter((r) => r.projectId.startsWith(aeroProjectPrefix) && r.currentStep !== 'complete')
  .sort((a, b) =>
    (STEP_ORDER.indexOf(b.currentStep) - STEP_ORDER.indexOf(a.currentStep))
    || b.updatedAt.localeCompare(a.updatedAt))
const expected = openRuns[0]
if (!expected) {
  console.error('No open AeroPlan run found — cannot validate resume')
  process.exit(1)
}
const expectedHeading = visibleHeading(expected.currentStep)
console.log(`AeroPlan resume target: ${expected.currentStep} → ${expectedHeading} (updated ${expected.updatedAt})`)

const { app, page, shot } = await launchWorkbench()
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()

// 1 · Opening a mid-run project resumes at its visible Build/Test step.
await page.getByRole('button', { name: 'Projects' }).click()
await page.getByRole('heading', { name: 'Projects', exact: true }).first().waitFor()
const aeroRow = page.locator('table.data-table tbody tr', { hasText: 'AeroPlan' })
const label = await aeroRow.getByRole('button').first().innerText()
record('OPEN-RUN-LABELLED-CONTINUE', /Continue/.test(label), `AeroPlan row action reads "${label.trim()}" (open run exists)`)
await aeroRow.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('heading', { name: expectedHeading }).waitFor({ timeout: 15_000 })
record('RESUMES-AT-PERSISTED-STEP', true, `AeroPlan opened straight to ${expectedHeading}`)
await shot('resume-at-persisted-step')

// 2 · Two-step stepper: Build/Test labels present; current step static.
const stepNames = await page.locator('.workflow .workflow-short').allTextContents()
record('STEPPER-TWO-STEPS', stepNames.includes('Build') && stepNames.includes('Test'), `stepper shorts: ${JSON.stringify(stepNames)}`)
const links = page.locator('.workflow .workflow-step-link')
const linkCount = await links.count()
const currentHasLink = await page.locator('.workflow-step.current .workflow-step-link, .workflow-step.viewing .workflow-step-link').count()
record('STEPPER-CURRENT-STATIC', currentHasLink === 0, `current/viewing step static: ${currentHasLink === 0}; clickable: ${linkCount}`)

if (expectedHeading === 'Test' && linkCount > 0) {
  await links.filter({ hasText: 'Build' }).click()
  await page.getByRole('heading', { name: 'Build' }).waitFor({ timeout: 15_000 })
  record('STEPPER-JUMPS-BACK', true, 'stepper click landed on Build')
  await shot('stepper-jump-back')
  await page.locator('.workflow .workflow-step-link').filter({ hasText: 'Test' }).click()
  await page.getByRole('heading', { name: 'Test' }).waitFor({ timeout: 15_000 })
  record('STEPPER-JUMPS-FORWARD', true, 'stepper click returned to Test')
} else if (expectedHeading === 'Build') {
  record('STEPPER-JUMPS-BACK', true, 'on Build — jump-back N/A until Test is reachable')
  record('STEPPER-JUMPS-FORWARD', linkCount === 0, `Test locked until apply: clickable count ${linkCount}`)
  await shot('stepper-jump-back')
}

// 3 · Locked Test on a fresh Build run is not clickable.
await page.getByRole('button', { name: 'Projects' }).click()
await page.getByRole('heading', { name: 'Projects', exact: true }).first().waitFor()
const plantRow = page.locator('table.data-table tbody tr', { hasText: 'PlantOps' })
await plantRow.getByRole('button', { name: /Continue|Start handoff/ }).click()
await page.getByRole('heading', { name: 'Build' }).waitFor({ timeout: 15_000 })
const lockedLinks = await page.locator('.workflow .workflow-step-link').count()
record('STEPPER-LOCKED-STATIC', lockedLinks === 0, `clickable steps on a fresh Build run: ${lockedLinks} (Test locked)`)
await shot('stepper-locked-fresh-run')

await app.close()
console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
