/*
 * DockPlan Workbench v2 mockup - scenario model.
 *
 * This module computes the Dock D-17 reverse-approach data set that the
 * interface shows. The articulated kinematics, the swept geometry, the
 * clearance search, and the metric tables are computed, not drawn by hand.
 * The planner search cloud and the solver iteration history are authored
 * replays with consistent numbers (see README.md).
 *
 * Coordinate frame: yard frame, meters, x to the east, y to the south
 * (screen direction). Headings are in radians, measured from +x toward +y.
 */

'use strict'

// ---------------------------------------------------------------- vehicle --
const VEHICLE = {
  name: 'YT-1 + T-136',
  tractor: {
    wheelbase: 3.8,      // m, front axle to rear axle group
    width: 2.5,          // m, body width
    frontOverhang: 1.4,  // m, ahead of front axle
    rearOverhang: 1.0,   // m, behind rear axle
    hitchOffset: 0.42,   // m, hitch behind the rear axle
    track: 2.04,         // m
  },
  trailer: {
    kingpinToAxle: 8.1,  // m, kingpin to bogie center
    width: 2.55,         // m
    frontOverhang: 1.7,  // m, ahead of the kingpin
    rearOverhang: 3.8,   // m, behind the bogie center
    length: 13.6,        // m, total body length
  },
  limits: {
    maxSteeringDeg: 35.0,
    maxSteeringRateDegS: 18.0,
    maxArticulationDeg: 42.0,
    maxReverseSpeed: 2.5,   // m/s
    maxAccel: 1.5,          // m/s^2
    terminalPos: 0.10,      // m
    terminalYawDeg: 1.0,
    clearance: 0.30,        // m, required swept-body clearance
  },
}

const CALC_INTERVAL = 0.25 // m, sample interval along the trailer axle path

// ------------------------------------------------------------ small helpers --
const deg = (r) => r * 180 / Math.PI
const rad = (d) => d * Math.PI / 180
const hyp = (x, y) => Math.sqrt(x * x + y * y)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Rectangle footprint centered on an axis: returns 4 corner points.
function footprint(cx, cy, phi, ahead, behind, halfWidth) {
  const ux = Math.cos(phi), uy = Math.sin(phi)
  const nx = -uy, ny = ux
  return [
    [cx + ux * ahead - nx * halfWidth, cy + uy * ahead - ny * halfWidth],
    [cx + ux * ahead + nx * halfWidth, cy + uy * ahead + ny * halfWidth],
    [cx - ux * behind + nx * halfWidth, cy - uy * behind + ny * halfWidth],
    [cx - ux * behind - nx * halfWidth, cy - uy * behind - ny * halfWidth],
  ]
}

function segPointDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay
  const wx = px - ax, wy = py - ay
  const c1 = vx * wx + vy * wy
  if (c1 <= 0) return hyp(px - ax, py - ay)
  const c2 = vx * vx + vy * vy
  if (c2 <= c1) return hyp(px - bx, py - by)
  const t = c1 / c2
  return hyp(px - (ax + t * vx), py - (ay + t * vy))
}

// Minimum distance between two convex polygons (vertex-to-edge search).
function polyDist(A, B) {
  let best = Infinity, wa = null, wb = null
  const scan = (P, Q) => {
    for (let i = 0; i < P.length; i++) {
      const p = P[i]
      for (let j = 0; j < Q.length; j++) {
        const a = Q[j], b = Q[(j + 1) % Q.length]
        const d = segPointDist(p[0], p[1], a[0], a[1], b[0], b[1])
        if (d < best) {
          best = d
          const vx = b[0] - a[0], vy = b[1] - a[1]
          const wx = p[0] - a[0], wy = p[1] - a[1]
          const c2 = vx * vx + vy * vy
          const t = clamp(c2 ? (vx * wx + vy * wy) / c2 : 0, 0, 1)
          wa = p; wb = [a[0] + t * vx, a[1] + t * vy]
        }
      }
    }
  }
  scan(A, B); scan(B, A)
  return { d: best, a: wa, b: wb }
}

