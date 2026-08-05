/* DockPlan Workbench v2 mockup - interface. Reads SCENE from model.js. */
'use strict'
/* global SCENE, VEHICLE */

// ------------------------------------------------------------------ helpers
const $ = (id) => document.getElementById(id)
const NS = 'http://www.w3.org/2000/svg'
function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(n)
  return n
}
function el(tag, cls, html, parent) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html !== undefined && html !== null) n.innerHTML = html
  if (parent) parent.appendChild(n)
  return n
}
const f1 = (v) => v.toFixed(1)
const f2 = (v) => v.toFixed(2)
const DEG = 180 / Math.PI
const clip = (v, a, b) => Math.min(b, Math.max(a, v))

const T = VEHICLE.tractor, TR = VEHICLE.trailer
function footprint(cx, cy, phi, ahead, behind, half) {
  const ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy, ny = ux
  return [
    [cx + ux * ahead - nx * half, cy + uy * ahead - ny * half],
    [cx + ux * ahead + nx * half, cy + uy * ahead + ny * half],
    [cx - ux * behind + nx * half, cy - uy * behind + ny * half],
    [cx - ux * behind - nx * half, cy - uy * behind - ny * half],
  ]
}
function bodiesOf(q) {
  return {
    tractor: footprint(q.tractorAxle[0], q.tractorAxle[1], q.tractorHeading,
      T.wheelbase + T.frontOverhang, T.rearOverhang, T.width / 2),
    trailer: footprint(q.axle[0], q.axle[1], q.trailerHeading,
      TR.kingpinToAxle + TR.frontOverhang, TR.rearOverhang, TR.width / 2),
  }
}
const ptsAttr = (pts) => pts.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ')
function polyPathD(polys) {
  let d = ''
  for (const poly of polys) {
    d += `M${poly.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}Z`
  }
  return d
}
function inflatePoly(poly, m) {
  let cx = 0, cy = 0
  for (const p of poly) { cx += p[0]; cy += p[1] }
  cx /= poly.length; cy /= poly.length
  return poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1
    return [x + (dx / L) * m, y + (dy / L) * m]
  })
}

// ------------------------------------------------------------------- state
const state = {
  ws: 'scenario',
  run: 'run-015',
  compare: false,
  station: 0,
  playing: false,
  selectedCheck: null,
  plannerDone: true, // search result is present when the app opens
}
const runOf = () => SCENE.runs[state.run]
const C = {
  cyan: '#4fb9c9', violet: '#a487e0', amber: '#d9a441', red: '#d4574e',
  green: '#57a066', track: '#5d7d62', text: '#d6d9dc', muted: '#9aa1a7',
  faint: '#6b7278', line: '#2e3338',
}

// ============================================================== canvas ====
const canvas = $('canvas')
const WORLD = { x0: 12, y0: -3.9, w: 58, h: 33.1 }
function setView(v) { canvas.setAttribute('viewBox', `${v.x0} ${v.y0} ${v.w} ${v.h}`) }
setView(WORLD)
canvas.setAttribute('preserveAspectRatio', 'xMidYMid meet')

const G = {}
for (const name of ['grid', 'yard', 'costmap', 'obstacles', 'cloud', 'clearEnv', 'swept',
  'tracks', 'warm', 'base', 'path', 'stations', 'ghosts', 'startGoal', 'witness',
  'rejected', 'vehicle', 'labels']) {
  G[name] = svgEl('g', { id: `g-${name}` }, canvas)
}

const HAIR = { 'vector-effect': 'non-scaling-stroke' }
function hairline(x1, y1, x2, y2, stroke, parent, extra) {
  return svgEl('line', Object.assign({ x1, y1, x2, y2, stroke, 'stroke-width': 1 }, HAIR, extra || {}), parent)
}

function drawGrid() {
  for (let x = 15; x <= 70; x += 5) hairline(x, WORLD.y0, x, WORLD.y0 + WORLD.h, '#191d20', G.grid)
  for (let y = -0; y <= 28; y += 5) hairline(WORLD.x0, y, WORLD.x0 + WORLD.w, y, '#191d20', G.grid)
}

function drawYard() {
  const Y = SCENE.yard
  // building band
  svgEl('rect', { x: WORLD.x0, y: -3.4, width: WORLD.w, height: 3.4, fill: '#20242a' }, G.yard)
  hairline(WORLD.x0, 0, WORLD.x0 + WORLD.w, 0, '#454c53', G.yard)
  // stalls
  for (const s of Y.stalls) {
    const x0 = s.cx - s.halfW, x1 = s.cx + s.halfW
    hairline(x0, 0, x0, s.lineY1, '#343a41', G.yard)
    hairline(x1, 0, x1, s.lineY1, '#343a41', G.yard)
    // dock door
    const dw = s.doorW / 2
    svgEl('rect', {
      x: s.cx - dw, y: -0.55, width: s.doorW, height: 0.55,
      fill: s.id === 'D-17' ? '#151a14' : '#14171b',
      stroke: s.id === 'D-17' ? C.amber : '#3a4046', 'stroke-width': 1,
      ...HAIR,
    }, G.yard)
    svgEl('text', {
      x: s.cx, y: -1.35, fill: s.id === 'D-17' ? C.amber : C.muted,
      'font-size': 1.15, 'text-anchor': 'middle', 'font-family': 'Inter, Arial, sans-serif',
      'font-weight': 600,
    }, G.yard).textContent = s.id
  }
  // pitch dimension
  const s0 = Y.stalls[1], s1 = Y.stalls[2]
  const dy = -2.6
  hairline(s0.cx, dy, s1.cx, dy, '#4a525a', G.yard)
  for (const x of [s0.cx, s1.cx]) hairline(x, dy - 0.3, x, dy + 0.3, '#4a525a', G.yard)
  svgEl('text', { x: (s0.cx + s1.cx) / 2, y: dy - 0.45, fill: C.faint, 'font-size': 0.85, 'text-anchor': 'middle', 'font-family': 'ui-monospace, Menlo, monospace' }, G.yard).textContent = '6.00'
  // kerb
  for (const k of Y.kerbs) {
    hairline(k.x0, k.y0, k.x1, k.y1, '#4a525a', G.yard)
    hairline(k.x0, k.y0 + 0.3, k.x1, k.y1 + 0.3, '#343a41', G.yard)
  }
  // lane marking
  svgEl('line', {
    x1: WORLD.x0 + 1, y1: Y.laneY, x2: WORLD.x0 + WORLD.w - 1, y2: Y.laneY,
    stroke: '#3d444b', 'stroke-width': 1, 'stroke-dasharray': '6 5', ...HAIR,
  }, G.yard)
  // scale bar + north arrow
  const sbY = 27.4, sbX = WORLD.x0 + WORLD.w - 17
  for (let i = 0; i < 3; i++) {
    svgEl('rect', { x: sbX + i * 5, y: sbY, width: 5, height: 0.35, fill: i % 2 ? '#20242a' : '#5c646b' }, G.yard)
  }
  for (const [i, lab] of [[0, '0'], [1, '5'], [2, '10'], [3, '15 m']].values()) {
    svgEl('text', { x: sbX + i * 5, y: sbY - 0.4, fill: C.faint, 'font-size': 0.8, 'text-anchor': 'middle', 'font-family': 'ui-monospace, Menlo, monospace' }, G.yard).textContent = lab
  }
  const nx = WORLD.x0 + 2.2, nyv = 26.2
  svgEl('path', { d: `M${nx} ${nyv} l0.55 1.9 l-0.55 -0.55 l-0.55 0.55 Z`, fill: '#5c646b', transform: `rotate(180 ${nx} ${nyv + 0.9})` }, G.yard)
  svgEl('text', { x: nx, y: nyv - 0.5, fill: C.faint, 'font-size': 0.95, 'text-anchor': 'middle', 'font-family': 'Inter, Arial, sans-serif' }, G.yard).textContent = 'N'
}

