/**
 * CAP-TEST-016 — Module verification suite selection, outcomes, provenance, ready gate.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildRepairPacketContext,
  buildVerificationRecord,
  classifyVerificationOutcome,
  isEligibleForReady,
  runModuleVerification,
  selectVerificationSuites,
  type CommandOutcome,
} from '../../src/capabilities/verification.js'
import type { ModuleManifest, ModuleType } from '../../src/capabilities/types.js'
import { MODULE_TYPES } from '../../src/capabilities/parity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures')

function loadManifest(): ModuleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(fixtureDir, 'module-manifest-valid.json'), 'utf8'),
  ) as ModuleManifest
}

const HASHES = {
  specification: 'spec-a',
  implementation: 'impl-a',
  architecture: 'arch-a',
  dependencies: 'dep-a',
  adapters: 'adap-a',
  bindings: 'bind-a',
  verificationSuites: 'suite-a',
}

function passCommands(labels: string[]): CommandOutcome[] {
  return labels.map((label) => ({
    label,
    exitCode: 0,
    passed: true,
    outputSummary: `${label} ok`,
  }))
}

describe('CAP-TEST-016 module verification', () => {
  it('selects suites by module type and merges manifest extras', () => {
    for (const moduleType of MODULE_TYPES) {
      const suites = selectVerificationSuites(moduleType)
      expect(suites).toContain('suite.architecture-trace')
      expect(suites.length).toBeGreaterThan(1)
    }

    const domain = selectVerificationSuites('domain')
    expect(domain).toEqual(expect.arrayContaining(['suite.contracts', 'suite.rules', 'suite.examples']))

    const workflow = selectVerificationSuites('workflow')
    expect(workflow).toEqual(expect.arrayContaining(['suite.scenarios-main', 'suite.states']))

    const connection = selectVerificationSuites('connection')
    expect(connection).toEqual(expect.arrayContaining(['suite.readiness', 'suite.compatibility']))

    const platform = selectVerificationSuites('platform')
    expect(platform).toEqual(expect.arrayContaining(['suite.health', 'suite.permissions']))

    const experience = selectVerificationSuites('experience')
    expect(experience).toEqual(expect.arrayContaining(['suite.build-typecheck', 'suite.accessibility']))

    const withExtra = selectVerificationSuites('domain', loadManifest())
    expect(withExtra).toContain('suite.domain')
    expect(withExtra).toContain('suite.architecture-trace')
  })

  it('keeps failure outcome classes distinct from injected command results', () => {
    expect(classifyVerificationOutcome([])).toBe('unverified')
    expect(
      classifyVerificationOutcome([{ label: 'a', exitCode: 0, passed: true }]),
    ).toBe('passed')
    expect(
      classifyVerificationOutcome([
        { label: 'setup', exitCode: 1, passed: false, kind: 'setup', outputSummary: 'npm install failed' },
      ]),
    ).toBe('failed-setup')
    expect(
      classifyVerificationOutcome([
        { label: 'reject', exitCode: 2, passed: false, kind: 'domain', outputSummary: 'rule rejected' },
      ]),
    ).toBe('failed-domain')
    expect(
      classifyVerificationOutcome([
        { label: 'crash', exitCode: 1, passed: false, kind: 'technical', outputSummary: 'segfault' },
      ]),
    ).toBe('failed-technical')
    expect(
      classifyVerificationOutcome([
        { label: 'user-stop', exitCode: 130, passed: false, kind: 'cancel' },
      ]),
    ).toBe('cancelled')
    expect(
      classifyVerificationOutcome([
        { label: 'ok', exitCode: 0, passed: true },
        { label: 'stop', exitCode: 130, passed: false, kind: 'cancel' },
      ]),
    ).toBe('cancelled')
  })

  it('persists complete provenance on a passing run', () => {
    const manifest = loadManifest()
    const suites = selectVerificationSuites('domain', manifest)
    const record = buildVerificationRecord({
      verificationId: 'ver-pass-1',
      projectId: 'proj-1',
      moduleId: manifest.moduleId,
      moduleType: 'domain',
      manifest,
      inputHashes: HASHES,
      commands: passCommands(suites),
      startedAt: '2026-07-12T20:00:00.000Z',
      completedAt: '2026-07-12T20:00:05.000Z',
    })

    expect(record.schemaVersion).toBe('1.0')
    expect(record.outcome).toBe('passed')
    expect(record.suiteIds).toEqual(suites)
    expect(record.suiteVersions).toHaveLength(suites.length)
    expect(record.suiteHashes).toHaveLength(suites.length)
    expect(record.inputHashes).toEqual(HASHES)
    expect(record.commandResults).toHaveLength(suites.length)
    expect(record.commandResults.every((c) => c.passed)).toBe(true)
    expect(record.diagnostics).toEqual([])
    expect(record.startedAt).toBe('2026-07-12T20:00:00.000Z')
    expect(record.completedAt).toBe('2026-07-12T20:00:05.000Z')
  })

  it('marks ready only on exact passing evidence', () => {
    const manifest = loadManifest()
    const suites = selectVerificationSuites(manifest.moduleType as ModuleType, manifest)

    const passed = runModuleVerification({
      verificationId: 'ver-ready',
      projectId: 'proj-1',
      moduleId: manifest.moduleId,
      moduleType: 'domain',
      manifest,
      inputHashes: HASHES,
      commands: passCommands(suites),
      startedAt: '2026-07-12T20:00:00.000Z',
      completedAt: '2026-07-12T20:00:01.000Z',
    })
    expect(passed.record.outcome).toBe('passed')
    expect(passed.eligibleForReady).toBe(true)
    expect(isEligibleForReady(passed.record, HASHES)).toBe(true)
    expect(isEligibleForReady(passed.record, { ...HASHES, implementation: 'impl-b' })).toBe(false)

    const failed = runModuleVerification({
      verificationId: 'ver-fail',
      projectId: 'proj-1',
      moduleId: manifest.moduleId,
      moduleType: 'domain',
      manifest,
      inputHashes: HASHES,
      commands: [
        { label: 'suite.rules', exitCode: 1, passed: false, kind: 'domain', outputSummary: 'bounds fail' },
      ],
      architectureVersion: '1.0',
      architectureHash: 'arch-a',
      startedAt: '2026-07-12T20:00:00.000Z',
      completedAt: '2026-07-12T20:00:01.000Z',
    })
    expect(failed.record.outcome).toBe('failed-domain')
    expect(failed.eligibleForReady).toBe(false)
    expect(isEligibleForReady(failed.record, HASHES)).toBe(false)
  })

  it('builds scoped repair packet context; setup failures stay setup actions', () => {
    const manifest = loadManifest()

    const setup = buildVerificationRecord({
      verificationId: 'ver-setup',
      projectId: 'proj-1',
      moduleId: manifest.moduleId,
      moduleType: 'domain',
      manifest,
      inputHashes: HASHES,
      commands: [
        {
          label: 'install',
          exitCode: 1,
          passed: false,
          kind: 'setup',
          outputSummary: 'missing toolchain',
        },
      ],
      startedAt: '2026-07-12T20:00:00.000Z',
      completedAt: '2026-07-12T20:00:01.000Z',
    })
    const setupRepair = buildRepairPacketContext({
      record: setup,
      manifest,
      architectureVersion: '1.0',
      architectureHash: 'arch-a',
    })
    expect(setupRepair).toEqual({
      setupAction: 'Install dependencies and re-run verification suites',
      outcome: 'failed-setup',
    })

    const domain = runModuleVerification({
      verificationId: 'ver-domain-fail',
      projectId: 'proj-1',
      moduleId: manifest.moduleId,
      moduleType: 'domain',
      manifest,
      inputHashes: HASHES,
      commands: [
        {
          label: 'suite.rejection',
          exitCode: 1,
          passed: false,
          kind: 'domain',
          outputSummary: 'invalid input accepted',
        },
      ],
      architectureVersion: '1.0',
      architectureHash: 'arch-a',
      startedAt: '2026-07-12T20:00:00.000Z',
      completedAt: '2026-07-12T20:00:01.000Z',
    })
    expect(domain.repairContext).toBeDefined()
    expect(domain.repairContext && 'packetId' in domain.repairContext).toBe(true)
    if (domain.repairContext && 'packetId' in domain.repairContext) {
      expect(domain.repairContext.targetId).toBe(manifest.moduleId)
      expect(domain.repairContext.allowedPaths).toEqual(manifest.ownedPaths)
      expect(domain.repairContext.unchangedBehavior.some((line) => line.includes('invalid input'))).toBe(
        true,
      )
    }
  })

  it('does not grant ready for cancelled, unverified, or technical failures', () => {
    const cases: { name: string; commands: CommandOutcome[] }[] = [
      { name: 'cancelled', commands: [{ label: 'x', exitCode: 130, passed: false, kind: 'cancel' }] },
      { name: 'unverified', commands: [] },
      {
        name: 'technical',
        commands: [{ label: 'x', exitCode: 1, passed: false, kind: 'technical', outputSummary: 'boom' }],
      },
    ]
    for (const c of cases) {
      const result = runModuleVerification({
        verificationId: `ver-${c.name}`,
        projectId: 'proj-1',
        moduleId: 'mod.domain',
        moduleType: 'domain',
        inputHashes: HASHES,
        commands: c.commands,
        startedAt: '2026-07-12T20:00:00.000Z',
        completedAt: '2026-07-12T20:00:01.000Z',
      })
      expect(result.eligibleForReady, c.name).toBe(false)
      expect(result.record.outcome, c.name).not.toBe('passed')
    }
  })
})
