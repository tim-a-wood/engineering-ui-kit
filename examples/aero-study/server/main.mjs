/**
 * AeroStudy server: one Node-stdlib HTTP process serving the built frontend
 * (dist/) and a typed JSON API over study definitions with JSON-file
 * persistence. Points are derived on the client from the shared model —
 * the definition is the stored source of truth.
 *
 *   GET    /api/studies              → { studies: Study[] }
 *   POST   /api/studies              → Study                (create)
 *   PUT    /api/studies/:id          → Study                (update)
 *   POST   /api/studies/:id/duplicate → Study               (copy)
 *   DELETE /api/studies/:id          → { ok: true }
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

/** @typedef {import('../shared/model').Study} Study */
/** @typedef {import('../shared/model').StudyDef} StudyDef */
/** @typedef {import('../shared/model').PerfInputs} PerfInputs */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = path.join(ROOT, 'dist')
const DATA_FILE = path.join(ROOT, 'data', 'aero-study.json')
const PORT = Number(process.env.PORT ?? 4181)

const VARIANTS = ['GL-350', 'GL-500', 'GL-650']
const OPERATIONS = ['takeoff', 'landing']
const CONDITIONS = ['dry', 'wet']
const FLAPS = ['10', '15', '20']
const SWEEP_FIELDS = ['weightLb', 'pressureAltitudeFt', 'oatC', 'windKt', 'runwayLengthFt']
const COMPARE_DIMS = ['none', 'variant', 'runwayCondition', 'flapSetting', 'operation']

/* ------------------------------------------------------------- persistence */

/** @returns {{ studies: Study[] }} */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = { studies: seedStudies() }
    saveData(seeded)
    return seeded
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
}

/** @param {{ studies: Study[] }} data */
function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}

/* ------------------------------------------------------------------- seeds */

/**
 * Six studies covering every sweep variable and every compare dimension,
 * including two with real crossovers and one hot-and-high study (§7).
 * @returns {Study[]}
 */
function seedStudies() {
  const now = new Date().toISOString()
  /**
   * @param {string} name @param {string} notes @param {PerfInputs} baseline
   * @param {Study['sweep']} sweep @param {Study['compareBy']} compareBy
   * @returns {Study}
   */
  const make = (name, notes, baseline, sweep, compareBy) => ({
    id: crypto.randomUUID(), name, notes, baseline, sweep, compareBy, createdAt: now, updatedAt: now,
  })

  /** @type {PerfInputs} */
  const ksvn = {
    operation: 'takeoff', variant: 'GL-500', runwayId: 'KSVN RWY 10', runwayLengthFt: 5000,
    pressureAltitudeFt: 100, oatC: 27, weightLb: 60000, windKt: 5, runwayCondition: 'dry', flapSetting: '15',
  }
  /** @type {PerfInputs} */
  const kase = {
    operation: 'takeoff', variant: 'GL-500', runwayId: 'KASE RWY 15', runwayLengthFt: 8000,
    pressureAltitudeFt: 10500, oatC: 31, weightLb: 60000, windKt: 0, runwayCondition: 'dry', flapSetting: '15',
  }
  /** @type {PerfInputs} */
  const kteb = {
    operation: 'landing', variant: 'GL-650', runwayId: 'KTEB RWY 06', runwayLengthFt: 6013,
    pressureAltitudeFt: 200, oatC: 19, weightLb: 68000, windKt: 8, runwayCondition: 'wet', flapSetting: '20',
  }

  return [
    make(
      'KSVN wet vs dry limiting weight',
      'Where does margin hit zero on the short field, wet vs dry?',
      ksvn, { field: 'weightLb', start: 48000, end: 72000, step: 2000 }, 'runwayCondition',
    ),
    make(
      'Hot-and-high weight study — Aspen',
      'Fleet comparison at KASE mid-summer; expect climb to bind.',
      kase, { field: 'weightLb', start: 48000, end: 76000, step: 2000 }, 'variant',
    ),
    make(
      'Aspen temperature sensitivity',
      'Required runway vs OAT for the GL-500 at 66,000 lb.',
      { ...kase, weightLb: 66000 }, { field: 'oatC', start: 5, end: 40, step: 2.5 }, 'none',
    ),
    make(
      'Altitude ladder — flap tradeoff',
      'PA sweep by flap setting; which flap holds margin longest?',
      { ...ksvn, runwayLengthFt: 6500, weightLb: 64000 },
      { field: 'pressureAltitudeFt', start: 0, end: 10000, step: 1000 }, 'flapSetting',
    ),
    make(
      'Teterboro wet arrival wind study',
      'Wind sensitivity for the wet landing; tailwind end is the risk.',
      kteb, { field: 'windKt', start: -10, end: 20, step: 2 }, 'none',
    ),
    make(
      'Runway shopping — takeoff vs landing',
      'How much runway do we actually need at 64,000 lb?',
      { ...ksvn, weightLb: 64000, runwayLengthFt: 5500 },
      { field: 'runwayLengthFt', start: 4000, end: 9000, step: 500 }, 'operation',
    ),
  ]
}

/* -------------------------------------------------------------- validation */

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: StudyDef & { name: string, notes: string } } | { ok: false, error: string }}
 */