function drawObstacles() {
  // hatch pattern for the pallet stack
  const defs = svgEl('defs', {}, canvas)
  const pat = svgEl('pattern', { id: 'hatch', width: 0.5, height: 0.5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs)
  svgEl('rect', { width: 0.5, height: 0.5, fill: '#20242a' }, pat)
  svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 0.5, stroke: '#4a525a', 'stroke-width': 0.09 }, pat)

  const P = SCENE.pallet
  const r = svgEl('rect', {
    x: P.x, y: P.y, width: P.w, height: P.h, fill: 'url(#hatch)',
    stroke: '#6b7278', 'stroke-width': 1, ...HAIR, cursor: 'pointer',
  }, G.obstacles)
  r.addEventListener('click', () => selectObject('pallet'))
  svgEl('text', { x: P.x + P.w + 0.4, y: P.y - 0.35, fill: C.muted, 'font-size': 0.85, 'font-family': 'Inter, Arial, sans-serif' }, G.obstacles)
    .textContent = 'Pallet stack 1.20 x 1.00'

  // parked trailer in D-14
  const st = SCENE.yard.stalls[0]
  const park = footprint(st.cx, 2.1 + 13.6 / 2, Math.PI / 2, 13.6 / 2, 13.6 / 2, 2.55 / 2)
  const pk = svgEl('polygon', {
    points: ptsAttr(park), fill: '#1c2025', stroke: '#454c53', 'stroke-width': 1, ...HAIR, cursor: 'pointer',
  }, G.obstacles)
  pk.addEventListener('click', () => selectObject('parked'))
  svgEl('text', { x: st.cx, y: 8.6, fill: C.faint, 'font-size': 0.8, 'text-anchor': 'middle', 'font-family': 'Inter, Arial, sans-serif' }, G.obstacles).textContent = 'Parked trailer'
}

function drawCostmap() {
  const cell = 0.6
  const obstacles = SCENE.obstacles.map((o) => o.poly)
  for (let x = WORLD.x0 + 0.5; x < WORLD.x0 + WORLD.w - 0.5; x += cell) {
    for (let y = -0.4; y < 26.5; y += cell) {
      let d = Infinity
      for (const poly of obstacles) {
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length]
          const t = clip((((x - a[0]) * (b[0] - a[0])) + ((y - a[1]) * (b[1] - a[1]))) /
            (Math.hypot(b[0] - a[0], b[1] - a[1]) ** 2 || 1), 0, 1)
          d = Math.min(d, Math.hypot(x - (a[0] + t * (b[0] - a[0])), y - (a[1] + t * (b[1] - a[1]))))
        }
      }
      if (d < 1.3) {
        const o = d < 0.45 ? 0.34 : 0.2 * (1 - (d - 0.45) / 0.85)
        svgEl('rect', { x: x - cell / 2, y: y - cell / 2, width: cell, height: cell, fill: '#b58a3d', opacity: o.toFixed(2) }, G.costmap)
      }
    }
  }
}

function axlePolyline(run) {
  return run.samples.map((q) => `${q.axle[0].toFixed(2)},${q.axle[1].toFixed(2)}`).join(' ')
}
function tractorPolyline(run) {
  return run.samples.map((q) => `${q.tractorAxle[0].toFixed(2)},${q.tractorAxle[1].toFixed(2)}`).join(' ')
}

function drawTrajectories() {
  const ref = SCENE.runs['run-015'], base = SCENE.runs['run-014']

  // swept body and clearance envelope for the active run (refined by default)
  const trailPolys = [], clearPolys = []
  for (let i = 0; i < ref.samples.length; i += 2) {
    const B = bodiesOf(ref.samples[i])
    trailPolys.push(B.trailer, B.tractor)
    clearPolys.push(inflatePoly(B.trailer, 0.30), inflatePoly(B.tractor, 0.30))
  }
  svgEl('path', { d: polyPathD(clearPolys), fill: C.amber, opacity: 0.045 }, G.clearEnv)
  svgEl('path', { d: polyPathD(trailPolys), fill: C.violet, opacity: 0.065 }, G.swept)

  // wheel tracks
  svgEl('polyline', { points: tractorPolyline(ref), fill: 'none', stroke: C.track, 'stroke-width': 1, 'stroke-dasharray': '5 4', ...HAIR }, G.tracks)

  // warm start: the raw geometric primitive before refinement (planner view)
  svgEl('polyline', { points: axlePolyline(ref), fill: 'none', stroke: C.cyan, 'stroke-width': 1.6, 'stroke-dasharray': '7 5', ...HAIR, transform: 'translate(0.22 -0.18)' }, G.warm)

  // baseline and refined axle paths
  svgEl('polyline', { points: axlePolyline(base), fill: 'none', stroke: C.red, 'stroke-width': 1.4, 'stroke-dasharray': '6 4', ...HAIR, id: 'basePath' }, G.base)
  svgEl('polyline', { points: axlePolyline(ref), fill: 'none', stroke: C.violet, 'stroke-width': 2, ...HAIR, id: 'refPath' }, G.path)

  // station markers every 5 m
  for (let s = 0; s <= ref.metrics.pathLength; s += 5) {
    const q = sampleNear(ref, s)
    svgEl('circle', { cx: q.axle[0], cy: q.axle[1], r: 0.16, fill: '#0e1113', stroke: C.violet, 'stroke-width': 1, ...HAIR }, G.stations)
    svgEl('text', { x: q.axle[0] + 0.45, y: q.axle[1] - 0.3, fill: C.faint, 'font-size': 0.8, 'font-family': 'ui-monospace, Menlo, monospace' }, G.stations).textContent = `s=${s}`
  }

  // ghost poses
  for (let s = 4; s < ref.metrics.pathLength - 1; s += 6.5) {
    const B = bodiesOf(sampleNear(ref, s))
    for (const poly of [B.trailer, B.tractor]) {
      svgEl('polygon', { points: ptsAttr(poly), fill: 'none', stroke: '#39414a', 'stroke-width': 1, ...HAIR }, G.ghosts)
    }
  }

  // start and goal
  const q0 = ref.samples[0]
  svgEl('path', {
    d: `M${q0.axle[0] + 2.2} ${q0.axle[1]} l1.6 -0.85 l0 1.7 Z`, fill: C.green,
  }, G.startGoal)
  svgEl('text', { x: q0.axle[0] + 4.2, y: q0.axle[1] + 0.35, fill: C.green, 'font-size': 0.95, 'font-family': 'Inter, Arial, sans-serif', 'font-weight': 600 }, G.startGoal).textContent = 'START'
  const g = SCENE.goal
  svgEl('rect', {
    x: g.x - 1.55, y: g.y - 2.3, width: 3.1, height: 4.6, fill: 'none',
    stroke: C.amber, 'stroke-width': 1.4, 'stroke-dasharray': '4 3', ...HAIR,
  }, G.startGoal)
  svgEl('text', { x: g.x + 2.0, y: g.y + 0.6, fill: C.amber, 'font-size': 0.85, 'font-family': 'Inter, Arial, sans-serif', 'font-weight': 600 }, G.startGoal).textContent = 'DOCK GOAL'

  // witness line at the minimum clearance
  drawWitness(ref)
}

