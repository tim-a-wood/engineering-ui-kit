import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import { inspectOverlay } from '../../src/overlay.js'

describe('CAP-TEST-015 capability overlay scope', () => {
  it('hard-blocks paths outside capability allowedPaths while preserving legacy warning behavior', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-overlay-'))
    const zipPath = path.join(dir, 'ui-overlay.zip')
    const zip = new AdmZip()
    zip.addFile('capabilities/modules/mod.a/index.ts', Buffer.from('export const a = 1\n'))
    zip.addFile('other/escape.ts', Buffer.from('export const x = 1\n'))
    zip.writeZip(zipPath)

    const capability = inspectOverlay(zipPath, {
      runId: 'cap-1',
      targetRoot: dir,
      capabilityAllowedPaths: ['capabilities/modules/mod.a/'],
    })
    expect(capability.hardBlockers.some((b) => b.ruleId === 'CAP-OVERLAY-SCOPE-001')).toBe(true)
    expect(capability.canApply).toBe(false)

    const legacy = inspectOverlay(zipPath, {
      runId: 'legacy-1',
      targetRoot: dir,
      expectedFiles: ['capabilities/modules/mod.a/index.ts'],
    })
    expect(legacy.hardBlockers.some((b) => b.ruleId === 'CAP-OVERLAY-SCOPE-001')).toBe(false)
    expect(legacy.warnings.some((w) => w.ruleId === 'AI-HANDOFF-043')).toBe(true)
  })
})
