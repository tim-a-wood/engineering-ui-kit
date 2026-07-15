import { describe, expect, it } from 'vitest'
import { MapConfigurationReader } from '../src/configuration.js'
import { Outcome } from '../src/outcome.js'
import type { Operation } from '../src/operation.js'
import { TestSecretResolver } from '../src/testing.js'
import { createNodeHttpHost } from '../src/node/http.js'

const configuration = new MapConfigurationReader()
const secretResolver = new TestSecretResolver()

describe('createNodeHttpHost', () => {
  it('starts a real node:http server on an ephemeral port and dispatches a real request to an operation', async () => {
    const doubleOperation: Operation<{ value: number }, number, never, never> = {
      code: 'double',
      execute(input) {
        return Outcome.success(input.value * 2)
      },
    }

    const host = createNodeHttpHost({
      routes: [{ method: 'POST', path: '/double', operation: doubleOperation }],
      configuration,
      secretResolver,
    })

    const { port } = await host.start(0)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/double`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 21 }),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-correlation-id')).toBeTruthy()
      const body = (await response.json()) as { kind: string; value: number }
      expect(body).toEqual({ kind: 'success', value: 42 })
    } finally {
      await host.stop()
    }
  })

  it('propagates an inbound correlation id and maps a domain rejection to 422', async () => {
    const rejectOperation: Operation<void, never, { field: string }, never> = {
      code: 'reject-me',
      execute() {
        return Outcome.rejected('duplicate-email', { field: 'email' })
      },
    }

    const host = createNodeHttpHost({
      routes: [{ method: 'GET', path: '/reject', operation: rejectOperation }],
      configuration,
      secretResolver,
    })

    const { port } = await host.start(0)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/reject`, {
        headers: { 'x-correlation-id': 'caller-supplied-correlation-id' },
      })

      expect(response.status).toBe(422)
      expect(response.headers.get('x-correlation-id')).toBe('caller-supplied-correlation-id')
      const body = (await response.json()) as { kind: string; code: string }
      expect(body.kind).toBe('rejected')
      expect(body.code).toBe('duplicate-email')
    } finally {
      await host.stop()
    }
  })

  it('serves health and readiness routes', async () => {
    const host = createNodeHttpHost({
      routes: [],
      configuration,
      secretResolver,
    })

    const { port } = await host.start(0)
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`)
      expect(health.status).toBe(200)
      expect((await health.json()) as { healthy: boolean }).toMatchObject({ healthy: true })

      const ready = await fetch(`http://127.0.0.1:${port}/ready`)
      expect(ready.status).toBe(200)
      expect((await ready.json()) as { ready: boolean }).toMatchObject({ ready: true })
    } finally {
      await host.stop()
    }
  })

  it('maps an unhandled exception to a safe 500 failed outcome, never leaking a stack trace', async () => {
    const boomOperation: Operation<void, never, never, never> = {
      code: 'boom',
      execute() {
        throw new Error('leaking a raw stack trace and secret-value-should-never-appear-xyz789')
      },
    }

    const host = createNodeHttpHost({
      routes: [{ method: 'GET', path: '/boom', operation: boomOperation }],
      configuration,
      secretResolver,
    })

    const { port } = await host.start(0)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/boom`)
      expect(response.status).toBe(500)
      const text = await response.text()
      expect(text).not.toContain('secret-value-should-never-appear-xyz789')
      expect(text).not.toContain('.ts:')
    } finally {
      await host.stop()
    }
  })

  it('gracefully drains and closes the server on stop()', async () => {
    const echoOperation: Operation<void, string, never, never> = {
      code: 'echo',
      execute() {
        return Outcome.success('ok')
      },
    }

    const host = createNodeHttpHost({
      routes: [{ method: 'GET', path: '/echo', operation: echoOperation }],
      configuration,
      secretResolver,
    })

    const { port } = await host.start(0)
    const response = await fetch(`http://127.0.0.1:${port}/echo`)
    expect(response.status).toBe(200)

    await host.stop()

    await expect(fetch(`http://127.0.0.1:${port}/echo`)).rejects.toBeTruthy()
  })
})
