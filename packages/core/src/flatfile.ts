/**
 * Repo flatfile serialization per
 * `standards/copilot-handoff/contracts/repo-flatfile-contract.md`:
 * a commented header block followed by
 * `===== FILE: <path> ===== … ===== END FILE: <path> =====` sections with
 * repo-relative POSIX paths.
 */

export type FlatfileHeader = {
  packetId: string
  sourceRepo: string
  sourceRoot: string
  baselineCommit: string
  generatedAt: string
  includedFiles: number
  excludedSummary: string
  secretsGuarantee: string
}

export type FlatfileEntry = {
  path: string
  content: string
}

export function serializeFlatfile(header: FlatfileHeader, entries: FlatfileEntry[]): string {
  const lines: string[] = [
    '# Engineering UI Kit Repo Flatfile',
    `# packet_id: ${header.packetId}`,
    `# source_repo: ${header.sourceRepo}`,
    `# source_root: ${header.sourceRoot}`,
    `# baseline_commit: ${header.baselineCommit}`,
    `# generated_at: ${header.generatedAt}`,
    `# included_files: ${header.includedFiles}`,
    `# excluded_summary: ${header.excludedSummary}`,
    `# secrets_guarantee: ${header.secretsGuarantee}`,
    '',
  ]
  for (const entry of entries) {
    lines.push(`===== FILE: ${entry.path} =====`)
    lines.push(entry.content.endsWith('\n') ? entry.content.slice(0, -1) : entry.content)
    lines.push(`===== END FILE: ${entry.path} =====`)
    lines.push('')
  }
  return lines.join('\n')
}

const HEADER_KEYS: Record<string, keyof FlatfileHeader> = {
  packet_id: 'packetId',
  source_repo: 'sourceRepo',
  source_root: 'sourceRoot',
  baseline_commit: 'baselineCommit',
  generated_at: 'generatedAt',
  included_files: 'includedFiles',
  excluded_summary: 'excludedSummary',
  secrets_guarantee: 'secretsGuarantee',
}

export function parseFlatfile(text: string): { header: Partial<FlatfileHeader>; entries: FlatfileEntry[] } {
  const header: Partial<FlatfileHeader> = {}
  for (const line of text.split('\n')) {
    if (!line.startsWith('#')) {
      if (line.startsWith('=====')) break
      continue
    }
    const m = line.match(/^# ([a-z_]+): (.*)$/)
    if (m && m[1] && m[1] in HEADER_KEYS) {
      const key = HEADER_KEYS[m[1]]!
      const value = m[2] ?? ''
      if (key === 'includedFiles') {
        header.includedFiles = Number(value)
      } else {
        header[key] = value as never
      }
    }
  }

  const entries: FlatfileEntry[] = []
  const pattern = /^===== FILE: (.+?) =====\n([\s\S]*?)\n===== END FILE: \1 =====$/gm
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    entries.push({ path: match[1]!, content: (match[2] ?? '') + '\n' })
  }
  return { header, entries }
}