// ------------------------------------------------------------ path builder --
/*
 * The trailer axle path is built from a curvature profile:
 * straight, constant-curvature arc, straight, with smooth curvature
 * blends. The profile is integrated to give positions and headings.
 */
function buildAxlePath(spec) {
  const { lead, radius, tail, blend, start, startHeading } = spec
  const arc = (Math.PI / 2) * radius
  const total = lead + arc + tail
  const n = Math.max(2, Math.round(total / 0.05))
  const ds = total / n

  // raw curvature profile with smoothstep blends
  const kMax = 1 / radius
  const k = new Array(n + 1)
  for (let i = 0; i <= n; i++) {
    const s = i * ds
    let v = 0
    const a0 = lead, a1 = lead + arc
    if (s > a0 - blend && s < a0 + blend) {
      const t = clamp((s - (a0 - blend)) / (2 * blend), 0, 1)
      v = kMax * (t * t * (3 - 2 * t))
    } else if (s >= a0 + blend && s <= a1 - blend) {
      v = kMax
    } else if (s > a1 - blend && s < a1 + blend) {
      const t = clamp((s - (a1 - blend)) / (2 * blend), 0, 1)
      v = kMax * (1 - t * t * (3 - 2 * t))
    }
    k[i] = v
  }
  // normalize the turn to exactly 90 degrees
  let area = 0
  for (let i = 0; i < n; i++) area += 0.5 * (k[i] + k[i + 1]) * ds
  const scale = (Math.PI / 2) / area
  for (let i = 0; i <= n; i++) k[i] *= scale

  // integrate
  const pts = [{ s: 0, x: start[0], y: start[1], phi: startHeading, k: k[0] }]
  let x = start[0], y = start[1], phi = startHeading
  for (let i = 0; i < n; i++) {
    const km = 0.5 * (k[i] + k[i + 1])
    phi += km * ds
    x += Math.cos(phi) * ds
    y += Math.sin(phi) * ds
    pts.push({ s: (i + 1) * ds, x, y, phi, k: k[i + 1] })
  }
  return { pts, total }
}

function sampleAt(path, s) {
  const { pts } = path
  const sMax = pts[pts.length - 1].s
  s = clamp(s, 0, sMax)
  let lo = 0, hi = pts.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (pts[mid].s <= s) lo = mid; else hi = mid
  }
  const a = pts[lo], b = pts[hi]
  const t = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s)
  return {
    s,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    phi: a.phi + wrapPi(b.phi - a.phi) * t,
    k: a.k + (b.k - a.k) * t,
  }
}

// -------------------------------------------------------- rig reconstruction --
/*
 * The rig reverses. The trailer axle follows the built path. The motion
 * heading is the path tangent. The trailer axis points opposite to the
 * motion. The kingpin sits kingpinToAxle ahead of the axle on the trailer
 * axis. The tractor heading follows the kingpin path tangent, reversed.
 * The steering angle comes from the curvature of the tractor axle path.
 */
