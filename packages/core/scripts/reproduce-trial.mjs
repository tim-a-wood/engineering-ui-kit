/**
 * Phase 5 exit-criterion script: reproduce the Phase 3 vertical-slice trial
 * through core-library calls only.
 *
 * Flow: parse the Phase 2 packet flatfile → materialize the baseline into a
 * disposable tree → inspect the Phase 3 ui-overlay.zip → apply it → run
 * typecheck and build via the verification command runner.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlatfile } from '../dist/flatfile.js'
import { inspectOverlay, applyOverlay } from '../dist/overlay.js'
import { runCommand } from '../dist/commandRunner.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const packetFlatfile = path.join(repoRoot, 'trials/vertical-slice-01/phase-2/packet/repo-flatfile.txt')
const overlayZip = path.join(repoRoot, 'trials/vertical-slice-01/phase-3/overlay/ui-overlay.zip')
const targetAppNodeModules = path.join(repoRoot, 'trials/vertical-slice-01/target-app/node_modules')

const failures = []
const step = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`)
  if (!ok) failures.push(name)
}

// 1. Materialize packet baseline
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-trial-repro-'))
const { header, entries } = parseFlatfile(fs.readFileSync(packetFlatfile, 'utf8'))
step('parse-flatfile', header.packetId === 'vertical-slice-01-phase-2' && entries.length === 11,
  `packet=${header.packetId} files=${entries.length}`)
for (const entry of entries) {
  const dest = path.join(work, entry.path)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, entry.content)
}
fs.symlinkSync(targetAppNodeModules, path.join(work, 'node_modules'))

// 2. Baseline verification
const baseTypecheck = await runCommand({ runId: 'repro', commandLabel: 'baseline-typecheck', commandText: 'npm run typecheck', workingDirectory: work })
step('baseline-typecheck', baseTypecheck.status === 'passed', `exit=${baseTypecheck.exitCode}`)

// 3. Inspect overlay
const inspection = inspectOverlay(overlayZip, {
  runId: 'repro',
  targetRoot: work,
  expectedFiles: ['src/App.tsx', 'src/styles.css', 'src/tokens.css'],
})
const warningIds = [...new Set(inspection.warnings.map((w) => w.ruleId))]
step('inspect-overlay', inspection.canApply && inspection.hardBlockers.length === 0,
  `blockers=${inspection.hardBlockers.length} warnings=${warningIds.join('+') || 'none'}`)

// 4. Apply overlay (warnings explicitly accepted, mirroring PO-2)
const applied = applyOverlay(overlayZip, inspection, { runId: 'repro', targetRoot: work, acceptWarnings: true })
const actions = Object.fromEntries(applied.files.map((f) => [f.relativePath, f.action]))
step('apply-overlay', applied.files.length === 3 && actions['src/tokens.css'] === 'created',
  JSON.stringify(actions))

// 5. Post-apply verification
const typecheck = await runCommand({ runId: 'repro', commandLabel: 'typecheck', commandText: 'npm run typecheck', workingDirectory: work })
step('post-apply-typecheck', typecheck.status === 'passed', `exit=${typecheck.exitCode}`)
const build = await runCommand({ runId: 'repro', commandLabel: 'build', commandText: 'npm run build', workingDirectory: work, timeoutMs: 120000 })
step('post-apply-build', build.status === 'passed', `exit=${build.exitCode}`)

fs.rmSync(work, { recursive: true, force: true })
console.log(failures.length === 0 ? '\nTrial reproduction: COMPLETE' : `\nTrial reproduction FAILED: ${failures.join(', ')}`)
process.exit(failures.length === 0 ? 0 : 1)
