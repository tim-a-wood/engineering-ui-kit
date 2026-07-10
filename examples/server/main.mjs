/**
 * test server: one Node-stdlib process serving a built Vite frontend plus a
 * small typed JSON API with JSON-file persistence.
 *
 *   GET  /api/cases          → { cases: PerformanceCase[] }
 *   POST /api/cases          → PerformanceCase
 *   PUT  /api/cases/:id      → PerformanceCase
 *   POST /api/calculate      → PerformanceOutput
 *
 * The calculation model is intentionally labeled as planning/demo-grade
 * because the task packet does not supply aircraft-specific AFM/OEM tables.
 */

/** @typedef {import('../shared/types').AircraftVariant} AircraftVariant */
/** @typedef {import('../shared/types').CaseInput} CaseInput */
/** @typedef {import('../shared/types').FlapSetting} FlapSetting */
/** @typedef {import('../shared/types').OperationMode} OperationMode */
/** @typedef {import('../shared/types').PerformanceCase} PerformanceCase */
/** @typedef {import('../shared/types').PerformanceInputs} PerformanceInputs */
/** @typedef {import('../shared/types').PerformanceOutput} PerformanceOutput */
/** @typedef {import('../shared/types').RunwayCondition} RunwayCondition */

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = path.join(ROOT, 'dist')
const DATA_FILE = path.join(ROOT, 'data', 'performance-cases.json')
const PORT = Number(process.env.PORT ?? 5412)

const AIRCRAFT = /** @type {const} */ ({
  'GL-350': { refWeight: 52000, minWeight: 30000, maxWeight: 64000, baseTakeoff: 3100, baseLanding: 2600, refVref: 116 },
  'GL-500': { refWeight: 65000, minWeight: 36000, maxWeight: 78000, baseTakeoff: 3650, baseLanding: 3020, refVref: 126 },
  'GL-650': { refWeight: 78000, minWeight: 44000, maxWeight: 90000, baseTakeoff: 4250, baseLanding: 3400, refVref: 136 },
})

const MODES = ['takeoff', 'landing']
const CONDITIONS = ['dry', 'wet']
const FLAPS = ['10', '15', '20']

/** @returns {{ cases: PerformanceCase[] }} */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = { cases: seedCases() }
    saveData(seeded)
    return seeded
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
}

/** @param {{ cases: PerformanceCase[] }} data */
function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}

/** @returns {PerformanceCase[]} */
function seedCases() {
  const samples = [
    {
      label: 'KSVN runway 10 — standard day dispatch check',
      inputs: {
        mode: 'takeoff',
        aircraftVariant: 'GL-500',
        runwayId: 'KSVN RWY 10',
        runwayLengthFt: 9351,
        pressureAltitudeFt: 48,
        oatC: 29,
        weightLb: 64500,
        windComponentKt: 8,
        runwayCondition: 'dry',
        flapSetting: '15',
        notes: 'Baseline planning case for local departure.',
      },
    },
    {
      label: 'Mountain field warm-day assessment',
      inputs: {
        mode: 'takeoff',
        aircraftVariant: 'GL-350',
        runwayId: 'KASE RWY 33',
        runwayLengthFt: 8006,
        pressureAltitudeFt: 7820,
        oatC: 24,
        weightLb: 58400,
        windComponentKt: -3,
        runwayCondition: 'dry',
        flapSetting: '20',
        notes: 'High-altitude demonstration case; review against approved data before use.',
      },
    },
    {
      label: 'Wet runway arrival planning',
      inputs: {
        mode: 'landing',
        aircraftVariant: 'GL-650',
        runwayId: 'KCHS RWY 15',
        runwayLengthFt: 9001,
        pressureAltitudeFt: 46,
        oatC: 31,
        weightLb: 69200,
        windComponentKt: 5,
        runwayCondition: 'wet',
        flapSetting: '20',
        notes: 'Arrival planning sample with wet runway factor.',
      },
    },
  ]

  const now = new Date().toISOString()
  return samples.map((sample, index) => ({
    id: crypto.randomUUID(),
    label: sample.label,
    createdAt: now,
    updatedAt: new Date(Date.now() + index).toISOString(),
    inputs: /** @type {PerformanceInputs} */ (sample.inputs),
    output: calculate(/** @type {PerformanceInputs} */ (sample.inputs)),
  }))
}