let witnessEls = []
function drawWitness(run) {
  for (const e of witnessEls) e.remove()
  witnessEls = []
  const m = run.min
  if (!m || !m.a || !m.b) return
  const bad = run.metrics.minClearance < VEHICLE.limits.clearance
  const col = bad ? C.red : C.amber
  witnessEls.push(svgEl('line', {
    x1: m.a[0], y1: m.a[1], x2: m.b[0], y2: m.b[1], stroke: col, 'stroke-width': 2, ...HAIR,
  }, G.witness))
  for (const p of [m.a, m.b]) {
    witnessEls.push(svgEl('circle', { cx: p[0], cy: p[1], r: 0.14, fill: col }, G.witness))
  }
  const t = svgEl('text', {
    x: (m.a[0] + m.b[0]) / 2 + 0.5, y: (m.a[1] + m.b[1]) / 2 + 1.15, fill: col,
    'font-size': 0.9, 'font-family': 'ui-monospace, Menlo, monospace', 'font-weight': 600,
  }, G.witness)
  t.textContent = `${run.metrics.minClearance.toFixed(2)} m`
  witnessEls.push(t)
}

function drawRejectedBranch() {
  const rej = SCENE.planner.rejected
  for (const pose of rej.poses) {
    const poly = footprint(pose.x, pose.y, pose.phi, TR.kingpinToAxle + TR.frontOverhang, TR.rearOverhang, TR.width / 2)
    svgEl('polygon', { points: ptsAttr(poly), fill: 'none', stroke: C.red, 'stroke-width': 1.2, ...HAIR, opacity: 0.85 }, G.rejected)
  }
  const last = rej.poses[rej.poses.length - 1]
  const chip = svgEl('g', { cursor: 'pointer' }, G.rejected)
  svgEl('rect', { x: last.x + 1.0, y: last.y - 0.8, width: 13.4, height: 1.5, fill: '#2a1512', stroke: C.red, 'stroke-width': 1, ...HAIR }, chip)
  svgEl('text', { x: last.x + 1.6, y: last.y + 0.28, fill: '#ee9089', 'font-size': 0.85, 'font-family': 'Inter, Arial, sans-serif' }, chip).textContent = 'Rejected: articulation bound'
  chip.addEventListener('click', () => selectObject('rejected'))
}

function drawCloud(progress) {
  G.cloud.innerHTML = ''
  const cloud = SCENE.planner.cloud
  const n = Math.floor(cloud.length * (progress === undefined ? 1 : progress))
  for (let i = 0; i < n; i++) {
    const c = cloud[i]
    svgEl('line', {
      x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2,
      stroke: c.pruned ? C.red : '#b58a3d', 'stroke-width': 1, ...HAIR,
      opacity: c.pruned ? 0.8 : 0.5,
    }, G.cloud)
  }
}

// vehicle at the current station
let vehicleEls = []
function drawVehicle(q) {
  for (const e of vehicleEls) e.remove()
  vehicleEls = []
  const B = bodiesOf(q)
  vehicleEls.push(svgEl('polygon', { points: ptsAttr(B.trailer), fill: '#2b3138', stroke: '#c7ccd1', 'stroke-width': 1.4, ...HAIR }, G.vehicle))
  vehicleEls.push(svgEl('polygon', { points: ptsAttr(B.tractor), fill: '#313841', stroke: '#c7ccd1', 'stroke-width': 1.4, ...HAIR }, G.vehicle))
  // axles and kingpin
  const wheel = (cx, cy, phi) => {
    const p = footprint(cx, cy, phi, 0.5, 0.5, 0.14)
    vehicleEls.push(svgEl('polygon', { points: ptsAttr(p), fill: '#0c0e10' }, G.vehicle))
  }
  const off = (pt, phi, lat) => [pt[0] - Math.sin(phi) * lat, pt[1] + Math.cos(phi) * lat]
  for (const lat of [-0.95, 0.95]) {
    const w1 = off(q.tractorAxle, q.tractorHeading, lat); wheel(w1[0], w1[1], q.tractorHeading)
    const f = [q.tractorAxle[0] + Math.cos(q.tractorHeading) * T.wheelbase, q.tractorAxle[1] + Math.sin(q.tractorHeading) * T.wheelbase]
    const w2 = off(f, q.tractorHeading, lat); wheel(w2[0], w2[1], q.tractorHeading + q.steering)
    for (const dx of [-0.55, 0.55]) {
      const a = [q.axle[0] + Math.cos(q.trailerHeading) * dx, q.axle[1] + Math.sin(q.trailerHeading) * dx]
      const w3 = off(a, q.trailerHeading, lat); wheel(w3[0], w3[1], q.trailerHeading)
    }
  }
  vehicleEls.push(svgEl('circle', { cx: q.kingpin[0], cy: q.kingpin[1], r: 0.18, fill: C.cyan }, G.vehicle))
}

function sampleNear(run, s) {
  const arr = run.samples
  const i = clip(Math.round(s / SCENE.calcInterval), 0, arr.length - 1)
  return arr[i]
}

// ============================================================ scrub/plots ==
const scrubber = $('scrubber')
function setStation(s, fromPlot) {
  const run = runOf()
  const sMax = run.metrics.pathLength
  state.station = clip(s, 0, sMax)
  const q = sampleNear(run, state.station)
  drawVehicle(q)
  scrubber.value = Math.round((state.station / sMax) * 1000)
  $('readout').innerHTML =
    `s <b>${f2(q.s)} m</b> · t <b>${f1(q.t)} s</b> · v <b>${f2(q.v)} m/s</b> · ` +
    `steering <b>${f1(q.steering * DEG)} deg</b> · articulation <b>${f1(q.articulation * DEG)} deg</b> · ` +
    `clearance <b>${q.clearance > 9 ? '>9.99' : f2(q.clearance)} m</b>`
  updatePlotCursors()
  if (!fromPlot) void 0
}
scrubber.addEventListener('input', () => {
  const sMax = runOf().metrics.pathLength
  stopPlay()
  setStation((scrubber.value / 1000) * sMax)
})

let playT = null
function stopPlay() {
  state.playing = false
  $('playBtn').textContent = 'Play motion'
  if (playT) { cancelAnimationFrame(playT); playT = null }
}
$('playBtn').addEventListener('click', () => {
  if (state.playing) { stopPlay(); return }
  state.playing = true
  $('playBtn').textContent = 'Pause motion'
  const run = runOf()
  const dur = run.metrics.duration
  let tCur = sampleNear(run, state.station).t
  if (tCur >= dur - 0.05) tCur = 0
  let last = performance.now()
  const tick = (now) => {
    if (!state.playing) return
    tCur += ((now - last) / 1000) * 2.4 // playback speed factor
    last = now
    if (tCur >= dur) { setStation(run.metrics.pathLength); stopPlay(); return }
    // find the station for the time
    const arr = run.samples
    let lo = 0, hi = arr.length - 1
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid].t <= tCur) lo = mid; else hi = mid }
    setStation(arr[lo].s)
    playT = requestAnimationFrame(tick)
  }
  playT = requestAnimationFrame(tick)
})

