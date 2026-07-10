/**
 * AeroPlan server: Node-stdlib HTTP serving the built frontend (dist/) and a
 * typed JSON API over cases and runways with JSON-file persistence. Cases
 * store inputs only — outputs derive on the client from the shared model,
 * the single compute source.
 *
 *   GET  /api/data                   → { cases, runways }
 *   POST /api/cases                  → PerformanceCase        (create)
 *   POST /api/cases/bulk             → { cases }              (sweep family, ≤25)
 *   PUT  /api/cases/:id              → PerformanceCase        (edit)
 *   POST /api/cases/:id/duplicate    → PerformanceCase
 *   POST /api/runways                → Runway                 (create)
 *   PUT  /api/runways/:id            → Runway                 (edit)
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

/** @typedef {import('../shared/model').PerformanceCase} PerformanceCase */
/** @typedef {import('../shared/model').CaseInputs} CaseInputs */
/** @typedef {import('../shared/model').Runway} Runway */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = path.join(ROOT, 'dist')
const DATA_FILE = path.join(ROOT, 'data', 'aero-plan.json')
const PORT = Number(process.env.PORT ?? 4180)

const VARIANTS = ['GL-350', 'GL-500', 'GL-650']
const OPERATIONS = ['takeoff', 'landing']
const CONDITIONS = ['dry', 'wet']
const FLAPS = ['10', '15', '20']
const ENVELOPES = { 'GL-350': [32000, 60000], 'GL-500': [40000, 72000], 'GL-650': [46000, 84000] }

/* ------------------------------------------------------------- persistence */

/** @returns {{ cases: PerformanceCase[], runways: Runway[] }} */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = seedData()
    saveData(seeded)
    return seeded
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
}

/** @param {{ cases: PerformanceCase[], runways: Runway[] }} data */
function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}

/* ------------------------------------------------------------------- seeds */

/** @returns {{ cases: PerformanceCase[], runways: Runway[] }} */
function seedData() {
  const now = new Date().toISOString()
  /** @type {Runway[]} */
  const runways = [
    { id: 'KSVN RWY 10', lengthFt: 5000, elevationFt: 42, notes: 'Short field — watch wet margins.', updatedAt: now },
    { id: 'KASE RWY 15', lengthFt: 8000, elevationFt: 7820, notes: 'Hot-and-high; climb usually binds.', updatedAt: now },
    { id: 'KTEB RWY 06', lengthFt: 6013, elevationFt: 8, notes: 'Noise-sensitive arrivals.', updatedAt: now },
    { id: 'KSSI RWY 04', lengthFt: 5054, elevationFt: 19, notes: 'Coastal; afternoon sea breeze.', updatedAt: now },
    { id: 'KJAC RWY 19', lengthFt: 6451, elevationFt: 6451, notes: 'Mountain field.', updatedAt: now },
    { id: 'KPDK RWY 21L', lengthFt: 6001, elevationFt: 1003, notes: 'Primary base field.', updatedAt: now },
  ]

  /**
   * @param {string} label @param {Partial<CaseInputs>} overrides @param {string} [family]
   * @returns {PerformanceCase}
   */
  const make = (label, overrides, family) => ({
    id: crypto.randomUUID(),
    label,
    ...(family ? { sweepFamily: family } : {}),
    inputs: {
      operation: 'takeoff', variant: 'GL-500', runwayId: 'KSVN RWY 10', runwayLengthFt: 5000,
      pressureAltitudeFt: 100, oatC: 27, weightLb: 60000, windKt: 5, runwayCondition: 'dry', flapSetting: '15',
      ...overrides,
    },
    createdAt: now,
    updatedAt: now,
  })

  /** @type {PerformanceCase[]} */
  const cases = []
  // 5-point sweep family on the short field.
  for (const w of [52000, 56000, 60000, 64000, 68000]) {
    cases.push(make(`KSVN heavy departure · sweep ${w} lb`, { weightLb: w }, 'KSVN heavy departure'))
  }
  // 4-point hot-and-high family.
  for (const w of [54000, 60000, 66000, 72000]) {
    cases.push(make(`Aspen summer study · sweep ${w} lb`, {
      runwayId: 'KASE RWY 15', runwayLengthFt: 8000, pressureAltitudeFt: 10500, oatC: 31, windKt: 0, weightLb: w,
    }, 'Aspen summer study'))
  }
  // Standalone cases, including the comparison-ready wet/dry pair.
  cases.push(make('KSSI charter quote — dry', { runwayId: 'KSSI RWY 04', runwayLengthFt: 5054, weightLb: 58000, oatC: 29, windKt: 4 }))
  cases.push(make('KSSI charter quote — wet', { runwayId: 'KSSI RWY 04', runwayLengthFt: 5054, weightLb: 58000, oatC: 29, windKt: 4, runwayCondition: 'wet' }))
  cases.push(make('Teterboro wet arrival', { operation: 'landing', variant: 'GL-650', runwayId: 'KTEB RWY 06', runwayLengthFt: 6013, oatC: 19, weightLb: 68000, windKt: 8, runwayCondition: 'wet', flapSetting: '20' }))
  cases.push(make('Jackson winter departure', { runwayId: 'KJAC RWY 19', runwayLengthFt: 6451, pressureAltitudeFt: 6800, oatC: -8, variant: 'GL-650', weightLb: 76000 }))
  cases.push(make('PDK base training', { runwayId: 'KPDK RWY 21L', runwayLengthFt: 6001, pressureAltitudeFt: 1000, variant: 'GL-350', weightLb: 48000, oatC: 22 }))
  cases.push(make('Aspen afternoon limit probe', { runwayId: 'KASE RWY 15', runwayLengthFt: 8000, pressureAltitudeFt: 10500, oatC: 31, weightLb: 71000 }))
  cases.push(make('KSVN wet contingency', { weightLb: 66000, runwayCondition: 'wet' }))
  return { cases, runways }
}