/** @param {unknown} body @returns {{ ok: true, value: CaseInput } | { ok: false, error: string }} */
function validateCaseInput(body) {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object.' }
  const b = /** @type {Record<string, unknown>} */ (body)
  const label = typeof b.label === 'string' ? b.label.trim() : ''
  const inputs = typeof b.inputs === 'object' && b.inputs !== null ? /** @type {Record<string, unknown>} */ (b.inputs) : null
  if (!label) return { ok: false, error: 'Case label is required.' }
  if (!inputs) return { ok: false, error: 'Inputs are required.' }

  const aircraftVariant = typeof inputs.aircraftVariant === 'string' ? inputs.aircraftVariant : ''
  const mode = typeof inputs.mode === 'string' ? inputs.mode : ''
  const runwayCondition = typeof inputs.runwayCondition === 'string' ? inputs.runwayCondition : ''
  const flapSetting = typeof inputs.flapSetting === 'string' ? inputs.flapSetting : ''
  const runwayId = typeof inputs.runwayId === 'string' ? inputs.runwayId.trim() : ''
  const notes = typeof inputs.notes === 'string' ? inputs.notes.trim() : ''

  if (!(aircraftVariant in AIRCRAFT)) return { ok: false, error: 'Aircraft variant is not supported.' }
  if (!MODES.includes(mode)) return { ok: false, error: 'Operation mode must be takeoff or landing.' }
  if (!CONDITIONS.includes(runwayCondition)) return { ok: false, error: 'Runway condition must be dry or wet.' }
  if (!FLAPS.includes(flapSetting)) return { ok: false, error: 'Flap setting must be 10, 15, or 20.' }
  if (!runwayId) return { ok: false, error: 'Runway identifier is required.' }

  const runwayLengthFt = numberFrom(inputs.runwayLengthFt)
  const pressureAltitudeFt = numberFrom(inputs.pressureAltitudeFt)
  const oatC = numberFrom(inputs.oatC)
  const weightLb = numberFrom(inputs.weightLb)
  const windComponentKt = numberFrom(inputs.windComponentKt)

  if (!Number.isFinite(runwayLengthFt) || runwayLengthFt < 1500 || runwayLengthFt > 16000) {
    return { ok: false, error: 'Runway length must be between 1,500 and 16,000 ft.' }
  }
  if (!Number.isFinite(pressureAltitudeFt) || pressureAltitudeFt < -2000 || pressureAltitudeFt > 14000) {
    return { ok: false, error: 'Pressure altitude must be between -2,000 and 14,000 ft.' }
  }
  if (!Number.isFinite(oatC) || oatC < -40 || oatC > 55) {
    return { ok: false, error: 'Outside air temperature must be between -40 and 55 °C.' }
  }
  if (!Number.isFinite(windComponentKt) || windComponentKt < -20 || windComponentKt > 40) {
    return { ok: false, error: 'Wind component must be between -20 kt tailwind and +40 kt headwind.' }
  }

  const limits = AIRCRAFT[/** @type {AircraftVariant} */ (aircraftVariant)]
  if (!Number.isFinite(weightLb) || weightLb < limits.minWeight || weightLb > limits.maxWeight) {
    return { ok: false, error: `Weight for ${aircraftVariant} must be between ${limits.minWeight.toLocaleString()} and ${limits.maxWeight.toLocaleString()} lb.` }
  }

  return {
    ok: true,
    value: {
      label,
      inputs: {
        aircraftVariant: /** @type {AircraftVariant} */ (aircraftVariant),
        mode: /** @type {OperationMode} */ (mode),
        runwayCondition: /** @type {RunwayCondition} */ (runwayCondition),
        flapSetting: /** @type {FlapSetting} */ (flapSetting),
        runwayId,
        runwayLengthFt,
        pressureAltitudeFt,
        oatC,
        weightLb,
        windComponentKt,
        notes,
      },
    },
  }
}

/** @param {unknown} v @returns {number} */
function numberFrom(v) {
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
}

