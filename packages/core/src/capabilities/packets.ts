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
import {
  assertSteProfile,
  checkSteEntries,
  withStePrompt,
  type SteCheckResult,
  type SteLexicon,
} from './simplifiedTechnicalEnglish.js'

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
  /** Project-selected vocabulary and preferred terms. */
  steLexicon?: SteLexicon
}

const HANDOFF_INTRODUCTIONS = {
  interview: [
    'This file contains the complete definition handoff.',
    'Start with a draft review of the supplied context.',
    'Return the JSON response after the user accepts or corrects the material assumptions.',
  ],
  implementation: [
    'This file contains an implementation task.',
    'The capability packet and supporting records contain input requirements.',
    'Implement production source code and tests.',
    'Return the code overlay.',
  ],
} as const

const INTERVIEW_OUTPUT_RULES = [
  'Present the proposed brief and compact follow-up prompts as plain text. Do not put them in JSON.',
  'Do not use a serial field-by-field interview. Group material decisions for one review.',
  'Return only the specified JSON file after the definition is complete.',
  'Use the top-level shape in the response template.',
  'Replace each placeholder with interview content.',
  'Do not invent wrapper keys.',
  'Do not omit required keys. Use empty arrays only when the interview confirms that no items exist.',
]

const IMPLEMENTATION_OUTPUT_RULES = [
  'Return exactly one specified ZIP file.',
  'Put only changed and new implementation files in the ZIP. Use repository-relative paths without a wrapper directory.',
  'Inspect the live repository paths and pattern files before coding. Preserve compatible project conventions.',
  'Use approved behavior first. Use repository conventions second. Use reference architecture defaults only when the other sources are silent.',
  'Trace source code and automated tests to approved operations, answers, rules, and acceptance case IDs.',
  'Implement working source code and the required tests. Do not return a metadata restatement.',
  'Do not put input records or an explanatory summary in the ZIP.',
  'Keep every ZIP entry inside the allowed paths and outside the protected or excluded paths.',
  'Preserve unrelated files and behavior. Exclude unchanged files, dependencies, build output, caches, credentials, and secrets.',
  'Complete the required tests before you make the ZIP. Ask for missing source context when safe implementation is not possible.',
]

const CAPABILITY_HANDOFF_TECHNICAL_TERMS = [
  'acceptance case',
  'application',
  'architecture',
  'capability',
  'capability packet',
  'delta packet',
  'handoff',
  'implementation brief',
  'implementation plan',
  'implementation wave',
  'module',
  'operation',
  'operation contract',
  'overlay',
  'repository',
  'result manifest',
  'review packet',
  'scenario step',
  'source code',
  'task packet',
  'test',
  'user interface',
  'use case',
  'verification',
  'verification plan',
  'ZIP',
] as const

/** Apply one current STE policy block to a capability handoff prompt. */
export function buildCapabilityHandoffPrompt(
  prompt: string,
  lexicon?: SteLexicon,
): string {
  return withStePrompt(prompt, {
    technicalTerms: [
      ...CAPABILITY_HANDOFF_TECHNICAL_TERMS,
      ...(lexicon?.technicalTerms ?? []),
    ],
    prohibitedAliases: lexicon?.prohibitedAliases,
  })
}

/** Check the human-facing prose that surrounds a capability handoff payload. */
export function evaluateCapabilityHandoffShellSte(
  kind: CapabilityHandoffMarkdownInput['kind'],
  lexicon?: SteLexicon,
): SteCheckResult {
  const isInterview = kind === 'interview'
  const introduction = isInterview
    ? HANDOFF_INTRODUCTIONS.interview
    : HANDOFF_INTRODUCTIONS.implementation
  const rules = isInterview ? INTERVIEW_OUTPUT_RULES : IMPLEMENTATION_OUTPUT_RULES
  return checkSteEntries([
    ...introduction.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `introduction.${index}`,
    })),
    ...rules.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `deliverable.rules.${index}`,
    })),
    {
      text: isInterview
        ? 'Use this JSON shape for the final response.'
        : 'Use this record to implement the module. Do not return, rewrite, or wrap this record as the result.',
      textClass: 'instruction',
      fieldPath: 'attachedRecord.instruction',
    },
  ], { lexicon })
}

/**
 * Render one self-contained Copilot handoff without conflating supporting JSON
 * with the requested deliverable. Interviews return their response template;
 * implementation and delta work return changed source files in ui-overlay.zip.
 */
export function buildCapabilityHandoffMarkdown(input: CapabilityHandoffMarkdownInput): string {
  const isInterview = input.kind === 'interview'
  const packetJson = JSON.stringify(input.packet, null, 2)
  const packetTerms = isInterview
    ? (input.packet as InterviewPacket).inputContext.glossary.map((item) => item.text)
    : []
  const promptLexicon = input.steLexicon || packetTerms.length
    ? {
        ...input.steLexicon,
        technicalTerms: [
          ...(input.steLexicon?.technicalTerms ?? []),
          ...packetTerms,
        ],
      }
    : undefined
  const recommendedPrompt = buildCapabilityHandoffPrompt(
    input.recommendedPrompt,
    promptLexicon,
  )
  const deliverable = isInterview
    ? (input.packet as InterviewPacket).outputFileName
    : (input.packet as ImplementationPacket).requiredOutput
  const attachedRecord = isInterview ? input.responseTemplate : input.supportingRecord
  const attachedSection = attachedRecord
    ? `\n## ${isInterview ? 'Response template' : 'Supporting context'}\n\nFile: \`${attachedRecord.fileName}\`\n\n${isInterview ? 'Use this JSON shape for the final response.' : 'Use this record to implement the module. Do not return, rewrite, or wrap this record as the result.'}\n\n\`\`\`json\n${JSON.stringify(attachedRecord.value, null, 2)}\n\`\`\`\n`
    : ''
  const introduction = (
    isInterview
      ? HANDOFF_INTRODUCTIONS.interview
      : HANDOFF_INTRODUCTIONS.implementation
  ).join(' ')
  const outputRules = isInterview
    ? [
        ...INTERVIEW_OUTPUT_RULES.slice(0, 2),
        `Return only the JSON file named \`${deliverable}\` after the definition is complete.`,
        ...INTERVIEW_OUTPUT_RULES.slice(3),
      ].map((rule) => `- ${rule}`).join('\n')
    : [
        `Return exactly one file named \`${deliverable}\`.`,
        ...IMPLEMENTATION_OUTPUT_RULES.slice(1, 6),
        'Do not include `module-manifest.json`, `implementation-context.json`, `module-implementation-brief.json`, `delta-packet.json`, or the capability packet.',
        ...IMPLEMENTATION_OUTPUT_RULES.slice(7),
      ].map((rule) => `- ${rule}`).join('\n')

  const markdown = `# Copilot capability handoff

${introduction}

## Request

${recommendedPrompt}

## Deliverable

${outputRules}

## Capability packet

\`\`\`json
${packetJson}
\`\`\`
${attachedSection}`
  assertSteProfile(
    'Capability handoff',
    evaluateCapabilityHandoffShellSte(input.kind, input.steLexicon),
  )
  return markdown
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
