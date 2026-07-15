/**
 * Generated-file ownership hashing and conflict rules (CAP-ERA-001 §9
 * CAP-CONTRACT-026, §11.1 `ownership.ts`).
 *
 * Pure: hashing uses `canonicalRecordHash` so identical virtual file content
 * always yields the same `contentHash` regardless of how the caller built it.
 * Detecting a modified generated file compares the last-known ownership hash
 * against a caller-supplied current hash (never reads the filesystem itself).
 */

import { canonicalRecordHash } from '../hash.js'
import type { GeneratedOwnershipManifest, GenerationFileChange } from '../types.js'
import { normalizeRepoRelativePath, sortByKey, uniqueSorted } from './paths.js'

/** Deterministic content hash for a virtual generated file's text content. */
export function generatedContentHash(content: string): string {
  return canonicalRecordHash(content)
}

export type OwnershipManifestInput = {
  projectId: string
  filePath: string
  content: string
  generatorVersion: string
  referenceProfileVersion: string
  sourceContractHashes: string[]
  deployableId: string
  moduleIds: string[]
  lastAppliedPlanId: string
  safeToDelete: boolean
}

/** Build a `GeneratedOwnershipManifest` (CAP-CONTRACT-026) for one generated file. */
export function buildOwnershipManifest(input: OwnershipManifestInput): GeneratedOwnershipManifest {
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    filePath: normalizeRepoRelativePath(input.filePath),
    contentHash: generatedContentHash(input.content),
    generatorVersion: input.generatorVersion,
    referenceProfileVersion: input.referenceProfileVersion,
    sourceContractHashes: uniqueSorted(input.sourceContractHashes),
    deployableId: input.deployableId,
    moduleIds: uniqueSorted(input.moduleIds),
    lastAppliedPlanId: input.lastAppliedPlanId,
    safeToDelete: input.safeToDelete,
  }
}

export type OwnershipConflict = {
  path: string
  expectedHash: string
  actualHash: string
}

/**
 * Detect generated files whose current content hash no longer matches the
 * last-recorded ownership hash — i.e. the file was modified outside
 * generation since it was last applied (CAP-CONTRACT-026 invariant).
 *
 * `currentContentHashesByPath` is supplied by the caller (e.g. computed from
 * live repository content via `generatedContentHash`); this function never
 * reads files itself.
 */
export function detectOwnershipConflicts(
  manifests: readonly GeneratedOwnershipManifest[],
  currentContentHashesByPath: Readonly<Record<string, string>>,
): OwnershipConflict[] {
  const conflicts: OwnershipConflict[] = []
  for (const manifest of manifests) {
    const path = normalizeRepoRelativePath(manifest.filePath)
    const actualHash = currentContentHashesByPath[path]
    if (actualHash !== undefined && actualHash !== manifest.contentHash) {
      conflicts.push({ path, expectedHash: manifest.contentHash, actualHash })
    }
  }
  return sortByKey(conflicts, (conflict) => conflict.path)
}

export type RegenerationFilterResult = {
  /** File changes safe to include in the plan. */
  allowed: GenerationFileChange[]
  /** File changes blocked by an unresolved ownership conflict, with the reason. */
  blocked: { path: string; reason: string }[]
}

/**
 * Conflict rule: a generated file with an unresolved ownership conflict blocks
 * regeneration of that file (update/delete). Creation of a not-yet-owned file
 * is never blocked. A path in `resolvedConflictPaths` (an explicit conflict
 * decision was recorded) is no longer blocked.
 */
export function filterRegenerationBlockedChanges(
  fileChanges: readonly GenerationFileChange[],
  conflicts: readonly OwnershipConflict[],
  resolvedConflictPaths: ReadonlySet<string> = new Set(),
): RegenerationFilterResult {
  const conflictedPaths = new Set(
    conflicts.map((conflict) => conflict.path).filter((path) => !resolvedConflictPaths.has(path)),
  )
  const allowed: GenerationFileChange[] = []
  const blocked: { path: string; reason: string }[] = []
  for (const change of fileChanges) {
    const path = normalizeRepoRelativePath(change.path)
    if (change.ownership === 'generated' && change.action !== 'create' && conflictedPaths.has(path)) {
      blocked.push({
        path,
        reason: `generated file was modified since it was last applied; a conflict decision is required before regenerating "${path}"`,
      })
    } else {
      allowed.push({ ...change, path })
    }
  }
  return {
    allowed: sortByKey(allowed, (change) => change.path),
    blocked: sortByKey(blocked, (item) => item.path),
  }
}
