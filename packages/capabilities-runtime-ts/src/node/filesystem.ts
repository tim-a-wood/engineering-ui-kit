/**
 * Filesystem adapter foundation (§15.3). Every target path is
 * root-relative, normalized, and checked against traversal and symlink
 * escape before any I/O happens; read and write are separate, explicitly
 * granted capabilities so a read-only composition can never accidentally
 * write.
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'

export class FilesystemPathError extends Error {
  constructor(
    message: string,
    readonly code: 'unknown-root' | 'absolute-path-rejected' | 'traversal-rejected' | 'symlink-escape',
  ) {
    super(message)
    this.name = 'FilesystemPathError'
  }
}

export class FilesystemCapabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FilesystemCapabilityError'
  }
}

export interface FilesystemAdapterOptions {
  /** Named allowed root directories (absolute paths). Every call names one root explicitly. */
  readonly roots: Readonly<Record<string, string>>
  readonly allowRead?: boolean
  readonly allowWrite?: boolean
}

async function nearestExistingAncestor(candidate: string): Promise<string> {
  let current = candidate
  for (;;) {
    try {
      await fs.stat(current)
      return current
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return current
      current = parent
    }
  }
}

/**
 * Resolves `relativePath` against `rootAbsolute`, rejecting absolute
 * inputs and textual traversal, then verifies (via `realpath` of the
 * nearest existing ancestor) that the resolved location does not escape
 * the root through a symlink.
 */
export async function resolveWithinRoot(rootAbsolute: string, relativePath: string): Promise<string> {
  if (path.isAbsolute(relativePath)) {
    throw new FilesystemPathError(`path must be relative to the configured root, got absolute path "${relativePath}"`, 'absolute-path-rejected')
  }
  const resolvedRoot = path.resolve(rootAbsolute)
  const resolved = path.resolve(resolvedRoot, relativePath)
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new FilesystemPathError(`path "${relativePath}" resolves outside its configured root`, 'traversal-rejected')
  }

  const realRoot = await fs.realpath(resolvedRoot).catch(() => resolvedRoot)
  const ancestor = await nearestExistingAncestor(resolved)
  const realAncestor = await fs.realpath(ancestor).catch(() => ancestor)
  if (realAncestor !== realRoot && !realAncestor.startsWith(realRoot + path.sep)) {
    throw new FilesystemPathError(`path "${relativePath}" escapes its configured root via a symlink`, 'symlink-escape')
  }
  return resolved
}

/** Read/write file adapter constrained to explicitly configured, named root directories. */
export class NodeFilesystemAdapter {
  constructor(private readonly options: FilesystemAdapterOptions) {}

  private rootPath(rootName: string): string {
    const rootPath = this.options.roots[rootName]
    if (rootPath === undefined) {
      throw new FilesystemPathError(`unknown filesystem root "${rootName}"`, 'unknown-root')
    }
    return rootPath
  }

  async readFile(rootName: string, relativePath: string): Promise<string> {
    if (this.options.allowRead === false) {
      throw new FilesystemCapabilityError('read capability is not enabled for this adapter')
    }
    const absolute = await resolveWithinRoot(this.rootPath(rootName), relativePath)
    return fs.readFile(absolute, 'utf8')
  }

  async writeFile(rootName: string, relativePath: string, contents: string): Promise<void> {
    if (!this.options.allowWrite) {
      throw new FilesystemCapabilityError('write capability is not enabled for this adapter')
    }
    const absolute = await resolveWithinRoot(this.rootPath(rootName), relativePath)
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, contents, 'utf8')
  }

  async exists(rootName: string, relativePath: string): Promise<boolean> {
    const absolute = await resolveWithinRoot(this.rootPath(rootName), relativePath)
    return fs
      .stat(absolute)
      .then(() => true)
      .catch(() => false)
  }

  async remove(rootName: string, relativePath: string): Promise<void> {
    if (!this.options.allowWrite) {
      throw new FilesystemCapabilityError('write capability is not enabled for this adapter')
    }
    const absolute = await resolveWithinRoot(this.rootPath(rootName), relativePath)
    await fs.rm(absolute, { force: true })
  }
}
