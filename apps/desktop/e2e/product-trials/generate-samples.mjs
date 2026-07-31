import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { productTrialSystems } from './systems.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const uiRoot = path.join(here, 'ui')
const sampleRoot = path.join(repoRoot, 'e2e-samples/product-trials')

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const slug = (value) => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

function table(panel) {
  const headers = panel.headers ?? ['Resource', 'Assignment', 'Remaining', 'State']
  return `<div class="panel-body" style="padding:0;overflow:auto">
    <table class="data-table">
      <thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead>
      <tbody>${panel.rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`
}

function chart(panel) {
  const width = 760
  const height = 250
  const max = Math.max(...panel.series, panel.threshold ?? 0) * 1.12
  const points = panel.series.map((value, index) => {
    const x = (index / (panel.series.length - 1)) * width
    const y = height - (value / max) * height
    return [x, y]
  })
  const pointText = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaText = `0,${height} ${pointText} ${width},${height}`
  const thresholdY = height - ((panel.threshold ?? 0) / max) * height
  return `<div class="panel-body">
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(panel.title)} trend">
        <g class="chart-grid">
          ${[0, 1, 2, 3, 4].map((index) => `<line x1="0" y1="${index * 62.5}" x2="${width}" y2="${index * 62.5}" />`).join('')}
          ${[0, 1, 2, 3, 4].map((index) => `<line x1="${index * 190}" y1="0" x2="${index * 190}" y2="${height}" />`).join('')}
        </g>
        <polygon class="chart-fill" points="${areaText}" />
        <polyline class="chart-path" points="${pointText}" />
        ${panel.threshold ? `<line class="chart-threshold" x1="0" y1="${thresholdY}" x2="${width}" y2="${thresholdY}" />` : ''}
      </svg>
      <div class="chart-labels">${panel.labels.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
    </div>
  </div>`
}

