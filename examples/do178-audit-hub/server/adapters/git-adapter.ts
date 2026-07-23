import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AdapterDiagnostic, RevisionIdentity, SourceRootConfiguration } from '../domain/model.js'
import type { RevisionSourcePort } from '../ports/outbound.js'

const execFileAsync = promisify(execFile)

function clean(value: string): string {
  return value.trim()
}

export class GitAdapter implements RevisionSourcePort {
  readonly id = 'adapter.git'

  async resolve(root: SourceRootConfiguration): Promise<{
    revision?: RevisionIdentity
    diagnostics: AdapterDiagnostic[]
  }> {
    try {
      const options = { cwd: root.rootPath, timeout: 10_000, maxBuffer: 1024 * 1024 }
      const [{ stdout: head }, { stdout: branch }, { stdout: status }] = await Promise.all([
        execFileAsync('git', ['rev-parse', 'HEAD'], options),
        execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], options),
        execFileAsync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], options),
      ])
      const dirty = clean(status).length > 0
      return {
        revision: {
          sourceId: root.id,
          revision: clean(head),
          dirty,
          provenance: `Git ${clean(branch)}${dirty ? ' (dirty)' : ''} at ${root.rootPath}`,
        },
        diagnostics: dirty
          ? [{
              id: `git:dirty:${root.id}`,
              adapterId: this.id,
              severity: 'warning',
              code: 'working-tree-dirty',
              message: 'The source repository has uncommitted changes; the snapshot records this state explicitly.',
              sourcePath: root.rootPath,
              retryable: false,
            }]
          : [],
      }
    } catch {
      return {
        diagnostics: [{
          id: `git:unavailable:${root.id}`,
          adapterId: this.id,
          severity: 'warning',
          code: 'revision-unavailable',
          message: 'The source root is not a readable Git worktree; file hashes will provide revision identity.',
          sourcePath: root.rootPath,
          retryable: false,
        }],
      }
    }
  }
}
