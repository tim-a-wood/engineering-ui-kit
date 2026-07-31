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

function semanticState(value) {
  const text = String(value).toLowerCase()
  if (/\b(pass|passed|ready|valid|approved|complete|closed|online|accepted)\b/.test(text)) return 'success'
  if (/\b(block|blocked|fail|failed|gap|invalid|critical|rejected|offline)\b/.test(text)) return 'danger'
  if (/\b(warn|warning|open|action|review|pending|needs|caution)\b/.test(text)) return 'warning'
  if (/\b(run|running|active|current|progress|recorded)\b/.test(text)) return 'info'
  return 'neutral'
}

const iconPaths = {
  'arrow-right': '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75Z"/><path d="m9 12 2 2 4-4"/>',
  'book-open-check': '<path d="M8 3H2v15h7a3 3 0 0 1 3 3V7a4 4 0 0 0-4-4Z"/><path d="m16 12 2 2 4-4"/><path d="M22 6V3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7v-2.3"/>',
  brackets: '<path d="M16 3h3v18h-3M8 21H5V3h3"/>',
  bug: '<path d="m8 2 1.9 1.9M14.1 3.9 16 2M9 7.1V6a3 3 0 0 1 6 0v1.1M3 13h18M3 5h4M17 5h4M5 19l3-2M19 19l-3-2"/><rect width="12" height="14" x="6" y="7" rx="6"/>',
  'calendar-clock': '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.5M16 2v4M8 2v4M3 10h8"/><circle cx="17" cy="17" r="4"/><path d="M17 15.5V17l1 1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/>',
  'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4"/><path d="M12 18h.01"/>',
  calendar: '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  boxes: '<path d="m12 2 4 2.3v4.6L12 11 8 8.9V4.3L12 2Z"/><path d="m5 12 4 2.3v4.6L5 21l-4-2.1v-4.6L5 12Z"/><path d="m19 12 4 2.3v4.6L19 21l-4-2.1v-4.6l4-2.3Z"/>',
  'clipboard-check': '<rect width="14" height="18" x="5" y="3" rx="2"/><path d="M9 3.5h6M9 12l2 2 4-4"/>',
  ellipsis: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  'file-input': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M2 15h10M9 18l3-3-3-3"/>',
  'file-search': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7"/><path d="M14 2v6h6v4M9 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM11.2 18.2 13 20"/>',
  files: '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M16 13H8M16 17H8"/><path d="M18 22a2 2 0 0 0 2-2V7l-5-5H8a2 2 0 0 0-2 2v2"/><path d="M4 6h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/>',
  flask: '<path d="M9 3h6M10 9V3h4v6l5 9a2 2 0 0 1-1.7 3H6.7A2 2 0 0 1 5 18l5-9Z"/><path d="M8 15h8"/>',
  'git-branch': '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'git-compare': '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M11 18H8a2 2 0 0 1-2-2V9M14 3l-3 3 3 3M10 15l3 3-3 3"/>',
  home: '<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  'key-round': '<path d="M21 2 13.6 9.4M15.5 7.5l2 2M18.5 4.5l2 2"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  lock: '<rect width="16" height="12" x="4" y="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  'message-square-plus': '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h6"/><path d="M19 3v6M16 6h6"/>',
  'messages-square': '<path d="M14 15a4 4 0 0 0 4-4V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v6a4 4 0 0 0 4 4h1l4 3v-3Z"/><path d="M15 22v-3h3a4 4 0 0 0 4-4V9"/>',
  moon: '<path d="M20.9 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.7 9.8Z"/>',
  package: '<path d="m7.5 4.3 9 5.2M3.3 7l8.7 5 8.7-5M12 22V12M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>',
  'package-open': '<path d="M12 22v-9M15.5 9 12 13 8.5 9M17 4.5l-10 5M3.3 7 12 12l8.7-5M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4Z"/>',
  panels: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M9 9h12"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  plane: '<path d="M17.8 19 16 11l4.5-4.5c1.9-1.9 2.5-4.5 1.4-5.6-1.1-1.1-3.7-.5-5.6 1.4L11.8 6.8 4 5 2 7l6 4-4 4-3-1-1 1 4 4 1-1-1-3 4-4 4 6Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m6 3 14 9-14 9Z"/>',
  radio: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M16.2 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2"/>',
  'refresh-cw': '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M16 16h5v5"/>',
  scale: '<path d="m16 16 3-8 3 8a5 5 0 0 1-6 0ZM2 16l3-8 3 8a5 5 0 0 1-6 0ZM7 21h10M12 3v18M3 7h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
  'shield-plus': '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="M9 12h6M12 9v6"/>',
  'sliders-horizontal': '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  'spell-check-2': '<path d="m6 16 6-12 6 12M8 12h8M16 20l2 2 4-4"/>',
  'square-kanban': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v8M12 7v5M16 7v9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  tags: '<path d="M13.2 2H4a2 2 0 0 0-2 2v9.2a2 2 0 0 0 .6 1.4l7.8 7.8a2 2 0 0 0 2.8 0l9.2-9.2a2 2 0 0 0 0-2.8l-7.8-7.8A2 2 0 0 0 13.2 2Z"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m18 5 3 3"/>',
  'triangle-alert': '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
}