function renderPanel(panel) {
  let body = ''
  if (['table', 'matrix', 'compatibility', 'schedule'].includes(panel.type)) {
    body = table(panel)
  } else if (panel.type === 'diff') {
    body = `<div class="panel-body diff">
      <div class="diff-line before">− ${escapeHtml(panel.before)}</div>
      <div class="diff-line after">+ ${escapeHtml(panel.after)}</div>
      <p class="diff-note">${escapeHtml(panel.note)}</p>
    </div>`
  } else if (panel.type === 'checklist') {
    body = `<div class="panel-body"><ul class="check-list">${panel.items.map(([label, done]) =>
      `<li><span class="check-mark ${done ? 'done' : ''}">${done ? '✓' : '·'}</span><span>${escapeHtml(label)}</span></li>`).join('')}</ul></div>`
  } else if (panel.type === 'kanban') {
    body = `<div class="panel-body"><div class="kanban">${panel.columns.map(([title, cards]) =>
      `<section class="kanban-column"><h4>${escapeHtml(title)}<span>${cards.length}</span></h4>${cards.map((card) =>
        `<div class="kanban-card">${escapeHtml(card)}</div>`).join('')}</section>`).join('')}</div></div>`
  } else if (panel.type === 'timeline') {
    body = `<div class="panel-body"><ol class="timeline">${panel.items.map(([time, title, detail]) =>
      `<li><time>${escapeHtml(time)}</time><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span></li>`).join('')}</ol></div>`
  } else if (panel.type === 'list') {
    body = `<div class="panel-body"><ul class="simple-list">${panel.items.map(([title, detail, state]) =>
      `<li><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span><em>${escapeHtml(state)}</em></li>`).join('')}</ul></div>`
  } else if (panel.type === 'editor') {
    body = `<div class="panel-body"><article class="editor-sheet"><h4>${escapeHtml(panel.title)}</h4>${panel.paragraphs.map((paragraph) =>
      `<p class="${paragraph === panel.highlight ? 'highlight' : ''}">${escapeHtml(paragraph)}</p>`).join('')}</article></div>`
  } else if (panel.type === 'diagnostics') {
    body = `<div class="panel-body"><ul class="diagnostics">${panel.items.map(([code, message, severity]) =>
      `<li><code>${escapeHtml(code)}</code><span>${escapeHtml(message)}</span><b class="severity">${escapeHtml(severity)}</b></li>`).join('')}</ul></div>`
  } else if (panel.type === 'comments') {
    body = `<div class="panel-body"><ol class="comment-list">${panel.items.map(([author, comment, time]) =>
      `<li><span class="comment-author">${escapeHtml(author.slice(0, 2).toUpperCase())}</span><p><b>${escapeHtml(author)}</b><br>${escapeHtml(comment)}</p><time>${escapeHtml(time)}</time></li>`).join('')}</ol></div>`
  } else if (panel.type === 'chart') {
    body = chart(panel)
  } else if (panel.type === 'events') {
    body = `<div class="panel-body"><ol class="event-list">${panel.items.map(([time, event, state]) =>
      `<li><time>${escapeHtml(time)}</time><span><b>${escapeHtml(event)}</b></span><span class="event-state">${escapeHtml(state)}</span></li>`).join('')}</ol></div>`
  } else if (panel.type === 'scatter') {
    body = `<div class="panel-body" style="padding:28px 34px 38px"><div class="scatter">${panel.points.map(([label, x, y, note]) =>
      `<span class="scatter-point" style="left:${x}%;bottom:${y}%">${escapeHtml(label)}<small>${escapeHtml(note)}</small></span>`).join('')}</div></div>`
  } else if (panel.type === 'sensitivity') {
    body = `<div class="panel-body sensitivity">${panel.items.map(([label, value, amount]) =>
      `<div class="sensitivity-row"><span>${escapeHtml(label)}</span><div class="sensitivity-track"><i style="width:${amount}%"></i></div><b>${escapeHtml(value)}</b></div>`).join('')}</div>`
  } else if (panel.type === 'pipeline') {
    body = `<div class="panel-body"><ol class="pipeline">${panel.items.map(([label, state], index) => {
      const stateClass = /complete/i.test(state) ? 'complete' : /running|review/i.test(state) ? 'running' : ''
      return `<li><span class="pipeline-dot ${stateClass}">${stateClass === 'complete' ? '✓' : index + 1}</span><b>${escapeHtml(label)}</b><small>${escapeHtml(state)}</small></li>`
    }).join('')}</ol></div>`
  } else if (panel.type === 'console') {
    body = `<div class="panel-body"><div class="console">${panel.items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>`
  } else if (panel.type === 'intake') {
    body = `<div class="panel-body intake-list">${panel.items.map(([name, detail, result]) =>
      `<div class="intake-row"><b>${escapeHtml(name)}</b><span>${escapeHtml(detail)}</span><em class="result-chip ${slug(result)}">${escapeHtml(result)}</em></div>`).join('')}</div>`
  } else if (panel.type === 'graph') {
    body = `<div class="panel-body"><div class="graph">${panel.nodes.map(([id, name]) =>
      `<article class="graph-node"><span>${escapeHtml(id)}</span><b>${escapeHtml(name)}</b></article>`).join('')}</div></div>`
  } else if (panel.type === 'decision') {
    body = `<div class="panel-body decision-list">${panel.items.map(([label, value]) =>
      `<div class="decision-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}</div>`
  } else if (panel.type === 'release') {
    body = `<div class="panel-body"><div class="release-path">${panel.items.map(([label, state], index) =>
      `<article class="release-step"><span>${index + 1}</span><b>${escapeHtml(label)}</b><small>${escapeHtml(state)}</small></article>`).join('')}</div></div>`
  } else if (panel.type === 'bars') {
    body = `<div class="panel-body bars">${panel.items.map(([label, width, count]) =>
      `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><i style="width:${width}%"></i></div><b>${escapeHtml(count)}</b></div>`).join('')}</div>`
  } else if (panel.type === 'investigation') {
    body = `<div class="panel-body investigation">${panel.items.map(([label, text]) =>
      `<div class="investigation-row"><span>${escapeHtml(label)}</span><p>${escapeHtml(text)}</p></div>`).join('')}</div>`
  } else {
    throw new Error(`Unknown product-trial panel: ${panel.type}`)
  }
  return `<article class="panel panel-${escapeHtml(panel.type)}">
    <header class="panel-header"><div><h3>${escapeHtml(panel.title)}</h3><p>${escapeHtml(panel.subtitle)}</p></div></header>
    ${body}
  </article>`
}

