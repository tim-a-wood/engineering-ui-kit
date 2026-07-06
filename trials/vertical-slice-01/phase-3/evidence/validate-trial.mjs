import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5199/'
const EVIDENCE = process.argv[2]
fs.mkdirSync(EVIDENCE, { recursive: true })

const results = []
function record(id, pass, detail) {
  results.push({ id, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
const page = await context.newPage()

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
const externalRequests = []
page.on('request', (r) => {
  const u = new URL(r.url())
  if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') externalRequests.push(r.url())
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(EVIDENCE, 'p3-01-initial.png'), fullPage: true })

// TRIAL-AC-002 launch + render
const h1 = await page.textContent('h1')
record('TRIAL-AC-002', h1?.trim() === 'Create Task Packet' && consoleErrors.length === 0,
  `h1="${h1?.trim()}", consoleErrors=${consoleErrors.length}`)

// TRIAL-AC-005 dark-first shell
const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
record('TRIAL-AC-005', bodyBg === 'rgb(7, 17, 31)', `body background=${bodyBg} (expect canvas #07111f)`)

// TRIAL-AC-009 tokens as CSS custom properties
const tokenProbe = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement)
  return {
    canvas: cs.getPropertyValue('--semantic-surface-canvas').trim(),
    accent: cs.getPropertyValue('--semantic-accent-primary').trim(),
    focus: cs.getPropertyValue('--semantic-focus-ring').trim(),
  }
})
record('TRIAL-AC-009', tokenProbe.canvas === '#07111f' && tokenProbe.accent === '#22d3ee' && tokenProbe.focus.length > 0,
  JSON.stringify(tokenProbe))

// TRIAL-AC-006 stepper: five named steps + current state
const steps = await page.$$eval('.workflow-step', (els) => els.map((el) => ({
  name: el.querySelector('.workflow-name')?.textContent?.trim(),
  state: el.className,
  stateLabel: el.querySelector('.workflow-state')?.textContent?.trim(),
})))
const expectedSteps = ['Prepare Context', 'Create Task Packet', 'Run in Copilot', 'Apply Zip Overlay', 'Verify & Review']
const stepNamesOk = steps.map((s) => s.name).join('|') === expectedSteps.join('|')
const currentOk = steps.filter((s) => s.state.includes('current')).length === 1 &&
  steps[1].state.includes('current') && steps[1].stateLabel === 'Current'
record('TRIAL-AC-006', stepNamesOk && currentOk, `steps=${JSON.stringify(steps.map((s) => `${s.name}:${s.stateLabel}`))}`)

// PB1/PB2: Edit reveals labeled prefilled textarea; Save commits
const goalRow = page.locator('.section-row', { hasText: 'Goal' }).first()
const originalGoal = (await goalRow.locator('.section-value').textContent())?.trim()
await goalRow.getByRole('button', { name: /Edit/ }).click()
const textarea = page.locator('textarea#section-goal')
const label = page.locator('label[for="section-goal"]')
const labelText = (await label.textContent())?.trim()
const prefilled = await textarea.inputValue()
record('PB-1', (await textarea.isVisible()) && labelText === 'Goal' && prefilled === originalGoal,
  `label="${labelText}", prefilled matches committed value=${prefilled === originalGoal}`)
await page.screenshot({ path: path.join(EVIDENCE, 'p3-02-editing.png'), fullPage: true })

const newGoal = 'Updated goal text for qualitative trial validation.'
await textarea.fill(newGoal)
await goalRow.getByRole('button', { name: 'Save' }).click()
const savedGoal = (await goalRow.locator('.section-value').textContent())?.trim()
const statusAfterSave = (await page.locator('.status').textContent())?.trim()
record('PB-2', savedGoal === newGoal && /saved/i.test(statusAfterSave ?? ''),
  `saved value committed=${savedGoal === newGoal}, status="${statusAfterSave}"`)

// PB3: Cancel restores previous value
await goalRow.getByRole('button', { name: /Edit/ }).click()
await textarea.fill('This draft should be discarded.')
await goalRow.getByRole('button', { name: 'Cancel' }).click()
const afterCancel = (await goalRow.locator('.section-value').textContent())?.trim()
record('PB-3', afterCancel === newGoal, `value after cancel="${afterCancel?.slice(0, 40)}..." unchanged=${afterCancel === newGoal}`)

// PB4 + TRIAL-AC-012: empty required section -> visible textual validation
const scopeRow = page.locator('.section-row', { hasText: 'Scope' }).first()
await scopeRow.getByRole('button', { name: /Edit/ }).click()
await page.locator('textarea#section-scope').fill('')
await scopeRow.getByRole('button', { name: 'Save' }).click()
await page.getByRole('button', { name: 'Preview Task Packet' }).click()
const summaryVisible = await page.locator('.validation-summary').isVisible()
const summaryText = (await page.locator('.validation-summary').textContent()) ?? ''
const fieldError = (await scopeRow.locator('.field-error').textContent()) ?? ''
const dialogBlocked = !(await page.locator('[role="dialog"]').count())
record('PB-4', summaryVisible && /Scope/.test(summaryText) && dialogBlocked,
  `summary visible=${summaryVisible}, mentions Scope=${/Scope/.test(summaryText)}, preview blocked=${dialogBlocked}`)
record('TRIAL-AC-012', /Error:/.test(fieldError) && /Validation blockers/.test(summaryText),
  `field error text="${fieldError.trim().slice(0, 60)}", summary heading present=${/Validation blockers/.test(summaryText)}`)
await page.screenshot({ path: path.join(EVIDENCE, 'p3-03-validation.png'), fullPage: true })

