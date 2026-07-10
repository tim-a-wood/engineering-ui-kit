/**
 * Validate the Verify-step launch-config affordance: a project created in the
 * app has no launch URL, so "1 · Launch app" must offer inline configuration
 * (Set launch URL…) rather than a dead disabled button. After saving a URL +
 * command, "Launch App" must appear and the project must persist the settings.
 *
 * Run phase-prepare + phase-apply first (PASS=launch-fix EXPERIMENT=launch-fix).
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench } from './driver.mjs'
import { DATA_DIR } from './config.mjs'

const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

const launchCard = page.locator('.inset', { has: page.getByRole('heading', { name: '1 · Launch app' }) })
await launchCard.scrollIntoViewIfNeeded()

// Before: no dead-end — an inline configure button is offered.
record('NO-LAUNCH-CTA', await launchCard.getByRole('button', { name: /Set launch URL/ }).count() > 0,
  'launch card offers "Set launch URL…" instead of a disabled button')
record('NO-DISABLED-LAUNCH', await launchCard.getByRole('button', { name: 'Launch App' }).count() === 0,
  'no disabled Launch App button shown when unconfigured')
await shot('launch-card-unconfigured')

// Configure inline.
await launchCard.getByRole('button', { name: /Set launch URL/ }).click()
await page.getByRole('heading', { name: /Launch & evidence/ }).waitFor()
await page.locator('#launch-url').fill('http://127.0.0.1:5410')
await page.locator('#launch-command').fill('npm start')
await shot('launch-config-dialog')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await waitForStatus(/Launch URL saved/)

// After: Launch App is now available.
record('LAUNCH-AVAILABLE', await launchCard.getByRole('button', { name: 'Launch App' }).count() > 0,
  'Launch App button appears after inline configuration')
await shot('launch-card-configured')

// Persisted to the project record.
const projectsRoot = path.join(DATA_DIR, 'projects')
const projectDir = fs.readdirSync(projectsRoot).find((d) => {
  const p = path.join(projectsRoot, d, 'project.json')
  return fs.existsSync(p) && JSON.parse(fs.readFileSync(p, 'utf8')).name === 'GaugeLab'
})
const project = JSON.parse(fs.readFileSync(path.join(projectsRoot, projectDir, 'project.json'), 'utf8'))
record('PERSISTED-URL', project.launchUrl === 'http://127.0.0.1:5410', `project.launchUrl = ${project.launchUrl}`)
record('PERSISTED-CMD', project.launchCommand === 'npm start', `project.launchCommand = ${project.launchCommand}`)

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
await app.close()
