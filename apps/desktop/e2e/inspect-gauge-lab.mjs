/**
 * Inspect the generated GaugeLab sample: screenshot each view and exercise
 * the create / log-calibration / filter flows end to end against the real
 * server. Saves sample-*.png into the pass evidence dir and prints a
 * machine-readable check summary.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright'

const TARGET = '/Users/timwood/Documents/UI Framework/examples/gauge-lab'
const EVIDENCE = process.env.EVIDENCE_DIR ?? '/Users/timwood/Documents/UI Framework/apps/desktop/validation-evidence/monolith-e2e/pass-1'
const URL = 'http://127.0.0.1:5410'
const checks = []
const check = (id, pass, detail) => { checks.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const server = spawn('npm', ['start'], { cwd: TARGET, detached: true, stdio: 'ignore' })
for (let i = 0; i < 60; i += 1) {
  try { const r = await fetch(URL, { signal: AbortSignal.timeout(1000) }); if (r.status < 500) break } catch { /* retry */ }
  await new Promise((r) => setTimeout(r, 500))
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const shot = (name, opts = {}) => page.screenshot({ path: path.join(EVIDENCE, `sample-${name}.png`), fullPage: true, ...opts })

try {
  // Dashboard
  await page.goto(`${URL}/`)
  await page.getByRole('heading', { name: 'Calibration status' }).waitFor()
  await shot('01-dashboard')
  const overdueKpi = await page.locator('.kpi-tile').first().innerText()
  check('DASH-KPI', /Overdue/.test(overdueKpi), `first KPI tile: ${overdueKpi.replace(/\n/g, ' ')}`)
  const overdueRows = await page.locator('section:has(#overdue-heading) .due-row').count()
  check('DASH-OVERDUE-LIST', overdueRows >= 3, `${overdueRows} overdue rows listed`)

  // Instruments + filters
  await page.getByRole('link', { name: 'Instruments' }).click()
  await page.getByRole('heading', { name: 'Instruments', exact: true }).waitFor()
  await shot('02-instruments')
  const total = await page.locator('tbody tr').count()
  await page.locator('#search').fill('PG-')
  const afterSearch = await page.locator('tbody tr').count()
  check('LIST-SEARCH', afterSearch < total && afterSearch >= 4, `search "PG-": ${total} → ${afterSearch} rows`)
  await page.locator('#search').fill('')
  await page.locator('#filter-due').selectOption('overdue')
  const afterDue = await page.locator('tbody tr').count()
  check('LIST-DUE-FILTER', afterDue >= 3 && afterDue < total, `overdue filter: ${afterDue} rows`)
  await shot('03-instruments-filtered')
  await page.locator('#filter-due').selectOption('all')

  // Detail + log calibration on the worst overdue instrument
  await page.getByRole('link', { name: 'PG-0107' }).click()
  await page.getByRole('heading', { name: /PG-0107/ }).waitFor()
  await shot('04-detail-overdue')
  const callout = await page.locator('.due-callout').innerText()
  check('DETAIL-OVERDUE-TEXT', /Overdue by \d+ days/.test(callout), `callout: ${callout.split('\n')[0]}`)

  const historyBefore = await page.locator('tbody tr').count()
  await page.locator('#cal-tech').fill('tw')
  await page.locator('#cal-result').selectOption('pass')
  await page.locator('#cal-note').fill('As-found within tolerance; full-range check complete.')
  await page.getByRole('button', { name: 'Record calibration' }).click()
  await page.locator('.status-success').waitFor()
  const historyAfter = await page.locator('tbody tr').count()
  check('LOG-CAL', historyAfter === historyBefore + 1, `history rows ${historyBefore} → ${historyAfter}`)
  const calloutAfter = await page.locator('.due-callout').innerText()
  check('LOG-CAL-RECALC', !/Overdue/.test(calloutAfter), `callout now: ${calloutAfter.split('\n')[0]}`)
  await shot('05-detail-after-log')

  // Validation: empty + duplicate tag
  await page.goto(`${URL}/#/instruments/new`)
  await page.getByRole('heading', { name: 'New instrument' }).waitFor()
  await shot('06-new-form')
  await page.getByRole('button', { name: 'Create instrument' }).click()
  await page.locator('.validation-summary').waitFor()
  check('FORM-VALIDATION', true, (await page.locator('.validation-summary').innerText()).replace(/\n/g, ' | ').slice(0, 90))
  await shot('07-form-validation')

  await page.locator('#f-tag').fill('PG-0107')
  await page.locator('#f-name').fill('Test gauge')
  await page.locator('#f-location').fill('Bldg 9')
  await page.getByRole('button', { name: 'Create instrument' }).click()
  await page.locator('.validation-summary').waitFor()
  const dupText = await page.locator('.validation-summary').innerText()
  check('FORM-DUP-TAG', /already in use/.test(dupText), dupText.replace(/\n/g, ' | ').slice(0, 90))

  // Create a real one, then keyboard check
  await page.locator('#f-tag').fill('PG-0161')
  await page.locator('#f-name').fill('Compound gauge -100–300 kPa')
  await page.locator('#f-location').fill('Bldg 1 · Test cell B')
  await page.getByRole('button', { name: 'Create instrument' }).click()
  await page.getByRole('heading', { name: /PG-0161/ }).waitFor()
  check('CREATE-FLOW', true, 'created PG-0161 and landed on its detail view')
  await shot('08-created-detail')

  // Persistence probe: instrument list from API contains the new record
  const api = await (await fetch(`${URL}/api/instruments`)).json()
  check('PERSIST', api.instruments.some((i) => i.assetTag === 'PG-0161'), `${api.instruments.length} instruments in store`)

  // Keyboard: tab to skip link
  await page.goto(`${URL}/`)
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => document.activeElement?.className ?? '')
  check('A11Y-SKIP-LINK', focused.includes('skip-link'), `first tab stop: ${focused}`)

  console.log(JSON.stringify({ checks }, null, 2))
} finally {
  await browser.close()
  try { process.kill(-server.pid) } catch { /* gone */ }
}
