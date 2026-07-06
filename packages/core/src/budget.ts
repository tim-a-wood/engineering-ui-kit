/**
 * Three-file upload budget enforcement and packet manifest generation
 * (`standards/copilot-handoff/three-file-upload-strategy.md`).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { PacketManifestEntry } from './types.js'

export const MAX_COPILOT_UPLOADS = 3

export function assertThreeFileBudget(files: string[]): void {
  if (files.length === 0) {
    throw new Error('upload set is empty')
  }
  if (files.length > MAX_COPILOT_UPLOADS) {
    throw new Error(`upload set has ${files.length} files; the strict Copilot budget is ${MAX_COPILOT_UPLOADS}`)
  }
}

export function buildPacketManifest(files: string[]): PacketManifestEntry[] {
  assertThreeFileBudget(files)
  return files.map((filePath) => {
    const data = fs.readFileSync(filePath)
    return {
      file: path.basename(filePath),
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      bytes: data.length,
    }
  })
}