/** @param {PerformanceInputs} inputs @returns {PerformanceOutput} */
function calculate(inputs) {
  const aircraft = AIRCRAFT[inputs.aircraftVariant]
  const weightRatio = inputs.weightLb / aircraft.refWeight
  const altitudeFactor = 1 + Math.max(-0.08, inputs.pressureAltitudeFt * 0.000075)
  const warmDayFactor = 1 + Math.max(-0.08, (inputs.oatC - 15) * 0.011)
  const windFactor = clamp(1 - inputs.windComponentKt * 0.012, 0.74, 1.28)
  const wetFactor = inputs.runwayCondition === 'wet' ? 1.15 : 1
  const flapFactor = inputs.flapSetting === '10' ? 1.08 : inputs.flapSetting === '20' ? 0.96 : 1

  const takeoffDistanceFt = round10(aircraft.baseTakeoff * weightRatio ** 2 * altitudeFactor * warmDayFactor * windFactor * wetFactor * flapFactor)
  const accelerateStopDistanceFt = round10(takeoffDistanceFt * (inputs.runwayCondition === 'wet' ? 1.2 : 1.14))
  const landingDistanceFt = round10(aircraft.baseLanding * weightRatio ** 1.55 * altitudeFactor * windFactor * wetFactor)
  const requiredRunwayFt = inputs.mode === 'takeoff' ? accelerateStopDistanceFt : landingDistanceFt
  const runwayMarginFt = Math.round(inputs.runwayLengthFt - requiredRunwayFt)
  const climbGradientPct = Math.round((6.2 - (weightRatio - 1) * 2.4 - inputs.pressureAltitudeFt * 0.00012 - Math.max(0, inputs.oatC - 15) * 0.026) * 10) / 10
  const approachSpeedKt = Math.round(aircraft.refVref * Math.sqrt(weightRatio))
  const weightRunwayLimit = inputs.weightLb * Math.sqrt(Math.max(0.35, inputs.runwayLengthFt / Math.max(1, requiredRunwayFt)))
  const maxAllowableWeightLb = Math.min(aircraft.maxWeight, Math.max(aircraft.minWeight, Math.floor(weightRunwayLimit / 100) * 100))

  const advisory = [
    'Planning/demo model only — not approved AFM/OEM performance data.',
    `Runway condition: ${inputs.runwayCondition}; wind component: ${inputs.windComponentKt >= 0 ? 'headwind' : 'tailwind'} ${Math.abs(inputs.windComponentKt)} kt.`,
  ]
  if (runwayMarginFt < 0) advisory.push('Runway margin is negative; the case is out of planning limits.')
  else if (runwayMarginFt < 1000) advisory.push('Runway margin is below 1,000 ft; review required.')
  if (climbGradientPct < 3.3) advisory.push('Estimated climb gradient is below the 3.3% planning threshold.')
  if (inputs.pressureAltitudeFt > 6000 || inputs.oatC > 35) advisory.push('High/hot condition: verify with approved source data.')

  let status = /** @type {PerformanceOutput['status']} */ ('within-limits')
  if (runwayMarginFt < 0 || climbGradientPct < 3.3) status = 'out-of-limits'
  else if (runwayMarginFt < 1000 || climbGradientPct < 4.0 || inputs.pressureAltitudeFt > 6000) status = 'caution'

  const limitingFactor = runwayMarginFt < 0
    ? 'runway length'
    : climbGradientPct < 3.3
      ? 'climb gradient'
      : inputs.pressureAltitudeFt > 6000 || inputs.oatC > 35
        ? 'density altitude'
        : inputs.runwayCondition === 'wet'
          ? 'wet runway factor'
          : 'within planning limits'

  return {
    takeoffDistanceFt,
    accelerateStopDistanceFt,
    landingDistanceFt,
    requiredRunwayFt,
    runwayMarginFt,
    climbGradientPct,
    approachSpeedKt,
    maxAllowableWeightLb,
    limitingFactor,
    status,
    advisory,
    calculationBasis: 'Deterministic planning estimate derived from weight, pressure altitude, temperature, wind, runway condition, and flap setting. Not approved performance data.',
  }
}

/** @param {number} value @param {number} min @param {number} max */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** @param {number} value */
function round10(value) {
  return Math.round(value / 10) * 10
}

/** @param {http.ServerResponse} res @param {number} status @param {unknown} payload */
function sendJson(res, status, payload) {
  const text = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

/** @param {http.IncomingMessage} req @returns {Promise<unknown>} */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) reject(new Error('Request body too large.'))
      else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        reject(new Error('Request body is not valid JSON.'))
      }
    })
    req.on('error', reject)
  })
}

const MIME = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
})

/** @param {http.ServerResponse} res @param {string} urlPath */
function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
  const candidate = path.resolve(DIST_DIR, rel)
  const target = candidate.startsWith(`${DIST_DIR}${path.sep}`) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(DIST_DIR, 'index.html')

  if (!fs.existsSync(target)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Frontend not built yet — run `npm run build` first.')
    return
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] ?? 'application/octet-stream' })
  fs.createReadStream(target).pipe(res)
}

const data = loadData()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const segments = url.pathname.split('/').filter(Boolean)

  try {
    if (segments[0] !== 'api') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' })
      return serveStatic(res, url.pathname)
    }

    if (segments[1] === 'cases' && segments.length === 2) {
      if (req.method === 'GET') return sendJson(res, 200, { cases: data.cases })
      if (req.method === 'POST') {
        const parsed = validateCaseInput(await readJsonBody(req))
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
        const now = new Date().toISOString()
        const created = {
          id: crypto.randomUUID(),
          label: parsed.value.label,
          createdAt: now,
          updatedAt: now,
          inputs: parsed.value.inputs,
          output: calculate(parsed.value.inputs),
        }
        data.cases.unshift(created)
        saveData(data)
        return sendJson(res, 201, created)
      }
    }

    if (segments[1] === 'cases' && segments[2] && segments.length === 3 && req.method === 'PUT') {
      const index = data.cases.findIndex((item) => item.id === segments[2])
      if (index < 0) return sendJson(res, 404, { error: 'Case not found.' })
      const parsed = validateCaseInput(await readJsonBody(req))
      if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
      const current = data.cases[index]
      const updated = {
        ...current,
        label: parsed.value.label,
        inputs: parsed.value.inputs,
        output: calculate(parsed.value.inputs),
        updatedAt: new Date().toISOString(),
      }
      data.cases[index] = updated
      saveData(data)
      return sendJson(res, 200, updated)
    }

    if (segments[1] === 'calculate' && segments.length === 2 && req.method === 'POST') {
      const parsed = validateCaseInput(await readJsonBody(req))
      if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
      return sendJson(res, 200, calculate(parsed.value.inputs))
    }

    return sendJson(res, 404, { error: 'Not found.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return sendJson(res, 500, { error: message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`test app listening at http://127.0.0.1:${PORT}`)
})
