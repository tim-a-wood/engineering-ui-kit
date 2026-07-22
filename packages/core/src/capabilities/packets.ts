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
  const explicitFiles = allowedPaths.filter((value) => /\.[a-z0-9]+$/i.test(value.split('/').pop() ?? ''))
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
    // Most module ownership entries are directories. Treat only explicit file
    // paths as exact overlay expectations; invented module.yaml paths cause every
    // real source file in a returned implementation to be flagged as unexpected.
    expectedPaths: explicitFiles,
    protectedPaths: [],
    excludedPaths: ['node_modules/', 'dist/', '.git/'],
    requiredTests: input.manifest.verificationSuiteIds,
    acceptanceCases: input.acceptanceCases,
    unchangedBehavior: input.unchangedBehavior,
    requiredOutput: 'ui-overlay.zip',
  }
}

export type CapabilityHandoffMarkdownInput = {
  kind: 'interview' | 'implementation' | 'delta'
  packet: InterviewPacket | ImplementationPacket | DeltaPacket
  recommendedPrompt: string
  /** Interview-only JSON shape that Copilot must return after the conversation. */
  responseTemplate?: { fileName: string; value: unknown }
  /** Read-only context for implementation/delta work; never an output template. */
  supportingRecord?: { fileName: string; value: unknown }
}

/**
 * Render one self-contained Copilot handoff without conflating supporting JSON
 * with the requested deliverable. Interviews return their response template;
 * implementation and delta work return changed source files in ui-overlay.zip.
 */
export function buildCapabilityHandoffMarkdown(input: CapabilityHandoffMarkdownInput): string {
  const isInterview = input.kind === 'interview'
  const packetJson = JSON.stringify(input.packet, null, 2)
  const deliverable = isInterview
    ? (input.packet as InterviewPacket).outputFileName
    : (input.packet as ImplementationPacket).requiredOutput
  const attachedRecord = isInterview ? input.responseTemplate : input.supportingRecord
  const attachedSection = attachedRecord
    ? `\n## ${isInterview ? `Required response template: ${attachedRecord.fileName}` : `Supporting context (input only): ${attachedRecord.fileName}`}\n\n${isInterview ? 'Use this JSON shape for the final response.' : 'Use this record to implement the module. Do not return, rewrite, or wrap this record as the result.'}\n\n\`\`\`json\n${JSON.stringify(attachedRecord.value, null, 2)}\n\`\`\`\n`
    : ''
  const introduction = isInterview
    ? 'This is the complete definition handoff. Start with a draft-first confirmation using the supplied context, then produce the requested JSON response only after the user accepts or corrects the material assumptions.'
    : 'This is an implementation task. The embedded capability packet and supporting records are input requirements, not response templates. Implement production source code and tests, then return the code overlay.'
  const outputRules = isInterview
    ? `- During the review, present the proposed brief and any compact follow-up prompts as plain conversation; do not wrap them in JSON.
- Do not conduct a serial field-by-field questionnaire. Group material decisions so the user can accept or correct them together.
- After the definition completion rules are satisfied, return only the JSON file named ${deliverable}.
- Use exactly the top-level shape shown in the required response template.
- Replace every “Replace with…” placeholder with interview content.
- Do not invent wrapper keys such as productDefinition, confirmedRequirements, or gate.
- Do not omit required keys. Use empty arrays only when the interview confirms there are no items.`
    : `- Return exactly one file named ${deliverable}.
- ${deliverable} must be a ZIP containing only changed and new implementation files, using repository-relative paths with no wrapper directory.
- Before coding, inspect the live repository paths and existing pattern files named in the implementation brief; follow established project conventions where they preserve the approved boundaries.
- Apply the brief’s precedence rules: approved behavior first, repository conventions second, and reference-architecture defaults where both are silent.
- Trace implementation and automated tests to the approved operation boundaries, detail answers, rules, and acceptance-case IDs.
- Implement working source code and the required tests; metadata, a manifest, a packet, prose, or a JSON restatement is not an implementation.
- Do not include module-manifest.json, implementation-context.json, module-implementation-brief.json, delta-packet.json, the capability packet, or any explanatory summary in the ZIP.
- Every ZIP entry must stay within allowedPaths and outside protectedPaths/excludedPaths from the capability packet.
- Preserve unrelated files and behavior. Do not include unchanged files, dependencies, build output, caches, credentials, or secrets.
- Complete the required tests before producing the ZIP; if the supplied context is insufficient for safe implementation, ask for the missing source context instead of returning an input record.`

  return `# Copilot capability handoff

${introduction}

## Request

${input.recommendedPrompt}

## Deliverable

${outputRules}

## Capability packet (input requirements)

\`\`\`json
${packetJson}
\`\`\`
${attachedSection}`
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
