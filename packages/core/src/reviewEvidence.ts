/**
 * Review packet v2 — evidence contact sheet (PRD roadmap R2).
 *
 * Builds the visual half of a review packet: for every target view, the
 * captured BEFORE and AFTER screenshots side by side, held against the task
 * packet's acceptance criteria, plus the changed-file list and any rendered
 * element losses. Output is a multi-page landscape PDF rendered with the same
 * optional-Playwright contract as `visualPack.ts`; callers without Playwright
 * can still generate the HTML and print it manually.
 *
 * Upload set stays within the strict 3-file Copilot budget:
 * `review-packet.md` + `review-evidence.pdf` + `changes.zip`.
 */

import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import type { ElementLoss } from './fidelity.js'

export type ReviewSheetView = {
  id: string
  label: string
  path: string
  /** Absolute paths to captured PNGs; embedded as data URIs when present. */
  beforePng?: string
  afterPng?: string
  /** Rendered census losses between the two captures (empty = none). */
  losses?: ElementLoss[]
  captureError?: string
}

export type ReviewSheetInput = {
  runId: string
  projectName: string
  taskTitle: string
  acceptanceCriteria: string
  standardsPackage: string
  standardsVersion: string
  generatedAt: string
  views: ReviewSheetView[]
  changedFiles: { relativePath: string; action: string; sizeBytes?: number }[]
  verificationSummary?: string
  reviewerNotes?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function imgDataUri(absolutePath: string): string {
  const data = fs.readFileSync(absolutePath)
  const ext = path.extname(absolutePath).replace('.', '') || 'png'
  return `data:image/${ext};base64,${data.toString('base64')}`
}

function pane(title: string, png: string | undefined, emptyText: string): string {
  const body = png
    ? `<img src="${imgDataUri(png)}" alt="${escapeHtml(title)}" />`
    : `<div class="missing">${escapeHtml(emptyText)}</div>`
  return `<figure class="pane"><figcaption>${escapeHtml(title)}</figcaption>${body}</figure>`
}

export function buildReviewContactSheetHtml(input: ReviewSheetInput): string {
  const lossRows = input.views
    .filter((v) => (v.losses?.length ?? 0) > 0)
    .map((v) => `<li><strong>${escapeHtml(v.label)}</strong>: ${escapeHtml(v.losses!.map((l) => `${l.element} ${l.before}→${l.after}`).join(', '))}</li>`)
    .join('')

  const changedRows = input.changedFiles
    .map((f) => `<tr><td><code>${escapeHtml(f.relativePath)}</code></td><td>${escapeHtml(f.action)}</td><td class="num">${f.sizeBytes ?? ''}</td></tr>`)
    .join('')

  const viewPages = input.views
    .map(
      (view) => `
<section class="sheet view-sheet">
  <header>
    <h2>${escapeHtml(view.label)} <code>${escapeHtml(view.path)}</code></h2>
    <span class="run-ref">Run <code>${escapeHtml(input.runId)}</code></span>
  </header>
  ${view.captureError ? `<p class="alert">Capture problem: ${escapeHtml(view.captureError)}</p>` : ''}
  <div class="pair">
    ${pane('Before (baseline)', view.beforePng, 'No baseline captured for this view')}
    ${pane('After (applied overlay)', view.afterPng, 'No post-apply capture for this view')}
  </div>
  ${
    view.losses && view.losses.length > 0
      ? `<p class="alert">Element loss detected: ${escapeHtml(view.losses.map((l) => `${l.element} ${l.before}→${l.after}`).join(', '))}</p>`
      : `<p class="ok-line">No rendered element loss detected on this view.</p>`
  }
</section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Review Evidence — ${escapeHtml(input.runId)}</title>
<style>
  @page { size: 1123px 794px; margin: 0; }
  html, body { margin: 0; padding: 0; background: #07111f; color: #f8fafc;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  code { font-family: "JetBrains Mono", Consolas, monospace; font-size: 11px; color: #94a3b8; }
  .sheet { width: 1123px; height: 794px; box-sizing: border-box; padding: 28px 32px; page-break-after: always; display: flex; flex-direction: column; gap: 14px; }
  .sheet:last-child { page-break-after: auto; }
  h1 { font-size: 22px; margin: 0; font-weight: 650; }
  h2 { font-size: 16px; margin: 0; font-weight: 600; }
  h3 { font-size: 12px; margin: 0 0 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-bottom: 1px solid rgba(148,163,184,0.24); padding-bottom: 10px; }
  .meta { font-size: 12px; color: #cbd5e1; }
  .cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; flex: 1; min-height: 0; }
  .block { border: 1px solid rgba(148,163,184,0.18); border-radius: 10px; padding: 14px; overflow: hidden; }
  .block p, .block li { font-size: 12px; line-height: 1.55; color: #e2e8f0; }
  .block ul { margin: 0; padding-left: 18px; }
  table { border-collapse: collapse; width: 100%; font-size: 11.5px; }
  th { text-align: left; text-transform: uppercase; letter-spacing: 0.07em; font-size: 10px; color: #94a3b8; padding: 4px 8px 6px 0; border-bottom: 1px solid rgba(148,163,184,0.24); }
  td { padding: 5px 8px 5px 0; border-bottom: 1px solid rgba(148,163,184,0.12); color: #e2e8f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; color: #94a3b8; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1; min-height: 0; }
  .pane { margin: 0; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .pane figcaption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .pane img { width: 100%; max-height: 560px; object-fit: contain; object-position: top; border: 1px solid rgba(148,163,184,0.22); border-radius: 8px; background: #0f172a; }
  .missing { border: 1px dashed rgba(148,163,184,0.34); border-radius: 8px; padding: 24px; color: #94a3b8; font-size: 12px; flex: 1; display: flex; align-items: center; justify-content: center; }
  .alert { border: 1px solid rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); color: #fca5a5; border-radius: 8px; padding: 8px 12px; font-size: 12px; margin: 0; }
  .ok-line { color: #34d399; font-size: 12px; margin: 0; }
  .run-ref { font-size: 11px; color: #94a3b8; white-space: nowrap; }
  .pre { white-space: pre-wrap; }
</style>
</head>
<body>
<section class="sheet">
  <header>
    <h1>Review Evidence — ${escapeHtml(input.taskTitle)}</h1>
    <span class="run-ref">Generated ${escapeHtml(input.generatedAt)}</span>
  </header>
  <p class="meta">Project <code>${escapeHtml(input.projectName)}</code> · Run <code>${escapeHtml(input.runId)}</code> · Standards <code>${escapeHtml(input.standardsPackage)} ${escapeHtml(input.standardsVersion)}</code> · ${input.views.length} target view${input.views.length === 1 ? '' : 's'}</p>
  <div class="cover-grid">
    <div class="block">
      <h3>Acceptance criteria under review</h3>
      <p class="pre">${escapeHtml(input.acceptanceCriteria)}</p>
    </div>
    <div class="block">
      <h3>Changed files (${input.changedFiles.length})</h3>
      <table>
        <thead><tr><th>File</th><th>Action</th><th>Bytes</th></tr></thead>
        <tbody>${changedRows || '<tr><td colspan="3">No applied files recorded.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="block">
      <h3>Rendered element losses</h3>
      ${lossRows ? `<ul>${lossRows}</ul>` : '<p>None detected across captured views.</p>'}
    </div>
    <div class="block">
      <h3>Verification &amp; reviewer notes</h3>
      <p class="pre">${escapeHtml(input.verificationSummary ?? 'No verification summary recorded.')}</p>
      ${input.reviewerNotes ? `<p class="pre">${escapeHtml(input.reviewerNotes)}</p>` : ''}
    </div>
  </div>
</section>
${viewPages}
</body>
</html>`
}

/**
 * Render the contact sheet to a multi-page landscape PDF. Requires the
 * optional `playwright` package (same contract as `renderVisualPackPdf`).
 */
export async function renderReviewContactSheetPdf(html: string, outputPdfPath: string): Promise<void> {
  let playwright: typeof import('playwright')
  try {
    playwright = await import('playwright')
  } catch {
    throw new Error(
      "PDF rendering requires the optional 'playwright' package. Install it, or use buildReviewContactSheetHtml() and print the HTML manually.",
    )
  }
  const browser = await playwright.chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true })
    await page.pdf({ path: outputPdfPath, width: '1123px', height: '794px', printBackground: true })
  } finally {
    await browser.close()
  }
}

/**
 * Bundle the applied changed files from the target repo into `changes.zip`
 * (third file of the review upload set). Missing files are skipped and
 * reported so a partially reverted tree cannot silently produce a hollow zip.
 */
export function buildChangesZip(
  targetRoot: string,
  files: { relativePath: string }[],
  outputZipPath: string,
): { added: string[]; missing: string[] } {
  const zip = new AdmZip()
  const added: string[] = []
  const missing: string[] = []
  for (const file of files) {
    const absolute = path.resolve(targetRoot, file.relativePath)
    if (!fs.existsSync(absolute)) {
      missing.push(file.relativePath)
      continue
    }
    zip.addFile(file.relativePath, fs.readFileSync(absolute))
    added.push(file.relativePath)
  }
  fs.mkdirSync(path.dirname(outputZipPath), { recursive: true })
  zip.writeZip(outputZipPath)
  return { added, missing }
}