function reconstructRig(path, speedProfile) {
  const T = VEHICLE.tractor, R = VEHICLE.trailer
  const sMax = path.pts[path.pts.length - 1].s
  const n = Math.round(sMax / CALC_INTERVAL)
  const h = 0.4 // m, finite difference step along s

  const samples = []
  for (let i = 0; i <= n; i++) {
    const s = Math.min(sMax, i * CALC_INTERVAL)
    const p = sampleAt(path, s)
    const trailerHeading = p.phi + Math.PI // axis points against the motion

    const kp = (sv) => {
      const q = sampleAt(path, sv)
      const th = q.phi + Math.PI
      return [q.x + Math.cos(th) * R.kingpinToAxle, q.y + Math.sin(th) * R.kingpinToAxle]
    }
    const K = kp(s)
    const Km = kp(Math.max(0, s - h))
    const Kp = kp(Math.min(sMax, s + h))
    // motion direction of the kingpin, reversed for the tractor axis
    const mvx = Kp[0] - Km[0], mvy = Kp[1] - Km[1]
    const tractorHeading = Math.atan2(mvy, mvx) + Math.PI

    // tractor rear axle sits hitchOffset ahead of the kingpin on the tractor axis
    const ax = K[0] + Math.cos(tractorHeading) * T.hitchOffset
    const ay = K[1] + Math.sin(tractorHeading) * T.hitchOffset

    samples.push({
      s,
      axle: [p.x, p.y],
      trailerHeading,
      kingpin: K,
      tractorAxle: [ax, ay],
      tractorHeading,
      articulation: wrapPi(trailerHeading - tractorHeading),
      motionHeading: p.phi,
    })
  }

  // steering from the curvature of the tractor axle path
  for (let i = 0; i <= n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[i], c = samples[Math.min(n, i + 1)]
    const h1 = Math.atan2(b.tractorAxle[1] - a.tractorAxle[1], b.tractorAxle[0] - a.tractorAxle[0])
    const h2 = Math.atan2(c.tractorAxle[1] - b.tractorAxle[1], c.tractorAxle[0] - b.tractorAxle[0])
    const dsA = hyp(b.tractorAxle[0] - a.tractorAxle[0], b.tractorAxle[1] - a.tractorAxle[1])
    const dsB = hyp(c.tractorAxle[0] - b.tractorAxle[0], c.tractorAxle[1] - b.tractorAxle[1])
    const kappa = wrapPi(h2 - h1) / Math.max(1e-6, 0.5 * (dsA + dsB) * 2)
    b.steering = Math.atan(T.wheelbase * kappa)
  }
  // clamp the numeric ends, then smooth the steering trace
  for (let i = 0; i < 3; i++) { samples[i].steering = samples[3].steering }
  for (let i = n - 2; i <= n; i++) { samples[i].steering = samples[n - 3].steering }
  const st = samples.map((q) => q.steering)
  for (let i = 0; i <= n; i++) {
    let acc = 0, cnt = 0
    for (let j = -4; j <= 4; j++) {
      const idx = i + j
      if (idx >= 0 && idx <= n) { acc += st[idx]; cnt++ }
    }
    samples[i].steering = acc / cnt
  }
  // path curvature carried onto the rig samples for the continuity check
  for (let i = 0; i <= n; i++) {
    samples[i].pathK = sampleAt(path, samples[i].s).k
  }

  // time parameterization
  const prof = speedProfile
  let t = 0
  for (let i = 0; i <= n; i++) {
    const q = samples[i]
    q.v = prof(q.s, sMax)
    if (i > 0) {
      const dsq = q.s - samples[i - 1].s
      const vm = Math.max(0.12, 0.5 * (q.v + samples[i - 1].v))
      t += dsq / vm
    }
    q.t = t
  }
  for (let i = 0; i <= n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(n, i + 1)]
    const dt = Math.max(1e-6, b.t - a.t)
    samples[i].accel = (b.v - a.v) / dt
    samples[i].steeringRate = wrapPi(b.steering - a.steering) / dt
  }
  return samples
}

function bodies(sample) {
  const T = VEHICLE.tractor, R = VEHICLE.trailer
  const tr = footprint(
    sample.tractorAxle[0], sample.tractorAxle[1], sample.tractorHeading,
    T.wheelbase + T.frontOverhang, T.rearOverhang, T.width / 2)
  const tl = footprint(
    sample.axle[0], sample.axle[1], sample.trailerHeading,
    R.kingpinToAxle + R.frontOverhang, R.rearOverhang, R.width / 2)
  return { tractor: tr, trailer: tl }
}

function inflate(poly, m) {
  // approximate outward offset of a convex quad from its centroid
  let cx = 0, cy = 0
  for (const p of poly) { cx += p[0]; cy += p[1] }
  cx /= poly.length; cy /= poly.length
  return poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy
    const L = hyp(dx, dy)
    return [x + (dx / L) * m, y + (dy / L) * m]
  })
}

