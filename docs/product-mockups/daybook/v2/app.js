/* Daybook v2 mockup - interface. Reads the Rowan fixture from model.js. */
'use strict'
/* global ROOM, TYPE_META, LESSONS, LAYOUT, PACKS, REFLECTIONS, CARRY_FORWARD, HALF_TERM */

const $ = (id) => document.getElementById(id)
function el(tag, cls, html, parent) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html !== undefined && html !== null) n.innerHTML = html
  if (parent) parent.appendChild(n)
  return n
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const state = {
  ws: 'week',
  day: 'mon',
  sheetTab: 'plan',
  area: 'carpet',
  pack: 'mon',
  refl: 'mon',
  zoom: 1,
  teach: { phase: 1, remaining: 0, running: false, timerId: null, notes: [] },
}
const lessonOf = (id) => LESSONS.find((l) => l.id === id)
const packOf = (id) => PACKS.find((p) => p.lesson === id)
const reflOf = (id) => REFLECTIONS.find((r) => r.lesson === id)
const totalMinutes = (l) => l.phases.reduce((a, p) => a + p.minutes, 0)

// ------------------------------------------------------------------ header --
$('ctxRoom').textContent = `${ROOM.name} · ${ROOM.cohort} · ${ROOM.children} children`
$('ctxTerm').textContent = `${ROOM.term} · ${ROOM.week}`

// ------------------------------------------------------------------- room --
function roomSvg(interactive, highlightAreas) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 100 80')
  svg.classList.add(interactive ? 'room-svg' : 'mini-room')
  const hi = highlightAreas || null
  for (const a of LAYOUT.areas) {
    const g = document.createElementNS(NS, 'g')
    const r = document.createElementNS(NS, 'rect')
    r.setAttribute('x', a.x); r.setAttribute('y', a.y)
    r.setAttribute('width', a.w); r.setAttribute('height', a.h)
    r.setAttribute('rx', 1.5)
    r.classList.add('area')
    if (!a.ready) r.classList.add('notready')
    if (interactive && state.area === a.id) r.classList.add('sel')
    if (hi && hi.includes(a.name)) r.classList.add('sel')
    const t = document.createElementNS(NS, 'text')
    t.setAttribute('x', a.x + 2); t.setAttribute('y', a.y + 5)
    t.classList.add('area-label')
    t.textContent = a.name
    const d = document.createElementNS(NS, 'text')
    d.setAttribute('x', a.x + 2); d.setAttribute('y', a.y + a.h - 2)
    d.classList.add('area-ready')
    d.setAttribute('fill', a.ready ? '#3d7a4f' : '#b0762a')
    d.textContent = a.ready ? 'READY' : 'TO SET'
    g.appendChild(r); g.appendChild(t); g.appendChild(d)
    if (interactive) {
      g.style.cursor = 'pointer'
      g.addEventListener('click', () => { state.area = a.id; render() })
    }
    svg.appendChild(g)
  }
  return svg
}

// ------------------------------------------------------------------ sider --
function renderSider() {
  const body = $('siderBody')
  body.innerHTML = ''
  const title = $('siderTitle')

  if (state.ws === 'week' || state.ws === 'reflections') {
    title.textContent = state.ws === 'week' ? 'This week' : 'Reflections this week'
    for (const l of LESSONS) {
      const meta = TYPE_META[l.type]
      const card = el('button', `lesson-card accent-${meta.accent}${(state.ws === 'week' ? state.day : state.refl) === l.id ? ' sel' : ''}`, null, body)
      const refl = reflOf(l.id)
      const stateTxt = refl.state === 'complete'
        ? '<span class="state done">Reflected</span>'
        : '<span class="state todo">To reflect</span>'
      el('div', 'day', `${l.day} · ${l.time}${stateTxt}`, card)
      el('div', 't', esc(l.title), card)
      el('div', 'meta', `${meta.label} · ${l.group}`, card)
      card.addEventListener('click', () => {
        if (state.ws === 'week') state.day = l.id
        else state.refl = l.id
        render()
      })
    }
  } else if (state.ws === 'plans') {
    title.textContent = 'Half term'
    for (const w of HALF_TERM.weeks) {
      const row = el('button', `srow${w.state === 'current' ? ' sel' : ''}`, null, body)
      el('b', null, `Week ${w.n} · ${w.dates}`, row)
      el('span', null, esc(w.focus), row)
    }
  } else if (state.ws === 'classroom') {
    title.textContent = 'Areas'
    for (const a of LAYOUT.areas) {
      const row = el('button', `srow${state.area === a.id ? ' sel' : ''}`, null, body)
      el('b', null, `${a.name} ${a.ready ? '· ready' : '· to set'}`, row)
      el('span', null, esc(a.invitation), row)
      row.addEventListener('click', () => { state.area = a.id; render() })
    }
  } else if (state.ws === 'resources') {
    title.textContent = 'Packs this week'
    for (const p of PACKS) {
      const l = lessonOf(p.lesson)
      const row = el('button', `srow${state.pack === p.lesson ? ' sel' : ''}`, null, body)
      el('b', null, `${esc(p.name)} ${p.ready ? '· ready' : '· to prepare'}`, row)
      el('span', null, `${l.day} · ${esc(l.title)}`, row)
      row.addEventListener('click', () => { state.pack = p.lesson; render() })
    }
  }
}

