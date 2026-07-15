// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import { Outcome } from '../src/outcome.js'
import { useOperation } from '../src/react.js'
import type { OperationCallable } from '../src/react.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(here, '..', 'src')

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

interface FakeClient {
  readonly client: OperationCallable
  readonly calls: Array<{ operationCode: string; input: unknown }>
  resolveNext(outcome: Outcome<unknown, unknown, unknown>): void
  pendingCount(): number
}

function createFakeClient(): FakeClient {
  const calls: Array<{ operationCode: string; input: unknown }> = []
  const pendingResolvers: Array<(outcome: Outcome<unknown, unknown, unknown>) => void> = []

  const client: OperationCallable = {
    call(operationCode, input) {
      calls.push({ operationCode, input })
      return new Promise((resolve) => {
        pendingResolvers.push(resolve as (outcome: Outcome<unknown, unknown, unknown>) => void)
      }) as ReturnType<OperationCallable['call']>
    },
  }

  return {
    client,
    calls,
    resolveNext(outcome) {
      const next = pendingResolvers.shift()
      if (!next) throw new Error('no pending call to resolve')
      next(outcome)
    },
    pendingCount: () => pendingResolvers.length,
  }
}

describe('./react bundle', () => {
  it('references no node:* built-in module anywhere under react.tsx / react/*', () => {
    const files = [path.join(srcRoot, 'react.tsx'), ...collectFiles(path.join(srcRoot, 'react'))]
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const contents = readFileSync(file, 'utf8')
      const importLines = contents
        .split('\n')
        .filter((line) => /^\s*import\b/.test(line) || /^\s*export\b.*\bfrom\b/.test(line))
      for (const line of importLines) {
        expect(line).not.toMatch(/from\s+['"]node:/)
      }
    }
  })
})

describe('useOperation', () => {
  it('starts idle and transitions loading -> success, exposing the result value', async () => {
    const fake = createFakeClient()
    const { result } = renderHook(() => useOperation<{ name: string }, { greeting: string }>(fake.client, 'greet'))

    expect(result.current.state).toBe('idle')
    expect(result.current.isSubmitting).toBe(false)

    let runPromise!: Promise<unknown>
    act(() => {
      runPromise = result.current.run({ name: 'Ada' })
    })

    expect(result.current.state).toBe('loading')
    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      fake.resolveNext(Outcome.success({ greeting: 'hi Ada' }))
      await runPromise
    })

    expect(result.current.state).toBe('success')
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.value).toEqual({ greeting: 'hi Ada' })
    expect(fake.calls).toEqual([{ operationCode: 'greet', input: { name: 'Ada' } }])
  })

  it('guards duplicate submissions: a second run() while loading is a no-op', async () => {
    const fake = createFakeClient()
    const { result } = renderHook(() => useOperation<{ name: string }, string>(fake.client, 'greet'))

    act(() => {
      void result.current.run({ name: 'Ada' })
    })
    expect(fake.calls).toHaveLength(1)
    expect(result.current.isSubmitting).toBe(true)

    let second: unknown
    await act(async () => {
      second = await result.current.run({ name: 'Grace' })
    })

    expect(second).toBeUndefined()
    expect(fake.calls).toHaveLength(1)

    await act(async () => {
      fake.resolveNext(Outcome.success('hi Ada'))
    })
    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.value).toBe('hi Ada')
  })

  it('exposes a domain rejection', async () => {
    const fake = createFakeClient()
    const { result } = renderHook(() => useOperation<void, never, { field: string }>(fake.client, 'create'))

    act(() => {
      void result.current.run(undefined)
    })
    await act(async () => {
      fake.resolveNext(Outcome.rejected('duplicate-email', { field: 'email' }))
    })

    expect(result.current.state).toBe('rejected')
    expect(result.current.rejection).toEqual({ code: 'duplicate-email', details: { field: 'email' } })
    expect(result.current.value).toBeUndefined()
  })

  it('exposes a technical failure', async () => {
    const fake = createFakeClient()
    const { result } = renderHook(() => useOperation<void, never, never, { detail: string }>(fake.client, 'boom'))

    act(() => {
      void result.current.run(undefined)
    })
    await act(async () => {
      fake.resolveNext(Outcome.failed('boom-code', 'Something went wrong.', true))
    })

    expect(result.current.state).toBe('failed')
    expect(result.current.failure).toEqual({ code: 'boom-code', safeMessage: 'Something went wrong.', retryable: true })
  })

  it('maps an unexpected client throw to a safe failed state, never propagating the raw error', async () => {
    const throwingClient: OperationCallable = {
      call() {
        return Promise.reject(new Error('leaking a raw stack trace and secret-value-should-never-appear-xyz789'))
      },
    }
    const { result } = renderHook(() => useOperation<void, never, never, never>(throwingClient, 'boom'))

    let runPromise!: Promise<unknown>
    act(() => {
      runPromise = result.current.run(undefined)
    })
    await act(async () => {
      await runPromise
    })

    expect(result.current.state).toBe('failed')
    expect(result.current.failure?.code).toBe('transport-defect')
    expect(JSON.stringify(result.current.failure)).not.toContain('secret-value-should-never-appear-xyz789')
  })

  it('cancel() immediately reflects cancelled state and aborts the in-flight call', async () => {
    const abortReasons: unknown[] = []
    const client: OperationCallable = {
      call(_operationCode, _input, options) {
        options?.signal?.addEventListener('abort', () => {
          abortReasons.push((options.signal as AbortSignal).reason)
        })
        return new Promise(() => {
          // never resolves; only cancel() should move the UI state
        }) as ReturnType<OperationCallable['call']>
      },
    }
    const { result } = renderHook(() => useOperation<void, never>(client, 'long-running'))

    act(() => {
      void result.current.run(undefined)
    })
    expect(result.current.state).toBe('loading')

    act(() => {
      result.current.cancel('user-cancelled')
    })

    expect(result.current.state).toBe('cancelled')
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.cancelledReason).toBe('user-cancelled')
    expect(abortReasons).toEqual(['user-cancelled'])
  })

  it('reset() returns to idle and a stale in-flight resolution never overwrites it', async () => {
    const fake = createFakeClient()
    const { result } = renderHook(() => useOperation<void, string>(fake.client, 'greet'))

    act(() => {
      void result.current.run(undefined)
    })
    expect(result.current.state).toBe('loading')

    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toBe('idle')

    await act(async () => {
      fake.resolveNext(Outcome.success('late result'))
      await Promise.resolve()
    })

    // The stale resolution must not resurrect a non-idle state.
    expect(result.current.state).toBe('idle')
    expect(result.current.value).toBeUndefined()
  })

  it('allows a new run() after a prior call completed', async () => {
    const fake = createFakeClient()
    const { result } = renderHook(() => useOperation<{ n: number }, number>(fake.client, 'double'))

    act(() => {
      void result.current.run({ n: 1 })
    })
    await act(async () => {
      fake.resolveNext(Outcome.success(2))
    })
    expect(result.current.state).toBe('success')

    act(() => {
      void result.current.run({ n: 2 })
    })
    expect(result.current.state).toBe('loading')
    await act(async () => {
      fake.resolveNext(Outcome.success(4))
    })
    expect(result.current.state).toBe('success')
    expect(result.current.value).toBe(4)
    expect(fake.calls).toEqual([
      { operationCode: 'double', input: { n: 1 } },
      { operationCode: 'double', input: { n: 2 } },
    ])
  })
})