/* -------------------------------------------------------------- validation */

/**
 * @param {unknown} body @param {PerformanceCase[]} cases @param {string} [selfId]
 * @returns {{ ok: true, value: { label: string, sweepFamily?: string, inputs: CaseInputs } } | { ok: false, error: string }}
 */
function validateCase(body, cases, selfId) {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object.' }
  const b = /** @type {Record<string, any>} */ (body)
  const label = typeof b.label === 'string' ? b.label.trim() : ''
  if (!label || label.length > 80) return { ok: false, error: 'Case label is required (80 characters maximum).' }
  if (cases.some((c) => c.label.toLowerCase() === label.toLowerCase() && c.id !== selfId)) {
    return { ok: false, error: `Case label "${label}" is already in use.` }
  }
  const i = b.inputs
  if (typeof i !== 'object' || i === null) return { ok: false, error: 'Case inputs are required.' }
  if (!OPERATIONS.includes(i.operation)) return { ok: false, error: 'Operation must be takeoff or landing.' }
  if (!VARIANTS.includes(i.variant)) return { ok: false, error: 'Variant must be one of the fleet.' }
  if (typeof i.runwayId !== 'string' || !i.runwayId.trim()) return { ok: false, error: 'Runway id is required.' }
  if (!CONDITIONS.includes(i.runwayCondition)) return { ok: false, error: 'Runway condition must be dry or wet.' }
  if (!FLAPS.includes(i.flapSetting)) return { ok: false, error: 'Flap setting must be 10, 15, or 20.' }
  /** @type {[string, number, number][]} */
  const nums = [
    ['runwayLengthFt', 1000, 20000], ['pressureAltitudeFt', -1000, 14000], ['oatC', -40, 55],
    ['weightLb', 30000, 90000], ['windKt', -30, 50],
  ]
  for (const [key, lo, hi] of nums) {
    const v = i[key]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      return { ok: false, error: `${key} must be a number between ${lo} and ${hi}.` }
    }
  }
  const envelope = ENVELOPES[/** @type {keyof typeof ENVELOPES} */ (i.variant)]
  if (i.weightLb < envelope[0] || i.weightLb > envelope[1]) {
    return { ok: false, error: `Weight must be within the ${i.variant} envelope (${envelope[0].toLocaleString()}–${envelope[1].toLocaleString()} lb).` }
  }
  const sweepFamily = typeof b.sweepFamily === 'string' && b.sweepFamily.trim() ? b.sweepFamily.trim() : undefined
  return {
    ok: true,
    value: {
      label,
      ...(sweepFamily ? { sweepFamily } : {}),
      inputs: {
        operation: i.operation, variant: i.variant, runwayId: i.runwayId.trim(),
        runwayLengthFt: i.runwayLengthFt, pressureAltitudeFt: i.pressureAltitudeFt, oatC: i.oatC,
        weightLb: i.weightLb, windKt: i.windKt, runwayCondition: i.runwayCondition, flapSetting: i.flapSetting,
      },
    },
  }
}

/**
 * @param {unknown} body @param {Runway[]} runways @param {string} [selfId]
 * @returns {{ ok: true, value: { id: string, lengthFt: number, elevationFt: number, notes: string } } | { ok: false, error: string }}
 */