// ------------------------------------------------------------------ canvas --
function renderCanvas() {
  const host = $('canvasInner')
  host.innerHTML = ''
  if (state.ws === 'week') renderWeekBook(host)
  else if (state.ws === 'plans') renderPlans(host)
  else if (state.ws === 'classroom') renderClassroom(host)
  else if (state.ws === 'resources') renderResources(host)
  else renderReflections(host)
}

function dayStrip(host, selId, onPick) {
  const strip = el('div', 'daystrip', null, host)
  for (const l of LESSONS) {
    const t = el('button', `daytab${selId === l.id ? ' sel' : ''}`, null, strip)
    el('div', 'd', `${l.day} ${l.date}`, t)
    el('div', 'n', esc(l.title), t)
    t.addEventListener('click', () => onPick(l.id))
  }
}

function renderWeekBook(host) {
  dayStrip(host, state.day, (id) => { state.day = id; render() })
  const l = lessonOf(state.day)
  const meta = TYPE_META[l.type]
  const sheet = el('div', `sheet accent-${meta.accent}`, null, host)
  el('div', 'eyebrow', `${l.day} ${l.date} · ${l.time} · ${meta.label}`, sheet)
  el('h1', 'title', esc(l.title), sheet)
  el('div', 'sub', `${l.group}`, sheet)
  const chips = el('div', 'chips', null, sheet)
  for (const th of l.threads) el('span', 'chip acc', esc(th), chips)
  if (!l.threads.length) el('span', 'chip', 'No threads linked', chips)

  const tabs = el('div', 'sheet-tabs', null, sheet)
  const pages = { plan: 'Planning sheet', setup: 'Classroom setup', res: 'Resources and print' }
  for (const [key, label] of Object.entries(pages)) {
    const b = el('button', state.sheetTab === key ? 'active' : '', label, tabs)
    b.addEventListener('click', () => { state.sheetTab = key; render() })
  }

  if (state.sheetTab === 'plan') {
    el('div', 'intent', `<b>Learning intention.</b> ${esc(l.intention)}`, sheet)
    el('div', 'intent', `<b>Listen and look for.</b> ${esc(l.listenFor)}`, sheet)
    for (const p of l.phases) {
      const row = el('div', 'phase', null, sheet)
      el('div', 'min', `<b>${p.minutes}</b><span>min</span>`, row)
      const body = el('div', null, null, row)
      el('h3', null, esc(p.name), body)
      el('p', null, `<b>Children.</b> ${esc(p.children)}`, body)
      el('p', null, `<b>Adult.</b> ${esc(p.adult)}`, body)
      if (p.notice) el('p', 'notice', `<b>Notice.</b> ${esc(p.notice)}`, body)
    }
    el('div', 'total', `Planned time <b>${totalMinutes(l)} minutes</b> · duration is a guide, not a score`, sheet)
    const foot = el('div', 'sheet-foot', null, sheet)
    const pr = el('button', 'abtn', 'Print sheet', foot)
    pr.title = 'This control is not in the v2 mockup.'
    const tv = el('button', 'abtn primary', 'Open teaching view', foot)
    tv.addEventListener('click', openTeach)
  } else if (state.sheetTab === 'setup') {
    el('div', 'intent', `<b>Areas for this lesson.</b> ${l.areas.join(', ')}.`, sheet)
    const wrap = el('div', 'roomwrap', null, sheet)
    wrap.appendChild(roomSvg(false, l.areas))
    const adults = el('div', null, null, sheet)
    adults.style.marginTop = '12px'
    for (const a of LAYOUT.adults) {
      el('div', 'slip', `<b>${a.name}</b><span>${esc(a.route)}</span>`, adults)
    }
    el('p', 'sub', esc(LAYOUT.transitions), sheet).style.marginTop = '10px'
  } else {
    const p = packOf(l.id)
    el('div', 'intent', `<b>${esc(p.name)}.</b> ${p.ready ? 'Marked ready.' : 'Not yet marked ready.'}`, sheet)
    const tbl = el('table', 'restable', null, sheet)
    tbl.innerHTML = '<thead><tr><th>Physical item</th><th>State</th></tr></thead>'
    const tb = el('tbody', null, null, tbl)
    for (const it of p.physical) {
      el('tr', null, `<td>${esc(it.item)}</td><td>${it.ready ? '<span class="pill ok">In place</span>' : '<span class="pill wait">To collect</span>'}</td>`, tb)
    }
    const tbl2 = el('table', 'restable', null, sheet)
    tbl2.innerHTML = '<thead><tr><th>Printable</th><th>Size</th><th>Mode</th><th class="num">Copies</th><th>Queue</th></tr></thead>'
    const tb2 = el('tbody', null, null, tbl2)
    for (const d of p.printables) {
      el('tr', null,
        `<td>${esc(d.doc)} <span class="kindtag">${d.kind}</span></td><td>${d.size}</td><td>${d.mode}</td>` +
        `<td class="num">${d.copies}</td><td>${d.queued ? '<span class="pill ok">Queued</span>' : '<span class="pill wait">Not queued</span>'}</td>`, tb2)
    }
  }
}

