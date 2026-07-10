/**
 * Shared configuration for the workflow E2E harness.
 *
 * Every path is derived from PASS (experiment pass number) and TARGET
 * (the target repo under examples/) so repeated passes never collide.
 * The workspace (EUIK_DATA_DIR) lives outside the repo; only screenshots
 * and machine-readable results are checked in under validation-evidence.
 */

import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export const PASS = process.env.PASS ?? '1'
export const TARGET = process.env.TARGET ?? 'gauge-lab'
export const EXPERIMENT = process.env.EXPERIMENT ?? 'monolith-e2e'

export const TARGET_REPO = path.join(REPO_ROOT, 'examples', TARGET)

/** Checked-in evidence: screenshots + results for this pass. */
export const EVIDENCE_DIR = path.join(REPO_ROOT, 'apps', 'desktop', 'validation-evidence', EXPERIMENT, `pass-${PASS}`)

/** Scratch state (not checked in): app workspace, overlay staging, zips. */
export const SCRATCH_ROOT = process.env.EUIK_E2E_SCRATCH
  ?? path.join(os.tmpdir(), 'euik-e2e', EXPERIMENT, `pass-${PASS}`)
export const DATA_DIR = path.join(SCRATCH_ROOT, 'workspace')
export const OVERLAY_ZIP = path.join(SCRATCH_ROOT, 'incoming', 'ui-overlay.zip')
