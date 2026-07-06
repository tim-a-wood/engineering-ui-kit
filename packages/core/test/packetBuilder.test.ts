import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildTaskAndStandardPack, verifySectionOrder, REQUIRED_SECTION_ORDER } from '../src/packetBuilder.js'
import { assertThreeFileBudget, buildPacketManifest } from '../src/budget.js'
import type { TaskDefinition } from '../src/types.js'

const task: TaskDefinition = {
  packetId: 'test-packet',
  packetVersion: '0.0.1',
  variant: 'visual',
  standardsPackage: 'engineering-ui-kit-standards',
  standardsVersion: '0.4.0',
  themePosture: 'dark-first',
  targetPackage: 'fixture-app',
  targetApplication: 'UI Overlay',
  selectedProjectSample: 'signal-analyzer-refresh',
  selectedProjectSamplePath: 'C:\\work\\signal-analyzer-refresh',
  targetAppRoot: 'fixture-app',
  screen: 'Create Task Packet',
  route: '/',
  primaryVisualReference: 'mockup.jpeg',
  goal: 'Refresh the screen.',
  scope: ['Only the screen at /.'],
  constraints: ['Dark-first only.'],
  protectedBehavior: ['Export keeps working.'],
  acceptanceCriteria: [
    { id: 'AC-1', criterion: 'Builds.', evidenceMethod: 'build log', blocking: true },
  ],
  references: ['standards/foundation/tokens.md'],
  expectedChangedFiles: [{ path: 'src/App.tsx' }, { path: 'src/tokens.css', note: 'optional; new only' }],
  forbiddenChanges: ['package.json'],
  applicableRuleIds: ['FND-VIS-001'],
  applicableComponentIds: ['CMP-SHELL-APP'],
  tokenRows: [{ path: 'semantic.surface.canvas', value: '#07111f', requiredUse: 'Root canvas' }],
  approvedGuidance: ['Dark engineering workbench.'],
  rejectedGuidance: ['Light mode.'],
  accessibilityRequirements: ['Target WCAG 2.2 AA.'],
  standardsExcerpts: [
    { id: 'FND-VIS-001', title: 'Dark-first surface hierarchy', body: 'Use semantic surfaces.', source: 'standards/foundation/visual-language.md' },
  ],
}

describe('buildTaskAndStandardPack', () => {
  const pack = buildTaskAndStandardPack(task, { baselineCommit: 'abc123', generatedAt: '2026-07-06T00:00:00Z' })

  it('contains every required section in contract order', () => {
    const check = verifySectionOrder(pack)
    expect(check.missing).toEqual([])
    expect(check.outOfOrder).toEqual([])
    expect(check.ok).toBe(true)
  })

  it('keeps application and selected-project identities distinct', () => {
    expect(pack).toContain('targetApplication: `UI Overlay`')
    expect(pack).toContain('selectedProjectSample: `signal-analyzer-refresh`')
  })

  it('renders acceptance criteria and token tables', () => {
    expect(pack).toContain('| AC-1 | Builds. | build log | yes |')
    expect(pack).toContain('| `semantic.surface.canvas` | `#07111f` | Root canvas |')
  })

  it('detects a dropped section', () => {
    const broken = pack.replace('\n## Rejected Guidance\n', '\n## Something Else\n')
    const check = verifySectionOrder(broken)
    expect(check.ok).toBe(false)
    expect(check.missing).toContain('## Rejected Guidance')
  })

  it('covers the full contract heading list', () => {
    expect(REQUIRED_SECTION_ORDER.length).toBe(20)
  })
})

describe('three-file budget', () => {
  it('rejects more than three uploads', () => {
    expect(() => assertThreeFileBudget(['a', 'b', 'c', 'd'])).toThrow(/budget is 3/)
    expect(() => assertThreeFileBudget([])).toThrow(/empty/)
    expect(() => assertThreeFileBudget(['a', 'b', 'c'])).not.toThrow()
  })

  it('builds a manifest with sha256 and byte counts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-budget-'))
    const f = path.join(dir, 'file.txt')
    fs.writeFileSync(f, 'hello')
    const manifest = buildPacketManifest([f])
    expect(manifest[0]).toEqual({
      file: 'file.txt',
      sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      bytes: 5,
    })
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
