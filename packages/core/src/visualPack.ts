/**
 * Visual reference pack builder.
 *
 * Produces the single-page landscape `visual-reference-pack.pdf` from an
 * approved mockup image plus task labels, mirroring the Phase 2 handcrafted
 * layout (`trials/vertical-slice-01/phase-2/source/visual-reference-pack.html`).
 *
 * PDF rendering uses Playwright's bundled Chromium via dynamic import so the
 * core library has no hard Playwright dependency; callers without Playwright
 * can still generate the HTML source and print it themselves.
 */

import fs from 'node:fs'
import path from 'node:path'

export type VisualPackInput = {
  packetId: string
  screenLabel: string
  sourceImagePath: string
  standardsPackage: string
  standardsVersion: string
  acceptanceSummary: string[]
  applicableComponentIds: string[]
  calibrationNote?: string
}

const DEFAULT_CALIBRATION_NOTE =
  'This page is app-specific visual calibration. It is not an exhaustive component catalog or a pixel contract.'

export function buildVisualPackHtml(input: VisualPackInput): string {
  const imageData = fs.readFileSync(input.sourceImagePath)
  const ext = path.extname(input.sourceImagePath).replace('.', '') || 'jpeg'
  const dataUri = `data:image/${ext};base64,${imageData.toString('base64')}`
  const note = input.calibrationNote ?? DEFAULT_CALIBRATION_NOTE

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Visual Reference Pack — ${escapeHtml(input.packetId)}</title>
<style>
  @page { size: 960px 540px; margin: 0; }
  html, body { margin: 0; padding: 0; width: 960px; height: 540px; background: #07111f; color: #f8fafc;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .page { display: grid; grid-template-columns: 640px 1fr; gap: 16px; padding: 20px; box-sizing: border-box; height: 100%; }
  .image-panel { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .image-panel img { width: 100%; height: auto; max-height: 430px; object-fit: contain; border: 1px solid rgba(148,163,184,0.18); border-radius: 8px; }
  h1 { font-size: 18px; margin: 0; font-weight: 600; }
  .label { font-size: 12px; color: #cbd5e1; }
  .meta-panel { font-size: 11px; line-height: 1.5; color: #cbd5e1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .meta-panel h2 { font-size: 12px; color: #f8fafc; margin: 0 0 4px; font-weight: 600; }
  .meta-panel ul { margin: 0; padding-left: 16px; }
  code { font-family: "JetBrains Mono", Consolas, monospace; font-size: 10px; color: #94a3b8; }
  .note { border: 1px solid rgba(148,163,184,0.34); border-radius: 8px; padding: 8px; color: #fbbf24; }
</style>
</head>
<body>
<div class="page">
  <div class="image-panel">
    <h1>${escapeHtml(input.screenLabel)}</h1>
    <p class="label">Packet <code>${escapeHtml(input.packetId)}</code> · Standards <code>${escapeHtml(input.standardsPackage)} ${escapeHtml(input.standardsVersion)}</code> · Source <code>${escapeHtml(path.basename(input.sourceImagePath))}</code></p>
    <img src="${dataUri}" alt="Approved mockup: ${escapeHtml(input.screenLabel)}" />
  </div>
  <div class="meta-panel">
    <div>
      <h2>Acceptance summary</h2>
      <ul>${input.acceptanceSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>
    <div>
      <h2>Applicable components</h2>
      <ul>${input.applicableComponentIds.map((id) => `<li><code>${escapeHtml(id)}</code></li>`).join('')}</ul>
    </div>
    <div class="note">${escapeHtml(note)}</div>
  </div>
</div>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Render the pack HTML to a one-page landscape PDF. Requires `playwright`
 * to be resolvable from the caller's environment.
 */
export async function renderVisualPackPdf(html: string, outputPdfPath: string): Promise<void> {
  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    throw new Error(
      "PDF rendering requires the optional 'playwright' package. Install it, or use buildVisualPackHtml() and print the HTML to PDF manually.",
    )
  }
  const browser = await playwright.chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true })
    await page.pdf({ path: outputPdfPath, width: '960px', height: '540px', printBackground: true, pageRanges: '1' })
  } finally {
    await browser.close()
  }
}
