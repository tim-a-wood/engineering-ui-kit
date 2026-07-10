/**
 * Validate that the monolithic-web-app method makes the app launchable with
 * zero manual setup: creating a fresh project (no launch config) and applying
 * the monolith template must seed the project's launchUrl + launchCommand, so
 * the "1 · Launch app" card is ready without opening the launch dialog.
 *
 * Drives from first launch: New Project → Prepare → template → assert config.
 */

import fs from 'node:fs'
import path from 'node:path'
import { launchWorkbench } from './driver.mjs'
import { DATA_DIR, TARGET_REPO } from './config.mjs'

const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const readProject = (name) => {
  const root = path.join(DATA_DIR, 'projects')
  const dir = fs.readdirSync(root).find((d) => {
    const p = path.join(root, d, 'project.json')
    return fs.existsSync(p) && JSON.parse(fs.readFileSync(p, 'utf8')).name === name
  })
  return dir ? JSON.parse(fs.readFileSync(path.join(root, dir, 'project.json'), 'utf8')) : null
}

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: 'New Project' }).first().click()
await page.locator('#np-name').fill('MonoAuto')
await page.locator('#np-path').fill(TARGET_REPO)
await page.getByRole('button', { name: 'Create Project' }).click()
await page.getByRole('heading', { name: 'Prepare Context' }).waitFor()

// Fresh project: no launch config yet.
record('FRESH-NO-LAUNCH', !readProject('MonoAuto').launchUrl, 'new project starts with no launchUrl')

await page.getByRole('button', { name: 'Generate Context' }).click()
await waitForStatus(/Context generated/)
await page.getByRole('button', { name: 'Continue to Task Packet' }).click()
await page.getByRole('heading', { name: 'Create Task Packet' }).waitFor()

// Apply the monolith template.
await page.locator('#template-select').selectOption('monolithic-web-app')
await page.getByRole('button', { name: 'Use template' }).click()
await waitForStatus(/Launch App is pre-configured/)
await shot('monolith-template-autoconfig')

const project = readProject('MonoAuto')
record('AUTO-LAUNCH-URL', project.launchUrl === 'http://127.0.0.1:4180', `launchUrl auto-set = ${project.launchUrl}`)
record('AUTO-LAUNCH-CMD', project.launchCommand === 'npm run build && npm start', `launchCommand auto-set = ${project.launchCommand}`)

// The packet text must tell Copilot to honour the same port + npm start.
await page.getByRole('button', { name: 'Export Task Packet' }).click()
await waitForStatus(/Packet built/)
const runsRoot = path.join(DATA_DIR, 'runs')
const runDir = fs.readdirSync(runsRoot).map((d) => path.join(runsRoot, d)).sort().at(-1)
const packet = fs.readFileSync(path.join(runDir, 'task-packet.md'), 'utf8')
record('PACKET-PORT', packet.includes('4180') && /npm start/.test(packet), 'packet prescribes npm start on port 4180')

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
await app.close()
