/**
 * REAL end-to-end test (handoff §19, §10.3 — CAP-TEST-057): starts the
 * ACTUAL `node:http` server produced by the composition root, sends an
 * ACTUAL HTTP request over the loopback interface with Node's built-in
 * `fetch`, and asserts on the typed outcome that came back through
 * `dispatch` inside the real host adapter. No operation is ever called
 * directly.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeHttpHost } from '@engineering-ui-kit/capabilities-runtime/node'
import { createHttpApp } from '../src/http/app.js'

describe('capabilities-ts-reference HTTP slice (real end-to-end)', () => {
  let host: NodeHttpHost | undefined

  afterEach(async () => {
    if (host) {
      await host.stop()
      host = undefined
    }
  })

  it('starts a real server and reaches the greet operation through the composition root for a success outcome', async () => {
    const app = createHttpApp()
    host = app.host
    const { port } = await host.start(0, '127.0.0.1')
    expect(port).toBeGreaterThan(0)

    const response = await fetch(`http://127.0.0.1:${port}/greet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-correlation-id')).toBeTruthy()
    const body = (await response.json()) as { kind: string; value: { greeting: string } }
    expect(body).toEqual({ kind: 'success', value: { greeting: 'Hello, Ada!' } })
  })

  it('maps the blank-name domain rejection to HTTP 422 through the same composition root', async () => {
    const app = createHttpApp()
    host = app.host
    const { port } = await host.start(0, '127.0.0.1')

    const response = await fetch(`http://127.0.0.1:${port}/greet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    })

    expect(response.status).toBe(422)
    const body = (await response.json()) as {
      kind: string
      code: string
      details: { field: string }
    }
    expect(body.kind).toBe('rejected')
    expect(body.code).toBe('blank-name')
    expect(body.details).toEqual({ field: 'name' })
  })

  it('serves liveness/readiness and always closes the server deterministically', async () => {
    const app = createHttpApp()
    host = app.host
    const { port } = await host.start(0, '127.0.0.1')

    const health = await fetch(`http://127.0.0.1:${port}/health`)
    expect(health.status).toBe(200)

    await host.stop()
    host = undefined

    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toBeTruthy()
  })
})
