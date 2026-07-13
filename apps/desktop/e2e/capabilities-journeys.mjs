/**
 * CAP-TEST-040 journey harness (CAP-PKT-032).
 *
 * Patterned after apps/desktop/e2e/: Node entrypoint, evidence under
 * validation-evidence, honest status for packaged vs offline paths.
 *
 * Packaged Electron + Playwright UI journeys are NOT launched here — that
 * path requires a built desktop app, Playwright Electron, and GUI flows that
 * are still incomplete for interview/binding. Offline core journeys MUST pass.
 *
 * Usage:
 *   node apps/desktop/e2e/capabilities-journeys.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { REPO_ROOT } from './config.mjs'

const PASS = process.env.PASS ?? 'cap-040'
const EXPERIMENT = process.env.EXPERIMENT ?? 'capabilities-journeys'
const EVIDENCE_DIR = path.join(
  REPO_ROOT,
  'apps',
  'desktop',
  'validation-evidence',
  EXPERIMENT,
  `pass-${PASS}`,
)

fs.mkdirSync(EVIDENCE_DIR, { recursive: true })

async function loadCoreJourneys() {
  const distEntry = path.join(REPO_ROOT, 'packages', 'core', 'dist', 'index.js')
  if (!fs.existsSync(distEntry)) {
    console.log('[cap-040] building packages/core (dist missing)…')
    const { spawnSync } = await import('node:child_process')
    const built = spawnSync('npm', ['run', 'build', '-w', 'packages/core'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (built.status !== 0) {
      throw new Error('packages/core build failed; cannot run offline journeys')
    }
  }
  return import(pathToFileURL(distEntry).href)
}

function writeEvidence(name, payload) {
  const file = path.join(EVIDENCE_DIR, name)
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n')
  console.log(`  [evidence] ${path.relative(REPO_ROOT, file)}`)
  return file
}

console.log('CAP-TEST-040 capabilities journeys')
console.log(`  evidence → ${path.relative(REPO_ROOT, EVIDENCE_DIR)}`)

const packagedStatus = {
  mode: 'packaged-electron-playwright',
  attempted: false,
  status: 'not-run',
  reason:
    'Packaged desktop UI journeys are not launched in this harness. Interview/architecture/binding GUI flows are incomplete for full Playwright driving; use offline core journeys below as the blocking CAP-TEST-040 path.',
}

writeEvidence('packaged-status.json', packagedStatus)
console.log('  [packaged] not-run — offline core journeys are the blocking path')

const core = await loadCoreJourneys()
const {
  runAllOfflineJourneys,
  createOfflineJourneyContext,
} = core

if (typeof runAllOfflineJourneys !== 'function') {
  throw new Error('runAllOfflineJourneys missing from @engineering-ui-kit/core — rebuild packages/core')
}

const ctx = createOfflineJourneyContext('euik-cap-e2e-')
const started = Date.now()
const { results, restartOk, deferredAbsent } = runAllOfflineJourneys(ctx)
const elapsedMs = Date.now() - started

const failed = results.filter((r) => !r.passed)
const offlineReport = {
  mode: 'offline-core',
  status: failed.length === 0 && restartOk && deferredAbsent ? 'passed' : 'failed',
  elapsedMs,
  hardware: {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    model: os.cpus()[0]?.model,
    totalMemGb: Math.round(os.totalmem() / 1024 ** 3),
  },
  restartOk,
  deferredAbsent,
  journeys: results,
  packaged: packagedStatus,
}

writeEvidence('offline-journeys.json', offlineReport)

for (const result of results) {
  const mark = result.passed ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${result.journeyId}`)
}
console.log(`  [restart] ${restartOk ? 'PASS' : 'FAIL'}`)
console.log(`  [deferred-absent] ${deferredAbsent ? 'PASS' : 'FAIL'}`)
console.log(`  offline status: ${offlineReport.status} (${elapsedMs}ms)`)

if (offlineReport.status !== 'passed') {
  console.error('CAP-TEST-040 offline journeys FAILED')
  process.exit(1)
}

console.log('CAP-TEST-040 offline journeys PASSED')
