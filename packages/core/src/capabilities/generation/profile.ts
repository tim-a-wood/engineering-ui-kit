/**
 * Reference-architecture profile selection and compatibility (CAP-ERA-001 §9
 * CAP-CONTRACT-023, §11.1 `profile.ts`).
 *
 * Pure and filesystem-independent: callers supply the candidate profile
 * records; this module never reads them from disk.
 */

import { canonicalRecordHash } from '../hash.js'
import type { ReferenceArchitectureProfile } from '../types.js'
import { ordinalCompare } from './paths.js'

/** A version specifier that names exactly one version (no range operator, no floating tag). */
export function isExactVersionSpecifier(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  if (/^(latest|\*)$/i.test(trimmed)) return false
  // Range/floating operators forbidden anywhere in the specifier: ^ ~ * x X > < = (as a
  // comparator prefix) and comma/space-separated range lists.
  if (/[\^~*]/.test(trimmed)) return false
  if (/^(>=|<=|>|<|=)/.test(trimmed)) return false
  if (/\s|\|\||,/.test(trimmed)) return false
  return true
}

/** Minimal numeric version compare: dot-separated numeric parts, missing parts treated as 0. */
function compareVersionParts(a: string, b: string): number {
  const partsA = a.split('.').map((part) => Number.parseInt(part, 10))
  const partsB = b.split('.').map((part) => Number.parseInt(part, 10))
  const length = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < length; i++) {
    const numA = Number.isFinite(partsA[i]) ? (partsA[i] as number) : 0
    const numB = Number.isFinite(partsB[i]) ? (partsB[i] as number) : 0
    if (numA !== numB) return numA - numB
  }
  return 0
}

type RangeClause = { operator: '>=' | '<=' | '>' | '<' | '='; version: string }

function parseRangeClause(clause: string): RangeClause | undefined {
  const match = /^(>=|<=|>|<|=)?\s*([0-9][0-9A-Za-z.\-+]*)$/.exec(clause.trim())
  if (!match) return undefined
  const operator = (match[1] as RangeClause['operator'] | undefined) ?? '='
  return { operator, version: match[2] as string }
}

/**
 * Evaluate a whitespace-separated AND-combined semver-like range (for example
 * `>=0.1.0 <0.2.0` or `>=22`) against a concrete version. Unrecognized clauses
 * fail closed (return `false`) rather than silently passing.
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  const clauses = range.trim().split(/\s+/).filter(Boolean)
  if (clauses.length === 0) return false
  for (const raw of clauses) {
    const clause = parseRangeClause(raw)
    if (!clause) return false
    const cmp = compareVersionParts(version, clause.version)
    const ok =
      clause.operator === '>=' ? cmp >= 0
      : clause.operator === '<=' ? cmp <= 0
      : clause.operator === '>' ? cmp > 0
      : clause.operator === '<' ? cmp < 0
      : cmp === 0
    if (!ok) return false
  }
  return true
}

export type ProfileSelectionCriteria = {
  profileId: string
  /** Exact profile version to select; when omitted, the highest available version is used. */
  profileVersion?: string
}

/**
 * Select a profile by id (and optionally exact version) from a candidate set.
 * Throws when no candidate matches — profile selection is never silently ambiguous.
 */
export function selectReferenceArchitectureProfile(
  profiles: readonly ReferenceArchitectureProfile[],
  criteria: ProfileSelectionCriteria,
): ReferenceArchitectureProfile {
  const candidates = profiles.filter((profile) => profile.profileId === criteria.profileId)
  if (candidates.length === 0) {
    throw new Error(`no reference-architecture profile registered for profileId "${criteria.profileId}"`)
  }
  if (criteria.profileVersion !== undefined) {
    const exact = candidates.find((profile) => profile.profileVersion === criteria.profileVersion)
    if (!exact) {
      throw new Error(
        `profile "${criteria.profileId}" has no version "${criteria.profileVersion}"; available: ${candidates
          .map((profile) => profile.profileVersion)
          .sort(ordinalCompare)
          .join(', ')}`,
      )
    }
    return exact
  }
  return [...candidates].sort((a, b) => compareVersionParts(b.profileVersion, a.profileVersion))[0] as ReferenceArchitectureProfile
}

/**
 * Assert that `generatorVersion` is within the profile's declared compatibility
 * range (CAP-CONTRACT-023 "generator version and compatibility range").
 */
export function assertGeneratorCompatible(profile: ReferenceArchitectureProfile, generatorVersion: string): void {
  if (!satisfiesVersionRange(generatorVersion, profile.generatorCompatibilityRange)) {
    throw new Error(
      `generator ${generatorVersion} is not compatible with profile "${profile.profileId}@${profile.profileVersion}" `
      + `(requires ${profile.generatorCompatibilityRange})`,
    )
  }
}

export type ProfileIntegrityResult = {
  valid: boolean
  expectedContentHash: string
  actualContentHash: string
}

/**
 * Validate the CAP-CONTRACT-023 invariant that a profile is immutable at a
 * given `profileId`/`profileVersion`: its `contentHash` must equal the
 * canonical hash of every other field.
 */
export function validateProfileIntegrity(profile: ReferenceArchitectureProfile): ProfileIntegrityResult {
  const { contentHash, ...rest } = profile
  const expectedContentHash = canonicalRecordHash(rest)
  return {
    valid: expectedContentHash === contentHash,
    expectedContentHash,
    actualContentHash: contentHash,
  }
}

/**
 * Assert every declared runtime-package coordinate uses an exact, pinned
 * version (CAP-ERA-001 §5.3: "the generator MUST NOT use floating `latest`
 * dependencies").
 */
export function assertProfileRuntimePackagesPinned(profile: ReferenceArchitectureProfile): void {
  for (const coordinate of profile.runtimePackageCoordinates) {
    if (coordinate.pinnedVersionPolicy !== 'exact') {
      throw new Error(
        `profile "${profile.profileId}@${profile.profileVersion}" runtime package "${coordinate.packageName}" `
        + `declares pinnedVersionPolicy "${coordinate.pinnedVersionPolicy}"; only "exact" is permitted`,
      )
    }
    if (!isExactVersionSpecifier(coordinate.version)) {
      throw new Error(
        `profile "${profile.profileId}@${profile.profileVersion}" runtime package "${coordinate.packageName}" `
        + `has a non-exact version specifier "${coordinate.version}"`,
      )
    }
  }
}

/**
 * Select, validate compatibility, validate immutability, and validate pinned
 * runtime packages for a profile in one call. Throws on the first violation.
 */
export function selectAndValidateProfile(
  profiles: readonly ReferenceArchitectureProfile[],
  criteria: ProfileSelectionCriteria,
  generatorVersion: string,
): ReferenceArchitectureProfile {
  const profile = selectReferenceArchitectureProfile(profiles, criteria)
  const integrity = validateProfileIntegrity(profile)
  if (!integrity.valid) {
    throw new Error(
      `profile "${profile.profileId}@${profile.profileVersion}" failed integrity check: `
      + `expected contentHash "${integrity.expectedContentHash}", found "${integrity.actualContentHash}"`,
    )
  }
  assertGeneratorCompatible(profile, generatorVersion)
  assertProfileRuntimePackagesPinned(profile)
  return profile
}