// mini plot builder ---------------------------------------------------------
const plots = []
function buildPlot(host, cfg) {
  const wrap = el('div', 'plot', null, host)
  const h = el('h4', null, `${cfg.title} <b class="cur"></b>`, wrap)
  const svg = svgEl('svg', { viewBox: '0 0 100 46', preserveAspectRatio: 'none' }, wrap)
  el('div', 'foot', cfg.foot, wrap)
  const plot = { cfg, svg, curEl: h.querySelector('.cur'), cursor: null }
  const draw = () => {
    svg.innerHTML = ''
    const run = runOf()
    const other = SCENE.runs[state.run === 'run-015' ? 'run-014' : 'run-015']
    const xMax = cfg.xMax(run)
    const [y0, y1] = cfg.yRange
    const X = (x) => 6 + (x / xMax) * 92
    const Y = (v) => 42 - ((v - y0) / (y1 - y0)) * 38
    // frame + gridlines
    svgEl('rect', { x: 6, y: 4, width: 92, height: 38, fill: 'none', stroke: '#262a2f', 'stroke-width': 0.4 }, svg)
    for (const gv of cfg.grid || []) {
      svgEl('line', { x1: 6, y1: Y(gv), x2: 98, y2: Y(gv), stroke: '#22262b', 'stroke-width': 0.35 }, svg)
      svgEl('text', { x: 5, y: Y(gv) + 1.2, fill: C.faint, 'font-size': 3.1, 'text-anchor': 'end', 'font-family': 'ui-monospace, Menlo, monospace' }, svg).textContent = String(gv)
    }
    for (const lim of cfg.limits || []) {
      svgEl('line', { x1: 6, y1: Y(lim.v), x2: 98, y2: Y(lim.v), stroke: C.amber, 'stroke-width': 0.5, 'stroke-dasharray': '2 1.4', opacity: 0.8 }, svg)
      svgEl('text', { x: 97.5, y: Y(lim.v) - 1, fill: C.amber, 'font-size': 3, 'text-anchor': 'end', 'font-family': 'ui-monospace, Menlo, monospace' }, svg).textContent = lim.label
    }
    const seriesLine = (r, color, dash) => {
      let d = ''
      for (let i = 0; i < r.samples.length; i += 1) {
        const q = r.samples[i]
        const xv = cfg.x(q), yv = clip(cfg.y(q), y0, y1)
        d += `${i ? 'L' : 'M'}${X(xv).toFixed(2)} ${Y(yv).toFixed(2)}`
      }
      svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': dash ? 0.6 : 0.8, 'stroke-dasharray': dash ? '2.2 1.6' : 'none' }, svg)
    }
    const colorOf = (r) => (r.kind === 'refined' ? C.cyan : '#e08a80')
    if (state.compare) seriesLine(other, colorOf(other), true)
    seriesLine(run, colorOf(run), false)
    plot.cursor = svgEl('line', { x1: 0, y1: 4, x2: 0, y2: 42, stroke: '#d6d9dc', 'stroke-width': 0.45, opacity: 0.75 }, svg)
    plot.X = X
  }
  svg.addEventListener('click', (ev) => {
    const r = svg.getBoundingClientRect()
    const fx = ((ev.clientX - r.left) / r.width) * 100
    const run = runOf()
    const xv = clip(((fx - 6) / 92), 0, 1) * cfg.xMax(run)
    stopPlay()
    setStation(cfg.xIsTime ? stationForTime(run, xv) : xv, true)
  })
  plot.draw = draw
  plots.push(plot)
  draw()
  return plot
}
function stationForTime(run, tv) {
  const arr = run.samples
  let lo = 0, hi = arr.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid].t <= tv) lo = mid; else hi = mid }
  return arr[lo].s
}
function updatePlotCursors() {
  const run = runOf()
  const q = sampleNear(run, state.station)
  for (const p of plots) {
    if (!p.cursor || !p.X) continue
    const xv = p.cfg.x(q)
    const px = p.X(clip(xv, 0, p.cfg.xMax(run)))
    p.cursor.setAttribute('x1', px); p.cursor.setAttribute('x2', px)
    p.curEl.textContent = p.cfg.cur(q)
  }
}
function redrawPlots() { for (const p of plots) p.draw(); updatePlotCursors() }

// ============================================================== panels ====
function buildTree() {
  const host = $('treeHost')
  host.innerHTML = ''
  const tree = el('div', 'tree', null, host)
  const node = (depth, label, opts = {}) => {
    const n = el('div', `node d${depth}`, null, tree)
    el('span', 'tw', opts.leaf ? '' : '&#9662;', n)
    el('span', `ic${opts.leaf ? ' file' : ''}`, '', n)
    el('span', null, label, n)
    if (opts.status) el('span', `st ${opts.status[1]}`, opts.status[0], n)
    if (opts.onclick) { n.style.cursor = 'pointer'; n.addEventListener('click', opts.onclick) }
    if (opts.id) n.id = opts.id
    return n
  }
  node(0, 'Dock D-17 reverse')
  node(1, 'Site')
  node(2, 'yard-plan.geojson', { leaf: true, onclick: () => selectFile('yard-plan.geojson', '48 KB', 'Imported site geometry, frame: yard, units: m') })
  node(2, 'costmap.yaml', { leaf: true, onclick: () => selectFile('costmap.yaml', '6 KB', 'Occupancy grid metadata, resolution 0.10 m') })
  node(1, 'Vehicle')
  node(2, 'YT-1 yard tractor', { leaf: true, onclick: () => selectObject('vehicle') })
  node(2, 'T-136 semitrailer', { leaf: true, onclick: () => selectObject('vehicle') })
  node(1, 'Path')
  node(2, 'Reference path, 8 points', { leaf: true })
  node(2, 'Start pose', { leaf: true })
  node(2, 'Goal pose, D-17', { leaf: true })
  node(1, 'Runs')
  node(2, 'run-014 baseline', {
    leaf: true, id: 'tree-run-014',
    status: ['REJECTED', 'bad'],
    onclick: () => setRun('run-014'),
  })
  node(2, 'run-015 refined', {
    leaf: true, id: 'tree-run-015',
    status: ['PASS', 'ok'],
    onclick: () => setRun('run-015'),
  })
  node(1, 'Reports')
  node(2, 'validation.json', { leaf: true, onclick: () => selectFile('validation.json', '64 KB', 'Validation matrix result for run-015, policy v1.2') })
  node(2, 'solver-trace.log', { leaf: true, onclick: () => selectFile('solver-trace.log', '512 KB', 'Hybrid A* and SQP iteration trace for run-015') })
  node(2, 'parameters.yaml', { leaf: true, onclick: () => selectFile('parameters.yaml', '23 KB', 'Planner, costmap, and policy parameter snapshot') })
  markTreeRun()
}
function markTreeRun() {
  for (const id of ['tree-run-014', 'tree-run-015']) {
    const n = $(id)
    if (n) n.classList.toggle('sel', id === `tree-${state.run}`)
  }
}