function renderPlans(host) {
  const sheet = el('div', 'sheet', null, host)
  el('div', 'eyebrow', 'Half-term map', sheet)
  el('h1', 'title', esc(HALF_TERM.name), sheet)
  el('div', 'intent', `<b>Intent.</b> ${esc(ROOM.intent)}`, sheet)
  const grid = el('div', 'weekgrid', null, sheet)
  for (const w of HALF_TERM.weeks) {
    const c = el('div', `wk${w.state === 'current' ? ' current' : ''}${w.state === 'break' ? ' break' : ''}`, null, grid)
    el('div', 'n', `Week ${w.n} · ${w.dates}`, c)
    el('p', null, esc(w.focus), c)
  }
  el('div', 'eyebrow', 'Curriculum threads', sheet).style.marginTop = '18px'
  for (const th of HALF_TERM.threads) {
    const row = el('div', `threadrow accent-${th.accent}`, null, sheet)
    el('div', 'name', esc(th.name), row)
    for (let w = 1; w <= 6; w++) el('div', `cell${th.weeks.includes(w) ? ' on' : ''}`, '', row)
  }
  el('div', 'eyebrow', 'Plan library', sheet).style.marginTop = '20px'
  const tbl = el('table', 'libtable', null, sheet)
  tbl.innerHTML = '<thead><tr><th>Plan</th><th>Type</th><th>Owner</th><th>Last use</th></tr></thead>'
  const tb = el('tbody', null, null, tbl)
  for (const p of HALF_TERM.library) {
    el('tr', null, `<td>${esc(p.name)}</td><td>${p.type}</td><td>${p.owner}</td><td>${p.used}</td>`, tb)
  }
}

function renderClassroom(host) {
  const sheet = el('div', 'sheet', null, host)
  el('div', 'eyebrow', 'Rowan room · this week', sheet)
  el('h1', 'title', 'Classroom and provision', sheet)
  el('div', 'sub', 'Select an area on the plan. The room plan is an educational setup view, not a safety plan.', sheet)
  const wrap = el('div', 'roomwrap', null, sheet)
  wrap.style.marginTop = '14px'
  wrap.appendChild(roomSvg(true))
}

