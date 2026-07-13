/**
 * Project-relative filesystem policy helpers (CAP-PKT-019 core portion).
 */

import path from 'node:path'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'

export type FilesystemPolicyRoot =
  | 'source'
  | 'generated-output'
  | 'configuration'
  | 'input-data'
  | 'artifacts'

export type FilesystemPolicy = {
  roots: Record<FilesystemPolicyRoot, string>
}

export type PathResolution =
  | { ok: true; relativePath: string; root: FilesystemPolicyRoot }
  | { ok: false; diagnostics: CapDiagnostic[] }

function isAbsolute(p: string): boolean {
  return path.isAbsolute(p) || p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)
}

export function resolveProjectRelativePath(
  policy: FilesystemPolicy,
  requestedRelativePath: string,
  allowedRoots: FilesystemPolicyRoot[],
): PathResolution {
  const diagnostics: CapDiagnostic[] = []
  if (isAbsolute(requestedRelativePath)) {
    diagnostics.push(
      diagnostic('CAP-FS-001', 'absolute paths are not allowed', {
        ruleId: 'CAP-AR-008',
        fieldPath: requestedRelativePath,
      }),
    )
    return { ok: false, diagnostics: sortDiagnostics(diagnostics) }
  }
  if (requestedRelativePath.includes('\0') || requestedRelativePath.split(/[\\/]/).includes('..')) {
    diagnostics.push(
      diagnostic('CAP-FS-002', 'path traversal is not allowed', {
        ruleId: 'CAP-FS-002',
        fieldPath: requestedRelativePath,
      }),
    )
    return { ok: false, diagnostics: sortDiagnostics(diagnostics) }
  }
  const normalized = requestedRelativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  for (const root of allowedRoots) {
    const rootRel = policy.roots[root].replace(/\\/g, '/').replace(/\/+$/, '')
    if (normalized === rootRel || normalized.startsWith(rootRel + '/')) {
      return { ok: true, relativePath: normalized, root }
    }
  }
  diagnostics.push(
    diagnostic('CAP-FS-003', 'path is outside allowed policy roots', {
      ruleId: 'CAP-FS-003',
      fieldPath: normalized,
    }),
  )
  return { ok: false, diagnostics: sortDiagnostics(diagnostics) }
}

/** Ensure a resolved real path stays within projectRoot (symlink-safe check helper). */
export function isWithinProjectRoot(projectRoot: string, resolvedPath: string): boolean {
  const root = path.resolve(projectRoot)
  const target = path.resolve(resolvedPath)
  return target === root || target.startsWith(root + path.sep)
}
