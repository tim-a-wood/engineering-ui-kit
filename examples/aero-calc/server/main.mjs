/**
 * Shared API shape references. Runtime validation remains in this Node-stdlib server.
 * @typedef {import('../src/shared/contracts').CaseInputs} CaseInputs
 * @typedef {import('../src/shared/contracts').CalculationReview} CalculationReview
 * @typedef {import('../src/shared/contracts').PerformanceCase} PerformanceCase
 * @typedef {import('../src/shared/contracts').Runway} Runway
 * @typedef {import('../src/shared/contracts').SweepRequest} SweepRequest
 */

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

/** @typedef {import('../src/shared/contracts.ts').CaseInputs} CaseInputs */
/** @typedef {import('../src/shared/contracts.ts').CalculationOutputs} CalculationOutputs */
/** @typedef {import('../src/shared/contracts.ts').CalculationReview} CalculationReview */
/** @typedef {import('../src/shared/contracts.ts').PerformanceCase} PerformanceCase */
/** @typedef {import('../src/shared/contracts.ts').Runway} Runway */
/** @typedef {import('../src/shared/contracts.ts').SweepRequest} SweepRequest */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const DATA_DIR = join(ROOT, 'data');
const CASES_FILE = join(DATA_DIR, 'cases.json');
const RUNWAYS_FILE = join(DATA_DIR, 'runways.json');
const PORT = Number(process.env.PORT || 4180);
const MIN_CLIMB = 2.4;

const AIRCRAFT = {
  'GL-350': { min: 30_000, max: 55_000, reference: 44_000, takeoffBase: 3_250, landingBase: 2_350, climbBase: 5.4, approachBase: 111 },
  'GL-500': { min: 40_000, max: 72_000, reference: 58_000, takeoffBase: 3_600, landingBase: 2_650, climbBase: 5.0, approachBase: 118 },
  'GL-650': { min: 48_000, max: 90_000, reference: 72_000, takeoffBase: 4_050, landingBase: 3_000, climbBase: 4.7, approachBase: 124 }
};

