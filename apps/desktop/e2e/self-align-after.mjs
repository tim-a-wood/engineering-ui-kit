/**
 * Self-alignment pass, after-audit: assert the workbench now honors its own
 * standard pack — collapsible nav (LAY-SHELL-001), one-line table rows with
 * an overflow menu (CMP-TABLE-DATA-TABLE), and equal-height sibling panels
 * with foot-pinned actions (RCP-DASH-001).
 */

import { launchWorkbench } from './driver.mjs'

const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const { app, page, shot } = await launchWorkbench()
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()

// LAY-SHELL-001: collapse affordance exists, collapses to a 64px icon rail.
const collapseBtn = page.getByRole('button', { name: 'Collapse' })
record('NAV-COLLAPSE-EXISTS', (await collapseBtn.count()) === 1, `collapse affordances: ${await collapseBtn.count()}`)
const widthOf = () => page.evaluate(() => Math.round(document.querySelector('aside.sidebar').getBoundingClientRect().width))
const expanded = await widthOf()
await collapseBtn.click()
await page.waitForTimeout(400)
const collapsed = await widthOf()
record('NAV-COLLAPSES-TO-RAIL', collapsed <= 72 && expanded >= 200, `rail ${expanded}px → ${collapsed}px`)
const labelsHidden = await page.evaluate(() =>
  [...document.querySelectorAll('.nav-label, .nav-section-label')].every((el) => getComputedStyle(el).display === 'none'),
)
record('NAV-RAIL-ICON-ONLY', labelsHidden, `labels hidden while collapsed: ${labelsHidden}`)
await shot('after-nav-collapsed')
await page.getByRole('button', { name: 'Expand navigation' }).click()
await page.waitForTimeout(400)

// CMP-TABLE-DATA-TABLE: one-line rows, nowrap timestamps, overflow menu.
await page.getByRole('button', { name: 'Projects' }).click()
await page.getByRole('heading', { name: 'Projects', exact: true }).first().waitFor()
const table = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table.data-table tbody tr')]
  const metas = rows.map((r) => r.querySelector('.row-meta')).filter(Boolean)
  const times = [...document.querySelectorAll('td.cell-time')]
  const actionCells = rows.map((r) => r.querySelectorAll('td:last-child button').length)
  return {
    rows: rows.length,
    metasNowrap: metas.every((m) => getComputedStyle(m).whiteSpace === 'nowrap'),
    timesNowrap: times.every((t) => getComputedStyle(t).whiteSpace === 'nowrap'),
    maxRowHeight: Math.max(...rows.map((r) => Math.round(r.getBoundingClientRect().height))),
    maxButtonsPerRow: Math.max(...actionCells),
  }
})
record('TABLE-ONE-LINE-META', table.metasNowrap && table.maxRowHeight <= 64, `meta nowrap: ${table.metasNowrap}; tallest row ${table.maxRowHeight}px across ${table.rows} rows`)
record('TABLE-TIME-NOWRAP', table.timesNowrap, `timestamp cells nowrap: ${table.timesNowrap}`)
record('TABLE-OVERFLOW-MENU', table.maxButtonsPerRow <= 2, `max visible action buttons per row: ${table.maxButtonsPerRow} (primary + More actions)`)
await page.getByRole('button', { name: 'More actions' }).first().click()
await page.getByRole('menu').waitFor()
await shot('after-projects-menu')
await page.keyboard.press('Escape')
await page.getByRole('heading', { name: 'Projects', exact: true }).first().click() // dismiss menu focus

// RCP-DASH-001: Settings sibling panels stretch equal per row.
await page.getByRole('button', { name: 'Settings' }).click()
await page.getByRole('heading', { name: 'Settings', exact: true }).first().waitFor()
const panels = await page.evaluate(() =>
  [...document.querySelectorAll('.grid-2 > .panel')].map((p) => {
    const r = p.getBoundingClientRect()
    return { top: Math.round(r.top), height: Math.round(r.height) }
  }),
)
const rows = new Map()
for (const p of panels) {
  const key = Math.round(p.top / 50)
  rows.set(key, [...(rows.get(key) ?? []), p.height])
}
const equalPerRow = [...rows.values()].every((hs) => Math.max(...hs) - Math.min(...hs) <= 2)
record('SETTINGS-PANELS-STRETCH', panels.length === 4 && equalPerRow, `panel heights per row: ${[...rows.values()].map((hs) => hs.join('=')).join(' | ')}`)
await shot('after-settings-aligned')

await app.close()
console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
