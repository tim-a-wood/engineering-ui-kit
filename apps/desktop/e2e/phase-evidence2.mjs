/**
 * Pass-2 evidence turn — validates the round-1 improvements in real use:
 * the Launch & evidence dialog now takes a launch command (F1) and accepts
 * hash paths (F2), so the workbench starts the target app itself and
 * captures evidence without any externally started server.
 */

import { launchWorkbench } from './driver.mjs'

const LAUNCH_URL = process.env.LAUNCH_URL ?? 'http://127.0.0.1:5410'
const LAUNCH_COMMAND = process.env.LAUNCH_COMMAND ?? 'npm start'
const PROJECT_NAME = process.env.PROJECT_NAME ?? 'GaugeLab'
const VIEWS = [
  'Dashboard | /',
  'Instruments | #/instruments',
  'New instrument | #/instruments/new',
].join('\n')

const { app, page, shot, waitForStatus } = await launchWorkbench()

await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: 'Projects' }).click()
await page.locator('tr', { hasText: PROJECT_NAME }).locator('button', { hasText: /launch & evidence/i }).first().click()
await page.locator('#launch-url').fill(LAUNCH_URL)
await page.locator('#launch-command').fill(LAUNCH_COMMAND)
await page.locator('#evidence-views').fill(VIEWS)
await shot('launch-evidence-config')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await waitForStatus(/Launch & evidence settings saved/)

await page.getByRole('button', { name: 'Copilot Handoff' }).click()
await page.getByRole('button', { name: /^Continue/ }).click()
await page.getByRole('heading', { name: 'Verify & Review' }).waitFor()

const evidenceSection = page.locator('section', { has: page.getByRole('heading', { name: 'Visual evidence — before / after' }) })
await evidenceSection.scrollIntoViewIfNeeded()
await evidenceSection.getByRole('button', { name: /Capture After|Re-capture/ }).click()
await waitForStatus(/captured with rendered element census|failed to capture/, { timeout: 240_000 })
await shot('evidence-captured')

await page.getByRole('button', { name: 'Generate Copilot Review Packet' }).click()
await page.getByRole('heading', { name: 'Generate Copilot Review Packet' }).waitFor()
await shot('review-packet')
await page.getByRole('button', { name: 'Close', exact: true }).click()

console.log('\nphase-evidence2 complete (app-managed server start)')
await app.close()