const now = () => new Date().toISOString();
const round = (value) => Math.round(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

async function ensureData() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await stat(RUNWAYS_FILE);
  } catch {
    await writeJson(RUNWAYS_FILE, seedRunways());
  }
  try {
    await stat(CASES_FILE);
  } catch {
    const runways = await readJson(RUNWAYS_FILE);
    await writeJson(CASES_FILE, seedCases(runways));
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

function seedRunways() {
  const timestamp = now();
  return [
    { id: 'KSVN RWY 10', lengthFt: 11_375, elevationFt: 41, notes: 'Long coastal operations runway.', updatedAt: timestamp },
    { id: 'KSAV RWY 01', lengthFt: 7_002, elevationFt: 50, notes: 'Regional planning reference.', updatedAt: timestamp },
    { id: 'KJAC RWY 19', lengthFt: 6_301, elevationFt: 6_451, notes: 'Hot-and-high mountain field.', updatedAt: timestamp },
    { id: 'KASE RWY 15', lengthFt: 8_006, elevationFt: 7_820, notes: 'High-elevation terrain-constrained field.', updatedAt: timestamp },
    { id: 'KTEB RWY 06', lengthFt: 6_013, elevationFt: 9, notes: 'Business aviation planning reference.', updatedAt: timestamp },
    { id: 'KSSI RWY 04', lengthFt: 5_584, elevationFt: 19, notes: 'Short-field coastal planning case.', updatedAt: timestamp }
  ];
}

function seedCases(runways) {
  const byId = (id) => runways.find((runway) => runway.id === id);
  const timestamp = Date.now();
  const seeds = [];
  const add = (inputs, sweepFamilyId = null, sweepFamilyLabel = null, minuteOffset = 0) => {
    const review = calculate(inputs, runways);
    const createdAt = new Date(timestamp - minuteOffset * 60_000).toISOString();
    seeds.push({ id: randomUUID(), sweepFamilyId, sweepFamilyLabel, createdAt, updatedAt: createdAt, ...review });
  };

  const familyA = randomUUID();
  [46_000, 49_000, 52_000, 55_000].forEach((weight, index) => add({
    label: `Coastal departure · sweep ${weight} lb`, operation: 'takeoff', variant: 'GL-350', runwayId: 'KSSI RWY 04', runwayLengthFt: byId('KSSI RWY 04').lengthFt,
    pressureAltitudeFt: 800, oatC: 32, weightLb: weight, windKt: 2, runwayCondition: 'wet', flapSetting: 15, notes: 'Seeded short-field sweep.'
  }, familyA, 'Coastal departure', 180 - index));

  const familyB = randomUUID();
  [58_000, 61_000, 64_000, 67_000, 70_000].forEach((weight, index) => add({
    label: `Mountain arrival · sweep ${weight} lb`, operation: 'landing', variant: 'GL-500', runwayId: 'KJAC RWY 19', runwayLengthFt: byId('KJAC RWY 19').lengthFt,
    pressureAltitudeFt: 8_200, oatC: 29, weightLb: weight, windKt: -4, runwayCondition: 'dry', flapSetting: 20, notes: 'Seeded hot-and-high landing sweep.'
  }, familyB, 'Mountain arrival', 120 - index));

  add({ label: 'Savannah charter quote', operation: 'takeoff', variant: 'GL-650', runwayId: 'KSVN RWY 10', runwayLengthFt: 11_375, pressureAltitudeFt: 100, oatC: 27, weightLb: 78_000, windKt: 8, runwayCondition: 'dry', flapSetting: 10, notes: 'Nominal long-runway planning case.' }, null, null, 80);
  add({ label: 'Aspen afternoon study', operation: 'takeoff', variant: 'GL-500', runwayId: 'KASE RWY 15', runwayLengthFt: 8_006, pressureAltitudeFt: 10_500, oatC: 31, weightLb: 71_000, windKt: -6, runwayCondition: 'dry', flapSetting: 15, notes: 'High density-altitude review.' }, null, null, 60);
  add({ label: 'Teterboro wet arrival', operation: 'landing', variant: 'GL-650', runwayId: 'KTEB RWY 06', runwayLengthFt: 6_013, pressureAltitudeFt: 200, oatC: 19, weightLb: 84_000, windKt: -8, runwayCondition: 'wet', flapSetting: 20, notes: 'Wet runway and tailwind sensitivity.' }, null, null, 40);
  add({ label: 'Savannah reserve aircraft', operation: 'landing', variant: 'GL-350', runwayId: 'KSAV RWY 01', runwayLengthFt: 7_002, pressureAltitudeFt: 300, oatC: 34, weightLb: 49_000, windKt: 4, runwayCondition: 'dry', flapSetting: 20, notes: 'Reserve aircraft comparison.' }, null, null, 20);
  add({ label: 'Jackson winter departure', operation: 'takeoff', variant: 'GL-650', runwayId: 'KJAC RWY 19', runwayLengthFt: 6_301, pressureAltitudeFt: 6_800, oatC: -8, weightLb: 76_000, windKt: 12, runwayCondition: 'dry', flapSetting: 15, notes: 'Cold-weather mountain departure.' }, null, null, 5);
  return seeds;
}

function validateInputs(input, runways, existingCases = [], excludeCaseId = null, allowFamilyLabel = false) {
  const errors = {};
  const label = typeof input?.label === 'string' ? input.label.trim() : '';
  if (!label) errors.label = 'Case label is required.';
  else if (label.length > 80) errors.label = 'Case label must be 80 characters or fewer.';
  else if (!allowFamilyLabel && existingCases.some((item) => item.id !== excludeCaseId && item.inputs.label.toLowerCase() === label.toLowerCase())) errors.label = 'Case label must be unique.';
  if (!['takeoff', 'landing'].includes(input?.operation)) errors.operation = 'Choose takeoff or landing.';
  if (!Object.hasOwn(AIRCRAFT, input?.variant)) errors.variant = 'Choose an aircraft variant.';
  if (!runways.some((runway) => runway.id === input?.runwayId)) errors.runwayId = 'Choose a runway from the library.';
  if (!Number.isInteger(input?.runwayLengthFt) || input.runwayLengthFt < 1_000 || input.runwayLengthFt > 20_000) errors.runwayLengthFt = 'Runway length must be a whole number from 1,000 to 20,000 ft.';
  if (!Number.isFinite(input?.pressureAltitudeFt) || input.pressureAltitudeFt < -1_000 || input.pressureAltitudeFt > 14_000) errors.pressureAltitudeFt = 'Pressure altitude must be from −1,000 to 14,000 ft.';
  if (!Number.isFinite(input?.oatC) || input.oatC < -40 || input.oatC > 55) errors.oatC = 'Temperature must be from −40 to 55 °C.';
  if (!Number.isInteger(input?.weightLb) || input.weightLb < 30_000 || input.weightLb > 90_000) errors.weightLb = 'Weight must be a whole number from 30,000 to 90,000 lb.';
  else if (AIRCRAFT[input.variant] && (input.weightLb < AIRCRAFT[input.variant].min || input.weightLb > AIRCRAFT[input.variant].max)) errors.weightLb = `${input.variant} weight must be from ${AIRCRAFT[input.variant].min.toLocaleString()} to ${AIRCRAFT[input.variant].max.toLocaleString()} lb.`;
  if (!Number.isFinite(input?.windKt) || input.windKt < -30 || input.windKt > 50) errors.windKt = 'Wind component must be from −30 to +50 kt.';
  if (!['dry', 'wet'].includes(input?.runwayCondition)) errors.runwayCondition = 'Choose dry or wet.';
  if (![10, 15, 20].includes(input?.flapSetting)) errors.flapSetting = 'Choose flap 10, 15, or 20.';
  if (typeof input?.notes !== 'string') errors.notes = 'Notes must be text.';
  return errors;
}

function validateReview(body, runways, cases, excludeCaseId = null) {
  if (!body || typeof body !== 'object' || !body.inputs || !body.outputs) return { body: 'A calculation review is required.' };
  return validateInputs(body.inputs, runways, cases, excludeCaseId);
}

function metrics(inputs) {
  const aircraft = AIRCRAFT[inputs.variant];
  const weightDelta = inputs.weightLb - aircraft.reference;
  const isaTemp = 15 - inputs.pressureAltitudeFt * 0.00198;
  const hotDelta = Math.max(0, inputs.oatC - isaTemp);
  const altitude = Math.max(0, inputs.pressureAltitudeFt);
  const wetTakeoff = inputs.runwayCondition === 'wet' ? 420 : 0;
  const wetLanding = inputs.runwayCondition === 'wet' ? 620 : 0;
  const flapTakeoff = inputs.flapSetting === 10 ? 230 : inputs.flapSetting === 20 ? -120 : 0;
  const flapLanding = inputs.flapSetting === 10 ? 300 : inputs.flapSetting === 15 ? 120 : -80;

  const takeoffDistanceFt = clamp(round(aircraft.takeoffBase + weightDelta * 0.085 + altitude * 0.21 + hotDelta * 34 - inputs.windKt * 27 + wetTakeoff + flapTakeoff), 1_200, 18_000);
  const accelerateStopDistanceFt = clamp(round(takeoffDistanceFt * 1.07 + 180 + Math.max(0, -inputs.windKt) * 12), 1_300, 19_000);
  const landingDistanceFt = clamp(round(aircraft.landingBase + weightDelta * 0.058 + altitude * 0.125 + hotDelta * 19 - inputs.windKt * 20 + wetLanding + flapLanding), 1_000, 17_000);
  const climbGradientPct = Number((aircraft.climbBase - (inputs.weightLb - aircraft.min) / (aircraft.max - aircraft.min) * 2.1 - altitude / 10_000 * 0.72 - hotDelta * 0.018 + inputs.windKt * 0.004).toFixed(2));
  const approachSpeedKt = clamp(round(aircraft.approachBase + weightDelta / 1_800 + (inputs.flapSetting === 10 ? 7 : inputs.flapSetting === 15 ? 3 : 0)), 90, 180);
  const requiredRunwayFt = inputs.operation === 'takeoff' ? Math.max(takeoffDistanceFt, accelerateStopDistanceFt) : landingDistanceFt;
  return { takeoffDistanceFt, accelerateStopDistanceFt, landingDistanceFt, requiredRunwayFt, climbGradientPct, approachSpeedKt };
}

function maxAllowableWeight(inputs) {
  const aircraft = AIRCRAFT[inputs.variant];
  let best = aircraft.min;
  for (let weight = aircraft.min; weight <= aircraft.max; weight += 100) {
    const candidate = metrics({ ...inputs, weightLb: weight });
    if (candidate.requiredRunwayFt <= inputs.runwayLengthFt && candidate.climbGradientPct >= MIN_CLIMB) best = weight;
    else break;
  }
  return best;
}

function calculate(inputs, runways) {
  const normalized = { ...inputs, label: inputs.label.trim(), notes: inputs.notes.trim() };
  const result = metrics(normalized);
  const runwayMarginFt = normalized.runwayLengthFt - result.requiredRunwayFt;
  const maxAllowableWeightLb = maxAllowableWeight(normalized);
  let status = 'within-limits';
  if (runwayMarginFt < 0 || result.climbGradientPct < MIN_CLIMB) status = 'out-of-limits';
  else if (runwayMarginFt < 1_000 || result.climbGradientPct < MIN_CLIMB + 0.3) status = 'caution';

  const runwayBinding = runwayMarginFt <= Math.max(500, normalized.runwayLengthFt * 0.08);
  const climbBinding = result.climbGradientPct <= MIN_CLIMB + 0.35;
  const weightBinding = maxAllowableWeightLb < AIRCRAFT[normalized.variant].max && normalized.weightLb >= maxAllowableWeightLb - 1_000;
  const limitingFactor = climbBinding ? 'Minimum climb gradient' : runwayBinding ? 'Runway length' : weightBinding ? 'Maximum allowable weight' : 'No active constraint';
  const runway = runways.find((item) => item.id === normalized.runwayId);

  return {
    inputs: normalized,
    outputs: {
      ...result,
      runwayMarginFt,
      maxAllowableWeightLb,
      limitingFactor,
      calculationBasis: `Planning/demo model for ${normalized.variant} at ${runway?.id ?? normalized.runwayId}. Applies simplified weight, pressure-altitude, temperature, wind, surface-condition, and flap adjustments; minimum planning climb gradient ${MIN_CLIMB.toFixed(1)}%. No approved AFM/OEM tables are used.`,
      status
    }
  };
}

function validateRunway(body, runways, originalId = null) {
  const errors = {};
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) errors.id = 'Runway id is required.';
  else if (runways.some((runway) => runway.id !== originalId && runway.id.toLowerCase() === id.toLowerCase())) errors.id = 'Runway id must be unique.';
  if (!Number.isInteger(body?.lengthFt) || body.lengthFt < 1_000 || body.lengthFt > 20_000) errors.lengthFt = 'Length must be a whole number from 1,000 to 20,000 ft.';
  if (!Number.isInteger(body?.elevationFt) || body.elevationFt < -1_500 || body.elevationFt > 15_000) errors.elevationFt = 'Elevation must be a whole number from −1,500 to 15,000 ft.';
  if (typeof body?.notes !== 'string') errors.notes = 'Notes must be text.';
  return errors;
}

