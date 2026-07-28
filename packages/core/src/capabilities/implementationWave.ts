import {
  evaluateImplementationBriefSte,
  type ModuleImplementationBrief,
} from './implementationBrief.js'
import type { ImplementationPacket } from './types.js'
import {
  assertSteProfile,
  buildStePromptRules,
  checkSteEntries,
  type SteCheckResult,
  type SteLexicon,
} from './simplifiedTechnicalEnglish.js'

export type ImplementationWaveHandoffTarget = {
  runId: string
  moduleId: string
  name: string
  packet: ImplementationPacket
  brief: ModuleImplementationBrief
}

export type ImplementationWaveResultManifest = {
  schemaVersion: '1.0'
  groupId: string
  waveIndex: number
  results: {
    runId: string
    moduleId: string
    deliverable: string
    allowedPaths: string[]
  }[]
}

export function implementationWaveDeliverable(moduleId: string): string {
  const segment = moduleId
    .replace(/^mod\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'module'
  return `ui-overlay-${segment}.zip`
}

const IMPLEMENTATION_WAVE_INTRO = [
  'Implement the independent targets below in one working session.',
  'Treat every target as a separate evidence scope.',
]

const IMPLEMENTATION_WAVE_RULES = [
  'Inspect the live repository before editing. Preserve its compatible conventions.',
  'Keep every target inside its own allowed paths. Do not move behavior between target scopes.',
  'Honor approved operation boundaries and dependency direction. Do not import another module’s internals.',
  'Implement production source code and tests. Do not restate the brief as metadata.',
  'Run the configured verification commands after all target-specific tests.',
  'Return exactly one ZIP per target. Use the filename in the result manifest.',
  'Put only repository-relative changed files for that target in each ZIP.',
  'If one target is blocked, finish the safe targets. Report the blocked target and do not invent a design decision.',
]

/** Check the human-facing prose that surrounds the structured wave payload. */
export function evaluateImplementationWaveHandoffSte(
  targets: readonly Pick<ImplementationWaveHandoffTarget, 'name'>[],
  lexicon?: SteLexicon,
): SteCheckResult {
  return checkSteEntries([
    ...IMPLEMENTATION_WAVE_INTRO.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `intro.${index}`,
    })),
    ...IMPLEMENTATION_WAVE_RULES.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `rules.${index}`,
    })),
    ...targets.map((target, index) => ({
      text: target.name,
      textClass: 'technical-name' as const,
      fieldPath: `targets.${index}.name`,
    })),
  ], { lexicon })
}

/**
 * Builds one self-contained implementation handoff for independent targets.
 * Every target retains its own run identity, path scope, result ZIP, and later
 * inspection/verification evidence.
 */
export function buildImplementationWaveHandoffMarkdown(input: {
  groupId: string
  projectId: string
  waveIndex: number
  targets: ImplementationWaveHandoffTarget[]
  steLexicon?: SteLexicon
}): {
  markdown: string
  resultManifest: ImplementationWaveResultManifest
} {
  if (input.targets.length === 0) throw new Error('implementation wave needs at least one target')
  for (const target of input.targets) {
    assertSteProfile(
      `Implementation brief for ${target.moduleId}`,
      evaluateImplementationBriefSte(target.brief, input.steLexicon),
    )
  }
  const resultManifest: ImplementationWaveResultManifest = {
    schemaVersion: '1.0',
    groupId: input.groupId,
    waveIndex: input.waveIndex,
    results: input.targets.map((target) => ({
      runId: target.runId,
      moduleId: target.moduleId,
      deliverable: implementationWaveDeliverable(target.moduleId),
      allowedPaths: target.packet.allowedPaths,
    })),
  }
  const targetSections = input.targets.map((target, index) => {
    const result = resultManifest.results[index]!
    return `## ${target.name}

- Target: ${index + 1}
- Module ID: \`${target.moduleId}\`
- Run ID: \`${target.runId}\`
- Required result: \`${result.deliverable}\`
- Scope: ${target.packet.allowedPaths.map((value) => `\`${value}\``).join(', ')}

### Capability packet

\`\`\`json
${JSON.stringify(target.packet, null, 2)}
\`\`\`

### Implementation brief

\`\`\`json
${JSON.stringify(target.brief, null, 2)}
\`\`\``
  }).join('\n\n')

  const markdown = `# Implementation wave

${IMPLEMENTATION_WAVE_INTRO.join(' ')}

## Rules

- Apply this writing policy to source-code text, documents, user-interface text, names, and diagram labels:

${buildStePromptRules({
  technicalTerms: [
    'application',
    'architecture',
    'capability packet',
    'implementation brief',
    'implementation wave',
    'module',
    'repository',
    'result manifest',
    'source code',
    'verification',
    'ZIP',
    ...(input.steLexicon?.technicalTerms ?? []),
  ],
  prohibitedAliases: input.steLexicon?.prohibitedAliases,
})}

${IMPLEMENTATION_WAVE_RULES.map((rule) => `- ${rule}`).join('\n')}

## Result manifest

\`\`\`json
${JSON.stringify(resultManifest, null, 2)}
\`\`\`

${targetSections}
`
  assertSteProfile(
    'Implementation wave handoff',
    evaluateImplementationWaveHandoffSte(input.targets, input.steLexicon),
  )
  return { markdown, resultManifest }
}