function icon(name, size = 18) {
  const paths = iconPaths[name]
  if (!paths) throw new Error(`Unknown interface icon: ${name}`)
  return `<svg class="lucide lucide-${name}" data-icon-family="lucide" data-icon-name="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
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
      <tbody>${panel.rows.map((row) => `<tr>${row.map((item, index) => `<td${index === row.length - 1 ? ` data-state="${semanticState(item)}"` : ''}>${index === 0 ? '<b>' : ''}${escapeHtml(item)}${index === 0 ? '</b>' : ''}</td>`).join('')}</tr>`).join('')}</tbody>
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
      <desc>${escapeHtml(panel.title)}. Values range from 0 to ${max.toFixed(1)} across ${panel.labels.length} samples.</desc>
      <g class="chart-grid">
        ${[0, 1, 2, 3, 4].map((index) => `<line x1="0" y1="${index * 71.5}" x2="${width}" y2="${index * 71.5}" />`).join('')}
        ${[0, 1, 2, 3, 4].map((index) => `<line x1="${index * 220}" y1="0" x2="${index * 220}" y2="${height}" />`).join('')}
      </g>
      <g class="chart-ticks">${[0, 1, 2, 3, 4].map((index) => `<text x="8" y="${Math.max(14, index * 71.5 - 7)}">${(max * (1 - index / 4)).toFixed(1)}</text>`).join('')}</g>
      <polygon class="chart-fill" points="${areaText}" />
      <polyline class="chart-path" points="${pointText}" />
      ${panel.threshold ? `<line class="chart-threshold" x1="0" y1="${thresholdY}" x2="${width}" y2="${thresholdY}" />` : ''}
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
      `<section class="kanban-column"><h3>${escapeHtml(title)}<span>${cards.length}</span></h3>${cards.map((card, index) =>
        `<div class="kanban-card" data-surface-kind="inset-object"><span class="card-signal signal-${index % 3}"></span><b>${escapeHtml(card)}</b><small>${index % 2 ? 'Needs evidence' : 'In progress'}</small></div>`).join('')}</section>`).join('')}</div></div>`
  }
  if (panel.type === 'timeline') {
    return `<div class="panel-body"><ol class="timeline">${panel.items.map(([time, title, detail]) =>
      `<li><time>${escapeHtml(time)}</time><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span></li>`).join('')}</ol></div>`
  }
  if (panel.type === 'list') {
    return `<div class="panel-body"><ul class="simple-list">${panel.items.map(([title, detail, state]) =>
      `<li><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span><em data-state="${semanticState(state)}">${escapeHtml(state)}</em></li>`).join('')}</ul></div>`
  }
  if (panel.type === 'editor') {
    return `<div class="panel-body editor-body"><article class="editor-sheet"><p class="doc-kicker">4.2 SOURCE SELECTION</p><h3>${escapeHtml(panel.title)}</h3>${panel.paragraphs.map((paragraph) =>
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
      `<li class="${index === 0 ? 'selected' : ''}"><time>${escapeHtml(time)}</time><span><b>${escapeHtml(event)}</b></span><span class="event-state" data-state="${semanticState(state)}">${escapeHtml(state)}</span></li>`).join('')}</ol></div>`
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
    const mobilePositions = [
      [30, 12, 300, 82],
      [30, 132, 300, 82],
      [10, 270, 165, 92],
      [185, 270, 165, 92],
      [97.5, 430, 165, 92],
    ]
    const mobilePaths = [
      'M 180 94 V 132',
      'M 180 214 V 242 H 92.5 V 270',
      'M 180 242 H 267.5 V 270',
      'M 92.5 362 V 398 H 180 V 430',
      'M 267.5 362 V 398 H 180 V 430',
    ]
    return `<div class="panel-body graph-body"><svg class="impact-svg impact-svg-desktop" viewBox="0 0 800 470" role="img" aria-label="${escapeHtml(panel.title)}">
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
    </svg><svg class="impact-svg impact-svg-mobile" viewBox="0 0 360 540" role="img" aria-label="${escapeHtml(panel.title)} in a narrow layout">
      <defs><marker id="impact-arrow-mobile" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
      <g class="impact-links impact-links-mobile">${mobilePaths.map((path) => `<path d="${path}" />`).join('')}</g>
      ${panel.nodes.map(([id, name], index) => {
        const [x, y, width, height] = mobilePositions[index] ?? [30, 12 + index * 104, 300, 82]
        return `<g class="impact-node ${index === 0 ? 'changed' : ''}" transform="translate(${x} ${y})">
          <rect width="${width}" height="${height}" rx="7" />
          <text class="impact-node-id" x="12" y="22">${escapeHtml(id)}</text>
          <text class="impact-node-name" x="12" y="49">${escapeHtml(name)}</text>
          <text class="impact-node-state" x="12" y="71">${index ? 'AFFECTED' : 'CHANGED'}</text>
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

function panel(panel, className = '', surface = 'plain') {
  const titleId = `panel-title-${slug(panel.title)}`
  const subtitleId = `panel-subtitle-${slug(panel.title)}`
  const surfaceKind = surface === 'canvas' ? ' data-surface-kind="inset-object"' : ''
  return `<article class="panel panel-${escapeHtml(panel.type)} panel--${escapeHtml(surface)} ${className}" data-panel-surface="${escapeHtml(surface)}"${surfaceKind} aria-labelledby="${titleId}" aria-describedby="${subtitleId}">
    <header class="panel-header"><div class="panel-heading"><h2 id="${titleId}" class="panel-title">${escapeHtml(panel.title)}</h2><p id="${subtitleId}" class="panel-subtitle">${escapeHtml(panel.subtitle)}</p></div>${panel.menu === true ? iconButton('Open panel menu', 'ellipsis') : ''}</header>
    ${panelBody(panel)}
  </article>`
}

const navigationIconsByLayout = {
  review: ['clipboard-check', 'boxes', 'triangle-alert', 'file'],
  sessions: ['square-kanban', 'radio', 'bug', 'history'],
  writing: ['pen-line', 'files', 'messages-square', 'book-open-check'],
  telemetry: ['activity', 'upload', 'triangle-alert', 'search'],
  trade: ['scale', 'sliders-horizontal', 'activity', 'git-compare'],
  hil: ['sliders-horizontal', 'calendar-clock', 'file', 'clipboard-check'],
  supplier: ['package-open', 'package', 'triangle-alert', 'users'],
  impact: ['git-branch', 'file-input', 'boxes', 'badge-check'],
  load: ['lock', 'package', 'plane', 'history'],
  fracas: ['activity', 'file', 'flask', 'clipboard-check'],
}

const brandIconsByLayout = {
  review: 'shield',
  sessions: 'radio',
  writing: 'pen-line',
  telemetry: 'activity',
  trade: 'scale',
  hil: 'flask',
  supplier: 'package-open',
  impact: 'git-branch',
  load: 'lock',
  fracas: 'shield-plus',
}

function navigationIcon(system, index) {
  return navigationIconsByLayout[system.layout]?.[index] ?? (index === 0 ? 'home' : 'panels')
}

function nav(system, mode = 'rail') {
  return `<aside class="sidebar product-nav nav-${mode}" data-product-nav>
    <div class="brand"><span class="brand-mark">${icon(brandIconsByLayout[system.layout] ?? 'home', 19)}</span><span class="brand-copy"><b>${escapeHtml(system.shortName)}</b><small>${escapeHtml(system.category)}</small></span></div>
    <nav aria-label="Primary navigation">${system.nav.map((item, index) => `<button class="nav-item ${index === 0 ? 'active' : ''}" type="button" data-nav-target="${slug(item)}" data-nav-title="${escapeHtml(item)}"><span class="nav-symbol">${icon(navigationIcon(system, index), 18)}</span><b>${escapeHtml(item)}</b></button>`).join('')}</nav>
    <div class="nav-foot"><span class="presence-dot"></span><span>Local workspace</span><b>TW</b></div>
  </aside>`
}

function topbar(system, extra = '', mode = 'workspace', menuLabel = 'Open navigation') {
  return `<header class="product-topbar topbar-${mode}" data-shell-mode="${mode}">
    <div>${iconButton(menuLabel, 'menu', 'data-mobile-menu aria-expanded="false"')}<span class="crumb">${escapeHtml(system.shortName)}</span><span class="crumb-divider">/</span><span class="topbar-view-title view-label" data-view-title>${escapeHtml(system.homeTitle)}</span></div>
    <div class="topbar-tools">${extra}<button class="command-button" type="button" data-open-commands aria-label="Open command menu">${icon('search', 16)}<span>Find or run</span><kbd>⌘ K</kbd></button>${iconButton('Open help', 'circle-help', 'data-help-trigger aria-expanded="false"')}${iconButton('Use dark mode', 'moon', 'data-theme-toggle')}<span class="user-chip">TW</span></div>
  </header>`
}

const actionIconsById = {
  'record-review-finding': 'message-square-plus',
  'check-objective-coverage': 'badge-check',
  'start-copilot-session': 'play',
  'check-ste-wording': 'spell-check-2',
  'record-review-comment': 'message-square-plus',
  'mark-analysis-interval': 'brackets',
  'compare-sensor-source': 'git-compare',
  'record-engineering-note': 'pen-line',
  'run-performance-analysis': 'play',
  'compare-design-options': 'boxes',
  'start-test-campaign': 'play',
  'load-test-configuration': 'upload',
  'review-failed-procedure': 'triangle-alert',
  'validate-package-manifest': 'badge-check',
  'request-supplier-correction': 'message-square-plus',
  'trace-affected-design': 'git-branch',
  'review-module-impact': 'boxes',
  'authorize-load-release': 'key-round',
  'schedule-aircraft-load': 'calendar-clock',
  'verify-loaded-configuration': 'shield-check',
  'analyze-root-cause': 'git-branch',
  'record-containment-action': 'shield-plus',
  'assign-corrective-action': 'users',
}

function actionIcon(action) {
  if (actionIconsById[action.actionId]) return actionIconsById[action.actionId]
  const value = String(action.name).toLowerCase()
  if (/\b(run|start)\b/.test(value)) return 'play'
  if (/\b(load|import|receive|upload)\b/.test(value)) return 'upload'
  if (/\b(export|download)\b/.test(value)) return 'download'
  if (/\b(reserve|schedule)\b/.test(value)) return 'calendar'
  if (/\b(review|check|validate|verify|approve|authorize|accept|resolve|close)\b/.test(value)) return 'circle-check'
  if (/\b(trace|inspect|analyze|classify|compare)\b/.test(value)) return 'search'
  if (/\b(record|register|create|add|draft|define|mark)\b/.test(value)) return 'plus'
  return 'arrow-right'
}

function actions(system, className = 'domain-actions', actionIds = []) {
  const visible = actionIds.map((actionId) => {
    const action = system.scenarios.find((item) => item.actionId === actionId)
    if (!action) throw new Error(`${system.slug} has no action ${actionId}`)
    return action
  })
  const visibleIcons = visible.map((item) => actionIcon(item))
  if (new Set(visibleIcons).size !== visibleIcons.length) {
    throw new Error(`${system.slug} uses one icon for different visible actions.`)
  }
  return `<div class="${className}" aria-label="Product actions">${visible.map((item, index) =>
    `<button class="${index === 0 ? 'primary-action' : ''}" type="button" data-scenario-action="${item.actionId}" data-action-icon="${visibleIcons[index]}" data-target="${escapeHtml(item.target)}"><span>${icon(visibleIcons[index], 16)}</span>${escapeHtml(item.name)}</button>`).join('')}<button class="more-actions" type="button" data-open-commands>${icon('ellipsis', 16)} More actions</button></div>`
}

function regionAttributes(system, regionId, surfaceKind) {
  const region = system.design.config.pagePlan?.primaryLayout?.regions?.find((item) => item.id === regionId)
  if (!region) throw new Error(`${system.slug} has no design-contract region ${regionId}`)
  const narrowOrder = region.placement?.narrow?.order
  const widePlacement = region.placement?.wide
  if (!Number.isInteger(narrowOrder)) throw new Error(`${system.slug}/${regionId} has no narrow order.`)
  if (!Number.isInteger(widePlacement?.columnStart) || !Number.isInteger(widePlacement?.columnSpan) || !Number.isInteger(widePlacement?.rowStart)) {
    throw new Error(`${system.slug}/${regionId} has no wide placement.`)
  }
  return `data-task-region="${escapeHtml(regionId)}" data-region-id="${escapeHtml(regionId)}" data-region-role="${escapeHtml(region.role)}" data-region-priority="${region.priority}" data-region-order="${narrowOrder}" data-wide-column-start="${widePlacement.columnStart}" data-wide-column-span="${widePlacement.columnSpan}" data-wide-row-start="${widePlacement.rowStart}" data-narrow-behavior="${escapeHtml(region.narrowBehavior)}" data-surface-kind="${escapeHtml(surfaceKind)}" style="--region-column-start:${widePlacement.columnStart};--region-column-span:${widePlacement.columnSpan};--region-row-start:${widePlacement.rowStart};--region-narrow-order:${narrowOrder}"`
}

function taskHeading(system, className, actionMarkup = '', contractAttributes = '') {
  return `<header class="${className} task-heading" ${contractAttributes}>
    <div class="task-heading-copy"><p class="task-context eyebrow">${escapeHtml(system.eyebrow)}</p><h1 class="page-title task-title">${escapeHtml(system.headline)}</h1><p class="task-subtitle">${escapeHtml(system.subhead)}</p></div>${actionMarkup ? `
    ${actionMarkup}` : ''}
  </header>`
}

function decisionFacts(system, indexes, className = '') {
  if (!system.decisionPurpose) return ''
  const facts = indexes.map((index) => system.decisionFacts?.[index]).filter(Boolean)
  if (facts.length === 0) throw new Error(`${system.slug} has no facts for ${system.decisionPurpose}`)
  return `<dl class="decision-facts ${className}" aria-label="Decision facts" data-decision-purpose="${escapeHtml(system.decisionPurpose)}">${facts.map(([label, value, detail]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd><b>${escapeHtml(value)}</b><span>${escapeHtml(detail)}</span></dd></div>`).join('')}</dl>`
}

function reviewSurface(system) {
  return `${nav(system, 'review')}
    <section class="product-workspace">
      ${topbar(system, `<span class="independence-pill">${icon('check', 14)} Independent reviewer</span>`, 'review')}
      <main class="review-layout task-composition" data-composition="review-evidence" data-region="primary-workspace">
        ${taskHeading(system, 'review-context', actions(system, 'review-actions', ['record-review-finding', 'check-objective-coverage']))}
        <aside class="artifact-browser task-region" ${regionAttributes(system, 'context-rail', 'structural-pane')}>
          ${panel(system.panels[0], 'embedded-panel')}
        </aside>
        <section class="review-document task-region" ${regionAttributes(system, 'work-surface', 'primary-work-surface')}>${panel(system.panels[1], 'document-diff', 'canvas')}</section>
        <aside class="objective-inspector task-region" ${regionAttributes(system, 'detail-inspector', 'structural-pane')}>
          ${decisionFacts(system, [1, 3], 'review-facts')}
          ${panel(system.panels[2], 'objective-panel')}
        </aside>
      </main>
    </section>`
}

function sessionSurface(system) {
  return `${nav(system, 'sessions')}
    <section class="product-workspace">
      ${topbar(system, '<span class="focus-clock">Focus: 42 min</span>', 'sessions')}
      <main class="session-layout task-composition" data-composition="session-flow" data-region="primary-workspace">
        ${taskHeading(system, 'session-heading task-region', actions(system, 'session-actions', ['start-copilot-session']), regionAttributes(system, 'board-actions', 'structural-pane'))}
        <section class="session-board task-region" ${regionAttributes(system, 'flow-columns', 'primary-work-surface')}>${panel(system.panels[0], 'board-panel')}</section>
        <aside class="session-inspector task-region" ${regionAttributes(system, 'work-detail', 'structural-pane')}>${panel(system.panels[1], 'timeline-panel')}${panel(system.panels[2], 'issues-panel')}</aside>
      </main>
    </section>`
}

function writingSurface(system) {
  return `${nav(system, 'documents')}
    <section class="product-workspace">
      ${topbar(system, '<span class="save-state">Saved 10:18</span>', 'editor')}
      <main class="writing-layout task-composition" data-composition="document-editor" data-region="primary-workspace">
        ${taskHeading(system, 'writing-toolbar', actions(system, 'writing-actions', ['check-ste-wording', 'record-review-comment']))}
        <aside class="document-outline task-region" ${regionAttributes(system, 'document-outline', 'structural-pane')}><h2 class="section-title">Document outline</h2><ol><li>1 Purpose</li><li>2 References</li><li>3 Architecture</li><li class="active">4 Source selection</li><li>5 Failure response</li><li>6 Verification</li></ol></aside>
        <section class="document-canvas task-region" ${regionAttributes(system, 'document-canvas', 'primary-work-surface')}>${panel(system.panels[0], 'editor-panel', 'canvas')}</section>
        <aside class="writing-inspector task-region" ${regionAttributes(system, 'review-inspector', 'structural-pane')}><div class="inspector-tabs" aria-label="Review tools"><b>Writing</b><span>Comments</span></div>${panel(system.panels[1], 'diagnostic-panel')}${panel(system.panels[2], 'comment-panel')}</aside>
      </main>
    </section>`
}

function telemetrySurface(system) {
  return `<section class="product-workspace telemetry-shell">
      ${topbar(system, '<span class="recording-pill"><i></i> Recorded data</span>', 'instrument', 'Open channels')}
      <main class="telemetry-layout task-composition" data-composition="telemetry-triage" data-region="primary-workspace">
        ${taskHeading(system, 'telemetry-head', actions(system, 'telemetry-actions', ['mark-analysis-interval', 'compare-sensor-source', 'record-engineering-note']))}
        <aside class="channel-rail sidebar task-region" data-product-nav ${regionAttributes(system, 'scope-rail', 'structural-pane')}><h2 class="section-title">Channels</h2><label>Find channel<input value="normal accel" readonly /></label><ul><li class="active"><b>NZ</b><span>Normal acceleration</span><em>2.61 g</em></li><li><b>ELE</b><span>Elevator position</span><em>8.4°</em></li><li><b>CAS</b><span>Calibrated airspeed</span><em>241 kt</em></li><li><b>AP</b><span>Autopilot state</span><em>OFF</em></li></ul>${decisionFacts(system, [0, 1], 'channel-facts')}</aside>
        <section class="telemetry-primary task-region" ${regionAttributes(system, 'primary-plot', 'primary-work-surface')}><div class="telemetry-plot">${panel(system.panels[0], 'plot-panel', 'canvas')}</div><div class="investigation-strip">${panel(system.panels[2], 'investigation-status')}</div></section>
        <aside class="event-rail task-region" ${regionAttributes(system, 'event-stream', 'structural-pane')}>${panel(system.panels[1], 'event-panel')}</aside>
      </main>
    </section>`
}

function tradeSurface(system) {
  return `${nav(system, 'study')}
    <section class="product-workspace">
      ${topbar(system, '<span class="model-state">MATLAB ready</span>', 'analysis')}
      <main class="trade-layout task-composition" data-composition="trade-study" data-region="primary-workspace">
        ${taskHeading(system, 'trade-head', actions(system, 'trade-actions', ['run-performance-analysis', 'compare-design-options']))}
        <aside class="parameter-drawer task-region" ${regionAttributes(system, 'context-rail', 'structural-pane')}><h2 class="section-title">Case inputs</h2><label>Gross weight<span><input value="18,240" readonly /> kg</span></label><label>Cruise altitude<span><input value="35,000" readonly /> ft</span></label><label>Drag factor<span><input value="1.012" readonly /></span></label><label>Fuel reserve<span><input value="45" readonly /> min</span></label><button type="button">Compare assumptions</button></aside>
        <section class="trade-work task-region" ${regionAttributes(system, 'work-surface', 'primary-work-surface')}><div class="trade-plot">${panel(system.panels[0], 'scatter-panel', 'canvas')}</div><div class="trade-matrix">${panel(system.panels[1], 'matrix-panel')}</div></section>
        <aside class="trade-sensitivity task-region" ${regionAttributes(system, 'detail-inspector', 'structural-pane')}>${panel(system.panels[2], 'sensitivity-panel')}</aside>
      </main>
    </section>`
}

function hilSurface(system) {
  return `<section class="product-workspace hil-shell">
      ${topbar(system, '<span class="rig-health">● 4 / 5 rigs online</span>', 'control', 'Open bench navigation')}
      <main class="hil-layout task-composition" data-composition="test-campaign" data-region="primary-workspace">
        ${taskHeading(system, 'hil-head', actions(system, 'hil-actions', ['start-test-campaign', 'load-test-configuration', 'review-failed-procedure']))}
        <nav class="bench-tabs sidebar task-region" data-product-nav aria-label="Bench navigation" ${regionAttributes(system, 'context-rail', 'structural-pane')}>${system.nav.map((item, index) => `<button class="nav-item ${index === 0 ? 'active' : ''}" type="button" data-nav-target="${slug(item)}" data-nav-title="${escapeHtml(item)}"><span class="nav-symbol">${icon(navigationIcon(system, index), 18)}</span>${escapeHtml(item)}</button>`).join('')}${decisionFacts(system, [0, 3], 'campaign-facts')}</nav>
        <section class="hil-work task-region" ${regionAttributes(system, 'work-surface', 'primary-work-surface')}><div class="bench-schedule">${panel(system.panels[0], 'schedule-panel')}</div><div class="procedure-run">${panel(system.panels[1], 'pipeline-panel')}</div></section>
        <aside class="rig-console task-region" ${regionAttributes(system, 'detail-inspector', 'structural-pane')}>${panel(system.panels[2], 'console-panel', 'canvas')}</aside>
      </main>
    </section>`
}

function supplierSurface(system) {
  return `${nav(system, 'portal')}
    <section class="product-workspace">
      ${topbar(system, '<span class="supplier-org">Northstar Avionics</span>', 'portal')}
      <main class="supplier-layout task-composition" data-composition="delivery-wizard" data-region="primary-workspace">
        ${taskHeading(system, 'supplier-head')}
        <ol class="intake-stepper task-region" ${regionAttributes(system, 'task-progress', 'structural-pane')}><li class="done"><span>1</span>Received</li><li class="current"><span>2</span>Validate</li><li><span>3</span>Resolve gaps</li><li><span>4</span>Accept</li></ol>
        <section class="supplier-current-step task-region" ${regionAttributes(system, 'current-step', 'primary-work-surface')}>
          <div class="supplier-package">${panel(system.panels[0], 'intake-panel')}</div>
          <aside class="supplier-correction">${panel(system.panels[2], 'correction-panel')}</aside>
          <details class="supplier-history"><summary>View recent deliveries</summary>${panel(system.panels[1], 'history-panel')}</details>
        </section>
        <div class="supplier-step-actions task-region" ${regionAttributes(system, 'step-actions', 'structural-pane')}>${actions(system, 'supplier-actions', ['validate-package-manifest', 'request-supplier-correction'])}</div>
      </main>
    </section>`
}

function impactSurface(system) {
  return `<section class="product-workspace impact-shell">
      ${topbar(system, '<span class="graph-state">Trace index: current</span>', 'graph', 'Open change set')}
      <main class="impact-layout task-composition" data-composition="change-impact" data-region="primary-workspace">
        <section class="impact-context task-region" ${regionAttributes(system, 'change-context', 'structural-pane')}>
          ${taskHeading(system, 'impact-head', actions(system, 'impact-actions', ['trace-affected-design', 'review-module-impact']))}
          <aside class="change-rail"><h2 class="section-title">Change set</h2><b>CR-2026-044</b><p>Change the altitude source timeout from 500 ms to 300 ms.</p><dl><div><dt>Source</dt><dd>SYS-NAV-118</dd></div><div><dt>Revision</dt><dd>R18 → R19</dd></div><div><dt>Owner</dt><dd>Navigation</dd></div></dl>${decisionFacts(system, [0, 2], 'impact-facts')}</aside>
        </section>
        <section class="impact-graph task-region" ${regionAttributes(system, 'graph-canvas', 'primary-work-surface')}>${panel(system.panels[0], 'graph-panel', 'canvas')}</section>
        <aside class="impact-decision task-region" ${regionAttributes(system, 'selection-detail', 'structural-pane')}>${panel(system.panels[2], 'decision-panel')}${panel(system.panels[1], 'affected-panel')}</aside>
      </main>
    </section>`
}

function loadSurface(system) {
  return `${nav(system, 'release')}
    <section class="product-workspace">
      ${topbar(system, `<span class="secure-state">${icon('lock', 14)} Secure load mode</span>`, 'secure')}
      <main class="load-layout task-composition" data-composition="load-wizard" data-region="primary-workspace">
        ${taskHeading(system, 'load-head')}
        <section class="load-stepper task-region" ${regionAttributes(system, 'task-progress', 'structural-pane')}>${panel(system.panels[0], 'release-panel')}</section>
        <section class="load-current-step task-region" ${regionAttributes(system, 'current-step', 'primary-work-surface')}>
          <aside class="package-card" data-surface-kind="inset-object"><p class="overline">Selected package</p><span class="package-icon">SW</span><h2 class="section-title">FCS-OFP-24.8.2</h2><p>SHA-256 · Signature valid</p><dl><div><dt>Target</dt><dd>FCC-A</dd></div><div><dt>Aircraft</dt><dd>N812TX</dd></div><div><dt>Size</dt><dd>48.2 MB</dd></div></dl></aside>
          <div class="compatibility-view">${panel(system.panels[1], 'compatibility-panel')}</div>
          <aside class="load-history">${panel(system.panels[2], 'history-panel')}</aside>
        </section>
        <div class="load-step-actions task-region" ${regionAttributes(system, 'step-actions', 'structural-pane')}>${actions(system, 'load-actions', ['authorize-load-release', 'schedule-aircraft-load'])}</div>
      </main>
    </section>`
}

function fracasSurface(system) {
  return `${nav(system, 'cases')}
    <section class="product-workspace">
      ${topbar(system, '<span class="review-window">90-day review</span>', 'case')}
      <main class="fracas-layout task-composition" data-composition="failure-case" data-region="primary-workspace">
        ${taskHeading(system, 'fracas-head')}
        <aside class="case-list task-region" ${regionAttributes(system, 'case-list', 'structural-pane')}><h2 class="section-title">Failure cases</h2><label>Filter cases<input placeholder="Part, aircraft, or symptom" /></label><ul><li class="active"><b>FR-2026-118</b><span>ADC-B data dropout</span><em>Critical</em></li><li><b>FR-2026-116</b><span>Sensor bias drift</span><em>Open</em></li><li><b>FR-2026-109</b><span>Power transient</span><em>Action</em></li><li><b>FR-2026-104</b><span>Software timeout</span><em>Monitor</em></li></ul>${decisionFacts(system, [2, 3], 'case-facts')}</aside>
        <section class="case-evidence task-region" ${regionAttributes(system, 'case-evidence', 'primary-work-surface')}><div class="case-analysis">${panel(system.panels[1], 'investigation-panel')}</div><div class="reliability-trend">${panel(system.panels[0], 'pareto-panel')}</div></section>
        <aside class="case-actions task-region" ${regionAttributes(system, 'decision-area', 'structural-pane')}>${actions(system, 'fracas-actions', ['analyze-root-cause', 'record-containment-action', 'assign-corrective-action'])}${panel(system.panels[2], 'actions-panel')}</aside>
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