function renderResources(host) {
  const p = packOf(state.pack)
  const l = lessonOf(state.pack)
  const sheet = el('div', 'sheet', null, host)
  const head = el('div', 'packhead', null, sheet)
  el('h1', 'title', esc(p.name), head)
  el('span', p.ready ? 'pill ok' : 'pill wait', p.ready ? 'Pack ready' : 'To prepare', head)
  el('div', 'sub', `${l.day} · ${esc(l.title)} · readiness is a deliberate action, never inferred`, sheet)

  el('div', 'eyebrow', 'Physical items', sheet).style.marginTop = '16px'
  const tbl = el('table', 'restable', null, sheet)
  tbl.innerHTML = '<thead><tr><th></th><th>Item</th><th>State</th></tr></thead>'
  const tb = el('tbody', null, null, tbl)
  p.physical.forEach((it, i) => {
    const tr = el('tr', null, null, tb)
    const tdT = el('td', null, null, tr)
    const tick = el('button', `tick${it.ready ? ' on' : ''}`, it.ready ? '✓' : '', tdT)
    tick.setAttribute('aria-label', `Mark ${it.item}`)
    tick.addEventListener('click', () => { it.ready = !it.ready; render() })
    el('td', null, esc(it.item), tr)
    el('td', null, it.ready ? '<span class="pill ok">In place</span>' : '<span class="pill wait">To collect</span>', tr)
  })

  el('div', 'eyebrow', 'Printables', sheet).style.marginTop = '16px'
  const tbl2 = el('table', 'restable', null, sheet)
  tbl2.innerHTML = '<thead><tr><th>Document</th><th>Provenance</th><th>Size</th><th>Mode</th><th class="num">Copies</th><th>Print queue</th></tr></thead>'
  const tb2 = el('tbody', null, null, tbl2)
  for (const d of p.printables) {
    const tr = el('tr', null,
      `<td>${esc(d.doc)}</td><td><span class="kindtag">${d.kind}</span></td><td>${d.size}</td>` +
      `<td>${d.mode}</td><td class="num">${d.copies}</td>`, tb2)
    const td = el('td', null, null, tr)
    const b = el('button', 'abtn', d.queued ? 'Remove from queue' : 'Add to queue', td)
    b.addEventListener('click', () => { d.queued = !d.queued; render() })
  }
}

function renderReflections(host) {
  const strip = el('div', 'refstrip', null, host)
  for (const l of LESSONS) {
    const r = reflOf(l.id)
    const c = el('button', `refcard${state.refl === l.id ? ' sel' : ''}`, null, strip)
    el('div', 'd', l.day, c)
    el('div', 's', r.state === 'complete'
      ? '<span class="state done">Reflected</span>'
      : '<span class="state todo">Not yet taught</span>', c)
    c.addEventListener('click', () => { state.refl = l.id; render() })
  }
  const l = lessonOf(state.refl)
  const r = reflOf(state.refl)
  const sheet = el('div', 'sheet', null, host)
  el('div', 'eyebrow', `${l.day} · ${TYPE_META[l.type].label}`, sheet)
  el('h1', 'title', esc(l.title), sheet)
  if (r.state !== 'complete') {
    el('div', 'intent', '<b>Not yet taught.</b> The reflection opens from Finish lesson in Teaching View, or from here after the session. A reflection can be short.', sheet)
    return
  }
  el('div', 'intent', `<b>What happened.</b> ${esc(r.happened)}`, sheet)
  el('div', 'quote', `${esc(r.quote.text)}<span class="who">${r.quote.child}, in the session</span>`, sheet)
  const kct = el('div', 'kct', null, sheet)
  el('div', 'col keep', `<h4>Keep</h4>${esc(r.keep)}`, kct)
  el('div', 'col change', `<h4>Change</h4>${esc(r.change)}`, kct)
  el('div', 'col try', `<h4>Try next</h4>${esc(r.tryNext)}`, kct)
  if (r.team) el('div', 'intent', `<b>Team response · ${r.team.by}.</b> ${esc(r.team.text)}`, sheet)
  el('div', 'eyebrow', 'Carry forward', sheet).style.marginTop = '14px'
  const cf = CARRY_FORWARD.find((c) => c.from.startsWith(l.day))
  if (cf) {
    el('div', 'carry',
      `<span class="arrow">&#8618;</span><span>${esc(cf.decision)}</span>` +
      `<span class="to">${cf.to}</span><span class="attached">Attached</span>`, sheet)
  } else {
    el('div', 'carry', '<span>No carry-forward decision from this session.</span>', sheet)
  }
}

