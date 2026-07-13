/**
 * Validate F28/F28b/F28c: the embedded app preview auto-renders inside the
 * review panel with no preview button, and the <webview> guest fills the
 * frame — regression check for the `display: block` short-paint cutoff where
 * only the top strip of the app ever rendered.
 */

import { launchWorkbench } from './driver.mjs'

const results = []
const record = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const { app, page, shot } = await launchWorkbench()
await page.getByRole('heading', { name: 'Copilot Handoff Hub' }).waitFor()
await page.getByRole('button', { name: /^Continue/ }).first().click()
await page.getByRole('heading', { name: 'Test' }).waitFor()

// The preview must appear on its own — no clicks past this point.
const webview = page.locator('webview.app-preview-frame')
await webview.waitFor({ state: 'visible', timeout: 120_000 })
await webview.scrollIntoViewIfNeeded()
await page.waitForTimeout(3_000) // let the guest attach and paint

const box = await webview.boundingBox()
const guest = await app.evaluate(async ({ webContents }) => {
  const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
  if (!wc) return null
  return wc.executeJavaScript(
    '({ w: window.innerWidth, h: window.innerHeight, sh: document.documentElement.scrollHeight, url: location.href })',
  )
})

record('AUTO-PREVIEW-GUEST', Boolean(guest), guest ? `guest loaded ${guest.url} with zero clicks` : 'no webview guest attached')
if (guest && box) {
  const fills = Math.abs(guest.w - box.width) <= 4 && Math.abs(guest.h - box.height) <= 4
  record('GUEST-FILLS-FRAME', fills, `guest viewport ${guest.w}x${guest.h} vs frame ${Math.round(box.width)}x${Math.round(box.height)}`)
  record('FRAME-USEFUL-HEIGHT', box.height >= 420, `frame height ${Math.round(box.height)}px (>= 420px floor)`)
}

// The guest must sit inside explicit chrome — a visible shell boundary and a
// raised header strip — never blended seamlessly into the workbench panel.
const chrome = await page.evaluate(() => {
  const shell = document.querySelector('.app-preview-shell')
  const bar = document.querySelector('.app-preview-chrome')
  const panel = shell?.closest('section.panel')
  if (!shell || !bar || !panel) return null
  const s = getComputedStyle(shell)
  const b = getComputedStyle(bar)
  const p = getComputedStyle(panel)
  return {
    borderWidth: s.borderTopWidth,
    borderColor: s.borderTopColor,
    barBg: b.backgroundColor,
    panelBg: p.backgroundColor,
    barRule: b.borderBottomWidth,
  }
})
record(
  'GUEST-DEMARCATED',
  Boolean(chrome) && parseFloat(chrome.borderWidth) >= 1 && parseFloat(chrome.barRule) >= 1 && chrome.barBg !== chrome.panelBg,
  chrome
    ? `shell border ${chrome.borderWidth} ${chrome.borderColor}; chrome bar bg ${chrome.barBg} vs panel ${chrome.panelBg}`
    : 'shell/chrome elements missing',
)

const inPanel = await page.locator('section.panel:has(#review-cockpit-heading) .app-preview').count()
record('IN-REVIEW-PANEL', inPanel === 1, `preview regions inside the review cockpit panel: ${inPanel}`)
const previewButtons = await page.getByRole('button', { name: /preview/i }).count()
record('NO-PREVIEW-BUTTON', previewButtons === 0, `buttons mentioning "preview": ${previewButtons}`)

await shot('embedded-preview-guest-fill')
await app.close()

console.log(JSON.stringify({ results }))
if (results.some((r) => !r.pass)) process.exitCode = 1
