/**
 * Module verification suite selection and provenance (CAP-PKT-014 / CAP-ARCH-006).
 *
 * Command results are injected by the caller (tests, desktop runner, or GUI).
 * Core never claims a module is ready without an exact-pass VerificationRecord.
 */

import type { ImplementationPacket, ModuleManifest, ModuleType, VerificationRecord } from './types.js'
import { buildImplementationPacket } from './packets.js'

export type CommandOutcome = {
  label: string
  exitCode: number
  passed: boolean
  outputSummary?: string
  kind?: 'setup' | 'domain' | 'technical' | 'cancel'
}

/** CAP-CONTRACT-017 suite selection by module type (architecture-trace on all). */
const SUITES_BY_TYPE: Record<ModuleType, string[]> = {
  domain: [
    'suite.contracts',
    'suite.rules',
    'suite.units',
    'suite.examples',
    'suite.bounds',
    'suite.rejection',
    'suite.tolerances',
    'suite.architecture-trace',
  ],
  workflow: [
    'suite.scenarios-main',
    'suite.scenarios-alternate',
    'suite.states',
    'suite.cancellation',
    'suite.recovery',
    'suite.guarantees',
    'suite.architecture-trace',
  ],
  connection: [
    'suite.readiness',
    'suite.translation',
    'suite.timeout',
    'suite.cancellation',
    'suite.external-errors',
    'suite.compatibility',
    'suite.architecture-trace',
  ],
  platform: [
    'suite.health',
    'suite.persistence',
    'suite.permissions',
    'suite.isolation',
    'suite.recovery',
    'suite.architecture-trace',
  ],
  experience: [
    'suite.build-typecheck',
    'suite.accessibility',
    'suite.mapping',
    'suite.presentation-states',
    'suite.responsive',
    'suite.architecture-trace',
  ],
}

export function selectVerificationSuites(moduleType: ModuleType, manifest?: ModuleManifest): string[] {
  const base = SUITES_BY_TYPE[moduleType] ?? ['suite.architecture-trace']
  const extra = manifest?.verificationSuiteIds ?? []
  return [...new Set([...base, ...extra])].sort()
}

export function classifyVerificationOutcome(
  commands: CommandOutcome[],
): VerificationRecord['outcome'] {
  if (commands.some((c) => c.kind === 'cancel')) return 'cancelled'
  if (commands.length === 0) return 'unverified'
  if (commands.every((c) => c.passed)) return 'passed'
  if (commands.some((c) => !c.passed && c.kind === 'setup')) return 'failed-setup'
  if (commands.some((c) => !c.passed && c.kind === 'domain')) return 'failed-domain'
  if (commands.some((c) => !c.passed)) return 'failed-technical'
  return 'unverified'
}

export function buildVerificationRecord(input: {
  verificationId: string
  projectId: string
  moduleId: string
  moduleType: ModuleType
  manifest?: ModuleManifest
  inputHashes: Record<string, string>
  commands: CommandOutcome[]
  startedAt: string
  completedAt: string
  connectionId?: string
  artifacts?: string[]
}): VerificationRecord {
  const suiteIds = selectVerificationSuites(input.moduleType, input.manifest)
  return {
    schemaVersion: '1.0',
    verificationId: input.verificationId,
    projectId: input.projectId,
    moduleId: input.moduleId,
    connectionId: input.connectionId,
    suiteIds,
    suiteVersions: suiteIds.map(() => '1.0'),
    suiteHashes: suiteIds.map((id) => input.inputHashes[`suite:${id}`] ?? id),
    inputHashes: { ...input.inputHashes },
    commandResults: input.commands.map((c) => ({
      label: c.label,
      exitCode: c.exitCode,
      passed: c.passed,
      outputSummary: c.outputSummary,
    })),
    artifacts: input.artifacts ?? [],
    diagnostics: input.commands
      .filter((c) => !c.passed)
      .map((c, index) => ({
        id: `diag-${index}`,
        code: `CAP-VER-${(c.kind ?? 'technical').toUpperCase()}`,
        message: c.outputSummary ?? `${c.label} failed`,
      })),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    outcome: classifyVerificationOutcome(input.commands),
  }
}

/** Ready only when outcome is passed and every hash matches exactly. */
export function isEligibleForReady(
  record: VerificationRecord,
  currentHashes: Record<string, string>,
): boolean {
  if (record.outcome !== 'passed') return false
  const keys = new Set([...Object.keys(record.inputHashes), ...Object.keys(currentHashes)])
  for (const key of keys) {
    if (record.inputHashes[key] !== currentHashes[key]) return false
  }
  return true
}

export type RepairPacketContext =
  | ImplementationPacket
  | { setupAction: string; outcome: 'failed-setup' }

export function buildRepairPacketContext(input: {
  record: VerificationRecord
  manifest: ModuleManifest
  architectureVersion: string
  architectureHash: string
}): RepairPacketContext {
  if (input.record.outcome === 'failed-setup') {
    return {
      setupAction: 'Install dependencies and re-run verification suites',
      outcome: 'failed-setup',
    }
  }
  return buildImplementationPacket({
    packetId: `repair-${input.record.verificationId}`,
    projectId: input.record.projectId,
    targetKind: 'module',
    targetId: input.manifest.moduleId,
    manifest: input.manifest,
    architectureVersion: input.architectureVersion,
    architectureHash: input.architectureHash,
    inputHashes: input.record.inputHashes,
    acceptanceCases: [
      {
        id: 'repair',
        description: 'Address verification diagnostics',
        expectedOutcome: 'passed',
      },
    ],
    unchangedBehavior: [
      'Preserve public contracts',
      ...input.record.diagnostics.map((d) => `Fix: ${d.message}`),
    ],
  })
}

export type RunModuleVerificationInput = {
  verificationId: string
  projectId: string
  moduleId: string
  moduleType: ModuleType
  manifest?: ModuleManifest
  inputHashes: Record<string, string>
  /** Injected command results — core does not spawn processes. */
  commands: CommandOutcome[]
  startedAt?: string
  completedAt?: string
  currentHashes?: Record<string, string>
  architectureVersion?: string
  architectureHash?: string
  connectionId?: string
  artifacts?: string[]
}

export type RunModuleVerificationResult = {
  record: VerificationRecord
  eligibleForReady: boolean
  repairContext?: RepairPacketContext
}

/**
 * Build a CAP-CONTRACT-017 record from injected command results, evaluate ready
 * eligibility, and attach scoped repair context when verification did not pass.
 */
export function runModuleVerification(input: RunModuleVerificationInput): RunModuleVerificationResult {
  const startedAt = input.startedAt ?? new Date().toISOString()
  const completedAt = input.completedAt ?? new Date().toISOString()
  const record = buildVerificationRecord({
    verificationId: input.verificationId,
    projectId: input.projectId,
    moduleId: input.moduleId,
    moduleType: input.moduleType,
    manifest: input.manifest,
    inputHashes: input.inputHashes,
    commands: input.commands,
    startedAt,
    completedAt,
    connectionId: input.connectionId,
    artifacts: input.artifacts,
  })
  const eligibleForReady = isEligibleForReady(record, input.currentHashes ?? input.inputHashes)
  let repairContext: RepairPacketContext | undefined
  if (
    record.outcome !== 'passed' &&
    input.manifest &&
    input.architectureVersion &&
    input.architectureHash
  ) {
    repairContext = buildRepairPacketContext({
      record,
      manifest: input.manifest,
      architectureVersion: input.architectureVersion,
      architectureHash: input.architectureHash,
    })
  }
  return { record, eligibleForReady, repairContext }
}