// -------------------------------------------------------------------- prep --
function renderPrep() {
  const host = $('prepRail')
  host.innerHTML = ''
  if (state.ws === 'week') {
    const l = lessonOf(state.day)
    const room = el('div', 'prep-block', '<h4>Room at a glance</h4>', host)
    room.appendChild(roomSvg(false, l.areas))
    const adults = el('div', 'prep-block', '<h4>Adults today</h4>', host)
    for (const a of LAYOUT.adults) el('div', 'slip', `<b>${a.name}</b><span>${esc(a.route)}</span>`, adults)
    const p = packOf(l.id)
    const readyCount = p.physical.filter((i) => i.ready).length
    const pk = el('div', 'prep-block',
      `<h4>Pack readiness</h4><div class="checkline"><span>${esc(p.name)}: ${readyCount} of ${p.physical.length} items in place, ` +
      `${p.printables.filter((d) => d.queued).length} of ${p.printables.length} printables queued.</span></div>`, host)
    void pk
    const note = el('div', 'prep-block', '<h4>Class note</h4>', host)
    el('div', 'note-clip', `${esc(l.priorNote)}`, note)
  } else if (state.ws === 'plans') {
    el('div', 'prep-block', `<h4>Week focus</h4><div>${esc(ROOM.weekFocus)}</div>`, host)
    el('div', 'prep-block', '<h4>Reuse rule</h4><div>A library plan opens as an editable copy. The original keeps its attribution and version.</div>', host)
  } else if (state.ws === 'classroom') {
    const a = LAYOUT.areas.find((x) => x.id === state.area)
    const blk = el('div', 'prep-block', `<h4>${esc(a.name)}</h4>`, host)
    el('div', null, `<b>Invitation.</b> ${esc(a.invitation)}`, blk).style.marginBottom = '6px'
    el('div', null, `<b>Intention.</b> ${esc(a.intention)}`, blk).style.marginBottom = '6px'
    const line = el('div', 'checkline', null, blk)
    const tick = el('button', `tick${a.ready ? ' on' : ''}`, a.ready ? '✓' : '', line)
    tick.setAttribute('aria-label', `Mark ${a.name} ready`)
    tick.addEventListener('click', () => { a.ready = !a.ready; render() })
    el('span', null, a.ready ? 'Set up and checked for today' : 'Not yet set for today', line)
    const linked = LESSONS.filter((l) => l.areas.includes(a.name))
    const lk = el('div', 'prep-block', '<h4>Linked plans</h4>', host)
    if (linked.length) for (const l of linked) el('div', 'slip', `<b>${l.day}</b><span>${esc(l.title)}</span>`, lk)
    else el('div', null, 'No plan uses this area this week.', lk)
    el('div', 'prep-block', `<h4>Transitions</h4><div>${esc(LAYOUT.transitions)}</div>`, host)
  } else if (state.ws === 'resources') {
    const jobs = []
    for (const p of PACKS) for (const d of p.printables) if (d.queued) jobs.push(d)
    const sheets = jobs.reduce((a, d) => a + d.copies, 0)
    const q = el('div', 'prep-block', `<h4>Print queue</h4><div>${jobs.length} jobs · ${sheets} sheets · staff-room printer</div>`, host)
    for (const d of jobs) el('div', 'checkline', `<span>${esc(d.doc)} · ${d.size} ${d.mode} · ${d.copies} copies</span>`, q)
    const run = el('button', 'abtn', 'Print queue now', q)
    run.title = 'This control is not in the v2 mockup.'
    run.style.marginTop = '8px'
    el('div', 'prep-block', '<h4>Provenance rule</h4><div>Every preview carries an Illustration, Actual pack, or Printable preview label. A generated printable needs adult review before children see it.</div>', host)
  } else {
    const blk = el('div', 'prep-block', '<h4>Carry forward this week</h4>', host)
    for (const c of CARRY_FORWARD) {
      el('div', 'slip', `<b>${esc(c.decision)}</b><span>${c.from} &#8594; ${c.to}</span>`, blk)
    }
    el('div', 'prep-block', '<h4>Reflection rule</h4><div>A reflection can be complete without an attachment, a tag, or a minimum length. Judgement stays with the teacher.</div>', host)
  }
}