function validateStudy(body) {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object.' }
  const b = /** @type {Record<string, any>} */ (body)
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name || name.length > 80) return { ok: false, error: 'Study name is required (80 characters maximum).' }
  const notes = typeof b.notes === 'string' ? b.notes.trim() : ''

  const base = b.baseline
  if (typeof base !== 'object' || base === null) return { ok: false, error: 'Baseline configuration is required.' }
  if (!OPERATIONS.includes(base.operation)) return { ok: false, error: 'Operation must be takeoff or landing.' }
  if (!VARIANTS.includes(base.variant)) return { ok: false, error: 'Aircraft variant must be one of the fleet.' }
  if (typeof base.runwayId !== 'string' || !base.runwayId.trim()) return { ok: false, error: 'Runway id is required.' }
  if (!CONDITIONS.includes(base.runwayCondition)) return { ok: false, error: 'Runway condition must be dry or wet.' }
  if (!FLAPS.includes(base.flapSetting)) return { ok: false, error: 'Flap setting must be 10, 15, or 20.' }
  /** @type {[string, number, number][]} */
  const nums = [
    ['runwayLengthFt', 1000, 20000], ['pressureAltitudeFt', -1000, 14000], ['oatC', -40, 55],
    ['weightLb', 30000, 90000], ['windKt', -30, 50],
  ]
  for (const [key, lo, hi] of nums) {
    const v = base[key]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      return { ok: false, error: `Baseline ${key} must be a number between ${lo} and ${hi}.` }
    }
  }

  const sweep = b.sweep
  if (typeof sweep !== 'object' || sweep === null || !SWEEP_FIELDS.includes(sweep.field)) {
    return { ok: false, error: 'Sweep variable must be one of the supported fields.' }
  }
  for (const key of ['start', 'end', 'step']) {
    if (typeof sweep[key] !== 'number' || !Number.isFinite(sweep[key])) {
      return { ok: false, error: `Sweep ${key} must be a number.` }
    }
  }
  if (sweep.step <= 0) return { ok: false, error: 'Sweep step must be positive.' }
  const count = Math.floor(Math.abs(sweep.end - sweep.start) / sweep.step) + 1
  if (count > 40) return { ok: false, error: `Sweep generates ${count} points — the cap is 40.` }
  if (!COMPARE_DIMS.includes(b.compareBy)) return { ok: false, error: 'Compare dimension is not recognised.' }

  return {
    ok: true,
    value: {
      name, notes,
      baseline: {
        operation: base.operation, variant: base.variant, runwayId: base.runwayId.trim(),
        runwayLengthFt: base.runwayLengthFt, pressureAltitudeFt: base.pressureAltitudeFt,
        oatC: base.oatC, weightLb: base.weightLb, windKt: base.windKt,
        runwayCondition: base.runwayCondition, flapSetting: base.flapSetting,
      },
      sweep: { field: sweep.field, start: sweep.start, end: sweep.end, step: sweep.step },
      compareBy: b.compareBy,
    },
  }
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
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const segments = url.pathname.split('/').filter(Boolean)

  try {
    if (segments[0] !== 'api') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' })
      return serveStatic(res, url.pathname)
    }

    if (segments[1] !== 'studies') return sendJson(res, 404, { error: 'Not found.' })

    if (segments.length === 2) {
      if (req.method === 'GET') return sendJson(res, 200, { studies: data.studies })
      if (req.method === 'POST') {
        const parsed = validateStudy(await readJsonBody(req))
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
        const now = new Date().toISOString()
        /** @type {Study} */
        const created = { id: crypto.randomUUID(), ...parsed.value, createdAt: now, updatedAt: now }
        data.studies.push(created)
        saveData(data)
        return sendJson(res, 201, created)
      }
      return sendJson(res, 405, { error: 'Method not allowed.' })
    }

    const study = data.studies.find((s) => s.id === segments[2])
    if (!study) return sendJson(res, 404, { error: 'Study not found.' })

    if (segments.length === 3 && req.method === 'GET') return sendJson(res, 200, study)

    if (segments.length === 3 && req.method === 'PUT') {
      const parsed = validateStudy(await readJsonBody(req))
      if (!parsed.ok) return sendJson(res, 400, { error: parsed.error })
      Object.assign(study, parsed.value, { updatedAt: new Date().toISOString() })
      saveData(data)
      return sendJson(res, 200, study)
    }

    if (segments.length === 3 && req.method === 'DELETE') {
      data.studies = data.studies.filter((s) => s.id !== study.id)
      saveData(data)
      return sendJson(res, 200, { ok: true })
    }

    if (segments.length === 4 && segments[3] === 'duplicate' && req.method === 'POST') {
      const now = new Date().toISOString()
      /** @type {Study} */
      const copy = {
        ...structuredClone(study),
        id: crypto.randomUUID(),
        name: `${study.name} (copy)`.slice(0, 80),
        createdAt: now,
        updatedAt: now,
      }
      data.studies.push(copy)
      saveData(data)
      return sendJson(res, 201, copy)
    }

    return sendJson(res, 405, { error: 'Method not allowed.' })
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AeroStudy serving http://127.0.0.1:${PORT} (frontend: ${fs.existsSync(DIST_DIR) ? 'dist/' : 'NOT BUILT'}; data: ${DATA_FILE})`)
})
