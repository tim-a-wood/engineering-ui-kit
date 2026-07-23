export type TaskIntentRequirement = 'required' | 'forbidden' | 'existing' | 'preserve' | 'unspecified'

export type TaskIntentProfile = {
  delivery: 'frontend-only' | 'existing-api-ui' | 'full-app' | 'document-only' | 'iteration' | 'preserve-existing' | 'unspecified'
  backend: TaskIntentRequirement
  network: TaskIntentRequirement
  persistence: TaskIntentRequirement
  filesystem: TaskIntentRequirement
}

export type TaskPacketLintFields = {
  taskTitle: string
  goal: string
  scope: string
  constraints: string
  acceptanceCriteria: string
  references: string
  intentProfile?: TaskIntentProfile
}

export type TaskPacketDiagnostic = {
  code: string
  severity: 'blocker' | 'warning'
  section: keyof Omit<TaskPacketLintFields, 'intentProfile'> | 'packet'
  message: string
  evidence?: string
}

export type TaskPacketLintResult = {
  valid: boolean
  diagnostics: TaskPacketDiagnostic[]
}

const REQUIRED_SECTIONS: (keyof Omit<TaskPacketLintFields, 'intentProfile'>)[] = [
  'taskTitle',
  'goal',
  'scope',
  'constraints',
  'acceptanceCriteria',
]

const PLACEHOLDER_PATTERNS = [
  /\bREPLACE\s*:/i,
  /\bTODO\s*:/i,
  /\bTBD\b/i,
  /\bfill (?:this|in)\b/i,
  /\bpaste or link\b/i,
]

const FORBIDDEN_PATTERNS: Record<'backend' | 'network' | 'persistence' | 'filesystem', RegExp[]> = {
  backend: [/\bno\b[^\n.]{0,120}\b(?:backend|server)\b/i, /\bfrontend only\b/i, /\bdo not (?:create|modify|use) (?:a |the )?(?:backend|server)\b/i],
  network: [/\bno\b[^\n.]{0,120}\b(?:network|http)\b/i, /\bno (?:network|http) requests?\b/i, /\boffline only\b/i],
  persistence: [/\bno\b[^\n.]{0,120}\bpersistence\b/i, /\bdo not persist\b/i, /\blocal (?:react )?state only\b/i],
  filesystem: [/\bno\b[^\n.]{0,120}\b(?:file ?system|filesystem)\b/i, /\bdo not (?:read|write|access) (?:the )?file ?system\b/i],
}

const REQUIRED_PATTERNS: Record<'backend' | 'network' | 'persistence' | 'filesystem', RegExp[]> = {
  backend: [/\b(?:build|implement|include|requires?) (?:a |the )?(?:backend|server|API)\b/i, /\bfrontend\s*[+/&]\s*backend\b/i],
  network: [/\bconsume(?:s)? (?:the |an )?(?:API|endpoint)\b/i, /\bnetwork requests?\b/i, /\btyped JSON API\b/i],
  persistence: [/\b(?:file-based |local )?persistence\b/i, /\bpersist(?:ed|ence)?\b/i, /\bstored? (?:data|records)\b/i],
  filesystem: [/\bfile-based persistence\b/i, /\b(?:read|write|scan|store).{0,24}\bfiles?\b/i, /\bfilesystem\b/i],
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[0]) return match[0]
  }
  return undefined
}

function inferredRequired(
  key: keyof typeof REQUIRED_PATTERNS,
  intentText: string,
  profile: TaskIntentProfile | undefined,
): string | undefined {
  if (profile?.[key] === 'required') return `intentProfile.${key}=required`
  return firstMatch(intentText, REQUIRED_PATTERNS[key])
}

function inferredForbidden(
  key: keyof typeof FORBIDDEN_PATTERNS,
  constraints: string,
  profile: TaskIntentProfile | undefined,
): string | undefined {
  if (profile?.[key] === 'forbidden') return `intentProfile.${key}=forbidden`
  return firstMatch(constraints, FORBIDDEN_PATTERNS[key])
}

/** Deterministic export gate. Advisory LLM checks may add warnings but never replace these rules. */
export function lintTaskPacket(fields: TaskPacketLintFields): TaskPacketLintResult {
  const diagnostics: TaskPacketDiagnostic[] = []
  for (const section of REQUIRED_SECTIONS) {
    if (!fields[section].trim()) {
      diagnostics.push({
        code: 'PACKET-REQUIRED-001',
        severity: 'blocker',
        section,
        message: `${section} is required.`,
      })
    }
  }

  const textSections = Object.entries(fields)
    .filter((entry): entry is [keyof Omit<TaskPacketLintFields, 'intentProfile'>, string] =>
      entry[0] !== 'intentProfile' && typeof entry[1] === 'string')
  for (const [section, text] of textSections) {
    const placeholder = firstMatch(text, PLACEHOLDER_PATTERNS)
    if (placeholder) {
      diagnostics.push({
        code: 'PACKET-PLACEHOLDER-001',
        severity: 'blocker',
        section,
        message: `Replace unresolved template text in ${section} before export.`,
        evidence: placeholder,
      })
    }
  }

  const intentText = `${fields.taskTitle}\n${fields.goal}\n${fields.scope}\n${fields.acceptanceCriteria}`
  for (const key of ['backend', 'network', 'persistence', 'filesystem'] as const) {
    const required = inferredRequired(key, intentText, fields.intentProfile)
    const forbidden = inferredForbidden(key, fields.constraints, fields.intentProfile)
    if (required && forbidden) {
      diagnostics.push({
        code: 'PACKET-CONTRADICTION-001',
        severity: 'blocker',
        section: 'constraints',
        message: `The task requires ${key}, but the constraints forbid it. Resolve the implementation boundary before export.`,
        evidence: `${required} ↔ ${forbidden}`,
      })
    }
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== 'blocker'),
    diagnostics,
  }
}