function validateRenderedComposition(system, markup) {
  const h1Count = (markup.match(/<h1\b/g) ?? []).length
  if (h1Count !== 1 || !/<h1 class="page-title task-title">/.test(markup)) {
    throw new Error(`${system.slug} must have one visible page title.`)
  }
  const topbars = markup.match(/<header class="product-topbar[^>]*>[\s\S]*?<\/header>/g) ?? []
  if (topbars.some((topbarMarkup) => /<h1\b/.test(topbarMarkup))) {
    throw new Error(`${system.slug} uses a page heading in the top bar.`)
  }
  const expectedRegions = system.design.config.pagePlan?.primaryLayout?.regions?.map((region) => region.id) ?? []
  const renderedRegions = [...markup.matchAll(/data-region-id="([^"]+)"/g)].map((match) => match[1])
  if (renderedRegions.length !== expectedRegions.length ||
      [...renderedRegions].sort().join('|') !== [...expectedRegions].sort().join('|')) {
    throw new Error(`${system.slug} does not render its design-contract regions.`)
  }
  if ((markup.match(/data-region-role="primary"/g) ?? []).length !== 1) {
    throw new Error(`${system.slug} must have one primary work surface.`)
  }
  if (/<h3[^>]*class="panel-title"/.test(markup) || !/<h2[^>]*class="panel-title"/.test(markup)) {
    throw new Error(`${system.slug} has an invalid panel heading hierarchy.`)
  }
  const iconTags = [...markup.matchAll(/<svg\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /class="[^"]*\blucide\b/.test(tag))
  if (iconTags.some((tag) => !/data-icon-name=/.test(tag))) {
    throw new Error(`${system.slug} has an icon without semantic metadata.`)
  }
}

function supportUi(system) {
  return `<section class="scenario-results" aria-live="polite">${system.scenarios.map((item, index) =>
      `<div class="scenario-result ${index === system.scenarios.length - 1 ? 'is-failure' : ''}" role="status" data-scenario-result="${item.actionId}" data-reward="${escapeHtml(system.reward)}">${icon(index === system.scenarios.length - 1 ? 'x' : 'circle-check', 18)}<span>${escapeHtml(item.result)}</span></div>`).join('')}</section>
    <aside class="help-popover" data-help-popover hidden><header><b>${escapeHtml(system.shortName)} help</b>${iconButton('Close help', 'x', 'data-close-help')}</header><p>${escapeHtml(system.description)}</p><p>Select “${escapeHtml(system.scenarios[0].name)}” to start. Use the command menu for other actions.</p></aside>
    <div class="command-dialog" data-command-dialog hidden><section class="command-card" role="dialog" aria-modal="true" aria-label="Command menu"><div class="command-search"><input data-command-input aria-label="Find an action" placeholder="Find an action" />${iconButton('Close command menu', 'x', 'data-close-commands')}</div><ul class="command-list">${system.scenarios.map((item) => `<li data-command-item="${item.actionId}"><button type="button"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.target)}</small></button></li>`).join('')}</ul></section></div>`
}

