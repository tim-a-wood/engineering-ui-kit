/**
 * Derived registry and deterministic provider resolver (CAP-PKT-017).
 */

import type { FreshnessRecord, ModuleManifest, RegistryEntry } from './types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'

export type ResolveRequest = {
  operationId: string
  acceptedContractRange?: string
}

export type ResolveResult =
  | { ok: true; entry: RegistryEntry }
  | { ok: false; failure: 'missing' | 'ambiguous' | 'incompatible' | 'unconfigured' | 'unverified'; diagnostics: CapDiagnostic[] }

export function rebuildRegistry(
  manifests: ModuleManifest[],
  freshnessByModule: Record<string, FreshnessRecord | undefined>,
  configReadyByModule: Record<string, boolean>,
): RegistryEntry[] {
  const entries: RegistryEntry[] = []
  for (const manifest of manifests.slice().sort((a, b) => a.moduleId.localeCompare(b.moduleId))) {
    const freshness = freshnessByModule[manifest.moduleId]
    for (const op of manifest.providedOperations.slice().sort((a, b) => a.operationId.localeCompare(b.operationId))) {
      entries.push({
        schemaVersion: '1.0',
        moduleId: manifest.moduleId,
        moduleVersion: manifest.moduleVersion,
        operationId: op.operationId,
        compatibleContractVersions: [op.contractVersion],
        runtimeAllocation: manifest.runtimeAllocation,
        configReady: configReadyByModule[manifest.moduleId] ?? true,
        verificationState: freshness?.primaryState === 'ready' ? 'passed' : freshness?.primaryState ?? 'draft',
        freshnessState: freshness?.primaryState ?? 'draft',
        evidenceRefs: freshness?.verificationEvidenceId ? [freshness.verificationEvidenceId] : [],
      })
    }
  }
  return entries
}

function semverCompatible(version: string, range?: string): boolean {
  if (!range) return true
  if (range.startsWith('^')) {
    const base = range.slice(1)
    const [maj] = base.split('.')
    const [vma] = version.split('.')
    return vma === maj
  }
  return version === range
}

export function resolveProvider(registry: RegistryEntry[], request: ResolveRequest): ResolveResult {
  const candidates = registry.filter((e) => e.operationId === request.operationId)
  if (!candidates.length) {
    return {
      ok: false,
      failure: 'missing',
      diagnostics: sortDiagnostics([
        diagnostic('CAP-RESOLVE-MISSING', 'no provider registered for operation', {
          relatedIds: [request.operationId],
        }),
      ]),
    }
  }
  const compatible = candidates.filter((e) =>
    e.compatibleContractVersions.some((v) => semverCompatible(v, request.acceptedContractRange)),
  )
  if (!compatible.length) {
    return {
      ok: false,
      failure: 'incompatible',
      diagnostics: sortDiagnostics([
        diagnostic('CAP-RESOLVE-INCOMPATIBLE', 'no compatible contract version', {
          relatedIds: [request.operationId],
        }),
      ]),
    }
  }
  const configured = compatible.filter((e) => e.configReady)
  if (!configured.length) {
    return {
      ok: false,
      failure: 'unconfigured',
      diagnostics: sortDiagnostics([
        diagnostic('CAP-RESOLVE-UNCONFIGURED', 'compatible providers are not configured', {
          relatedIds: [request.operationId],
        }),
      ]),
    }
  }
  const verified = configured.filter((e) => e.freshnessState === 'ready')
  if (!verified.length) {
    return {
      ok: false,
      failure: 'unverified',
      diagnostics: sortDiagnostics([
        diagnostic('CAP-RESOLVE-UNVERIFIED', 'compatible providers are not verified/ready', {
          relatedIds: [request.operationId],
        }),
      ]),
    }
  }
  if (verified.length > 1) {
    return {
      ok: false,
      failure: 'ambiguous',
      diagnostics: sortDiagnostics([
        diagnostic('CAP-RESOLVE-AMBIGUOUS', 'multiple compatible ready providers', {
          relatedIds: verified.map((v) => v.moduleId),
        }),
      ]),
    }
  }
  return { ok: true, entry: verified[0]! }
}