const LAYERS = [
  { id: 'grid', label: 'Grid', on: true, sw: '#33393f' },
  { id: 'yard', label: 'Base map', on: true, sw: '#454c53' },
  { id: 'obstacles', label: 'Obstacles', on: true, sw: '#6b7278' },
  { id: 'costmap', label: 'Costmap inflation', on: true, sw: '#b58a3d', ws: 'planner' },
  { id: 'cloud', label: 'Search states', on: true, sw: '#b58a3d', ws: 'planner' },
  { id: 'warm', label: 'Warm start', on: true, sw: C.cyan, ws: 'planner' },
  { id: 'path', label: 'Refined trajectory', on: true, sw: C.violet },
  { id: 'base', label: 'Baseline run-014', on: true, sw: C.red, ws: 'validation' },
  { id: 'tracks', label: 'Tractor wheel track', on: true, sw: C.track },
  { id: 'swept', label: 'Swept body', on: true, sw: C.violet },
  { id: 'clearEnv', label: 'Clearance envelope', on: true, sw: C.amber },
  { id: 'stations', label: 'Station marks', on: true, sw: C.faint },
  { id: 'ghosts', label: 'Sampled poses', on: true, sw: '#39414a' },
  { id: 'witness', label: 'Clearance witness', on: true, sw: C.amber },
]
function buildLayers() {
  const host = $('layersHost')
  host.innerHTML = ''
  const box = el('div', 'layers', null, host)
  for (const L of LAYERS) {
    const row = el('label', 'layer', null, box)
    const cb = document.createElement('input')
    cb.type = 'checkbox'; cb.checked = L.on
    row.appendChild(cb)
    el('i', 'sw', '', row).style.background = L.sw
    el('span', null, L.label, row)
    cb.addEventListener('change', () => { L.on = cb.checked; applyLayerVisibility() })
  }
}
function applyLayerVisibility() {
  for (const L of LAYERS) {
    const g = G[L.id]
    if (!g) continue
    const wsOk = !L.ws || L.ws === state.ws ||
      (L.id === 'base' && (state.compare || state.run === 'run-014'))
    g.style.display = (L.on && wsOk) ? '' : 'none'
  }
  // planner-only groups hidden elsewhere
  G.rejected.style.display = state.ws === 'planner' ? '' : 'none'
  G.witness.style.display = (state.ws !== 'planner' && LAYERS.find((l) => l.id === 'witness').on) ? '' : 'none'
}

// inspector -----------------------------------------------------------------
function kvGroup(host, title, rows) {
  const g = el('div', 'grp', null, host)
  el('h3', null, title, g)
  const kv = el('div', 'kv', null, g)
  for (const [k, v, cls] of rows) {
    el('div', 'k', k, kv)
    el('div', `v${cls ? ' ' + cls : ''}`, v, kv)
  }
  return g
}
function buildInspector() {
  const host = $('inspector')
  host.innerHTML = ''
  const run = runOf()
  const m = run.metrics
  if (state.ws === 'scenario') {
    $('inspectorTitle').textContent = 'Properties'
    kvGroup(host, 'Scenario', [
      ['Name', 'dock-d17-reverse'],
      ['Maneuver', 'Reverse to dock D-17'],
      ['Map frame', 'yard'],
    ])
    kvGroup(host, 'Vehicle', [
      ['Unit', VEHICLE.name],
      ['Tractor wheelbase', '3.80 m'],
      ['Hitch offset', '0.42 m'],
      ['Kingpin to bogie', '8.10 m'],
      ['Trailer length', '13.60 m'],
      ['Trailer width', '2.55 m'],
      ['Max steering', '35.0 deg'],
      ['Max articulation', '42.0 deg'],
      ['Max steering rate', '18.0 deg/s'],
    ])
    kvGroup(host, 'Calculation', [
      ['Interval', '0.25 m'],
      ['Clearance envelope', '0.30 m'],
      ['Clearance check', 'on'],
    ])
    kvGroup(host, 'Start pose', [
      ['Station', '0.00 m'],
      ['East', `${f2(run.samples[0].axle[0])} m`],
      ['South', `${f2(run.samples[0].axle[1])} m`],
      ['Trailer heading', '0.0 deg'],
    ])
    kvGroup(host, 'Goal pose', [
      ['East', `${f2(SCENE.goal.x)} m`],
      ['South', `${f2(SCENE.goal.y)} m`],
      ['Trailer heading', `${SCENE.goal.headingDeg.toFixed(1)} deg`],
      ['Tolerance', '0.10 m, 1.0 deg'],
    ])
    kvGroup(host, 'Result', [
      ['Path length', `${f2(m.pathLength)} m`],
      ['Duration', `${f1(m.duration)} s`],
      ['Minimum clearance', `${f2(m.minClearance)} m`, m.minClearance >= 0.30 ? 'ok' : 'bad'],
      ['At station', `${f1(m.minClearanceS)} m`],
      ['Nearest object', m.minClearanceObstacle],
    ])
    el('div', 'grp', `<div class="kv" style="padding-top:8px"><div class="k" id="objInfoK">Selection</div><div class="v" id="objInfoV">none</div></div>`, host)
  } else if (state.ws === 'planner') {
    $('inspectorTitle').textContent = 'Planner'
    const P = SCENE.planner
    kvGroup(host, 'Summary', [
      ['Expanded states', P.summary.expanded.toLocaleString('en-US')],
      ['Generated states', P.summary.generated.toLocaleString('en-US')],
      ['Reopened', String(P.summary.reopened)],
      ['Analytic connections', P.summary.analytic],
      ['Warm-start cost', String(P.summary.warmStartCost)],
      ['SQP iterations', String(P.summary.iterations)],
      ['Primal residual', P.summary.primal],
      ['Objective J', String(P.summary.objective)],
      ['Status', 'CONVERGED', 'ok'],
    ])
    const g = el('div', 'grp', null, host)
    el('h3', null, 'Solver parameters', g)
    const kv = el('div', 'kv', null, g)
    for (const [k, v] of P.params) {
      if (v === null) { el('div', 'k', `<b style="color:var(--text)">${k}</b>`, kv); el('div', 'v', '', kv) }
      else { el('div', 'k', k, kv); el('div', 'v', v, kv) }
    }
    kvGroup(host, 'Iteration inspector', [
      ['Iteration', '31 / 31'],
      ['Merit', '13.821'],
      ['Primal residual', '8.2e-5'],
      ['Dual residual', '6.1e-5'],
      ['Step norm', '1.3e-4'],
      ['Active constraints', '27'],
    ])
    el('div', 'grp', `<div class="kv" style="padding-top:8px"><div class="k" id="objInfoK">Selection</div><div class="v" id="objInfoV">none</div></div>`, host)
  } else {
    $('inspectorTitle').textContent = 'Validation matrix'
    const wrapEl = el('div', 'scrolly', null, host)
    const tbl = el('table', 'tbl matrix', null, wrapEl)
    tbl.innerHTML = `<thead><tr><th>#</th><th>Check</th><th class="num">Observed</th><th class="num">Margin</th><th></th></tr></thead>`
    const tb = el('tbody', null, null, tbl)
    run.checks.forEach((c, i) => {
      const tr = el('tr', state.selectedCheck === i ? 'sel' : '', null, tb)
      tr.innerHTML =
        `<td class="dim">${i + 1}</td><td>${c.name}<br><span class="dim">${c.required}</span></td>` +
        `<td class="num">${c.observed}</td>` +
        `<td class="num">${c.margin === null ? 'n/a' : (c.margin >= 0 ? '+' : '') + c.margin.toFixed(c.unit === 'deg' || c.unit === '' ? 1 : 2) + ' ' + c.unit}</td>` +
        `<td class="${c.pass ? 'ok' : 'bad'}">${c.pass ? 'PASS' : 'FAIL'}</td>`
      tr.addEventListener('click', () => selectCheck(i))
    })
    const foot = el('div', 'grp', null, host)
    kvGroup(foot, 'Run identity', [
      ['Run', run.id],
      ['Scenario', 'dock-d17-reverse'],
      ['Vehicle', VEHICLE.name],
      ['Planner', 'DockPlan 2.4.1'],
      ['Policy', 'v1.2'],
      ['Evidence hashes', 'verified', 'ok'],
    ])
  }
}

function selectFile(name, size, desc) {
  const k = $('objInfoK'), v = $('objInfoV')
  if (k && v) { k.textContent = name; v.textContent = `${size} · ${desc}` }
  setStatus(`${name} selected`)
}
function selectObject(kind) {
  const k = $('objInfoK'), v = $('objInfoV')
  const info = {
    pallet: ['Pallet stack', 'Static obstacle, 1.20 x 1.00 m, source: site import'],
    parked: ['Parked trailer, D-14', 'Static obstacle, 13.6 x 2.55 m'],
    vehicle: ['YT-1 + T-136', 'Articulated unit, overall length 16.6 m'],
    rejected: ['Rejected branch', 'Articulation 42.6 deg exceeds the 42.0 deg limit'],
  }[kind]
  if (k && v && info) { k.textContent = info[0]; v.textContent = info[1] }
  setStatus(`${info ? info[0] : kind} selected`)
}