function validateRunway(body, runways, selfId) {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object.' }
  const b = /** @type {Record<string, any>} */ (body)
  const id = typeof b.id === 'string' ? b.id.trim() : ''
  if (!id) return { ok: false, error: 'Runway id is required.' }
  if (runways.some((r) => r.id.toLowerCase() === id.toLowerCase() && r.id !== selfId)) {
    return { ok: false, error: `Runway "${id}" already exists.` }
  }
  if (typeof b.lengthFt !== 'number' || b.lengthFt < 1000 || b.lengthFt > 20000) {
    return { ok: false, error: 'Length must be between 1,000 and 20,000 ft.' }
  }
  if (typeof b.elevationFt !== 'number' || !Number.isFinite(b.elevationFt)) {
    return { ok: false, error: 'Elevation must be a number.' }
  }
  return { ok: true, value: { id, lengthFt: b.lengthFt, elevationFt: b.elevationFt, notes: typeof b.notes === 'string' ? b.notes.trim() : '' } }
}

/* -------------------------------------------------------------------- http */

/** @param {http.ServerResponse} res @param {number} status @param {unknown} payload */
function sendJson(res, status, payload) {
  const text = JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) })
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
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) }
      catch { reject(new Error('Request body is not valid JSON.')) }
    })
    req.on('error', reject)
  })
}

const MIME = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
})

/** @param {http.ServerResponse} res @param {string} urlPath */
function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
  const file = path.normalize(path.join(DIST_DIR, rel))
  const target = file.startsWith(DIST_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()
    ? file
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
const now = () => new Date().toISOString()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const seg = url.pathname.split('/').filter(Boolean)

  try {
    if (seg[0] !== 'api') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' })
      return serveStatic(res, url.pathname)
    }

    if (seg[1] === 'data' && req.method === 'GET') return sendJson(res, 200, data)

    if (seg[1] === 'cases') {
      if (seg.length === 2 && req.method === 'POST') {
        const parsed = validateCase(await readJsonBody(req), data.cases)
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
        /** @type {PerformanceCase} */
        const created = { id: crypto.randomUUID(), ...parsed.value, createdAt: now(), updatedAt: now() }
        data.cases.push(created)
        saveData(data)
        return sendJson(res, 201, created)
      }
      if (seg.length === 3 && seg[2] === 'bulk' && req.method === 'POST') {
        const body = /** @type {{ cases?: unknown[] }} */ (await readJsonBody(req))
        if (!Array.isArray(body.cases) || body.cases.length === 0 || body.cases.length > 25) {
          return sendJson(res, 400, { error: 'Bulk create takes 1–25 cases.' })
        }
        /** @type {PerformanceCase[]} */
        const created = []
        for (const item of body.cases) {
          const parsed = validateCase(item, [...data.cases, ...created])
          if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
          created.push({ id: crypto.randomUUID(), ...parsed.value, createdAt: now(), updatedAt: now() })
        }
        data.cases.push(...created)
        saveData(data)
        return sendJson(res, 201, { cases: created })
      }
      const target = data.cases.find((c) => c.id === seg[2])
      if (!target) return sendJson(res, 404, { error: 'Case not found.' })
      if (seg.length === 3 && req.method === 'PUT') {
        const parsed = validateCase(await readJsonBody(req), data.cases, target.id)
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
        Object.assign(target, parsed.value, { updatedAt: now() })
        saveData(data)
        return sendJson(res, 200, target)
      }
      if (seg.length === 4 && seg[3] === 'duplicate' && req.method === 'POST') {
        /** @type {PerformanceCase} */
        const copy = { ...structuredClone(target), id: crypto.randomUUID(), label: `${target.label} (copy)`.slice(0, 80), createdAt: now(), updatedAt: now() }
        delete copy.sweepFamily
        data.cases.push(copy)
        saveData(data)
        return sendJson(res, 201, copy)
      }
      return sendJson(res, 405, { error: 'Method not allowed.' })
    }

    if (seg[1] === 'runways') {
      if (seg.length === 2 && req.method === 'POST') {
        const parsed = validateRunway(await readJsonBody(req), data.runways)
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
        /** @type {Runway} */
        const created = { ...parsed.value, updatedAt: now() }
        data.runways.push(created)
        saveData(data)
        return sendJson(res, 201, created)
      }
      const target = data.runways.find((r) => r.id === decodeURIComponent(seg[2] ?? ''))
      if (!target) return sendJson(res, 404, { error: 'Runway not found.' })
      if (seg.length === 3 && req.method === 'PUT') {
        const parsed = validateRunway(await readJsonBody(req), data.runways, target.id)
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
        Object.assign(target, parsed.value, { updatedAt: now() })
        saveData(data)
        return sendJson(res, 200, target)
      }
      return sendJson(res, 405, { error: 'Method not allowed.' })
    }

    return sendJson(res, 404, { error: 'Not found.' })
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AeroPlan serving http://127.0.0.1:${PORT} (frontend: ${fs.existsSync(DIST_DIR) ? 'dist/' : 'NOT BUILT'}; data: ${DATA_FILE})`)
})
