/**
 * Task and standards pack builder.
 *
 * Emits `task-and-standard-pack.md` with the exact section order required by
 * `standards/copilot-handoff/contracts/task-and-standard-pack-contract.md`.
 */

import type { TaskDefinition } from './types.js'

export const REQUIRED_SECTION_ORDER = [
  '## Package Metadata',
  '## Goal',
  '## Scope',
  '## Constraints',
  '## Protected Behavior',
  '## Acceptance Criteria',
  '## References',
  '## Expected Changed Files',
  '## Forbidden Changes',
  '## Required Output',
  '## Verification Expectations',
  '## Source Precedence',
  '## Applicable Rule IDs',
  '## Applicable Component IDs',
  '## Applicable Token Paths and Values',
  '## Approved Guidance',
  '## Rejected Guidance',
  '## Accessibility Requirements',
  '## Standards Excerpts',
  '## Copilot Response Requirements',
] as const

export type BuildPacketOptions = {
  baselineCommit: string
  generatedAt: string
}

export function buildTaskAndStandardPack(task: TaskDefinition, options: BuildPacketOptions): string {
  const lines: string[] = []
  const push = (...items: string[]) => lines.push(...items)

  push('# Task and Standards Pack', '')

  push('## Package Metadata', '')
  push(
    `- packetId: \`${task.packetId}\``,
    `- packetVersion: \`${task.packetVersion}\``,
    `- generatedAt: \`${options.generatedAt}\``,
    `- baselineCommit: \`${options.baselineCommit}\``,
    `- standardsPackage: \`${task.standardsPackage}\``,
    `- standardsVersion: \`${task.standardsVersion}\``,
    `- themePosture: \`${task.themePosture}\``,
    `- variant: \`${task.variant === 'visual' ? 'visual/mockup' : 'text-only'}\``,
    `- targetPackage: \`${task.targetPackage}\``,
    `- targetApplication: \`${task.targetApplication}\``,
  )
  if (task.selectedProjectSample) push(`- selectedProjectSample: \`${task.selectedProjectSample}\``)
  if (task.selectedProjectSamplePath) push(`- selectedProjectSamplePath: \`${task.selectedProjectSamplePath}\``)
  push(
    `- targetAppRoot: \`${task.targetAppRoot}\``,
    `- screen: \`${task.screen}\``,
    `- route: \`${task.route}\``,
  )
  if (task.primaryVisualReference) push(`- primaryVisualReference: \`${task.primaryVisualReference}\``)
  push('- expectedOutput: `ui-overlay.zip`', '')

  push('## Goal', '', task.goal, '')

  push('## Scope', '')
  for (const item of task.scope) push(`- ${item}`)
  push('')

  push('## Constraints', '')
  for (const item of task.constraints) push(`- ${item}`)
  push('')

  push('## Protected Behavior', '')
  task.protectedBehavior.forEach((item, index) => push(`${index + 1}. ${item}`))
  push('')

  push('## Acceptance Criteria', '')
  push('| ID | Criterion | Evidence Method | Blocking |', '|---|---|---|---|')
  for (const ac of task.acceptanceCriteria) {
    push(`| ${ac.id} | ${ac.criterion} | ${ac.evidenceMethod} | ${ac.blocking ? 'yes' : 'no'} |`)
  }
  push('')

  push('## References', '')
  for (const item of task.references) push(`- ${item}`)
  push('')

  push('## Expected Changed Files', '', 'The expected overlay scope is:', '', '```text')
  for (const f of task.expectedChangedFiles) push(f.note ? `${f.path}   # ${f.note}` : f.path)
  push('```', '')
  push('- No other changed file is expected.', '- An overlay entry outside this list is at least a warning.', '')

  push('## Forbidden Changes', '', 'Do not change:', '', '```text')
  for (const f of task.forbiddenChanges) push(f)
  push('```', '')

  push(
    '## Required Output',
    '',
    '- Return one file named `ui-overlay.zip`.',
    '- Include changed and new files only.',
    '- Use paths relative to the target-app root.',
    '- Include no deletion semantics.',
    '- Do not return a full repository.',
    '- Do not claim the overlay was locally verified.',
    '- Preserve every existing visual element in files you modify: inline `<svg>` markup, `<img>` references, buttons, and inputs must survive unless the task explicitly removes them.',
    '- Never elide, summarize, or truncate icon or SVG path data when regenerating a file; copy it through verbatim.',
    '- If a view references an asset you cannot see (listed as excluded in the repo inventory), keep the existing reference untouched; small new image assets (svg/png icons) are permitted in the overlay.',
    '',
  )

  push(
    '## Verification Expectations',
    '',
    'The later human workflow shall run:',
    '',
    '```bash',
    'npm run typecheck',
    'npm run build',
    '```',
    '',
    'Manual verification follows the standards qualitative verification checklist.',
    '',
  )

  push(
    '## Source Precedence',
    '',
    '1. Combined task and standards pack for task scope.',
    '2. Stable-ID standards excerpts and token mappings.',
    '3. Labeled PDF for visual calibration.',
    '4. Repo flatfile for implementation context.',
    '5. No historical chat assumptions.',
    '',
  )

  push('## Applicable Rule IDs', '')
  for (const id of task.applicableRuleIds) push(`- \`${id}\``)
  push('')

  push('## Applicable Component IDs', '')
  for (const id of task.applicableComponentIds) push(`- \`${id}\``)
  push('')

  push('## Applicable Token Paths and Values', '')
  push('| Token path | Resolved value | Required use |', '|---|---|---|')
  for (const row of task.tokenRows) push(`| \`${row.path}\` | \`${row.value}\` | ${row.requiredUse} |`)
  push('')

  push('## Approved Guidance', '')
  for (const item of task.approvedGuidance) push(`- ${item}`)
  push('')

  push('## Rejected Guidance', '')
  for (const item of task.rejectedGuidance) push(`- ${item}`)
  push('')

  push('## Accessibility Requirements', '')
  for (const item of task.accessibilityRequirements) push(`- ${item}`)
  push('')

  push('## Standards Excerpts', '')
  for (const excerpt of task.standardsExcerpts) {
    push(`### ${excerpt.id} — ${excerpt.title}`, '', excerpt.body, '', `Source: \`${excerpt.source}\``)
  }
  push('')

  push(
    '## Copilot Response Requirements',
    '',
    '- Inspect all uploaded files before proposing changes.',
    '- Report missing or conflicting information rather than guessing.',
    '- Keep changes inside expected scope.',
    '- Return only `ui-overlay.zip` as the file artifact.',
    '- Mention any limitation in response text.',
    '- Do not claim local verification.',
    '- Do not include dependencies, build output, source repository snapshots, or secrets.',
    '',
  )

  return lines.join('\n')
}

/** Verify a built pack contains every required section heading in order. */
export function verifySectionOrder(packText: string): { ok: boolean; missing: string[]; outOfOrder: string[] } {
  const missing: string[] = []
  const outOfOrder: string[] = []
  let cursor = -1
  for (const heading of REQUIRED_SECTION_ORDER) {
    const index = packText.indexOf(`\n${heading}\n`)
    if (index === -1) {
      missing.push(heading)
      continue
    }
    if (index < cursor) outOfOrder.push(heading)
    cursor = index
  }
  return { ok: missing.length === 0 && outOfOrder.length === 0, missing, outOfOrder }
}
