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

const iconPaths = {
  'arrow-right': '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/>',
  'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4"/><path d="M12 18h.01"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  boxes: '<path d="m12 2 4 2.3v4.6L12 11 8 8.9V4.3L12 2Z"/><path d="m5 12 4 2.3v4.6L5 21l-4-2.1v-4.6L5 12Z"/><path d="m19 12 4 2.3v4.6L19 21l-4-2.1v-4.6l4-2.3Z"/>',
  'clipboard-check': '<rect width="14" height="18" x="5" y="3" rx="2"/><path d="M9 3.5h6M9 12l2 2 4-4"/>',
  ellipsis: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  flask: '<path d="M9 3h6M10 9V3h4v6l5 9a2 2 0 0 1-1.7 3H6.7A2 2 0 0 1 5 18l5-9Z"/><path d="M8 15h8"/>',
  'git-branch': '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  home: '<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z"/>',
  lock: '<rect width="16" height="12" x="4" y="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  moon: '<path d="M20.9 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.7 9.8Z"/>',
  package: '<path d="m7.5 4.3 9 5.2M3.3 7l8.7 5 8.7-5M12 22V12M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>',
  panels: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M9 9h12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
  'square-kanban': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v8M12 7v5M16 7v9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
}

function icon(name, size = 18) {
  const paths = iconPaths[name]
  if (!paths) throw new Error(`Unknown interface icon: ${name}`)
  return `<svg class="lucide lucide-${name}" data-icon-family="lucide" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

let controlSequence = 0
function iconButton(label, iconName, attributes = '') {
  controlSequence += 1
  const tooltipId = `tooltip-${slug(label)}-${controlSequence}`
  return `<button class="icon-button" type="button" aria-label="${escapeHtml(label)}" aria-describedby="${tooltipId}" data-tooltip-trigger ${attributes}>${icon(iconName)}<span id="${tooltipId}" class="control-tooltip" role="tooltip">${escapeHtml(label)}</span></button>`
}

function table(panel, compact = false) {
  const headers = panel.headers ?? ['Resource', 'Assignment', 'Remaining', 'State']
  return `<div class="panel-body table-scroll ${compact ? 'is-compact' : ''}">
    <table class="data-table">
      <thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead>
      <tbody>${panel.rows.map((row) => `<tr>${row.map((item, index) => `<td>${index === 0 ? '<b>' : ''}${escapeHtml(item)}${index === 0 ? '</b>' : ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`
}

function lineChart(panel) {
  const width = 880
  const height = 286
  const max = Math.max(...panel.series, panel.threshold ?? 0) * 1.12
  const points = panel.series.map((value, index) => {
    const x = (index / (panel.series.length - 1)) * width
    const y = height - (value / max) * height
    return [x, y]
  })
  const pointText = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaText = `0,${height} ${pointText} ${width},${height}`
  const thresholdY = height - ((panel.threshold ?? 0) / max) * height
  return `<div class="panel-body chart-body">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(panel.title)} trend">
      <g class="chart-grid">
        ${[0, 1, 2, 3, 4].map((index) => `<line x1="0" y1="${index * 71.5}" x2="${width}" y2="${index * 71.5}" />`).join('')}
        ${[0, 1, 2, 3, 4].map((index) => `<line x1="${index * 220}" y1="0" x2="${index * 220}" y2="${height}" />`).join('')}
      </g>
      <polygon class="chart-fill" points="${areaText}" />
      <polyline class="chart-path" points="${pointText}" />
      ${panel.threshold ? `<line class="chart-threshold" x1="0" y1="${thresholdY}" x2="${width}" y2="${thresholdY}" />` : ''}
      <line class="chart-cursor" x1="486" y1="0" x2="486" y2="${height}" />
    </svg>
    <div class="chart-labels">${panel.labels.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
  </div>`
}

function panelBody(panel) {
  if (['table', 'matrix', 'compatibility', 'schedule'].includes(panel.type)) return table(panel)
  if (panel.type === 'diff') {
    return `<div class="panel-body diff">
      <div class="diff-line before"><span>−</span>${escapeHtml(panel.before)}</div>
      <div class="diff-line after"><span>+</span>${escapeHtml(panel.after)}</div>
      <p class="diff-note">${escapeHtml(panel.note)}</p>
    </div>`
  }
  if (panel.type === 'checklist') {
    return `<div class="panel-body"><ul class="check-list">${panel.items.map(([label, done]) =>
      `<li><span class="check-mark ${done ? 'done' : ''}">${done ? icon('check', 14) : ''}</span><span>${escapeHtml(label)}</span></li>`).join('')}</ul></div>`
  }
  if (panel.type === 'kanban') {
    return `<div class="panel-body board-scroll"><div class="kanban">${panel.columns.map(([title, cards]) =>
      `<section class="kanban-column"><h4>${escapeHtml(title)}<span>${cards.length}</span></h4>${cards.map((card, index) =>
        `<div class="kanban-card"><span class="card-signal signal-${index % 3}"></span><b>${escapeHtml(card)}</b><small>${index % 2 ? 'Needs evidence' : 'In progress'}</small></div>`).join('')}</section>`).join('')}</div></div>`
  }
  if (panel.type === 'timeline') {
    return `<div class="panel-body"><ol class="timeline">${panel.items.map(([time, title, detail]) =>
      `<li><time>${escapeHtml(time)}</time><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span></li>`).join('')}</ol></div>`
  }
  if (panel.type === 'list') {
    return `<div class="panel-body"><ul class="simple-list">${panel.items.map(([title, detail, state]) =>
      `<li><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span><em>${escapeHtml(state)}</em></li>`).join('')}</ul></div>`
  }
  if (panel.type === 'editor') {
    return `<div class="panel-body editor-body"><article class="editor-sheet"><p class="doc-kicker">4.2 SOURCE SELECTION</p><h4>${escapeHtml(panel.title)}</h4>${panel.paragraphs.map((paragraph) =>
      `<p class="${paragraph === panel.highlight ? 'highlight' : ''}">${escapeHtml(paragraph)}</p>`).join('')}<span class="text-caret" aria-hidden="true"></span></article></div>`
  }
  if (panel.type === 'diagnostics') {
    return `<div class="panel-body"><ul class="diagnostics">${panel.items.map(([code, message, severity]) =>
      `<li><code>${escapeHtml(code)}</code><span>${escapeHtml(message)}</span><b class="severity">${escapeHtml(severity)}</b></li>`).join('')}</ul></div>`
  }
  if (panel.type === 'comments') {
    return `<div class="panel-body"><ol class="comment-list">${panel.items.map(([author, comment, time]) =>
      `<li><span class="comment-author">${escapeHtml(author.slice(0, 2).toUpperCase())}</span><p><b>${escapeHtml(author)}</b><br>${escapeHtml(comment)}</p><time>${escapeHtml(time)}</time></li>`).join('')}</ol></div>`
  }
  if (panel.type === 'chart') return lineChart(panel)
  if (panel.type === 'events') {
    return `<div class="panel-body"><ol class="event-list">${panel.items.map(([time, event, state], index) =>
      `<li class="${index === 0 ? 'selected' : ''}"><time>${escapeHtml(time)}</time><span><b>${escapeHtml(event)}</b></span><span class="event-state">${escapeHtml(state)}</span></li>`).join('')}</ol></div>`
  }
  if (panel.type === 'scatter') {
    return `<div class="panel-body scatter-body"><div class="scatter"><span class="scatter-axis axis-y">Range</span><span class="scatter-axis axis-x">Weight</span>${panel.points.map(([label, x, y, note]) =>
      `<span class="scatter-point" style="left:${x}%;bottom:${y}%"><b>${escapeHtml(label)}</b><small>${escapeHtml(note)}</small></span>`).join('')}</div></div>`
  }
  if (panel.type === 'sensitivity') {
    return `<div class="panel-body sensitivity">${panel.items.map(([label, value, amount]) =>
      `<div class="sensitivity-row"><span>${escapeHtml(label)}</span><div class="sensitivity-track"><i style="width:${amount}%"></i></div><b>${escapeHtml(value)}</b></div>`).join('')}</div>`
  }
  if (panel.type === 'pipeline') {
    return `<div class="panel-body"><ol class="pipeline">${panel.items.map(([label, state], index) => {
      const stateClass = /complete/i.test(state) ? 'complete' : /running|review/i.test(state) ? 'running' : ''
      return `<li><span class="pipeline-dot ${stateClass}">${stateClass === 'complete' ? icon('check', 14) : index + 1}</span><b>${escapeHtml(label)}</b><small>${escapeHtml(state)}</small></li>`
    }).join('')}</ol></div>`
  }
  if (panel.type === 'console') {
    return `<div class="panel-body"><div class="console"><div class="console-head"><i></i><i></i><i></i><span>LIVE · BENCH 04</span></div>${panel.items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>`
  }
  if (panel.type === 'intake') {
    return `<div class="panel-body intake-list">${panel.items.map(([name, detail, result], index) =>
      `<div class="intake-row ${index === 1 ? 'selected' : ''}"><span class="file-mark">ZIP</span><b>${escapeHtml(name)}</b><span>${escapeHtml(detail)}</span><em class="result-chip ${slug(result)}">${escapeHtml(result)}</em></div>`).join('')}</div>`
  }
  if (panel.type === 'graph') {
    const positions = [[35, 45], [300, 45], [565, 45], [300, 285], [565, 285]]
    const paths = [
      'M 235 105 H 300',
      'M 500 105 H 565',
      'M 400 165 V 285',
      'M 665 165 V 285',
      'M 500 345 H 565',
    ]
    return `<div class="panel-body graph-body"><svg class="impact-svg" viewBox="0 0 800 470" role="img" aria-label="${escapeHtml(panel.title)}">
      <defs><marker id="impact-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
      <g class="impact-links">${paths.map((path) => `<path d="${path}" />`).join('')}</g>
      ${panel.nodes.map(([id, name], index) => {
        const [x, y] = positions[index] ?? [35 + (index % 3) * 265, 285]
        return `<g class="impact-node ${index === 0 ? 'changed' : ''}" transform="translate(${x} ${y})">
          <rect width="200" height="120" rx="8" />
          <text class="impact-node-id" x="16" y="27">${escapeHtml(id)}</text>
          <text class="impact-node-name" x="16" y="61">${escapeHtml(name)}</text>
          <text class="impact-node-state" x="16" y="94">${index ? 'AFFECTED' : 'CHANGED'}</text>
        </g>`
      }).join('')}
    </svg></div>`
  }
  if (panel.type === 'decision') {
    return `<div class="panel-body decision-list">${panel.items.map(([label, value]) =>
      `<div class="decision-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}</div>`
  }
  if (panel.type === 'release') {
    return `<div class="panel-body"><div class="release-path">${panel.items.map(([label, state], index) =>
      `<article class="release-step ${index === 2 ? 'current' : ''}"><span>${index + 1}</span><b>${escapeHtml(label)}</b><small>${escapeHtml(state)}</small></article>`).join('')}</div></div>`
  }
  if (panel.type === 'bars') {
    return `<div class="panel-body bars">${panel.items.map(([label, width, count]) =>
      `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><i style="width:${width}%"></i></div><b>${escapeHtml(count)}</b></div>`).join('')}</div>`
  }
  if (panel.type === 'investigation') {
    return `<div class="panel-body investigation">${panel.items.map(([label, text], index) =>
      `<div class="investigation-row ${index === 2 ? 'active' : ''}"><span>${escapeHtml(label)}</span><p>${escapeHtml(text)}</p></div>`).join('')}</div>`
  }
  throw new Error(`Unknown product-trial panel: ${panel.type}`)
}

function panel(panel, className = '') {
  return `<article class="panel panel-${escapeHtml(panel.type)} ${className}">
    <header class="panel-header"><div><h3>${escapeHtml(panel.title)}</h3><p>${escapeHtml(panel.subtitle)}</p></div>${iconButton('Open panel menu', 'ellipsis')}</header>
    ${panelBody(panel)}
  </article>`
}

function navigationIcon(label, index) {
  const value = String(label).toLowerCase()
  if (/session|queue|work/.test(value)) return 'square-kanban'
  if (/deliver|package|load|install/.test(value)) return 'package'
  if (/review|compliance|evidence|verify/.test(value)) return 'clipboard-check'
  if (/supplier|user|team|owner/.test(value)) return 'users'
  if (/failure|investigation|case|finding/.test(value)) return 'search'
  if (/telemetry|reliability|monitor|control/.test(value)) return 'activity'
  if (/document|writing|report/.test(value)) return 'file'
  if (/impact|trace|architecture|dependency/.test(value)) return 'git-branch'
  if (/test|campaign|bench|procedure/.test(value)) return 'flask'
  if (/module|system|asset/.test(value)) return 'boxes'
  return index === 0 ? 'home' : 'panels'
}

function nav(system, mode = 'rail') {
  const initials = system.shortName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2)
  return `<aside class="sidebar product-nav nav-${mode}" data-product-nav>
    <div class="brand"><span class="brand-mark">${escapeHtml(initials)}</span><span class="brand-copy"><b>${escapeHtml(system.shortName)}</b><small>${escapeHtml(system.category)}</small></span></div>
    <nav aria-label="Primary navigation">${system.nav.map((item, index) => `<button class="nav-item ${index === 0 ? 'active' : ''}" type="button" data-nav-target="${slug(item)}" data-nav-title="${escapeHtml(item)}"><span class="nav-symbol">${icon(navigationIcon(item, index), 18)}</span><b>${escapeHtml(item)}</b></button>`).join('')}</nav>
    <div class="nav-foot"><span class="presence-dot"></span><span>Local workspace</span><b>TW</b></div>
  </aside>`
}

function topbar(system, extra = '', mode = 'workspace') {
  return `<header class="product-topbar topbar-${mode}" data-shell-mode="${mode}">
    <div>${iconButton('Open menu', 'menu', 'data-mobile-menu')}<span class="crumb">${escapeHtml(system.shortName)}</span><span class="crumb-divider">/</span><h1 data-view-title>${escapeHtml(system.homeTitle)}</h1></div>
    <div class="topbar-tools">${extra}<button class="command-button" type="button" data-open-commands aria-label="Open command menu">${icon('search', 16)}<span>Find or run</span><kbd>⌘ K</kbd></button>${iconButton('Open help', 'circle-help', 'data-help-trigger aria-expanded="false"')}${iconButton('Use dark mode', 'moon', 'data-theme-toggle')}<span class="user-chip">TW</span></div>
  </header>`
}

function actions(system, className = 'domain-actions', visibleCount = 3) {
  const visible = system.scenarios.slice(0, visibleCount)
  return `<div class="${className}" aria-label="Product actions">${visible.map((item, index) =>
    `<button class="${index === 0 ? 'primary-action' : ''}" type="button" data-scenario-action="${item.actionId}" data-target="${escapeHtml(item.target)}"><span>${index === 0 ? icon('plus', 16) : icon('arrow-right', 16)}</span>${escapeHtml(item.name)}</button>`).join('')}<button class="more-actions" type="button" data-open-commands>${icon('ellipsis', 16)} More actions</button></div>`
}

function metricStrip(system, className = '') {
  return `<div class="metric-strip ${className}" aria-label="Current measures">${system.metrics.map(([label, value, detail]) =>
    `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`).join('')}</div>`
}

function reviewSurface(system) {
  return `${nav(system, 'review')}
    <section class="product-workspace">
      ${topbar(system, `<span class="independence-pill">${icon('check', 14)} Independent reviewer</span>`, 'review')}
      <main class="review-layout">
        <header class="review-context">
          <div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>
          ${actions(system, 'review-actions', 2)}
        </header>
        <aside class="artifact-browser">
          <header><b>Lifecycle data</b><span>161 objectives</span></header>
          ${panel(system.panels[0], 'embedded-panel')}
        </aside>
        <section class="review-document">${panel(system.panels[1], 'document-diff')}</section>
        <aside class="objective-inspector">
          ${metricStrip(system, 'review-measures')}
          ${panel(system.panels[2], 'objective-panel')}
        </aside>
      </main>
    </section>`
}

function sessionSurface(system) {
  return `${nav(system, 'sessions')}
    <section class="product-workspace">
      ${topbar(system, '<span class="focus-clock">Focus: 42 min</span>', 'sessions')}
      <main class="session-layout">
        <header class="session-heading"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${metricStrip(system, 'session-stats')}</header>
        <section class="session-board">${panel(system.panels[0], 'board-panel')}</section>
        <aside class="session-inspector">${actions(system, 'session-actions', 1)}${panel(system.panels[1], 'timeline-panel')}${panel(system.panels[2], 'issues-panel')}</aside>
      </main>
    </section>`
}

function writingSurface(system) {
  return `${nav(system, 'documents')}
    <section class="product-workspace">
      ${topbar(system, '<span class="save-state">Saved 10:18</span>', 'editor')}
      <main class="writing-layout">
        <header class="writing-toolbar"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2></div>${actions(system, 'writing-actions', 2)}</header>
        <aside class="document-outline"><b>Document outline</b><ol><li>1 Purpose</li><li>2 References</li><li>3 Architecture</li><li class="active">4 Source selection</li><li>5 Failure response</li><li>6 Verification</li></ol>${metricStrip(system, 'writing-stats')}</aside>
        <section class="document-canvas">${panel(system.panels[0], 'editor-panel')}</section>
        <aside class="writing-inspector"><div class="inspector-tabs"><b>Writing</b><span>Comments</span></div>${panel(system.panels[1], 'diagnostic-panel')}${panel(system.panels[2], 'comment-panel')}</aside>
      </main>
    </section>`
}

function telemetrySurface(system) {
  return `<section class="product-workspace telemetry-shell">
      ${topbar(system, '<span class="recording-pill"><i></i> Recorded data</span>', 'instrument')}
      <main class="telemetry-layout">
        <header class="telemetry-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2></div>${actions(system, 'telemetry-actions', 3)}</header>
        <aside class="channel-rail sidebar" data-product-nav><h3>Channels</h3><label>Find channel<input value="normal accel" readonly /></label><ul><li class="active"><b>NZ</b><span>Normal acceleration</span><em>2.61 g</em></li><li><b>ELE</b><span>Elevator position</span><em>8.4°</em></li><li><b>CAS</b><span>Calibrated airspeed</span><em>241 kt</em></li><li><b>AP</b><span>Autopilot state</span><em>OFF</em></li></ul>${metricStrip(system, 'channel-stats')}</aside>
        <section class="telemetry-plot">${panel(system.panels[0], 'plot-panel')}</section>
        <aside class="event-rail">${panel(system.panels[1], 'event-panel')}</aside>
        <section class="investigation-strip">${panel(system.panels[2], 'investigation-status')}</section>
      </main>
    </section>`
}

function tradeSurface(system) {
  return `${nav(system, 'study')}
    <section class="product-workspace">
      ${topbar(system, '<span class="model-state">MATLAB ready</span>', 'analysis')}
      <main class="trade-layout">
        <header class="trade-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${actions(system, 'trade-actions', 2)}</header>
        <aside class="parameter-drawer"><h3>Case inputs</h3><label>Gross weight<span><input value="18,240" readonly /> kg</span></label><label>Cruise altitude<span><input value="35,000" readonly /> ft</span></label><label>Drag factor<span><input value="1.012" readonly /></span></label><label>Fuel reserve<span><input value="45" readonly /> min</span></label><button type="button">Compare assumptions</button>${metricStrip(system, 'parameter-stats')}</aside>
        <section class="trade-plot">${panel(system.panels[0], 'scatter-panel')}</section>
        <aside class="trade-sensitivity">${panel(system.panels[2], 'sensitivity-panel')}</aside>
        <section class="trade-matrix">${panel(system.panels[1], 'matrix-panel')}</section>
      </main>
    </section>`
}

function hilSurface(system) {
  return `<section class="product-workspace hil-shell">
      ${topbar(system, '<span class="rig-health">● 4 / 5 rigs online</span>', 'control')}
      <main class="hil-layout">
        <header class="hil-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${actions(system, 'hil-actions', 3)}</header>
        <nav class="bench-tabs sidebar" data-product-nav aria-label="Bench navigation">${system.nav.map((item, index) => `<button class="nav-item ${index === 0 ? 'active' : ''}" data-nav-target="${slug(item)}" data-nav-title="${escapeHtml(item)}"><span>0${index + 1}</span>${escapeHtml(item)}</button>`).join('')}</nav>
        <section class="bench-schedule">${panel(system.panels[0], 'schedule-panel')}</section>
        <section class="procedure-run">${panel(system.panels[1], 'pipeline-panel')}</section>
        <section class="rig-console">${panel(system.panels[2], 'console-panel')}</section>
        ${metricStrip(system, 'hil-metrics')}
      </main>
    </section>`
}

function supplierSurface(system) {
  return `${nav(system, 'portal')}
    <section class="product-workspace">
      ${topbar(system, '<span class="supplier-org">NORTHSTAR AVIONICS</span>', 'portal')}
      <main class="supplier-layout">
        <header class="supplier-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${actions(system, 'supplier-actions', 2)}</header>
        <ol class="intake-stepper"><li class="done"><span>1</span>Received</li><li class="current"><span>2</span>Validate</li><li><span>3</span>Resolve gaps</li><li><span>4</span>Accept</li></ol>
        <section class="supplier-package">${panel(system.panels[0], 'intake-panel')}</section>
        <aside class="supplier-checks">${panel(system.panels[1], 'check-panel')}</aside>
        <aside class="supplier-summary">${metricStrip(system, 'supplier-metrics')}${panel(system.panels[2], 'summary-panel')}</aside>
      </main>
    </section>`
}

function impactSurface(system) {
  return `<section class="product-workspace impact-shell">
      ${topbar(system, '<span class="graph-state">TRACE INDEX · CURRENT</span>', 'graph')}
      <main class="impact-layout">
        <header class="impact-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${actions(system, 'impact-actions', 2)}</header>
        <aside class="change-rail sidebar" data-product-nav><h3>Change set</h3><b>CR-2026-044</b><p>Change altitude source timeout from 500 ms to 300 ms.</p><dl><div><dt>Source</dt><dd>SYS-NAV-118</dd></div><div><dt>Revision</dt><dd>R18 → R19</dd></div><div><dt>Owner</dt><dd>Navigation</dd></div></dl>${metricStrip(system, 'impact-metrics')}</aside>
        <section class="impact-graph">${panel(system.panels[0], 'graph-panel')}</section>
        <aside class="impact-decision">${panel(system.panels[1], 'decision-panel')}${panel(system.panels[2], 'affected-panel')}</aside>
      </main>
    </section>`
}

function loadSurface(system) {
  return `${nav(system, 'release')}
    <section class="product-workspace">
      ${topbar(system, `<span class="secure-state">${icon('lock', 14)} Secure load mode</span>`, 'secure')}
      <main class="load-layout">
        <header class="load-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${metricStrip(system, 'load-metrics')}</header>
        <section class="load-stepper">${panel(system.panels[0], 'release-panel')}</section>
        <aside class="package-card"><p class="overline">Selected package</p><span class="package-icon">SW</span><h3>FCS-OFP-24.8.2</h3><p>SHA-256 · Signature valid</p><dl><div><dt>Target</dt><dd>FCC-A</dd></div><div><dt>Aircraft</dt><dd>N812TX</dd></div><div><dt>Size</dt><dd>48.2 MB</dd></div></dl>${actions(system, 'load-actions', 3)}</aside>
        <section class="compatibility-view">${panel(system.panels[1], 'compatibility-panel')}</section>
        <aside class="load-readiness">${panel(system.panels[2], 'readiness-panel')}</aside>
      </main>
    </section>`
}

function fracasSurface(system) {
  return `${nav(system, 'cases')}
    <section class="product-workspace">
      ${topbar(system, '<span class="review-window">90 DAY WINDOW</span>', 'case')}
      <main class="fracas-layout">
        <header class="fracas-head"><div><p class="eyebrow">${escapeHtml(system.eyebrow)}</p><h2>${escapeHtml(system.headline)}</h2><p>${escapeHtml(system.subhead)}</p></div>${actions(system, 'fracas-actions', 3)}</header>
        <aside class="case-list"><h3>Failure cases</h3><label>Filter cases<input placeholder="Part, aircraft, or symptom" /></label><ul><li class="active"><b>FR-2026-118</b><span>ADC-B data dropout</span><em>Critical</em></li><li><b>FR-2026-116</b><span>Sensor bias drift</span><em>Open</em></li><li><b>FR-2026-109</b><span>Power transient</span><em>Action</em></li><li><b>FR-2026-104</b><span>Software timeout</span><em>Monitor</em></li></ul>${metricStrip(system, 'case-stats')}</aside>
        <section class="case-analysis">${panel(system.panels[1], 'investigation-panel')}</section>
        <aside class="case-actions">${panel(system.panels[2], 'actions-panel')}</aside>
        <section class="reliability-trend">${panel(system.panels[0], 'pareto-panel')}</section>
      </main>
    </section>`
}

const renderers = {
  review: reviewSurface,
  sessions: sessionSurface,
  writing: writingSurface,
  telemetry: telemetrySurface,
  trade: tradeSurface,
  hil: hilSurface,
  supplier: supplierSurface,
  impact: impactSurface,
  load: loadSurface,
  fracas: fracasSurface,
}

function supportUi(system) {
  return `<section class="scenario-results" aria-live="polite">${system.scenarios.map((item, index) =>
      `<div class="scenario-result ${index === system.scenarios.length - 1 ? 'is-failure' : ''}" data-scenario-result="${item.actionId}" data-reward="${escapeHtml(system.reward)}">${icon(index === system.scenarios.length - 1 ? 'x' : 'circle-check', 18)}<span>${escapeHtml(item.result)}</span></div>`).join('')}</section>
    <details class="activity-drawer"><summary>Activity</summary><ol class="activity-list" data-activity><li><span>Now</span><b>Workspace opened</b><small>${escapeHtml(system.description)}</small></li></ol></details>
    <aside class="help-popover" data-help-popover hidden><header><b>Workspace help</b>${iconButton('Close help', 'x', 'data-close-help')}</header><p>Use the main action to start work. Use the command menu to find other actions.</p><p>Press Escape to close this help.</p></aside>
    <div class="command-dialog" data-command-dialog hidden><section class="command-card" role="dialog" aria-modal="true" aria-label="Command menu"><div class="command-search"><input data-command-input aria-label="Find an action" placeholder="Find an action" />${iconButton('Close command menu', 'x', 'data-close-commands')}</div><ul class="command-list">${system.scenarios.map((item) => `<li data-command-item="${item.actionId}"><button type="button"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.target)}</small></button></li>`).join('')}</ul></section></div>`
}

export function renderProductDocument(system) {
  const render = renderers[system.layout]
  if (!render) throw new Error(`No product renderer for ${system.layout}`)
  const design = system.design
  if (!design) throw new Error(`No design profile for ${system.slug}`)
  const config = JSON.stringify({
    name: system.name,
    reward: system.reward,
    scenarios: system.scenarios,
    architecture: system.architecture,
    design,
  }).replaceAll('<', '\\u003c')
  return `<!doctype html>
<html lang="en" data-design-contract="EUIT-FRONTEND-001" style="--eui-brand-accent-light:${design.lightAccent};--eui-brand-accent-dark:${design.darkAccent};--eui-brand-soft-light:${design.lightSoft};--eui-brand-soft-dark:${design.darkSoft};--eui-brand-rgb-light:${design.lightRgb};--eui-brand-rgb-dark:${design.darkRgb};--eui-font-config:${escapeHtml(design.fontStack)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(system.name)}</title>
    <script>
      (() => {
        const savedMode = localStorage.getItem('eui-color-mode')
        const startMode = savedMode || ${JSON.stringify(design.defaultMode)}
        if (startMode === 'light' || startMode === 'dark') {
          document.documentElement.dataset.theme = startMode
        }
      })()
    </script>
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./product-layouts.css" />
  </head>
  <body class="product-v2 product-v3 product-${escapeHtml(system.layout)}" data-density="${escapeHtml(design.density)}" data-composition="${escapeHtml(system.layout)}-${escapeHtml(design.density)}">
    <div class="app-shell">${render(system)}</div>
    ${supportUi(system)}
    <script id="product-config" type="application/json">${config}</script>
    <script src="./runtime.js"></script>
  </body>
</html>
`
}