function renderHtml(system) {
  const config = JSON.stringify({
    name: system.name,
    reward: system.reward,
    scenarios: system.scenarios,
  }).replaceAll('<', '\\u003c')
  return `<!doctype html>
<html lang="en" style="--accent:${system.accent};--accent-rgb:${system.accentRgb}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(system.name)}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">${escapeHtml(system.shortName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2))}</span>
          <span class="brand-copy"><b>${escapeHtml(system.shortName)}</b><small>${escapeHtml(system.category)}</small></span>
        </div>
        <nav aria-label="Primary navigation">
          ${system.nav.map((item, index) => `<button class="nav-item ${index === 0 ? 'active' : ''}" type="button" aria-label="Open ${escapeHtml(item.toLowerCase())}" data-nav-target="${slug(item)}" data-nav-title="${escapeHtml(item)}">
            <span class="nav-icon">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(item)}
          </button>`).join('')}
        </nav>
        <div class="sidebar-spacer"></div>
        <div class="sidebar-summary"><span>Current focus</span><strong>${escapeHtml(system.metrics[1][1])}</strong><small>${escapeHtml(system.metrics[1][2])}</small></div>
        <div class="user-row"><span class="avatar">TW</span><span><b>Tim Wood</b><small>Local engineering workspace</small></span></div>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div class="topbar-left">
            <button class="mobile-menu" type="button" data-mobile-menu aria-label="Open menu">☰</button>
            <h1 data-view-title>${escapeHtml(system.homeTitle)}</h1>
          </div>
          <button class="command-button" type="button" data-open-commands aria-label="Open command menu">
            <span>Find or run an action</span><kbd>⌘ K</kbd>
          </button>
        </header>

        <main>
          <section class="hero">
            <div>
              <p class="eyebrow">${escapeHtml(system.eyebrow)}</p>
              <h2>${escapeHtml(system.headline)}</h2>
              <p class="hero-copy">${escapeHtml(system.subhead)}</p>
            </div>
            <div class="hero-status"><span class="status-orb"></span>Workspace data is current</div>
          </section>

          <section class="metrics" aria-label="Current measures">
            ${system.metrics.map(([label, value, detail]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join('')}
          </section>

          <section class="action-deck" aria-label="Scenario actions">
            <span>Prove the next task</span>
            ${system.scenarios.map((item) => `<button class="scenario-action" type="button" data-scenario-action="${item.actionId}" data-target="${escapeHtml(item.target)}">${escapeHtml(item.name)}</button>`).join('')}
          </section>

          <section class="scenario-results" aria-live="polite">
            ${system.scenarios.map((item, index) => `<div class="scenario-result ${index === system.scenarios.length - 1 ? 'is-failure' : ''}" data-scenario-result="${item.actionId}" data-reward="${escapeHtml(system.reward)}">${escapeHtml(item.result)}</div>`).join('')}
          </section>

          <section class="panel-grid">
            ${system.panels.map(renderPanel).join('')}
          </section>

          <details class="activity-drawer">
            <summary>Session activity</summary>
            <ol class="activity-list" data-activity>
              <li><span>Now</span><b>Workspace opened</b><small>${escapeHtml(system.description)}</small></li>
            </ol>
          </details>
        </main>
      </section>
    </div>

    <aside class="reward-toast" data-reward aria-live="polite">
      <div class="reward-head"><span class="reward-spark">✦</span><span><b data-reward-label>${escapeHtml(system.reward)}</b><small data-reward-count>0 of ${system.scenarios.length} actions evidenced</small></span></div>
      <div class="reward-track"><i data-reward-bar></i></div>
    </aside>

    <div class="command-dialog" data-command-dialog hidden>
      <section class="command-card" role="dialog" aria-modal="true" aria-label="Command menu">
        <div class="command-search">
          <input data-command-input aria-label="Find an action" placeholder="Find an action…" />
          <button class="command-close" type="button" data-close-commands aria-label="Close command menu">×</button>
        </div>
        <ul class="command-list">
          ${system.scenarios.map((item) => `<li data-command-item="${item.actionId}"><button type="button"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.target)}</small></button></li>`).join('')}
        </ul>
      </section>
    </div>

    <script id="product-config" type="application/json">${config}</script>
    <script src="./runtime.js"></script>
  </body>
</html>
`
}

function testRunner() {
  return `import fs from 'node:fs'
import path from 'node:path'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve('capabilities/modules/mod.experience-first/ui/index.html')
const passed = fs.existsSync(appPath) && fs.statSync(appPath).size > 0

if (passed && screenshotPath && fs.existsSync(proofPath)) {
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
  fs.copyFileSync(proofPath, screenshotPath)
}

process.stdout.write(JSON.stringify({
  passed,
  module: process.argv[2] ?? 'all',
  artifact: appPath,
}))
process.exitCode = passed ? 0 : 1
`
}

function writeSystem(system) {
  const relativeUi = 'capabilities/modules/mod.experience-first/ui'
  const sampleDir = path.join(sampleRoot, system.slug)
  const sampleUi = path.join(sampleDir, relativeUi)
  fs.mkdirSync(sampleUi, { recursive: true })

  const html = renderHtml(system)
  fs.writeFileSync(path.join(sampleUi, 'index.html'), html)
  fs.copyFileSync(path.join(uiRoot, 'styles.css'), path.join(sampleUi, 'styles.css'))
  fs.copyFileSync(path.join(uiRoot, 'runtime.js'), path.join(sampleUi, 'runtime.js'))

  const cli = `const input = JSON.parse(process.argv.at(-1) || '{}')\nprocess.stdout.write(JSON.stringify({ ok: true, system: ${JSON.stringify(system.name)}, input }))\n`
  fs.writeFileSync(path.join(path.dirname(sampleUi), 'cli.mjs'), cli)

  fs.writeFileSync(path.join(sampleDir, 'README.md'), `# ${system.name}\n\n${system.description}\n\n## User tasks\n\n${system.examples.map((item) => `- ${item}`).join('\n')}\n\n## Protected outcome\n\n- ${system.prohibited}\n`)
  fs.writeFileSync(path.join(sampleDir, 'package.json'), `${JSON.stringify({
    name: system.slug,
    private: true,
    type: 'module',
    scripts: { test: 'node ./test-runner.mjs' },
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(sampleDir, 'test-runner.mjs'), testRunner())
  fs.writeFileSync(path.join(sampleDir, 'product-trial.json'), `${JSON.stringify(system, null, 2)}\n`)
}

for (const system of productTrialSystems) {
  writeSystem(system)
  console.log(`generated ${system.slug}`)
}