// ------------------------------------------------------------- teaching view --
function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function openTeach() {
  const t = state.teach
  t.phase = 0
  t.notes = []
  loadPhase(0)
  $('teach').classList.add('open')
}
function loadPhase(idx) {
  const l = lessonOf(state.day)
  const t = state.teach
  stopTimer()
  t.phase = idx
  t.remaining = l.phases[idx].minutes * 60
  renderTeach()
}
function startTimer() {
  const t = state.teach
  if (t.running) return
  t.running = true
  t.timerId = setInterval(() => {
    t.remaining = Math.max(0, t.remaining - 1)
    updateClock()
    if (t.remaining === 0) stopTimer('Time. The timer is a prompt, not a rule.')
  }, 1000)
  updateClock()
}
function stopTimer(msg) {
  const t = state.teach
  t.running = false
  if (t.timerId) { clearInterval(t.timerId); t.timerId = null }
  updateClock(msg)
}
function updateClock(msg) {
  const t = state.teach
  $('clock').textContent = fmt(t.remaining)
  $('clockState').textContent = msg || (t.running ? 'Running' : (t.remaining ? 'Paused' : 'Time'))
  const box = $('timerBox')
  box.classList.toggle('running', t.running)
  box.classList.toggle('low', t.remaining > 0 && t.remaining <= 60)
}
function renderTeach() {
  const l = lessonOf(state.day)
  const t = state.teach
  const p = l.phases[t.phase]
  $('teachTitle').textContent = l.title
  $('teachMeta').textContent = `${l.day} ${l.date} · ${l.time} · ${l.group}`
  const stage = $('teachStage')
  stage.innerHTML = ''
  const path = el('div', 'phasepath', null, stage)
  l.phases.forEach((ph, i) => {
    if (i) el('span', 'link', '', path)
    const d = el('span', `pdot${i < t.phase ? ' done' : ''}${i === t.phase ? ' now' : ''}`, null, path)
    el('i', null, i < t.phase ? '✓' : String(i + 1), d)
    el('span', null, esc(ph.name), d)
  })
  el('div', 'eyebrow', `Phase ${t.phase + 1} of ${l.phases.length} · ${p.minutes} minutes planned`, stage)
  el('h1', null, esc(p.name), stage)
  el('div', 'activity', esc(p.children), stage)
  if (p.notice) el('div', 'promptcard', `<h4>Listen and look for</h4><p>${esc(p.notice)}</p>`, stage)
  el('div', 'adultrole', `<b>Adult role.</b> ${esc(p.adult)}`, stage)

  const res = $('teachResources')
  res.innerHTML = ''
  const pk = packOf(l.id)
  for (const it of pk.physical) {
    el('div', 'checkline', `<span class="tick${it.ready ? ' on' : ''}">${it.ready ? '✓' : ''}</span><span>${esc(it.item)}</span>`, res)
  }
  const notes = $('qnoteList')
  notes.innerHTML = ''
  for (const n of t.notes) el('div', 'qchip', `<b>${n.stamp}</b>${esc(n.text)}`, notes)

  $('tPrev').disabled = t.phase === 0
  $('tNext').textContent = t.phase === l.phases.length - 1 ? 'Last phase' : 'Next phase'
  $('tNext').disabled = t.phase === l.phases.length - 1
  updateClock()
}
$('openTeach').addEventListener('click', openTeach)
$('teachClose').addEventListener('click', () => { stopTimer(); $('teach').classList.remove('open') })
$('tStart').addEventListener('click', startTimer)
$('tPause').addEventListener('click', () => stopTimer())
$('tPlus').addEventListener('click', () => { state.teach.remaining += 120; updateClock() })
$('tPrev').addEventListener('click', () => loadPhase(Math.max(0, state.teach.phase - 1)))
$('tNext').addEventListener('click', () => {
  const l = lessonOf(state.day)
  loadPhase(Math.min(l.phases.length - 1, state.teach.phase + 1))
})
$('tFinish').addEventListener('click', () => {
  stopTimer()
  $('teach').classList.remove('open')
  state.ws = 'reflections'
  state.refl = state.day
  render()
})
$('qnoteAdd').addEventListener('click', () => {
  const inp = $('qnoteInput')
  const text = inp.value.trim()
  if (!text) return
  const l = lessonOf(state.day)
  const t = state.teach
  const used = l.phases[t.phase].minutes * 60 - t.remaining
  t.notes.push({ stamp: `P${t.phase + 1} +${fmt(Math.max(0, used))}`, text })
  inp.value = ''
  renderTeach()
})

// ------------------------------------------------------------------- zoom --
function applyZoom() {
  $('app').style.transform = state.zoom === 1 ? '' : `scale(${state.zoom})`
}
$('zoomFit').addEventListener('click', () => {
  state.zoom = Math.min(1, Math.round(($('zoomHost').clientWidth / 1280) * 100) / 100)
  applyZoom()
})
$('zoomOut').addEventListener('click', () => { state.zoom = Math.max(0.4, state.zoom - 0.1); applyZoom() })
$('zoomIn').addEventListener('click', () => { state.zoom = Math.min(1.2, state.zoom + 0.1); applyZoom() })

// ------------------------------------------------------------------ render --
document.querySelectorAll('.nav button').forEach((b) => {
  b.addEventListener('click', () => { state.ws = b.dataset.ws; render() })
})
function render() {
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.ws === state.ws))
  renderSider()
  renderCanvas()
  renderPrep()
}
render()