// -------------------------------------------------------------- clearance --
function clearanceTrace(samples, obstacles) {
  let min = { d: Infinity }
  for (const q of samples) {
    const B = bodies(q)
    let best = { d: Infinity, obstacle: null, a: null, b: null }
    for (const ob of obstacles) {
      for (const body of [B.tractor, B.trailer]) {
        const r = polyDist(body, ob.poly)
        if (r.d < best.d) best = { d: r.d, obstacle: ob.id, a: r.a, b: r.b }
      }
    }
    q.clearance = best.d
    q.witness = best
    if (best.d < min.d) min = { ...best, s: q.s, t: q.t }
  }
  return min
}

// ------------------------------------------------------------------- yard --
function buildYard(dockCenterX) {
  const pitch = 6.0
  const stalls = []
  for (let i = 0; i < 5; i++) {
    const cx = dockCenterX + (i - 3) * pitch
    stalls.push({ id: `D-${14 + i}`, cx, doorW: 3.6, lineY0: 0, lineY1: 14.5, halfW: pitch / 2 - 0.25 })
  }
  return {
    buildingY: 0,          // dock face
    buildingBand: 3.2,     // drawn band height above the face
    stalls,
    apronY1: 28.2,
    kerbs: [
      { x0: dockCenterX - 26, y0: 26.4, x1: dockCenterX + 24, y1: 26.4 },
    ],
    laneY: 22.9,
    parked: { stall: 0, len: 13.6, w: 2.55 }, // parked trailer in D-14
  }
}

// ------------------------------------------------------------ speed profiles --
const refinedSpeed = (s, sMax) => {
  const dEnd = sMax - s
  let v = 2.1
  v = Math.min(v, 0.35 + 0.28 * s)             // pull away, a = dv/ds * v <= 0.6
  v = Math.min(v, 0.20 + 0.26 * dEnd)          // brake to the dock
  return clamp(v, 0.18, 2.1)
}
const baselineSpeed = (s, sMax) => {
  const dEnd = sMax - s
  let v = 2.3
  v = Math.min(v, 0.40 + 0.30 * s)
  v = Math.min(v, 0.24 + 0.28 * dEnd)
  return clamp(v, 0.2, 2.3)
}

// ------------------------------------------------------------------ metrics --
function metrics(samples, minClear) {
  const n = samples.length
  const last = samples[n - 1]
  let maxArt = 0, maxSteer = 0, maxRate = 0, maxV = 0, maxA = 0, maxKRate = 0
  let steerEffort = 0, artRate = 0
  for (let i = 0; i < n; i++) {
    const q = samples[i]
    maxArt = Math.max(maxArt, Math.abs(q.articulation))
    maxSteer = Math.max(maxSteer, Math.abs(q.steering))
    maxRate = Math.max(maxRate, Math.abs(q.steeringRate))
    maxV = Math.max(maxV, q.v)
    maxA = Math.max(maxA, Math.abs(q.accel))
    if (i > 0) {
      const dt = q.t - samples[i - 1].t
      steerEffort += q.steering * q.steering * dt
      artRate += Math.abs(q.articulation - samples[i - 1].articulation)
      const dk = 0 // curvature rate proxy computed below from steering
      maxKRate = Math.max(maxKRate, dk)
    }
  }
  // curvature-rate proxy: d(kappa)/ds of the trailer axle path
  for (let i = 1; i < n; i++) {
    const dsq = Math.max(1e-6, samples[i].s - samples[i - 1].s)
    maxKRate = Math.max(maxKRate, Math.abs(samples[i].pathK - samples[i - 1].pathK) / dsq)
  }
  return {
    pathLength: last.s,
    duration: last.t,
    minClearance: minClear.d,
    minClearanceS: minClear.s,
    minClearanceObstacle: minClear.obstacle,
    maxArticulationDeg: deg(maxArt),
    maxSteeringDeg: deg(maxSteer),
    maxSteeringRateDegS: deg(maxRate),
    maxReverseSpeed: maxV,
    maxAccel: maxA,
    maxCurvatureRate: maxKRate,
    steerEffort,
    artRate,
  }
}