// dock ----------------------------------------------------------------------
function buildDock() {
  const tabs = $('dockTabs'), body = $('dockBody')
  tabs.innerHTML = ''; body.innerHTML = ''
  plots.length = 0
  const pages = []
  const addPage = (label, build) => {
    const btn = el('button', pages.length === 0 ? 'active' : '', label, tabs)
    const page = el('div', `dock-page${pages.length === 0 ? ' active' : ''}`, null, body)
    build(page)
    const idx = pages.length
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === idx))
      pages.forEach((p, i) => p.classList.toggle('active', i === idx))
    })
    pages.push(page)
  }

  const run = runOf()
  const sMaxOf = (r) => r.metrics.pathLength
  const plotsPage = (page, six) => {
    const box = el('div', 'plots', null, page)
    buildPlot(box, {
      title: 'Articulation [deg] vs s [m]', color: C.cyan,
      x: (q) => q.s, xMax: sMaxOf, y: (q) => q.articulation * DEG, yRange: [-8, 46],
      grid: [0, 20, 40], limits: [{ v: 42, label: '42.0' }],
      cur: (q) => `${f1(q.articulation * DEG)} deg`, foot: 'Limit 42.0 deg',
    })
    buildPlot(box, {
      title: 'Steering [deg] vs s [m]', color: C.cyan,
      x: (q) => q.s, xMax: sMaxOf, y: (q) => q.steering * DEG, yRange: [-8, 40],
      grid: [0, 20], limits: [{ v: 35, label: '35.0' }],
      cur: (q) => `${f1(q.steering * DEG)} deg`, foot: 'Limit 35.0 deg',
    })
    if (six) {
      buildPlot(box, {
        title: 'Steering rate [deg/s] vs s [m]', color: C.cyan,
        x: (q) => q.s, xMax: sMaxOf, y: (q) => Math.abs(q.steeringRate * DEG), yRange: [0, 22],
        grid: [0, 10, 20], limits: [{ v: 18, label: '18.0' }],
        cur: (q) => `${f1(Math.abs(q.steeringRate * DEG))} deg/s`, foot: 'Limit 18.0 deg/s',
      })
    }
    buildPlot(box, {
      title: 'Clearance [m] vs s [m]', color: C.cyan,
      x: (q) => q.s, xMax: sMaxOf, y: (q) => Math.min(q.clearance, 3), yRange: [0, 3],
      grid: [1, 2], limits: [{ v: 0.30, label: '0.30' }],
      cur: (q) => `${f2(Math.min(q.clearance, 9.99))} m`, foot: 'Required 0.30 m or more',
    })
    if (six) {
      buildPlot(box, {
        title: 'Reverse speed [m/s] vs s [m]', color: C.cyan,
        x: (q) => q.s, xMax: sMaxOf, y: (q) => q.v, yRange: [0, 2.8],
        grid: [1, 2], limits: [{ v: 2.5, label: '2.50' }],
        cur: (q) => `${f2(q.v)} m/s`, foot: 'Limit 2.50 m/s',
      })
      buildPlot(box, {
        title: 'Acceleration [m/s2] vs s [m]', color: C.cyan,
        x: (q) => q.s, xMax: sMaxOf, y: (q) => Math.abs(q.accel), yRange: [0, 1.8],
        grid: [0.5, 1, 1.5], limits: [{ v: 1.5, label: '1.50' }],
        cur: (q) => `${f2(Math.abs(q.accel))} m/s2`, foot: 'Limit 1.50 m/s2',
      })
    }
  }

  if (state.ws === 'scenario') {
    addPage('Plots', (p) => plotsPage(p, false))
    addPage('Event log', (p) => buildLog(p, SCENE.planner.log.slice(0, 6)))
  } else if (state.ws === 'planner') {
    addPage('Convergence', (p) => buildConvergence(p))
    addPage('Objective terms', (p) => buildObjectiveTable(p))
    addPage('Active constraints', (p) => buildConstraints(p))
    addPage('Event log', (p) => buildLog(p, SCENE.planner.log, true))
  } else {
    addPage('Plots', (p) => plotsPage(p, true))
    addPage('Comparison', (p) => buildComparison(p))
    addPage('Artifacts', (p) => buildArtifacts(p))
  }
  updatePlotCursors()
}

function buildLog(page, rows, live) {
  const wrap = el('div', 'scrolly', null, page)
  const log = el('div', 'log', null, wrap)
  log.id = live ? 'plannerLog' : ''
  for (const [t, lv, msg] of rows) appendLog(log, t, lv, msg)
  return log
}
function appendLog(log, t, lv, msg) {
  const row = el('div', 'row', null, log)
  el('span', 't', t, row)
  el('span', `lv ${lv}`, lv, row)
  el('span', `m${msg === 'CONVERGED' ? ' good' : ''}`, msg, row)
  log.parentElement.scrollTop = log.parentElement.scrollHeight
}

