/**
 * Package staged PAVE visual refresh, inspect, apply, and update the seeded run.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import { Workspace, inspectOverlay, applyOverlay } from '../../../../packages/core/dist/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STAGE = path.join(__dirname, 'overlay-stage')
const EVIDENCE = __dirname
const RUN_ID = 'd2bc31a3-3328-4549-9980-847fd225548b'
const TARGET = '/Users/timwood/Desktop/projects/PWA/PAVE/source/frontend/pwa'
const DATA_DIR = path.join(process.env.HOME, 'Library/Application Support/@engineering-ui-kit/desktop/workspace')
const ZIP_PATH = path.join(EVIDENCE, 'ui-overlay.zip')

const files = [
  'styles/tokens.css',
  'styles/render-fidelity-stylesheet.css',
  'pages/application-shell-page.html',
  'pages/index-page.html',
]

const zip = new AdmZip()
for (const relative of files) {
  const absolute = path.join(STAGE, relative)
  if (!fs.existsSync(absolute)) throw new Error(`missing staged file: ${relative}`)
  zip.addLocalFile(absolute, path.dirname(relative), path.basename(relative))
}
zip.writeZip(ZIP_PATH)

const workspace = new Workspace(DATA_DIR)
const run = workspace.getRun(RUN_ID)
if (!run) throw new Error(`run not found: ${RUN_ID}`)

const inspection = inspectOverlay(ZIP_PATH, {
  runId: RUN_ID,
  targetRoot: TARGET,
})
fs.writeFileSync(path.join(EVIDENCE, 'inspection.json'), `${JSON.stringify(inspection, null, 2)}\n`)
fs.writeFileSync(path.join(workspace.runDir(RUN_ID), 'overlay-inspection.json'), `${JSON.stringify(inspection, null, 2)}\n`)

if (!inspection.canApply) {
  console.error(JSON.stringify({ blocked: true, blockers: inspection.hardBlockers }, null, 2))
  process.exit(1)
}

const applied = applyOverlay(ZIP_PATH, inspection, {
  runId: RUN_ID,
  targetRoot: TARGET,
  acceptWarnings: true,
})
fs.writeFileSync(path.join(EVIDENCE, 'applied-files.json'), `${JSON.stringify(applied, null, 2)}\n`)
const appliedPath = path.join(workspace.runDir(RUN_ID), 'applied-files.json')
fs.writeFileSync(appliedPath, `${JSON.stringify(applied, null, 2)}\n`)

workspace.updateRun(RUN_ID, {
  currentStep: 'verify-review',
  overlayZipPath: ZIP_PATH,
  overlayInspectionPath: path.join(workspace.runDir(RUN_ID), 'overlay-inspection.json'),
  appliedFilesPath: appliedPath,
})

console.log(JSON.stringify({
  zipPath: ZIP_PATH,
  canApply: inspection.canApply,
  warnings: inspection.warnings,
  hardBlockers: inspection.hardBlockers,
  appliedFiles: applied.files,
  currentStep: 'verify-review',
}, null, 2))
