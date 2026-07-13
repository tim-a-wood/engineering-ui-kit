/**
 * Self-alignment audit: screenshot every workbench screen so the workbench's
 * own GUI can be graded against its own standards pack (the dogfood pass).
 * Read-only — navigates and shoots, changes nothing.
 */

import { launchWorkbench } from './driver.mjs'

const { app, page, shot } = await launchWorkbench()
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await shot('audit-hub')

for (const nav of ['Recipes', 'Components', 'Projects', 'Settings']) {
  await page.getByRole('button', { name: nav }).or(page.getByRole('link', { name: nav })).first().click()
  await page.waitForTimeout(600)
  await shot(`audit-${nav.toLowerCase()}`)
}

// Workflow steps on the newest run (read-only visits).
await page.getByRole('button', { name: 'Copilot Handoff' }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^Continue/ }).first().click()
await page.waitForTimeout(800)
await shot('audit-workflow-current-step')

// Nav collapse affordance check (LAY-SHELL-001).
const collapse = await page.getByRole('button', { name: /collapse/i }).count()
const sidebar = await page.evaluate(() => {
  const el = document.querySelector('nav, aside, .sidebar, .app-nav, [class*="sidebar"], [class*="nav-rail"]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { width: Math.round(r.width), cls: el.className }
})
console.log(JSON.stringify({ collapseButtons: collapse, sidebar }))

await app.close()
