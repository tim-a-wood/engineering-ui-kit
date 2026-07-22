import type { ArchitectureSpecification } from '@engineering-ui-kit/core'

/** Prefer a revised draft while retaining the latest approved architecture otherwise. */
export function architectureForDisplay(architecture: {
  draft?: unknown
  approved?: unknown
}): ArchitectureSpecification | undefined {
  const approved = architecture.approved as ArchitectureSpecification | undefined
  const draft = architecture.draft as ArchitectureSpecification | undefined
  return draft && (!approved || draft.revision !== approved.revision)
    ? draft
    : approved ?? draft
}
