import { lstat, readdir, realpath } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import type {
  AdapterDiagnostic,
  ArtifactDescriptor,
  SourceKind,
  SourceRootConfiguration,
} from '../domain/model.js'
import type { ArtifactCatalogPort } from '../ports/outbound.js'
import { sha256File } from '../lib/files.js'

const DEFAULT_EXTENSIONS = new Set([
  '.slreqx',
  '.slmx',
  '.slx',
  '.sldd',
  '.sldatx',
  '.mldatx',
  '.xlsx',
  '.csv',
  '.c',
  '.h',
  '.json',
  '.xml',
  '.lcov',
])

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.audit-hub',
  '.audit-hub-data',
  '.engineering-ui',
  'dist',
  'dist-server',
  'node_modules',
])

function sourceKind(filePath: string): SourceKind {
  switch (extname(filePath).toLowerCase()) {
    case '.slreqx': return 'SLREQX'
    case '.slmx': return 'SLMX'
    case '.slx': return 'SLX'
    case '.sldd': return 'SLDD'
    case '.sldatx':
    case '.mldatx': return 'SLDATX'
    case '.xlsx': return 'XLSX'
    case '.csv': return 'CSV'
    case '.c': return 'C'
    case '.h': return 'H'
    case '.lcov': return 'COVERAGE'
    case '.json':
    case '.xml': return /review|checklist|approval/i.test(filePath) ? 'REVIEW' : 'CONFIG'
    default: return 'UNKNOWN'
  }
}

function diagnostic(
  severity: AdapterDiagnostic['severity'],
  code: string,
  message: string,
  sourcePath?: string,
): AdapterDiagnostic {
  return {
    id: `filesystem:${code}:${sourcePath ?? 'root'}`,
    adapterId: 'adapter.filesystem',
    severity,
    code,
    message,
    ...(sourcePath ? { sourcePath } : {}),
    retryable: severity === 'error',
  }
}

export class FilesystemAdapter implements ArtifactCatalogPort {
  readonly id = 'adapter.filesystem'

  async discover(root: SourceRootConfiguration): Promise<{
    artifacts: ArtifactDescriptor[]
    diagnostics: AdapterDiagnostic[]
  }> {
    const artifacts: ArtifactDescriptor[] = []
    const diagnostics: AdapterDiagnostic[] = []
    if (!root.enabled) return { artifacts, diagnostics }

    const configuredRoot = resolve(root.rootPath)
    let canonicalRoot: string
    try {
      canonicalRoot = await realpath(configuredRoot)
    } catch {
      return {
        artifacts,
        diagnostics: [diagnostic('fatal', 'root-unreadable', `Source root is not readable: ${configuredRoot}`, configuredRoot)],
      }
    }

    const allowedExtensions = new Set(
      (root.includeExtensions ?? [...DEFAULT_EXTENSIONS]).map((entry) =>
        entry.startsWith('.') ? entry.toLowerCase() : `.${entry.toLowerCase()}`),
    )

    const walk = async (directory: string): Promise<void> => {
      let entries
      try {
        entries = await readdir(directory, { withFileTypes: true })
      } catch (error) {
        diagnostics.push(diagnostic('error', 'directory-unreadable', String(error), directory))
        return
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue
        const absolutePath = resolve(directory, entry.name)
        const relativePath = relative(canonicalRoot, absolutePath)
        if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
          diagnostics.push(diagnostic('error', 'path-escape', 'Resolved path escaped the configured source root.', absolutePath))
          continue
        }
        if (entry.isSymbolicLink()) {
          diagnostics.push(diagnostic('info', 'symlink-skipped', 'Symbolic links are not followed during evidence discovery.', absolutePath))
          continue
        }
        if (entry.isDirectory()) {
          await walk(absolutePath)
          continue
        }
        const extension = extname(entry.name).toLowerCase()
        if (!entry.isFile() || !allowedExtensions.has(extension)) continue
        // Normalized MATLAB sidecars are derivative inputs owned by the
        // MATLAB adapter and are attributed to their authoritative artifact.
        // Generic repository JSON/XML is intentionally ignored; otherwise a
        // project-root connection would reject on package.json, tool config,
        // and other files that are not lifecycle evidence.
        if (entry.name.toLowerCase().endsWith('.audit-hub.json')) continue
        if ((extension === '.json' || extension === '.xml')
          && !/coverage|cobertura/i.test(relativePath)) continue
        try {
          const stat = await lstat(absolutePath)
          artifacts.push({
            absolutePath,
            relativePath: relativePath.split(sep).join('/'),
            sourceRootId: root.id,
            sourceKind: sourceKind(absolutePath),
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            hash: await sha256File(absolutePath),
          })
        } catch (error) {
          diagnostics.push(diagnostic('error', 'file-unreadable', String(error), absolutePath))
        }
      }
    }

    await walk(canonicalRoot)
    if (artifacts.length === 0) {
      diagnostics.push(diagnostic('warning', 'no-supported-artifacts', 'No supported lifecycle artifacts were found.', canonicalRoot))
    }
    return { artifacts, diagnostics }
  }
}
