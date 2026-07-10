/**
 * Reset the target repo to its start point: REQUIREMENTS.md + package.json +
 * .gitignore (+ node_modules when present). Everything the workflow produced
 * — src, server, configs, dist, data — is removed, so every experiment pass
 * starts from the identical state.
 */

import fs from 'node:fs'
import path from 'node:path'
import { TARGET_REPO } from './config.mjs'

const KEEP = new Set(['REQUIREMENTS.md', 'package.json', '.gitignore', 'node_modules'])

const entries = fs.readdirSync(TARGET_REPO)
const removed = []
for (const entry of entries) {
  if (KEEP.has(entry)) continue
  fs.rmSync(path.join(TARGET_REPO, entry), { recursive: true, force: true })
  removed.push(entry)
}
console.log(`reset ${TARGET_REPO}`)
console.log(removed.length ? `  removed: ${removed.join(', ')}` : '  already at start point')
