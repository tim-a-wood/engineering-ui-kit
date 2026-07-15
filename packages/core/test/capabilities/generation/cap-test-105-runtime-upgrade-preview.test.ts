/**
 * CAP-TEST-105 — explicit runtime/reference-architecture-profile upgrade
 * preview (CAP-ERA-001 §5.5, §13, §14.3, WP9B): `planRuntimeUpgradePreview`
 * never mutates a profile or a target repository, always requires explicit
 * approval, and never silently drops runtime-language support.
 */
import { describe, expect, it } from 'vitest'
import { planRuntimeUpgradePreview } from '../../../src/capabilities/generation/upgradePreview.js'
import type { ReferenceArchitectureProfile } from '../../../src/capabilities/types.js'
import { buildValidProfile } from './fixtures.js'

describe('CAP-TEST-105 runtime/profile upgrade preview', () => {
  it('previews a straightforward minor-version upgrade: explicit approval required, no blockers', () => {
    const current = buildValidProfile({ profileVersion: '1.0.0' })
    const target = buildValidProfile({ profileVersion: '1.1.0' })

    const preview = planRuntimeUpgradePreview({ current, target })

    expect(preview.requiresExplicitApproval).toBe(true)
    expect(preview.blocked).toBeUndefined()
    expect(preview.fromVersions).toEqual({
      profileId: 'hexagonal-ports-and-adapters',
      profileVersion: '1.0.0',
      generatorVersion: '0.1.0',
    })
    expect(preview.toVersions).toEqual({
      profileId: 'hexagonal-ports-and-adapters',
      profileVersion: '1.1.0',
      generatorVersion: '0.1.0',
    })
    expect(preview.migrationNotes.some((note) => /explicit user approval/i.test(note))).toBe(true)
    expect(preview.migrationNotes.some((note) => /never silently upgrades a runtime/i.test(note))).toBe(true)
    // No policy or dependency changes between these two fixtures beyond the version bump.
    expect(preview.dependencyChanges.every((change) => change.changeKind === 'unchanged')).toBe(true)
  })

  it('reports dependency changes: added, updated, removed, and unchanged runtime package coordinates', () => {
    const current = buildValidProfile({
      profileVersion: '1.0.0',
      runtimePackageCoordinates: [
        { language: 'typescript', packageName: '@engineering-ui-kit/capabilities-runtime', version: '0.1.0', pinnedVersionPolicy: 'exact' },
        { language: 'python', packageName: 'capabilities-runtime-py', version: '0.1.0', pinnedVersionPolicy: 'exact' },
      ],
    })
    const target = buildValidProfile({
      profileVersion: '1.1.0',
      runtimePackageCoordinates: [
        { language: 'typescript', packageName: '@engineering-ui-kit/capabilities-runtime', version: '0.2.0', pinnedVersionPolicy: 'exact' },
        { language: 'typescript', packageName: '@engineering-ui-kit/capabilities-runtime-http', version: '0.1.0', pinnedVersionPolicy: 'exact' },
      ],
    })

    const preview = planRuntimeUpgradePreview({ current, target })

    const byPackage = new Map(preview.dependencyChanges.map((change) => [change.packageName, change]))
    expect(byPackage.get('@engineering-ui-kit/capabilities-runtime')).toEqual({
      language: 'typescript',
      packageName: '@engineering-ui-kit/capabilities-runtime',
      fromVersion: '0.1.0',
      toVersion: '0.2.0',
      changeKind: 'update',
    })
    expect(byPackage.get('@engineering-ui-kit/capabilities-runtime-http')).toEqual({
      language: 'typescript',
      packageName: '@engineering-ui-kit/capabilities-runtime-http',
      toVersion: '0.1.0',
      changeKind: 'add',
    })
    expect(byPackage.get('capabilities-runtime-py')).toEqual({
      language: 'python',
      packageName: 'capabilities-runtime-py',
      fromVersion: '0.1.0',
      changeKind: 'remove',
    })
    expect(preview.migrationNotes.some((note) => note.includes('capabilities-runtime-py') && /removed/i.test(note))).toBe(true)
  })

  it('records a migration note for every changed profile policy field', () => {
    const current = buildValidProfile({ profileVersion: '1.0.0', authorizationPolicy: 'protected-deny-by-default' })
    const target = buildValidProfile({ profileVersion: '1.1.0', authorizationPolicy: 'protected-deny-by-default-v2' })

    const preview = planRuntimeUpgradePreview({ current, target })

    expect(preview.migrationNotes.some((note) => note.includes('authorizationPolicy'))).toBe(true)
    expect(preview.migrationNotes.some((note) => note.includes('protected-deny-by-default-v2'))).toBe(true)
  })

  it('blocks an upgrade to a profile that is not a strictly newer version of the same profileId', () => {
    const current = buildValidProfile({ profileVersion: '1.1.0' })
    const sameVersion = buildValidProfile({ profileVersion: '1.1.0' })
    const olderVersion = buildValidProfile({ profileVersion: '1.0.0' })

    const samePreview = planRuntimeUpgradePreview({ current, target: sameVersion })
    expect(samePreview.blocked?.some((reason) => /not newer than/i.test(reason))).toBe(true)
    expect(samePreview.requiresExplicitApproval).toBe(true)

    const downgradePreview = planRuntimeUpgradePreview({ current, target: olderVersion })
    expect(downgradePreview.blocked?.some((reason) => /not newer than/i.test(reason))).toBe(true)
  })

  it('blocks an upgrade across different profileIds; this is not a supported upgrade path', () => {
    const current = buildValidProfile({ profileId: 'hexagonal-ports-and-adapters', profileVersion: '1.0.0' })
    const target = buildValidProfile({ profileId: 'clean-architecture', profileVersion: '1.0.0' })

    const preview = planRuntimeUpgradePreview({ current, target })
    expect(preview.blocked?.some((reason) => /different profiles/i.test(reason))).toBe(true)
  })

  it('never silently drops runtime-language support: a dropped language blocks the preview', () => {
    const current = buildValidProfile({
      profileVersion: '1.0.0',
      supportedRuntimeLanguages: [
        { language: 'typescript', versionRange: '>=22' },
        { language: 'python', versionRange: '>=3.11' },
      ],
    })
    const target = buildValidProfile({
      profileVersion: '1.1.0',
      supportedRuntimeLanguages: [{ language: 'typescript', versionRange: '>=22' }],
    })

    const preview = planRuntimeUpgradePreview({ current, target })
    expect(preview.blocked?.some((reason) => reason.includes('python') && /drops supported runtime language/i.test(reason))).toBe(true)
    // Still a preview only — approval is still required, never silently applied or silently refused-and-forgotten.
    expect(preview.requiresExplicitApproval).toBe(true)
  })

  it('is deterministic and never mutates either input profile', () => {
    const current = buildValidProfile({ profileVersion: '1.0.0' })
    const target = buildValidProfile({ profileVersion: '1.1.0' })
    const currentSnapshot: ReferenceArchitectureProfile = JSON.parse(JSON.stringify(current))
    const targetSnapshot: ReferenceArchitectureProfile = JSON.parse(JSON.stringify(target))

    const previewA = planRuntimeUpgradePreview({ current, target })
    const previewB = planRuntimeUpgradePreview({ current, target })

    expect(previewB).toEqual(previewA)
    expect(current).toEqual(currentSnapshot)
    expect(target).toEqual(targetSnapshot)
  })
})