// ------------------------------------------------------------------ scene --
function computeScene() {
  // refined run
  const refPath = buildAxlePath({
    lead: 8.0, radius: 14.0, tail: 2.38, blend: 3.5,
    start: [53.5, 20.45], startHeading: Math.PI, // moving toward -x
  })
  const refined = reconstructRig(refPath, refinedSpeed)
  const refEnd = refined[refined.length - 1]

  // dock centered on the achieved terminal axle x
  const dockX = refEnd.axle[0]
  const yard = buildYard(dockX)

  // goal pose: authored close to the achieved terminal state
  const goal = {
    x: dockX + 0.031,
    y: refEnd.axle[1] - 0.024,
    headingDeg: 90.31, // trailer axis, yard frame, +y is south
  }

  // baseline run: tighter arc from a closer lane, harder profile
  const basePath = buildAxlePath({
    lead: 9.7, radius: 12.3, tail: 2.55, blend: 3.0,
    start: [53.5, 18.8], startHeading: Math.PI,
  })
  const baseline = reconstructRig(basePath, baselineSpeed)

  // obstacles ------------------------------------------------------------
  // The pallet stack is placed against the refined swept path so that the
  // observed clearance equals the reference value 0.34 m, then fixed.
  const pallet = { id: 'PALLET-STACK', w: 1.2, h: 1.0, x: 0, y: 0 }
  // provisional placement inside the turn
  let px = dockX + 6.4, py = 10.6
  const palletPoly = () => {
    const r = pallet
    return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]
  }
  pallet.x = px; pallet.y = py
  // measure, then move the pallet toward the swept body until the
  // observed clearance equals the 0.34 m reference value
  {
    const target = 0.34
    for (let iter = 0; iter < 6; iter++) {
      const probe = [{ id: 'P', poly: palletPoly() }]
      const min = clearanceTrace(refined, probe)
      if (Math.abs(min.d - target) < 0.004) break
      const pcx = pallet.x + pallet.w / 2, pcy = pallet.y + pallet.h / 2
      // pick the witness point that sits on the vehicle body
      const da = hyp(min.a[0] - pcx, min.a[1] - pcy)
      const db = hyp(min.b[0] - pcx, min.b[1] - pcy)
      const bodyPt = da > db ? min.a : min.b
      const dx = bodyPt[0] - pcx, dy = bodyPt[1] - pcy
      const L = hyp(dx, dy) || 1
      const move = min.d - target
      pallet.x += (dx / L) * move
      pallet.y += (dy / L) * move
    }
  }

  const parkedStall = yard.stalls[0]
  // The dock face is an obstacle, without the open D-17 door segment.
  const doorHalf = 1.8
  const obstacles = [
    { id: 'PALLET-STACK', kind: 'pallet', poly: palletPoly() },
    {
      id: 'DOCK-FACE-W', kind: 'building',
      poly: [[dockX - 26, -0.05], [dockX - doorHalf, -0.05], [dockX - doorHalf, 0.0], [dockX - 26, 0.0]],
    },
    {
      id: 'DOCK-FACE-E', kind: 'building',
      poly: [[dockX + doorHalf, -0.05], [dockX + 24, -0.05], [dockX + 24, 0.0], [dockX + doorHalf, 0.0]],
    },
    {
      id: 'TRAILER-D14', kind: 'parked',
      poly: footprint(parkedStall.cx, 2.1 + 13.6 / 2, Math.PI / 2, 13.6 / 2, 13.6 / 2, 2.55 / 2),
    },
    {
      id: 'KERB-S', kind: 'kerb',
      poly: [[dockX - 26, 26.4], [dockX + 24, 26.4], [dockX + 24, 26.7], [dockX - 26, 26.7]],
    },
  ]

  const refMin = clearanceTrace(refined, obstacles)
  const baseMin = clearanceTrace(baseline, obstacles)
  const refM = metrics(refined, refMin)
  const baseM = metrics(baseline, baseMin)

  // terminal error against the authored goal
  const refTerm = {
    dx: Math.abs(refEnd.axle[0] - goal.x),
    dy: Math.abs(refEnd.axle[1] - goal.y),
    dyawDeg: Math.abs(deg(wrapPi(refEnd.trailerHeading - rad(goal.headingDeg)))),
  }
  const baseEnd = baseline[baseline.length - 1]
  const baseTerm = {
    dx: Math.abs(baseEnd.axle[0] - goal.x),
    dy: Math.abs(baseEnd.axle[1] - goal.y),
    dyawDeg: Math.abs(deg(wrapPi(baseEnd.trailerHeading - rad(goal.headingDeg)))),
  }

  // cost policy (validation): weighted, bounded at 200 ---------------------
  const costTerms = (m, term) => {
    const rows = [
      { term: 'Path length', unit: 'm', weight: 2.0, value: m.pathLength },
      { term: 'Duration', unit: 's', weight: 1.5, value: m.duration },
      { term: 'Steering effort', unit: 'rad^2 s', weight: 6.0, value: m.steerEffort },
      { term: 'Articulation travel', unit: 'rad', weight: 8.0, value: m.artRate },
      { term: 'Clearance penalty', unit: 'm', weight: 60.0, value: Math.max(0, 0.6 - m.minClearance) },
      { term: 'Terminal error', unit: 'm', weight: 40.0, value: term.dx + term.dy },
    ]
    let total = 0
    for (const r of rows) { r.contribution = r.weight * r.value; total += r.contribution }
    return { rows, total }
  }
  const refCost = costTerms(refM, refTerm)
  const baseCost = costTerms(baseM, baseTerm)

  // validation checks ------------------------------------------------------
  const L = VEHICLE.limits
  const f2 = (v) => v.toFixed(2)
  const checks = (m, term, cost) => ([
    {
      id: 'VAL-CHECK-001', name: 'Swept-body clearance',
      observed: `${f2(m.minClearance)} m`, required: '>= 0.30 m',
      margin: m.minClearance - L.clearance, unit: 'm',
      pass: m.minClearance >= L.clearance,
      evidence: `clearance.min at s = ${m.minClearanceS.toFixed(1)} m, ${m.minClearanceObstacle}`,
      station: m.minClearanceS,
    },
    {
      id: 'VAL-CHECK-002', name: 'Boundary compliance',
      observed: '0 violations', required: '0 violations',
      margin: null, pass: true,
      evidence: 'boundary.violations, kerb and stall layers',
      station: null,
    },
    {
      id: 'VAL-CHECK-003', name: 'Kinematic feasibility',
      observed: `${m.maxArticulationDeg.toFixed(1)} deg, ${m.maxSteeringDeg.toFixed(1)} deg`,
      required: '<= 42.0 deg, <= 35.0 deg',
      margin: Math.min(L.maxArticulationDeg - m.maxArticulationDeg, L.maxSteeringDeg - m.maxSteeringDeg),
      unit: 'deg',
      pass: m.maxArticulationDeg <= L.maxArticulationDeg && m.maxSteeringDeg <= L.maxSteeringDeg,
      evidence: 'kinematics.articulation.max, steering.max',
      station: null, stationKind: 'maxArticulation',
    },
    {
      id: 'VAL-CHECK-004', name: 'Control limits',
      observed: `${m.maxSteeringRateDegS.toFixed(1)} deg/s, ${f2(m.maxAccel)} m/s^2`,
      required: '<= 18.0 deg/s, <= 1.50 m/s^2',
      margin: L.maxSteeringRateDegS - m.maxSteeringRateDegS, unit: 'deg/s',
      pass: m.maxSteeringRateDegS <= L.maxSteeringRateDegS && m.maxAccel <= L.maxAccel,
      evidence: 'controls.steering_rate.max, accel.max',
      station: null,
    },
    {
      id: 'VAL-CHECK-005', name: 'Trajectory continuity',
      observed: `0 gaps, ${m.maxCurvatureRate.toFixed(3)} 1/m^2`, required: '<= 0.200 1/m^2',
      margin: 0.2 - m.maxCurvatureRate, unit: '1/m^2',
      pass: m.maxCurvatureRate <= 0.2,
      evidence: 'continuity.curvature_rate.max',
      station: null,
    },
    {
      id: 'VAL-CHECK-006', name: 'Terminal pose accuracy',
      observed: `${f2(Math.max(term.dx, term.dy))} m, ${term.dyawDeg.toFixed(1)} deg`,
      required: '<= 0.10 m, <= 1.0 deg',
      margin: L.terminalPos - Math.max(term.dx, term.dy), unit: 'm',
      pass: Math.max(term.dx, term.dy) <= L.terminalPos && term.dyawDeg <= L.terminalYawDeg,
      evidence: 'terminal.pose vs goal envelope',
      station: 'end',
    },
    {
      id: 'VAL-CHECK-007', name: 'Reverse motion limits',
      observed: `${f2(m.maxReverseSpeed)} m/s, ${f2(m.maxAccel)} m/s^2`,
      required: '<= 2.50 m/s, <= 1.50 m/s^2',
      margin: L.maxReverseSpeed - m.maxReverseSpeed, unit: 'm/s',
      pass: m.maxReverseSpeed <= L.maxReverseSpeed,
      evidence: 'velocity.reverse.max',
      station: null,
    },
    {
      id: 'VAL-CHECK-008', name: 'Cost evaluation',
      observed: cost.total.toFixed(1), required: '<= 200.0',
      margin: 200 - cost.total, unit: '',
      pass: cost.total <= 200,
      evidence: 'cost.total, weighted term table',
      station: null,
    },
  ])

  const refChecks = checks(refM, refTerm, refCost)
  const baseChecks = checks(baseM, baseTerm, baseCost)

  // planner replay ---------------------------------------------------------
  const planner = buildPlannerReplay(refined, refPath, obstacles, refM, dockX)

  return {
    vehicle: VEHICLE,
    calcInterval: CALC_INTERVAL,
    yard, obstacles, pallet, goal, dockX, planner,
    runs: {
      'run-015': {
        id: 'run-015', label: 'run-015 refined', kind: 'refined',
        samples: refined, metrics: refM, term: refTerm, cost: refCost,
        checks: refChecks, min: refMin,
        releasable: refChecks.every((c) => c.pass),
      },
      'run-014': {
        id: 'run-014', label: 'run-014 baseline', kind: 'baseline',
        samples: baseline, metrics: baseM, term: baseTerm, cost: baseCost,
        checks: baseChecks, min: baseMin,
        releasable: baseChecks.every((c) => c.pass),
      },
    },
  }
}