export function renderProductDocument(system) {
  const render = renderers[system.layout]
  if (!render) throw new Error(`No product renderer for ${system.layout}`)
  const design = system.design
  if (!design) throw new Error(`No design profile for ${system.slug}`)
  const primaryView = design.config.pagePlan?.primaryViewKind ?? design.viewKinds[0] ?? 'workbench'
  const recipeId = design.config.pagePlan?.primaryLayout?.recipeId ?? 'RCP-WORKBENCH-001'
  const config = JSON.stringify({
    name: system.name,
    reward: system.reward,
    scenarios: system.scenarios,
    architecture: system.architecture,
    design,
  }).replaceAll('<', '\\u003c')
  const manifest = JSON.stringify(design.config).replaceAll('<', '\\u003c')
  const productSurface = render(system)
  validateRenderedComposition(system, productSurface)
  return `<!doctype html>
<html lang="en" data-design-contract="EUIT-FRONTEND-001">
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
    <link rel="stylesheet" href="./theme.css" />
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./product-layouts.css" />
    <link rel="stylesheet" href="./modern-system.css" />
  </head>
  <body class="product-v5 product-${escapeHtml(system.layout)}" data-density="${escapeHtml(design.density)}" data-product-layout="${escapeHtml(system.layout)}" data-layout-recipe="${escapeHtml(recipeId)}" data-primary-view="${escapeHtml(primaryView)}">
    <div class="app-shell">${productSurface}<button class="navigation-scrim" type="button" aria-label="Close navigation" data-close-navigation></button></div>
    ${supportUi(system)}
    <script id="design-system-manifest" type="application/json">${manifest}</script>
    <script id="product-config" type="application/json">${config}</script>
    <script src="./runtime.js"></script>
  </body>
</html>
`
}