// restore scope content
await scopeRow.getByRole('button', { name: /Edit/ }).click()
await page.locator('textarea#section-scope').fill('Restored scope content for preview and export checks.')
await scopeRow.getByRole('button', { name: 'Save' }).click()

// PB5 + TRIAL-AC-008: preview shows current values in accessible dialog
await page.getByRole('button', { name: 'Preview Task Packet' }).click()
const dialog = page.locator('[role="dialog"]')
const dialogAria = await dialog.evaluate((el) => ({
  modal: el.getAttribute('aria-modal'),
  labelledby: !!el.getAttribute('aria-labelledby'),
}))
const previewText = (await dialog.locator('.preview-content').textContent()) ?? ''
const previewOk = previewText.includes(newGoal) && previewText.includes('Restored scope content')
const headingsInPreview = ['## Goal', '## Scope', '## Constraints', '## Acceptance Criteria', '## References']
  .every((h) => previewText.includes(h))
record('PB-5', (await dialog.isVisible()) && dialogAria.modal === 'true' && dialogAria.labelledby && previewOk,
  `dialog aria-modal=${dialogAria.modal}, labelled=${dialogAria.labelledby}, current values shown=${previewOk}`)
record('TRIAL-AC-008', previewOk && headingsInPreview, `five headings in preview=${headingsInPreview}`)
await page.screenshot({ path: path.join(EVIDENCE, 'p3-04-preview-dialog.png'), fullPage: true })

// focus containment probe: initial focus on Close
const focusOnClose = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Close')

// PB6: Escape dismisses and returns focus to Preview control
await page.keyboard.press('Escape')
await page.waitForTimeout(120)
const dialogGone = (await page.locator('[role="dialog"]').count()) === 0
const focusAfterEsc = await page.evaluate(() => document.activeElement?.textContent?.trim())
record('PB-6', dialogGone && focusAfterEsc === 'Preview Task Packet',
  `dialog dismissed=${dialogGone}, focus returned to="${focusAfterEsc}", initial dialog focus on Close=${focusOnClose}`)

// PB7: Close button dismisses and returns focus
await page.getByRole('button', { name: 'Preview Task Packet' }).click()
await dialog.getByRole('button', { name: 'Close' }).click()
await page.waitForTimeout(120)
const focusAfterClose = await page.evaluate(() => document.activeElement?.textContent?.trim())
record('PB-7', (await page.locator('[role="dialog"]').count()) === 0 && focusAfterClose === 'Preview Task Packet',
  `focus returned to="${focusAfterClose}"`)

// PB8/PB9: export downloads task-packet.md with five headings
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export Task Packet' }).click(),
])
const suggested = download.suggestedFilename()
const exportPath = path.join(EVIDENCE, 'exported-task-packet.md')
await download.saveAs(exportPath)
const exported = fs.readFileSync(exportPath, 'utf8')
const headingsOk = ['## Goal', '## Scope', '## Constraints', '## Acceptance Criteria', '## References']
  .every((h) => exported.includes(h))
record('PB-8', suggested === 'task-packet.md', `download filename="${suggested}"`)
record('PB-9', headingsOk && exported.includes(newGoal), `five headings=${headingsOk}, current goal in export=${exported.includes(newGoal)}`)

// PB10: no external network or filesystem access
record('PB-10', externalRequests.length === 0, `external requests=${JSON.stringify(externalRequests)}`)

// TRIAL-AC-010/011: keyboard traversal and visible focus indicators
await page.keyboard.press('Escape')
const focusProbes = []
await page.evaluate(() => { document.querySelector(".nav-item")?.focus() })
for (let i = 0; i < 25; i++) {
  const probe = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const cs = getComputedStyle(el)
    return {
      text: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30),
      tag: el.tagName,
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      boxShadow: cs.boxShadow !== 'none',
    }
  })
  if (probe) focusProbes.push(probe)
  await page.keyboard.press('Tab')
}
const interactive = focusProbes.filter((p) => ['BUTTON', 'A', 'TEXTAREA', 'INPUT'].includes(p.tag))
const allVisible = interactive.length >= 8 && interactive.every((p) => p.outline || p.boxShadow)
record('TRIAL-AC-010', interactive.length >= 8, `keyboard reached ${interactive.length} interactive controls`)
record('TRIAL-AC-011', allVisible, `all focused controls show outline/ring=${allVisible}`)

// focus-visible screenshot
await page.evaluate(() => { document.querySelector(".section-edit")?.focus() })
await page.keyboard.press('Shift+Tab')
await page.keyboard.press('Tab')
await page.screenshot({ path: path.join(EVIDENCE, 'p3-05-focus-visible.png'), fullPage: false })

// TRIAL-AC-013 drift checks: no light backgrounds, no neon glow spam
const drift = await page.evaluate(() => {
  const light = []
  for (const el of Array.from(document.querySelectorAll('main *, aside *')).slice(0, 400)) {
    const bg = getComputedStyle(el).backgroundColor
    const m = bg.match(/rgba?\((\d+), (\d+), (\d+)/)
    if (m && Number(m[1]) > 200 && Number(m[2]) > 200 && Number(m[3]) > 200) light.push(bg)
  }
  return { lightSurfaces: light.length }
})
record('TRIAL-AC-013', drift.lightSurfaces === 0, `light-mode surfaces detected=${drift.lightSurfaces}`)

fs.writeFileSync(path.join(EVIDENCE, 'qualitative-validation-results.json'), JSON.stringify({ results, consoleErrors, externalRequests, generatedAt: new Date().toISOString() }, null, 2))
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
