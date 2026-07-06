export type TaskSectionKey =
  | 'goal'
  | 'scope'
  | 'constraints'
  | 'acceptanceCriteria'
  | 'references'

export type TaskSection = {
  key: TaskSectionKey
  title: string
  description: string
  value: string
  required: boolean
}

export type TaskPacketState = Record<TaskSectionKey, string>

export type ValidationResult = {
  valid: boolean
  messages: string[]
  emptyRequiredKeys: TaskSectionKey[]
}

export const APPLICATION = {
  name: 'UI Overlay',
  sourceRoot: 'trials/vertical-slice-01/target-app',
} as const

// Fixed sample data shown inside UI Overlay; this is not the application identity.
export const PROJECT = {
  name: 'signal-analyzer-refresh',
  path: 'C:\\work\\signal-analyzer-refresh',
} as const

export const WORKFLOW_STEPS = [
  'Prepare Context',
  'Create Task Packet',
  'Run in Copilot',
  'Apply Zip Overlay',
  'Verify & Review',
] as const

export const CURRENT_WORKFLOW_STEP = 1

export const NAV_ITEMS = [
  'Copilot Handoff',
  'Recipes',
  'Components',
  'Projects',
  'Settings',
] as const

export const SECTION_META: Array<{
  key: TaskSectionKey
  title: string
  description: string
  required: boolean
}> = [
  {
    key: 'goal',
    title: 'Goal',
    description: 'What you want to achieve',
    required: true,
  },
  {
    key: 'scope',
    title: 'Scope',
    description: 'Screens, features, or areas in scope',
    required: true,
  },
  {
    key: 'constraints',
    title: 'Constraints',
    description: 'What not to change, technical limits, etc.',
    required: true,
  },
  {
    key: 'acceptanceCriteria',
    title: 'Acceptance Criteria',
    description: 'How success will be measured',
    required: true,
  },
  {
    key: 'references',
    title: 'References',
    description: 'Specs, designs, screenshots, examples',
    required: true,
  },
]

export const SAMPLE_TASK_PACKET: TaskPacketState = {
  goal: "Refresh UI Overlay's Create Task Packet screen to match Engineering UI Kit dark-first standards while preserving all existing domain behavior.",
  scope: 'Only the UI Overlay Create Task Packet screen in trials/vertical-slice-01/target-app/. The displayed signal-analyzer-refresh project is fixed sample data, not the application being redesigned. Limit changes to presentation, layout, and styling files listed in the task packet.',
  constraints: 'Do not change task-packet serialization, validation rules, export filename, or protected interactions. Do not add routers, state libraries, component libraries, or network calls.',
  acceptanceCriteria: 'Build and typecheck pass. Edit/Save/Cancel, preview dialog, Escape/Close focus return, and export of task-packet.md continue to work. Dark-first shell, workflow stepper, semantic tokens, and keyboard accessibility are present.',
  references: 'Primary visual reference: project-sources/visual-references/1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg. Applicable standards and component IDs are listed in trials/vertical-slice-01/target-selection.md.',
}

export function createInitialTaskPacket(): TaskPacketState {
  return { ...SAMPLE_TASK_PACKET }
}

export function validateTaskPacket(packet: TaskPacketState): ValidationResult {
  const emptyRequiredKeys = SECTION_META.filter(
    (section) => section.required && packet[section.key].trim().length === 0,
  ).map((section) => section.key)

  const messages = emptyRequiredKeys.map((key) => {
    const title = SECTION_META.find((section) => section.key === key)?.title ?? key
    return `${title} is required.`
  })

  return {
    valid: emptyRequiredKeys.length === 0,
    messages,
    emptyRequiredKeys,
  }
}

export function serializeTaskPacketMarkdown(packet: TaskPacketState): string {
  const lines = [
    '# Task Packet',
    '',
    `Application: ${APPLICATION.name}`,
    `Application source: ${APPLICATION.sourceRoot}`,
    `Selected project (sample): ${PROJECT.name}`,
    `Selected project path (sample): ${PROJECT.path}`,
    '',
    '## Goal',
    '',
    packet.goal.trim() || '_(empty)_',
    '',
    '## Scope',
    '',
    packet.scope.trim() || '_(empty)_',
    '',
    '## Constraints',
    '',
    packet.constraints.trim() || '_(empty)_',
    '',
    '## Acceptance Criteria',
    '',
    packet.acceptanceCriteria.trim() || '_(empty)_',
    '',
    '## References',
    '',
    packet.references.trim() || '_(empty)_',
    '',
  ]

  return lines.join('\n')
}

export function downloadTaskPacket(packet: TaskPacketState): void {
  const markdown = serializeTaskPacketMarkdown(packet)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'task-packet.md'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