// --------------------------------------------------------- planner replay --
function buildPlannerReplay(samples, path, obstacles, m, dockX) {
  const rand = mulberry32(20260804)
  const cloud = []
  const sMax = samples[samples.length - 1].s
  for (let i = 0; i < 430; i++) {
    const s = rand() * sMax
    const p = sampleAt(path, s)
    const lat = (rand() * 2 - 1) * (1.2 + 2.8 * rand())
    const nx = -Math.sin(p.phi), ny = Math.cos(p.phi)
    const x = p.x + nx * lat, y = p.y + ny * lat
    if (y < 1.2 || y > 24.0) continue
    const dh = (rand() * 2 - 1) * rad(26)
    const hphi = p.phi + dh
    const len = 0.85
    let pruned = false
    for (const ob of obstacles) {
      const r = polyDist([[x, y]], inflate(ob.poly, 0.35))
      if (r.d < 0.32) { pruned = true; break }
    }
    cloud.push({
      x1: x, y1: y,
      x2: x + Math.cos(hphi) * len, y2: y + Math.sin(hphi) * len,
      pruned,
    })
  }

  // one labeled rejected branch toward the pallet side
  const rejected = {
    label: 'Rejected: articulation bound',
    reason: 'Articulation 42.6 deg exceeds the 42.0 deg limit at branch depth 3.',
    station: (sMax * 0.42),
    poses: [0, 1, 2].map((i) => {
      const t = sMax * (0.40 + i * 0.05)
      const q = sampleAt(path, Math.min(sMax, t))
      const push = -(2.2 + i * 2.1)
      const nx = -Math.sin(q.phi), ny = Math.cos(q.phi)
      return { x: q.x + nx * push, y: q.y + ny * push, phi: q.phi - rad(12 + i * 17) }
    }),
  }

  // convergence history (authored replay, monotone and consistent)
  const iters = []
  const J0 = 24.7, Jf = 13.821
  for (let i = 0; i <= 31; i++) {
    const t = i / 31
    const J = Jf + (J0 - Jf) * Math.exp(-4.2 * t) * (1 - 0.12 * t)
    const primal = Math.pow(10, 0 - 4.1 * t - 0.9 * t * t)
    iters.push({ iter: i, J: i === 31 ? Jf : J, primal: i === 31 ? 8.2e-5 : primal })
  }

  const params = [
    ['Hybrid A*', null],
    ['grid resolution', '0.10 m'],
    ['steering step', '5.0 deg'],
    ['analytic expansion', 'on'],
    ['max steering', '35.0 deg'],
    ['reverse penalty', '2.0'],
    ['gear change penalty', '5.0'],
    ['obstacle inflation', '0.45 m'],
    ['SQP refinement', null],
    ['max iterations', '50'],
    ['tolerance, primal', '1.0e-4'],
    ['tolerance, dual', '1.0e-4'],
    ['line search', 'merit'],
    ['warm start', 'on'],
  ]

  const summary = {
    expanded: 18642,
    generated: 44208,
    reopened: 512,
    analytic: '14 / 1 accepted',
    warmStartCost: 18.447,
    iterations: 31,
    primal: '8.2e-5',
    objective: 13.821,
  }

  const objectiveTerms = [
    { term: 'Path length', weight: 0.25, value: m.pathLength },
    { term: 'Duration', weight: 0.10, value: m.duration },
    { term: 'Steering effort', weight: 1.40, value: m.steerEffort },
    { term: 'Articulation travel', weight: 2.20, value: m.artRate },
    { term: 'Clearance, soft', weight: 1.00, value: Math.max(0, 0.5 - m.minClearance) },
    { term: 'Terminal pose', weight: 5.00, value: 0.004 },
  ]
  let tot = 0
  for (const r of objectiveTerms) { r.contribution = r.weight * r.value; tot += r.contribution }
  const norm = 13.821 / tot
  for (const r of objectiveTerms) { r.weight *= norm; r.contribution *= norm }

  const log = [
    ['14:12:03.118', 'INFO', 'Input normalization complete'],
    ['14:12:03.242', 'INFO', 'Hybrid A* search started'],
    ['14:12:04.870', 'INFO', 'Expanded 18,642 states'],
    ['14:12:04.871', 'INFO', 'Analytic connections 14, 1 accepted'],
    ['14:12:04.902', 'INFO', 'Warm-start cost 18.447'],
    ['14:12:04.995', 'INFO', 'Articulated state reconstruction complete'],
    ['14:12:05.130', 'INFO', 'SQP refinement started'],
    ['14:12:05.512', 'DEBUG', 'Iter 1   merit 24.715   primal 1.2e-1'],
    ['14:12:06.081', 'DEBUG', 'Iter 10  merit 15.237   primal 6.3e-3'],
    ['14:12:06.700', 'DEBUG', 'Iter 20  merit 13.862   primal 2.1e-4'],
    ['14:12:07.214', 'DEBUG', 'Iter 31  merit 13.821   primal 8.2e-5'],
    ['14:12:07.215', 'INFO', 'CONVERGED'],
    ['14:12:07.348', 'INFO', 'Time parameterization complete'],
    ['14:12:07.402', 'INFO', 'Validation handoff ready'],
  ]

  return { cloud, rejected, iters, params, summary, objectiveTerms, log }
}

const SCENE = computeScene()

if (typeof module !== 'undefined') module.exports = { SCENE, VEHICLE, deg, rad }
