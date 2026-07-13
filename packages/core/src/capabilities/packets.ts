/**
 * Capability interview/implementation/delta packet builders (CAP-PKT-012/016).
 */

import type {
  DeltaPacket,
  ImplementationPacket,
  InterviewPacket,
  ModuleManifest,
} from './types.js'
import { canonicalHash } from './hash.js'

export function buildInterviewPacket(input: {
  packetId: string
  projectId: string
  interviewKind: string
  gateId: string
  inputContext: InterviewPacket['inputContext']
  interviewBoundary: string
  stateLabels: InterviewPacket['stateLabels']
}): InterviewPacket {
  return {
    schemaVersion: '1.0',
    packetId: input.packetId,
    packetVersion: '1.0',
    projectId: input.projectId,
    interviewKind: input.interviewKind,
    generatedAt: new Date().toISOString(),
    inputContext: input.inputContext,
    interviewBoundary: input.interviewBoundary,
    stateLabels: input.stateLabels,
    outputSchemaRef:
      input.interviewKind === 'architecture'
        ? 'CAP-CONTRACT-002'
        : input.interviewKind === 'module'
          ? 'CAP-CONTRACT-003'
          : 'CAP-CONTRACT-001',
    outputFileName: 'capability-interview-response.json',
    gateId: input.gateId,
    safetyNotes: [
      'Do not include credentials',
      'Do not silently approve proposed facts',
      'Do not implement source code in the interview response',
    ],
  }
}

export function buildImplementationPacket(input: {
  packetId: string
  projectId: string
  targetKind: 'module' | 'connection'
  targetId: string
  manifest: ModuleManifest
  architectureVersion: string
  architectureHash: string
  inputHashes: Record<string, string>
  acceptanceCases: ImplementationPacket['acceptanceCases']
  unchangedBehavior: string[]
}): ImplementationPacket {
  const allowedPaths = input.manifest.ownedPaths.length
    ? input.manifest.ownedPaths
    : [`capabilities/modules/${input.targetId}/`]
  return {
    schemaVersion: '1.0',
    packetId: input.packetId,
    packetVersion: '1.0',
    projectId: input.projectId,
    targetKind: input.targetKind,
    targetId: input.targetId,
    inputHashes: input.inputHashes,
    architectureVersion: input.architectureVersion,
    architectureHash: input.architectureHash,
    allowedPaths,
    expectedPaths: allowedPaths.map((p) => pathJoin(p, 'module.yaml')),
    protectedPaths: [],
    excludedPaths: ['node_modules/', 'dist/', '.git/'],
    requiredTests: input.manifest.verificationSuiteIds,
    acceptanceCases: input.acceptanceCases,
    unchangedBehavior: input.unchangedBehavior,
    requiredOutput: 'ui-overlay.zip',
  }
}

export function buildDeltaPacket(
  base: ImplementationPacket,
  extras: Omit<
    DeltaPacket,
    keyof ImplementationPacket
  >,
): DeltaPacket {
  return { ...base, ...extras }
}

export function packetContentHash(packet: object): string {
  return canonicalHash(packet)
}

function pathJoin(root: string, leaf: string): string {
  return root.endsWith('/') ? `${root}${leaf}` : `${root}/${leaf}`
}
