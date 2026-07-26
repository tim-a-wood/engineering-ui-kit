/**
 * Generates the bundled DO-178C sample's original screenshot and structured
 * evidence artifacts. The screenshots are captures of a deterministic,
 * explicitly synthetic Audit Hub fixture—not illustrations or placeholder
 * cards—and every file is hashed into the core manifest consumed by the
 * immutable sample runs.
 *
 * Run from the repository root after building @engineering-ui-kit/core:
 *   node apps/gui/scripts/generate-sample-evidence.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright'
import { buildSampleAuditHub } from '../../../packages/core/dist/capabilities/design/sampleAuditHub.js'

const root = process.cwd()
const publicRoot = path.join(root, 'apps/gui/public/sample-evidence')
const screenshotRoot = path.join(publicRoot, 'screenshots')
const structuredRoot = path.join(publicRoot, 'structured')
const manifestPath = path.join(root, 'packages/core/src/capabilities/design/sampleEvidenceManifest.ts')

fs.mkdirSync(screenshotRoot, { recursive: true })
fs.mkdirSync(structuredRoot, { recursive: true })

const sample = buildSampleAuditHub()
const scenarioById = new Map(sample.scenarioTestPlan.entries.map((entry) => [entry.scenarioId, entry]))
const artifacts = {}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function safeFileStem(stepId, index) {
  const suffix = stepId.split('.').at(-1)?.replace(/[^a-z0-9-]/gi, '-') || 'step'
  const identity = sha256(Buffer.from(stepId)).slice(0, 12)
  return `${String(index + 1).padStart(2, '0')}-${suffix}-${identity}`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function activeArea(action) {
  const value = action.toLowerCase()
  if (value.includes('export') || value.includes('package')) return 'Exports'
  if (value.includes('baseline') || value.includes('revision')) return 'Baselines'
  if (value.includes('trace') || value.includes('evidence')) return 'Traceability'
  if (value.includes('verify') || value.includes('test')) return 'Verification'
  return 'Audit overview'
}

function fixtureHtml({ scenarioName, scenarioKind, step, outcome, runId, completedAt }) {
  const area = activeArea(step.action)
  const areas = ['Audit overview', 'Traceability', 'Baselines', 'Verification', 'Exports']
  const activity = [
    ['HLR-042', 'Flight-control monitor', 'Verified', 'MC/DC + review'],
    ['LLR-118', 'Sensor disagreement rule', 'Verified', 'Unit + integration'],
    ['LLR-204', 'Export package signing', outcome === 'failed' ? 'Attention' : 'Verified', 'Procedure + checksum'],
    ['OBJ-031', 'Limit protection path', 'Verified', 'Structural coverage'],
  ]
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box} body{margin:0;background:#eef2f6;color:#182230;font:14px/1.45 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .app{width:1280px;height:800px;display:grid;grid-template-columns:224px 1fr;overflow:hidden}
  aside{background:#101c2d;color:#c9d5e5;padding:24px 18px;display:flex;flex-direction:column}
  .brand{display:flex;align-items:center;gap:11px;color:#fff;font-weight:720;font-size:16px;margin:0 8px 30px}
  .brand i{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#5b79ff;color:white;font-style:normal}
  .label{margin:0 10px 9px;color:#778ba7;font-size:10px;font-weight:750;letter-spacing:.13em;text-transform:uppercase}
  nav{display:grid;gap:5px} nav div{padding:10px 12px;border-radius:8px} nav .active{background:#21334c;color:#fff;box-shadow:inset 3px 0 #7e96ff}
  nav span{float:right;color:#7f93ae;font-size:12px}.sample{margin-top:auto;border:1px solid #30445f;border-radius:10px;padding:12px;color:#a9bad0;font-size:12px}.sample b{display:block;color:#dfe8f4;margin-bottom:3px}
  main{display:grid;grid-template-rows:auto auto 1fr;min-width:0;overflow:hidden}
  header{height:82px;background:#fff;border-bottom:1px solid #dce3eb;padding:18px 28px;display:flex;align-items:center;justify-content:space-between}
  header h1{font-size:20px;line-height:1.2;margin:2px 0 0} header p{margin:0;color:#677485;font-size:12px}.tag{display:inline-flex;align-items:center;gap:7px;border:1px solid #dce3eb;border-radius:999px;padding:7px 11px;color:#435168;font-weight:650}.tag:before{content:"";width:7px;height:7px;border-radius:50%;background:#2fbe83}
  .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px 28px 0}.metric{background:#fff;border:1px solid #dce3eb;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px #14213d0a}.metric b{display:block;font-size:22px}.metric span{color:#6b7889;font-size:12px}.metric em{float:right;color:#15936a;font-style:normal;font-size:11px;font-weight:700}
  .content{min-height:0;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:18px;padding:18px 28px 26px}.panel{background:#fff;border:1px solid #dce3eb;border-radius:13px;box-shadow:0 4px 14px #14213d0a;min-height:0;overflow:hidden}
  .panel-head{padding:16px 18px;border-bottom:1px solid #e6ebf0;display:flex;justify-content:space-between;align-items:center}.panel-head h2{margin:0;font-size:15px}.panel-head span{color:#718094;font-size:11px}.scenario{padding:18px}.kind{display:inline-block;padding:4px 8px;border-radius:999px;background:#eef1ff;color:#4a61ce;font-size:10px;font-weight:760;text-transform:uppercase;letter-spacing:.07em}.scenario h3{font-size:18px;margin:10px 0 4px}.scenario>p{color:#6a7788;margin:0 0 16px}
  .step{border:1px solid ${outcome === 'failed' ? '#e7a6aa' : '#b9c7ff'};background:${outcome === 'failed' ? '#fff6f6' : '#f7f8ff'};border-radius:11px;padding:15px}.step-line{display:flex;gap:12px}.step-num{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:${outcome === 'failed' ? '#c93d4a' : '#526eea'};color:#fff;font-weight:750;flex:0 0 auto}.step h4{margin:1px 0 6px;font-size:14px}.step p{margin:0;color:#526174}.expect{margin-top:12px;padding-top:12px;border-top:1px solid ${outcome === 'failed' ? '#f0cccc' : '#dfe4ff'}}.expect small{display:block;color:#788599;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:4px}.expect b{font-weight:650}
  table{width:100%;border-collapse:collapse;margin-top:17px;font-size:12px}th{text-align:left;color:#788599;font-weight:650;padding:8px;border-bottom:1px solid #e6ebf0}td{padding:9px 8px;border-bottom:1px solid #eef1f4}.status{font-weight:700;color:#168762}.attention{color:#ba3540}
  .right{display:grid;grid-template-rows:auto 1fr;gap:18px}.summary{padding:18px}.result{display:flex;align-items:center;gap:12px}.result i{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:${outcome === 'failed' ? '#fde7e9' : '#dcf7ed'};color:${outcome === 'failed' ? '#bb3440' : '#137c5b'};font-style:normal;font-size:20px}.result h3{margin:0;font-size:15px}.result p{margin:2px 0 0;color:#6d7a8c;font-size:12px}.facts{display:grid;grid-template-columns:100px 1fr;gap:9px;margin:18px 0 0}.facts dt{color:#7a8797}.facts dd{margin:0;font-weight:620;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .timeline{padding:17px 18px}.timeline h3{margin:0 0 15px;font-size:14px}.event{position:relative;padding:0 0 17px 24px;color:#657386;font-size:12px}.event:before{content:"";position:absolute;left:4px;top:4px;width:8px;height:8px;border-radius:50%;background:#6f86ef}.event:after{content:"";position:absolute;left:7px;top:15px;width:2px;height:calc(100% - 10px);background:#dfe5ec}.event:last-child:after{display:none}.event b{display:block;color:#344155;margin-bottom:2px}
  .watermark{position:absolute;right:26px;bottom:12px;color:#8090a2;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
</style>
</head>
<body>
<div class="app">
  <aside>
    <div class="brand"><i>AH</i> Assurance Hub</div>
    <p class="label">Lifecycle evidence</p>
    <nav>${areas.map((item) => `<div class="${item === area ? 'active' : ''}">${escapeHtml(item)}<span>${item === area ? '●' : '›'}</span></div>`).join('')}</nav>
    <div class="sample"><b>Synthetic sample workspace</b>Deterministic DO-178C fixture data. No production records.</div>
  </aside>
  <main>
    <header><div><p>Flight software assurance / Release R7</p><h1>${escapeHtml(area)}</h1></div><div class="tag">Baseline A-17 approved</div></header>
    <section class="metrics">
      <div class="metric"><em>+18</em><b>1,472</b><span>Trace links</span></div>
      <div class="metric"><em>99.3%</em><b>1,461</b><span>Verified links</span></div>
      <div class="metric"><b>11</b><span>Open review items</span></div>
      <div class="metric"><b>0</b><span>Blocking anomalies</span></div>
    </section>
    <section class="content">
      <article class="panel">
        <div class="panel-head"><h2>Scenario execution</h2><span>${escapeHtml(completedAt)}</span></div>
        <div class="scenario">
          <span class="kind">${escapeHtml(scenarioKind)}</span>
          <h3>${escapeHtml(scenarioName)}</h3>
          <p>Recorded against the approved use-case and system-design baseline.</p>
          <div class="step">
            <div class="step-line"><div class="step-num">✓</div><div><h4>${escapeHtml(step.action)}</h4><p>${escapeHtml(step.actualResult)}</p></div></div>
            <div class="expect"><small>Expected result</small><b>${escapeHtml(step.expectedResult)}</b></div>
          </div>
          <table>
            <thead><tr><th>Evidence item</th><th>Design allocation</th><th>Status</th><th>Basis</th></tr></thead>
            <tbody>${activity.map(([id, allocation, status, basis]) => `<tr><td><b>${id}</b></td><td>${allocation}</td><td class="status ${status === 'Attention' ? 'attention' : ''}">${status}</td><td>${basis}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </article>
      <div class="right">
        <article class="panel summary">
          <div class="result"><i>${outcome === 'failed' ? '!' : '✓'}</i><div><h3>${outcome === 'failed' ? 'Step needs attention' : 'Step passed'}</h3><p>Original fixture state captured</p></div></div>
          <dl class="facts"><dt>Build</dt><dd>build.2026.07.01-1</dd><dt>Scenario run</dt><dd>${escapeHtml(runId)}</dd><dt>Viewport</dt><dd>1280 × 800</dd><dt>Test data</dt><dd>fixtures-r1</dd></dl>
        </article>
        <article class="panel timeline">
          <h3>Lifecycle trace</h3>
          <div class="event"><b>Use case approved</b>Product lead · revision r1</div>
          <div class="event"><b>Design baseline approved</b>17 modules · contracts frozen</div>
          <div class="event"><b>Implementation verified</b>Build identity and source revision recorded</div>
          <div class="event"><b>Scenario step captured</b>Original PNG + structured result</div>
        </article>
      </div>
    </section>
  </main>
</div>
<div class="watermark">Synthetic fixture · original capture</div>
</body>
</html>`
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

let index = 0
for (const run of sample.scenarioRuns) {
  const scenarioEntry = scenarioById.get(run.scenarioId)
  for (const step of run.steps) {
    const stem = safeFileStem(step.stepId, index)
    index += 1
    const screenshotName = `${stem}.png`
    const structuredName = `${stem}.json`
    const screenshotPath = path.join(screenshotRoot, screenshotName)
    const structuredPath = path.join(structuredRoot, structuredName)
    const structured = {
      schemaVersion: '1.0',
      sample: true,
      fixture: 'DO-178C Audit Hub',
      runId: run.runId,
      scenarioId: run.scenarioId,
      scenarioName: scenarioEntry?.scenarioName ?? run.scenarioId,
      scenarioKind: scenarioEntry?.scenarioKind ?? 'main',
      stepId: step.stepId,
      action: step.action,
      expectedResult: step.expectedResult,
      actualResult: step.actualResult,
      outcome: step.outcome,
      startedAt: step.startedAt,
      endedAt: step.endedAt,
      identity: run.identity,
    }
    fs.writeFileSync(structuredPath, `${JSON.stringify(structured, null, 2)}\n`)
    await page.setContent(fixtureHtml({
      scenarioName: scenarioEntry?.scenarioName ?? run.scenarioId,
      scenarioKind: scenarioEntry?.scenarioKind ?? 'main',
      step,
      outcome: step.outcome,
      runId: run.runId,
      completedAt: run.completedAt,
    }), { waitUntil: 'load' })
    await page.screenshot({ path: screenshotPath, type: 'png' })

    const screenshotBytes = fs.readFileSync(screenshotPath)
    const structuredBytes = fs.readFileSync(structuredPath)
    artifacts[step.stepId] = {
      screenshot: {
        fileName: screenshotName,
        sha256: sha256(screenshotBytes),
        bytes: screenshotBytes.byteLength,
        width: 1280,
        height: 800,
      },
      structured: {
        fileName: structuredName,
        sha256: sha256(structuredBytes),
        bytes: structuredBytes.byteLength,
      },
    }
  }
}

await browser.close()

const generated = `/** Generated by apps/gui/scripts/generate-sample-evidence.mjs. Do not edit by hand. */\n` +
  `export type SampleEvidenceManifestEntry = {\n` +
  `  screenshot: { fileName: string; sha256: string; bytes: number; width: number; height: number }\n` +
  `  structured: { fileName: string; sha256: string; bytes: number }\n` +
  `}\n\n` +
  `export const SAMPLE_EVIDENCE_MANIFEST: Readonly<Record<string, SampleEvidenceManifestEntry>> = ${JSON.stringify(artifacts, null, 2)}\n`

fs.writeFileSync(manifestPath, generated)
console.log(`Generated ${Object.keys(artifacts).length} screenshot/structured evidence pairs.`)
