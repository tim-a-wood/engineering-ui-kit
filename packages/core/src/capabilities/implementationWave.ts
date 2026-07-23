import type { ModuleImplementationBrief } from './implementationBrief.js'
import type { ImplementationPacket } from './types.js'

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
}): {
  markdown: string
  resultManifest: ImplementationWaveResultManifest
} {
  if (input.targets.length === 0) throw new Error('implementation wave needs at least one target')
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
    return `## Target ${index + 1}: ${target.name} (${target.moduleId})

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

  const markdown = `# Capability implementation wave ${input.waveIndex}

Implement the ${input.targets.length} independent targets below in one working session. Treat every target as a separate evidence scope even when you share repository inspection or verification setup.

## Rules

- Inspect the live repository before editing and preserve its compatible conventions.
- Keep every target inside its own allowed paths. Do not move behavior between target scopes.
- Honor approved operation boundaries and dependency direction; do not import another module's internals.
- Implement production source code and tests, not metadata or a restatement of the brief.
- Run the configured verification commands after all target-specific tests.
- Return exactly one ZIP per target using the filenames in the result manifest.
- Each ZIP must contain repository-relative changed files for only that target, with no wrapper directory.
- If one target is blocked, finish the safe targets and report that target as blocked instead of inventing a design decision.

## Result manifest

\`\`\`json
${JSON.stringify(resultManifest, null, 2)}
\`\`\`

${targetSections}
`
  return { markdown, resultManifest }
}
