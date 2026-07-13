/** Node-only local embedded capability transport (CAP-PKT-017). */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type OperationHandler = (args: unknown, context: { signal: AbortSignal }) => unknown | Promise<unknown>
type RuntimeModule = {
  operations?: Record<string, OperationHandler>
  default?: { operations?: Record<string, OperationHandler> }
}

export type InvokeLocalRuntimeInput = {
  repoRoot: string
  moduleId: string
  ownedPaths: readonly string[]
  operationId: string
  args?: unknown
  timeoutMs?: number
}

function normalizeOwnedPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`invalid owned path: ${value}`)
  }
  return normalized
}

function runtimeCandidates(repoRoot: string, ownedPaths: readonly string[]): string[] {
  const root = path.resolve(repoRoot)
  const candidates: string[] = []
  for (const ownedPath of ownedPaths) {
    const normalized = normalizeOwnedPath(ownedPath)
    const absolute = path.resolve(root, ...normalized.split('/'))
    if (!absolute.startsWith(root + path.sep)) throw new Error('owned path escaped project root')
    if (/\.(?:m?js)$/i.test(normalized)) {
      candidates.push(absolute)
      continue
    }
    for (const name of ['runtime.mjs', 'runtime.js', 'index.mjs', 'index.js']) {
      candidates.push(path.join(absolute, name))
    }
  }
  return candidates
}

function resolveRuntimeFile(repoRoot: string, ownedPaths: readonly string[]): string {
  for (const candidate of runtimeCandidates(repoRoot, ownedPaths)) {
    if (!fs.existsSync(candidate)) continue
    const stat = fs.lstatSync(candidate)
    if (stat.isSymbolicLink()) throw new Error('local runtime entrypoint cannot be a symbolic link')
    if (stat.isFile()) return candidate
  }
  throw new Error('approved local module has no runtime.mjs/runtime.js entrypoint in its owned paths')
}

export async function invokeLocalRuntime(input: InvokeLocalRuntimeInput): Promise<unknown> {
  const runtimeFile = resolveRuntimeFile(input.repoRoot, input.ownedPaths)
  const stat = fs.statSync(runtimeFile)
  const loaded = (await import(`${pathToFileURL(runtimeFile).href}?revision=${stat.mtimeMs}`)) as RuntimeModule
  const operations = loaded.operations ?? loaded.default?.operations
  const handler = operations?.[input.operationId]
  if (typeof handler !== 'function') {
    throw new Error(`local runtime does not export operation: ${input.operationId}`)
  }

  let args: unknown
  try {
    args = input.args === undefined ? undefined : structuredClone(input.args)
  } catch {
    throw new Error('operation input is not serializable')
  }

  const controller = new AbortController()
  const timeoutMs = input.timeoutMs ?? 30_000
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      Promise.resolve(handler(args, { signal: controller.signal })),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error(`local operation timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
    try {
      return structuredClone(result)
    } catch {
      throw new Error('operation result is not serializable')
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
