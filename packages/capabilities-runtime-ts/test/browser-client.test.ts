import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Outcome } from '../src/outcome.js'
import { OperationClient } from '../src/browser/client.js'
import { BrowserConfigurationReader, readBrowserConfigurationFromGlobal } from '../src/browser/configuration.js'
import { CORRELATION_ID_HEADER, createCorrelationId } from '../src/browser/correlation.js'
import type { Transport, TransportRequest } from '../src/browser/transport.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(here, '..', 'src')

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(full)
    return entry.name.endsWith('.ts') ? [full] : []
  })
}

describe('./browser bundle', () => {
  it('references no node:* built-in module anywhere under browser.ts / browser/*', () => {
    const files = [path.join(srcRoot, 'browser.ts'), ...collectFiles(path.join(srcRoot, 'browser'))]
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

  it('dispatches an operation call through an injected Transport and returns its Outcome', async () => {
    const seenRequests: TransportRequest[] = []
    const transport: Transport = {
      async send<Success>(request: TransportRequest) {
        seenRequests.push(request)
        return Outcome.success({ doubled: (request.input as { value: number }).value * 2 }) as Outcome<
          Success,
          never,
          never
        >
      },
    }

    const client = new OperationClient({ transport })
    const outcome = await client.call<{ doubled: number }>('double', { value: 21 })

    expect(Outcome.isSuccess(outcome)).toBe(true)
    if (Outcome.isSuccess(outcome)) {
      expect(outcome.value).toEqual({ doubled: 42 })
    }
    expect(seenRequests).toHaveLength(1)
    expect(seenRequests[0]?.operationCode).toBe('double')
    expect(seenRequests[0]?.correlationId).toBeTruthy()
    expect(seenRequests[0]?.headers?.[CORRELATION_ID_HEADER]).toBe(seenRequests[0]?.correlationId)
  })

  it('propagates an explicitly supplied correlation id instead of minting a new one', async () => {
    const seenRequests: TransportRequest[] = []
    const transport: Transport = {
      async send<Success>(request: TransportRequest) {
        seenRequests.push(request)
        return Outcome.success(undefined) as Outcome<Success, never, never>
      },
    }

    const client = new OperationClient({ transport })
    await client.call('noop', undefined, { correlationId: 'explicit-correlation-id' })

    expect(seenRequests[0]?.correlationId).toBe('explicit-correlation-id')
  })

  it('generates RFC-4122-shaped correlation ids', () => {
    const id = createCorrelationId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('the browser configuration boundary never reads process.env, only its injected source', () => {
    const reader = new BrowserConfigurationReader({ apiBaseUrl: 'https://example.test' })
    expect(reader.get('apiBaseUrl')).toBe('https://example.test')
    expect(reader.get('missing')).toBeUndefined()
    expect(() => reader.require('missing')).toThrow()
  })

  it('readBrowserConfigurationFromGlobal reads only string values from the named global, defaulting to empty', () => {
    ;(globalThis as Record<string, unknown>).__TEST_APP_CONFIG__ = { a: 'x', b: 1, c: null }
    try {
      const reader = readBrowserConfigurationFromGlobal('__TEST_APP_CONFIG__')
      expect(reader.get('a')).toBe('x')
      expect(reader.get('b')).toBeUndefined()
      expect(reader.get('c')).toBeUndefined()

      const missingGlobalReader = readBrowserConfigurationFromGlobal('__DOES_NOT_EXIST__')
      expect(missingGlobalReader.get('anything')).toBeUndefined()
    } finally {
      delete (globalThis as Record<string, unknown>).__TEST_APP_CONFIG__
    }
  })
})