let convSvgs = null
function buildConvergence(page) {
  const box = el('div', 'plots', null, page)
  const mk = (title, foot) => {
    const wrap = el('div', 'plot', null, box)
    el('h4', null, title, wrap)
    const svg = svgEl('svg', { viewBox: '0 0 100 46', preserveAspectRatio: 'none' }, wrap)
    el('div', 'foot', foot, wrap)
    return svg
  }
  const s1 = mk('Primal feasibility, log scale, vs iteration', 'Tolerance 1.0e-4')
  const s2 = mk('Objective J vs iteration', 'Converged at iteration 31')
  convSvgs = { s1, s2 }
  drawConvergence(1)
}
function drawConvergence(progress) {
  if (!convSvgs) return
  const it = SCENE.planner.iters
  const n = Math.max(2, Math.round(it.length * progress))
  const draw = (svg, val, yMap, gridVals, fmt) => {
    svg.innerHTML = ''
    svgEl('rect', { x: 8, y: 4, width: 90, height: 38, fill: 'none', stroke: '#262a2f', 'stroke-width': 0.4 }, svg)
    for (const g of gridVals) {
      const y = yMap(g)
      svgEl('line', { x1: 8, y1: y, x2: 98, y2: y, stroke: '#22262b', 'stroke-width': 0.35 }, svg)
      svgEl('text', { x: 7, y: y + 1.2, fill: C.faint, 'font-size': 3, 'text-anchor': 'end', 'font-family': 'ui-monospace, Menlo, monospace' }, svg).textContent = fmt(g)
    }
    let d = ''
    for (let i = 0; i < n; i++) {
      const x = 8 + (it[i].iter / 31) * 90
      d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${yMap(val(it[i])).toFixed(2)}`
    }
    svgEl('path', { d, fill: 'none', stroke: C.cyan, 'stroke-width': 0.9 }, svg)
    for (let i = 0; i < n; i += 3) {
      const x = 8 + (it[i].iter / 31) * 90
      svgEl('circle', { cx: x, cy: yMap(val(it[i])), r: 0.8, fill: C.cyan }, svg)
    }
  }
  draw(convSvgs.s1, (r) => r.primal,
    (v) => 42 - ((Math.log10(v) + 5) / 5.2) * 38, [1, 1e-2, 1e-4], (g) => `1e${Math.round(Math.log10(g))}`)
  draw(convSvgs.s2, (r) => r.J,
    (v) => 42 - ((v - 12) / 14) * 38, [15, 20, 25], (g) => String(g))
}

function buildObjectiveTable(page) {
  const wrap = el('div', 'scrolly', null, page)
  const tbl = el('table', 'tbl', null, wrap)
  tbl.innerHTML = `<thead><tr><th>Term</th><th class="num">Weight</th><th class="num">Value</th><th class="num">Contribution</th></tr></thead>`
  const tb = el('tbody', null, null, tbl)
  let tot = 0
  for (const r of SCENE.planner.objectiveTerms) {
    tot += r.contribution
    el('tr', null,
      `<td>${r.term}</td><td class="num">${r.weight.toFixed(2)}</td>` +
      `<td class="num">${r.value.toFixed(3)}</td><td class="num">${r.contribution.toFixed(3)}</td>`, tb)
  }
  el('tr', null,
    `<td><b>Total J</b></td><td></td><td></td><td class="num"><b>${tot.toFixed(3)}</b></td>`, tb)
}

function buildConstraints(page) {
  const run = SCENE.runs['run-015']
  const m = run.metrics
  const wrap = el('div', 'scrolly', null, page)
  const tbl = el('table', 'tbl', null, wrap)
  tbl.innerHTML = `<thead><tr><th>Constraint</th><th class="num">Observed</th><th class="num">Bound</th><th class="num">Margin</th><th>State</th></tr></thead>`
  const tb = el('tbody', null, null, tbl)
  const rows = [
    ['Swept clearance, PALLET-STACK', `${f2(m.minClearance)} m`, '>= 0.30 m', `+${f2(m.minClearance - 0.30)} m`, 'active'],
    ['Articulation angle', `${f1(m.maxArticulationDeg)} deg`, '<= 42.0 deg', `+${f1(42 - m.maxArticulationDeg)} deg`, 'inactive'],
    ['Road-wheel steering', `${f1(m.maxSteeringDeg)} deg`, '<= 35.0 deg', `+${f1(35 - m.maxSteeringDeg)} deg`, 'inactive'],
    ['Steering rate', `${f1(m.maxSteeringRateDegS)} deg/s`, '<= 18.0 deg/s', `+${f1(18 - m.maxSteeringRateDegS)} deg/s`, 'inactive'],
    ['Terminal position', `${f2(Math.max(run.term.dx, run.term.dy))} m`, '<= 0.10 m', `+${f2(0.10 - Math.max(run.term.dx, run.term.dy))} m`, 'active'],
    ['Terminal yaw', `${run.term.dyawDeg.toFixed(2)} deg`, '<= 1.00 deg', `+${(1 - run.term.dyawDeg).toFixed(2)} deg`, 'active'],
    ['Reverse speed', `${f2(m.maxReverseSpeed)} m/s`, '<= 2.50 m/s', `+${f2(2.5 - m.maxReverseSpeed)} m/s`, 'inactive'],
  ]
  for (const [a, b, c, d, e] of rows) {
    el('tr', null,
      `<td>${a}</td><td class="num">${b}</td><td class="num">${c}</td><td class="num">${d}</td>` +
      `<td class="${e === 'active' ? 'ok' : 'dim'}">${e}</td>`, tb)
  }
}

function buildComparison(page) {
  const a = SCENE.runs['run-014'], b = SCENE.runs['run-015']
  const wrap = el('div', 'scrolly', null, page)
  const tbl = el('table', 'tbl', null, wrap)
  tbl.innerHTML = `<thead><tr><th>Metric</th><th class="num">run-014 baseline</th><th class="num">run-015 refined</th><th class="num">Delta</th></tr></thead>`
  const tb = el('tbody', null, null, tbl)
  const row = (name, va, vb, fmt, better) => {
    const d = vb - va
    el('tr', null,
      `<td>${name}</td><td class="num">${fmt(va)}</td><td class="num">${fmt(vb)}</td>` +
      `<td class="num ${better === undefined ? '' : (better(d) ? 'ok' : 'bad')}">${d >= 0 ? '+' : ''}${fmt(d)}</td>`, tb)
  }
  el('tr', null,
    `<td>Status</td><td class="num bad">REJECTED</td><td class="num ok">RELEASABLE</td><td></td>`, tb)
  row('Total cost', a.cost.total, b.cost.total, (v) => v.toFixed(1), (d) => d < 0)
  row('Path length [m]', a.metrics.pathLength, b.metrics.pathLength, (v) => v.toFixed(1))
  row('Duration [s]', a.metrics.duration, b.metrics.duration, (v) => v.toFixed(1))
  row('Min clearance [m]', a.metrics.minClearance, b.metrics.minClearance, (v) => v.toFixed(2), (d) => d > 0)
  row('Max articulation [deg]', a.metrics.maxArticulationDeg, b.metrics.maxArticulationDeg, (v) => v.toFixed(1), (d) => d < 0)
  row('Max steering rate [deg/s]', a.metrics.maxSteeringRateDegS, b.metrics.maxSteeringRateDegS, (v) => v.toFixed(1), (d) => d < 0)
  row('Terminal error [m]', Math.max(a.term.dx, a.term.dy), Math.max(b.term.dx, b.term.dy), (v) => v.toFixed(2), (d) => d < 0)
  row('Max reverse speed [m/s]', a.metrics.maxReverseSpeed, b.metrics.maxReverseSpeed, (v) => v.toFixed(2), (d) => d < 0)
}

function buildArtifacts(page) {
  const wrap = el('div', 'scrolly', null, page)
  const tbl = el('table', 'tbl', null, wrap)
  tbl.innerHTML = `<thead><tr><th>File</th><th>Type</th><th class="num">Size</th><th>Producing run</th><th>Integrity</th></tr></thead>`
  const tb = el('tbody', null, null, tbl)
  const rows = [
    ['solution.json', 'Trajectory', '18 KB'],
    ['validation.json', 'Validation result', '64 KB'],
    ['solver-trace.log', 'Solver trace', '512 KB'],
    ['parameters.yaml', 'Parameter snapshot', '23 KB'],
    ['scenario-snapshot.json', 'Normalized scenario', '41 KB'],
    ['plot-data.csv', 'Plot data', '156 KB'],
    ['manifest.json', 'Run manifest', '5 KB'],
  ]
  for (const [n, ty, sz] of rows) {
    el('tr', null,
      `<td>${n}</td><td class="dim">${ty}</td><td class="num">${sz}</td>` +
      `<td class="dim">run-015</td><td class="ok">hash verified</td>`, tb)
  }
}

// verdict -------------------------------------------------------------------
function buildVerdict() {
  const v = $('verdict')
  const run = runOf()
  const passCount = run.checks.filter((c) => c.pass).length
  v.innerHTML = ''
  const sel = document.createElement('select')
  for (const id of ['run-015', 'run-014']) {
    const o = document.createElement('option')
    o.value = id; o.textContent = SCENE.runs[id].label
    if (id === state.run) o.selected = true
    sel.appendChild(o)
  }
  sel.addEventListener('change', () => setRun(sel.value))
  v.appendChild(sel)
  el('span', `badge ${run.releasable ? 'ok' : 'bad'}`, run.releasable ? 'RELEASABLE' : 'REJECTED', v)
  el('span', 'counts', `${passCount} of 8 required checks pass`, v)
  el('span', 'scope',
    'Scope: scenario dock-d17-reverse, vehicle YT-1 + T-136, planner DockPlan 2.4.1, policy v1.2.', v)
  const cmp = el('label', 'cmp', null, v)
  const cb = document.createElement('input')
  cb.type = 'checkbox'; cb.checked = state.compare
  cmp.appendChild(cb)
  el('span', null, 'Compare runs', cmp)
  cb.addEventListener('change', () => { state.compare = cb.checked; applyLayerVisibility(); redrawPlots() })
  const exp = el('button', 'tbtn', 'Export bundle', v)
  exp.title = 'This control is not in the v2 mockup.'
}

// check selection -----------------------------------------------------------
function selectCheck(i) {
  state.selectedCheck = i
  const run = runOf()
  const c = run.checks[i]
  buildInspector()
  stopPlay()
  if (c.id === 'VAL-CHECK-001') {
    setStation(run.metrics.minClearanceS)
  } else if (c.id === 'VAL-CHECK-003') {
    let best = 0, bs = 0
    for (const q of run.samples) if (Math.abs(q.articulation) > best) { best = Math.abs(q.articulation); bs = q.s }
    setStation(bs)
  } else if (c.id === 'VAL-CHECK-004') {
    let best = 0, bs = 0
    for (const q of run.samples) if (Math.abs(q.steeringRate) > best) { best = Math.abs(q.steeringRate); bs = q.s }
    setStation(bs)
  } else if (c.id === 'VAL-CHECK-006') {
    setStation(run.metrics.pathLength)
  } else if (c.id === 'VAL-CHECK-007') {
    let best = 0, bs = 0
    for (const q of run.samples) if (q.v > best) { best = q.v; bs = q.s }
    setStation(bs)
  }
  setStatus(`${c.id} · ${c.name} · evidence: ${c.evidence}`)
}

// run switch ----------------------------------------------------------------
function setRun(id) {
  state.run = id
  state.selectedCheck = null
  const base = document.getElementById('basePath')
  const ref = document.getElementById('refPath')
  if (id === 'run-014') {
    base.setAttribute('stroke-width', 2.2)
    base.setAttribute('stroke-dasharray', 'none')
    ref.setAttribute('opacity', 0.35)
  } else {
    base.setAttribute('stroke-width', 1.4)
    base.setAttribute('stroke-dasharray', '6 4')
    ref.setAttribute('opacity', 1)
  }
  drawWitness(runOf())
  markTreeRun()
  buildVerdict()
  buildInspector()
  buildDock()
  applyLayerVisibility()
  setStation(Math.min(state.station, runOf().metrics.pathLength))
  setStatus(`${runOf().label} active`)
}

// workspace switch ----------------------------------------------------------
const WS_LABEL = {
  scenario: 'SCENARIO DEFINITION',
  planner: 'PLANNER DIAGNOSTICS · HYBRID A* + SQP',
  validation: 'VALIDATION + RELEASE REVIEW',
}
function setWs(ws) {
  state.ws = ws
  $('app').dataset.ws = ws
  document.querySelectorAll('.wstab').forEach((t) => t.classList.toggle('active', t.dataset.ws === ws))
  $('wsLabel').textContent = WS_LABEL[ws]
  buildLegend()
  buildInspector()
  buildDock()
  buildVerdict()
  applyLayerVisibility()
  updatePlotCursors()
  if (ws !== 'validation' && state.run !== 'run-015') setRun('run-015')
  setStatus(ws === 'planner' ? 'CONVERGED' : 'Ready', ws === 'planner')
}
document.querySelectorAll('.wstab').forEach((t) => {
  t.addEventListener('click', () => setWs(t.dataset.ws))
})

function buildLegend() {
  const host = $('legend')
  host.innerHTML = ''
  const items = {
    scenario: [
      ['Reference path', C.violet, false],
      ['Tractor track', C.track, true],
      ['Swept body', C.violet, 'box'],
      ['Clearance 0.30 m', C.amber, 'box'],
    ],
    planner: [
      ['Warm start', C.cyan, true],
      ['Refined', C.violet, false],
      ['Expanded states', '#b58a3d', false],
      ['Rejected', C.red, false],
    ],
    validation: [
      ['run-015 refined', C.violet, false],
      ['run-014 baseline', C.red, true],
      ['Dock goal', C.amber, true],
      ['Witness', C.amber, false],
    ],
  }[state.ws]
  for (const [label, color, dash] of items) {
    const li = el('div', 'li', null, host)
    const i = el('i', dash === 'box' ? 'box' : (dash ? 'dash' : ''), '', li)
    i.style.borderColor = color
    el('span', null, label, li)
  }
}

// planner run replay --------------------------------------------------------
let replayBusy = false
function runPlannerReplay() {
  if (replayBusy) return
  replayBusy = true
  if (state.ws !== 'planner') setWs('planner')
  const btn = $('runPlanner'), stop = $('stopRun')
  btn.disabled = true; stop.disabled = false
  setStatus('Planning', false)
  const log = document.getElementById('plannerLog')
  if (log) log.innerHTML = ''
  drawCloud(0)
  G.path.style.opacity = 0.15
  drawConvergence(0.02)
  const steps = SCENE.planner.log
  let i = 0
  const t0 = performance.now()
  const totalMs = 4300
  const timer = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / totalMs)
    drawCloud(Math.min(1, p * 1.7))
    if (p > 0.35) drawConvergence(Math.min(1, (p - 0.35) / 0.5))
    while (i < steps.length && i / steps.length < p) {
      if (log) appendLog(log, steps[i][0], steps[i][1], steps[i][2])
      i++
    }
    if (p >= 1) {
      clearInterval(timer)
      while (i < steps.length) { if (log) appendLog(log, steps[i][0], steps[i][1], steps[i][2]); i++ }
      G.path.style.opacity = 1
      drawConvergence(1)
      btn.disabled = false; stop.disabled = true
      replayBusy = false
      setStatus('CONVERGED', true)
    }
  }, 90)
}
$('runPlanner').addEventListener('click', runPlannerReplay)

// misc wiring ---------------------------------------------------------------
function setStatus(text, good) {
  const s = $('statusState')
  s.textContent = text
  s.classList.toggle('good', !!good)
}
$('fitView').addEventListener('click', () => setView(WORLD))
$('fitPath').addEventListener('click', () => setView({ x0: 24, y0: -1.5, w: 34, h: 24.5 }))
$('tabTree').addEventListener('click', () => {
  $('tabTree').classList.add('active'); $('tabLayers').classList.remove('active')
  $('treeHost').hidden = false; $('layersHost').hidden = true
})
$('tabLayers').addEventListener('click', () => {
  $('tabLayers').classList.add('active'); $('tabTree').classList.remove('active')
  $('treeHost').hidden = true; $('layersHost').hidden = false
})
canvas.addEventListener('mousemove', (ev) => {
  const r = canvas.getBoundingClientRect()
  const vb = canvas.viewBox.baseVal
  const scale = Math.min(r.width / vb.width, r.height / vb.height)
  const ox = (r.width - vb.width * scale) / 2, oy = (r.height - vb.height * scale) / 2
  const x = vb.x + (ev.clientX - r.left - ox) / scale
  const y = vb.y + (ev.clientY - r.top - oy) / scale
  const txt = `E ${x.toFixed(2)} m · S ${y.toFixed(2)} m`
  $('coords').textContent = txt
  $('statusCursor').textContent = txt
})

// ------------------------------------------------------------------- boot --
drawGrid()
drawYard()
drawCostmap()
drawObstacles()
drawTrajectories()
drawCloud(1)
drawRejectedBranch()
buildTree()
buildLayers()
buildLegend()
buildVerdict()
buildInspector()
buildDock()
applyLayerVisibility()
setStation(0)
setStatus('Ready')