function json(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}

async function parseBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1_000_000) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleApi(req, res, url) {
  const runways = await readJson(RUNWAYS_FILE);
  const cases = await readJson(CASES_FILE);

  if (req.method === 'GET' && url.pathname === '/api/snapshot') return json(res, 200, { cases, runways });

  if (req.method === 'POST' && url.pathname === '/api/calculate') {
    const body = await parseBody(req);
    const errors = validateInputs(body, runways, cases);
    if (Object.keys(errors).length) return json(res, 400, { error: 'Calculation inputs are invalid.', fieldErrors: errors });
    return json(res, 200, calculate(body, runways));
  }

  if (req.method === 'POST' && url.pathname === '/api/cases') {
    const body = await parseBody(req);
    const errors = validateReview(body, runways, cases);
    if (Object.keys(errors).length) return json(res, 400, { error: 'The reviewed case is invalid.', fieldErrors: errors });
    const authoritative = calculate(body.inputs, runways);
    const timestamp = now();
    const item = { id: randomUUID(), sweepFamilyId: null, sweepFamilyLabel: null, createdAt: timestamp, updatedAt: timestamp, ...authoritative };
    await writeJson(CASES_FILE, [...cases, item]);
    return json(res, 201, item);
  }

  const caseMatch = url.pathname.match(/^\/api\/cases\/([^/]+)$/);
  if (req.method === 'PUT' && caseMatch) {
    const id = decodeURIComponent(caseMatch[1]);
    const index = cases.findIndex((item) => item.id === id);
    if (index < 0) return json(res, 404, { error: 'Saved case not found.' });
    const body = await parseBody(req);
    const errors = validateReview(body, runways, cases, id);
    if (Object.keys(errors).length) return json(res, 400, { error: 'The reviewed case is invalid.', fieldErrors: errors });
    const authoritative = calculate(body.inputs, runways);
    const item = { ...cases[index], ...authoritative, updatedAt: now() };
    const updated = [...cases];
    updated[index] = item;
    await writeJson(CASES_FILE, updated);
    return json(res, 200, item);
  }

  if (req.method === 'POST' && url.pathname === '/api/sweeps') {
    const body = await parseBody(req);
    const baseErrors = validateInputs(body?.baseInputs, runways, cases, null, true);
    const start = body?.startWeightLb;
    const end = body?.endWeightLb;
    const step = body?.stepWeightLb;
    if (!Number.isInteger(start)) baseErrors.startWeightLb = 'Start weight must be a whole number.';
    if (!Number.isInteger(end) || end < start) baseErrors.endWeightLb = 'End weight must be a whole number not below start weight.';
    if (!Number.isInteger(step) || step <= 0) baseErrors.stepWeightLb = 'Step must be a positive whole number.';
    const count = Number.isInteger(step) && step > 0 && end >= start ? Math.floor((end - start) / step) + 1 : 0;
    if (count < 1 || count > 25) baseErrors.stepWeightLb = 'Sweep must contain from 1 to 25 cases.';
    const aircraft = AIRCRAFT[body?.baseInputs?.variant];
    if (aircraft && (start < aircraft.min || end > aircraft.max)) baseErrors.startWeightLb = `Sweep weights must stay within ${body.baseInputs.variant} limits (${aircraft.min.toLocaleString()}–${aircraft.max.toLocaleString()} lb).`;
    const familyLabel = body?.baseInputs?.label?.trim();
    const generatedLabels = Array.from({ length: count }, (_, index) => `${familyLabel} · sweep ${start + index * step} lb`);
    const duplicate = generatedLabels.find((label) => cases.some((item) => item.inputs.label.toLowerCase() === label.toLowerCase()));
    if (duplicate) baseErrors.label = `A generated case label already exists: ${duplicate}`;
    if (Object.keys(baseErrors).length) return json(res, 400, { error: 'Sweep inputs are invalid.', fieldErrors: baseErrors });

    const familyId = randomUUID();
    const timestamp = now();
    const items = generatedLabels.map((label, index) => {
      const inputs = { ...body.baseInputs, label, weightLb: start + index * step };
      return { id: randomUUID(), sweepFamilyId: familyId, sweepFamilyLabel: familyLabel, createdAt: timestamp, updatedAt: timestamp, ...calculate(inputs, runways) };
    });
    await writeJson(CASES_FILE, [...cases, ...items]);
    return json(res, 201, items);
  }

  if (req.method === 'POST' && url.pathname === '/api/runways') {
    const body = await parseBody(req);
    const errors = validateRunway(body, runways);
    if (Object.keys(errors).length) return json(res, 400, { error: 'Runway record is invalid.', fieldErrors: errors });
    const item = { id: body.id.trim(), lengthFt: body.lengthFt, elevationFt: body.elevationFt, notes: body.notes.trim(), updatedAt: now() };
    await writeJson(RUNWAYS_FILE, [...runways, item].sort((a, b) => a.id.localeCompare(b.id)));
    return json(res, 201, item);
  }

  const runwayMatch = url.pathname.match(/^\/api\/runways\/([^/]+)$/);
  if (req.method === 'PUT' && runwayMatch) {
    const originalId = decodeURIComponent(runwayMatch[1]);
    const index = runways.findIndex((item) => item.id === originalId);
    if (index < 0) return json(res, 404, { error: 'Runway record not found.' });
    const body = await parseBody(req);
    const errors = validateRunway(body, runways, originalId);
    if (Object.keys(errors).length) return json(res, 400, { error: 'Runway record is invalid.', fieldErrors: errors });
    const item = { id: body.id.trim(), lengthFt: body.lengthFt, elevationFt: body.elevationFt, notes: body.notes.trim(), updatedAt: now() };
    const updated = [...runways];
    updated[index] = item;
    await writeJson(RUNWAYS_FILE, updated.sort((a, b) => a.id.localeCompare(b.id)));
    return json(res, 200, item);
  }

  return json(res, 404, { error: 'API route not found.' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon'
};

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const normalizedPath = normalize(pathname).replace(/^([.][.][/\\])+/, '');
  let filePath = resolve(DIST, `.${normalizedPath}`);
  if (!filePath.startsWith(DIST)) return json(res, 403, { error: 'Forbidden.' });
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(DIST, 'index.html');
  }
  try {
    const fileStat = await stat(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Content-Length': fileStat.size,
      'Cache-Control': filePath.endsWith('index.html') || filePath.endsWith('sw.js') ? 'no-cache' : 'public, max-age=31536000, immutable'
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(filePath).pipe(res);
  } catch {
    json(res, 404, { error: 'Built frontend not found. Run npm run build first.' });
  }
}

await ensureData();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Request body must be valid JSON.' : error instanceof Error ? error.message : 'Unexpected server error.';
    json(res, error instanceof SyntaxError ? 400 : 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`AeroCalc listening at http://localhost:${PORT}`);
});
