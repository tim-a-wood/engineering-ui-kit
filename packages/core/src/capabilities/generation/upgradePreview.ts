/**
 * Runtime/reference-architecture-profile upgrade PREVIEW (CAP-ERA-001 §5.5:
 * "generation never silently upgrades a runtime"; §13 change/freshness
 * behavior; §14.3 existing source repositories).
 *
 * `planRuntimeUpgradePreview` is a PREVIEW only: it never mutates a profile,
 * a `GenerationPlan`, or a target repository, and it always reports
 * `requiresExplicitApproval: true` — there is no code path that applies an
 * upgrade silently. Given the same `current`/`target` profiles, the preview
 * is byte-identical (deterministic): no `Date.now()`/`Math.random()`, no
 * `node:*` imports, safe to bundle into the renderer (see `../browser.ts`).
 */

import type { ReferenceArchitectureProfile, RuntimeLanguage } from '../types.js'
import { uniqueSorted } from './paths.js'

export type RuntimeUpgradeDependencyChangeKind = 'add' | 'update' | 'remove' | 'unchanged'

export type RuntimeUpgradeDependencyChange = {
  language: RuntimeLanguage
  packageName: string
  fromVersion?: string
  toVersion?: string
  changeKind: RuntimeUpgradeDependencyChangeKind
}

export type RuntimeUpgradePreviewInput = {
  current: ReferenceArchitectureProfile
  target: ReferenceArchitectureProfile
}

export type RuntimeUpgradePreviewVersions = {
  profileId: string
  profileVersion: string
  generatorVersion: string
}

export type RuntimeUpgradePreview = {
  fromVersions: RuntimeUpgradePreviewVersions
  toVersions: RuntimeUpgradePreviewVersions
  dependencyChanges: RuntimeUpgradeDependencyChange[]
  migrationNotes: string[]
  /** Always `true`: an upgrade preview is never auto-applied (CAP-ERA-001 §5.5). */
  requiresExplicitApproval: true
  /** Evidence-backed reasons this upgrade cannot proceed as-is; `undefined` when there are none. */
  blocked?: string[]
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

const POLICY_FIELDS = [
  'contractFormat',
  'httpContractFormat',
  'lifecyclePolicy',
  'telemetryPolicy',
  'secretPolicy',
  'authorizationPolicy',
  'persistencePolicy',
  'errorPolicy',
] as const satisfies readonly (keyof ReferenceArchitectureProfile)[]

function dependencyKey(language: RuntimeLanguage, packageName: string): string {
  return `${language}::${packageName}`
}

function versionsOf(profile: ReferenceArchitectureProfile): RuntimeUpgradePreviewVersions {
  return { profileId: profile.profileId, profileVersion: profile.profileVersion, generatorVersion: profile.generatorVersion }
}

/**
 * Build an explicit, reviewable preview of upgrading from `current` to
 * `target` (CAP-CONTRACT-023). Never mutates either profile. Always requires
 * explicit approval before any apply — this function never applies anything
 * itself, and there is no `apply`-shaped counterpart that skips approval.
 */
export function planRuntimeUpgradePreview(input: RuntimeUpgradePreviewInput): RuntimeUpgradePreview {
  const { current, target } = input
  const blocked: string[] = []
  const migrationNotes: string[] = [
    `Upgrading profile "${current.profileId}" from version "${current.profileVersion}" to "${target.profileVersion}" `
    + 'requires explicit user approval before generation applies anything (CAP-ERA-001 §5.5: generation never silently upgrades a runtime).',
  ]

  if (current.profileId !== target.profileId) {
    blocked.push(
      `current profile "${current.profileId}" and target profile "${target.profileId}" are different profiles; `
      + 'this is not a supported upgrade path (an upgrade must stay within the same profileId).',
    )
  } else if (compareVersionParts(target.profileVersion, current.profileVersion) <= 0) {
    blocked.push(
      `target profile version "${target.profileVersion}" is not newer than current profile version `
      + `"${current.profileVersion}"; an upgrade preview requires a strictly newer target version.`,
    )
  }

  if (current.generatorVersion !== target.generatorVersion) {
    migrationNotes.push(`generatorVersion changes from "${current.generatorVersion}" to "${target.generatorVersion}"; review before approving.`)
  }

  for (const field of POLICY_FIELDS) {
    const fromValue = current[field]
    const toValue = target[field]
    if (fromValue !== toValue) {
      migrationNotes.push(`"${field}" changes from "${fromValue}" to "${toValue}"; review before approving.`)
    }
  }

  const currentLanguages = uniqueSorted(current.supportedRuntimeLanguages.map((entry) => entry.language))
  const targetLanguages = uniqueSorted(target.supportedRuntimeLanguages.map((entry) => entry.language))
  const droppedLanguages = currentLanguages.filter((language) => !targetLanguages.includes(language))
  if (droppedLanguages.length > 0) {
    blocked.push(
      `target profile drops supported runtime language(s) [${droppedLanguages.join(', ')}] that the current profile `
      + 'supports; dropping runtime language support is never applied silently and must be explicitly resolved.',
    )
  }

  const currentByKey = new Map(current.runtimePackageCoordinates.map((coord) => [dependencyKey(coord.language, coord.packageName), coord]))
  const targetByKey = new Map(target.runtimePackageCoordinates.map((coord) => [dependencyKey(coord.language, coord.packageName), coord]))
  const allKeys = uniqueSorted([...currentByKey.keys(), ...targetByKey.keys()])

  const dependencyChanges: RuntimeUpgradeDependencyChange[] = allKeys.map((key) => {
    const from = currentByKey.get(key)
    const to = targetByKey.get(key)
    const language = (to ?? from)!.language
    const packageName = (to ?? from)!.packageName
    if (from && !to) return { language, packageName, fromVersion: from.version, changeKind: 'remove' }
    if (!from && to) return { language, packageName, toVersion: to.version, changeKind: 'add' }
    if (from && to && from.version !== to.version) {
      return { language, packageName, fromVersion: from.version, toVersion: to.version, changeKind: 'update' }
    }
    return { language, packageName, fromVersion: from?.version, toVersion: to?.version, changeKind: 'unchanged' }
  })

  const removed = dependencyChanges.filter((change) => change.changeKind === 'remove')
  if (removed.length > 0) {
    migrationNotes.push(
      `${removed.length} runtime package coordinate(s) are removed by the target profile: `
      + `${removed.map((change) => `${change.language}:${change.packageName}`).join(', ')}; confirm no adopted code still depends on them.`,
    )
  }

  return {
    fromVersions: versionsOf(current),
    toVersions: versionsOf(target),
    dependencyChanges,
    migrationNotes,
    requiresExplicitApproval: true,
    ...(blocked.length > 0 ? { blocked: uniqueSorted(blocked) } : {}),
  }
}
