// @vitest-environment jsdom
/**
 * CAP-TEST-066 (WP4B-react-python gate — handoff §Wave-4 gate): a REAL,
 * non-simulated round-trip. This test:
 *
 * 1. Spawns the ACTUAL Python FastAPI host
 *    (`../src/capabilities_react_python_reference/http_app.py`) as a REAL
 *    OS subprocess, using the venv interpreter, on a REAL ephemeral TCP
 *    port (`./support/python-server.js`) — no in-process/mocked transport.
 * 2. Waits for the subprocess to report readiness over its own real
 *    `/healthz` HTTP route.
 * 3. Renders the ACTUAL `PlaceOrderForm` React component, wired to the
 *    ACTUAL `OperationClient` built over a REAL `PythonHttpTransport`
 *    (`../src/client/http-transport.ts`) pointed at that subprocess's
 *    real loopback address.
 * 4. Drives it with REAL user interactions
 *    (`@testing-library/user-event`), which trigger a REAL `fetch()` HTTP
 *    request across a REAL network socket to the REAL Python process, and
 *    asserts on the typed `Outcome` that comes back — for BOTH a success
 *    input and a domain-rejection input.
 * 5. ALWAYS kills the subprocess in `afterAll` (SIGTERM), whether the test
 *    passed or failed.
 *
 * Nothing here calls `PlaceOrderOperation.execute` directly, imports any
 * Python module, or stubs `fetch` — the only path from "user clicks Place
 * order" to "operation ran" is `PlaceOrderForm` -> `useOperation` ->
 * `OperationClient` -> `PythonHttpTransport` -> a real HTTP request -> the
 * real Python process's `dispatch` -> `PlaceOrderOperation`, exactly as a
 * real deployment would drive it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { PlaceOrderForm } from '../src/react/PlaceOrderForm.js'
import { createReactPythonApp } from '../src/client/composition-root.js'
import { startPythonServer, type PythonServerHandle } from './support/python-server.js'

describe('CAP-TEST-066 React calls a live Python host (real end-to-end)', () => {
  let server: PythonServerHandle

  beforeAll(async () => {
    server = await startPythonServer()
  }, 30_000)

  afterAll(async () => {
    await server?.stop()
  })

  afterEach(() => {
    cleanup()
  })

  it('drives a real success round-trip through the live Python host', async () => {
    const user = userEvent.setup()
    const { client } = createReactPythonApp(server.baseUrl)
    render(<PlaceOrderForm client={client} />)

    await user.clear(screen.getByLabelText('SKU'))
    await user.type(screen.getByLabelText('SKU'), 'widget')
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '2')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/^Order order-\d{6} placed \(total 3998 cents\)\.$/)
  })

  it('drives a real domain-rejection round-trip through the live Python host', async () => {
    const user = userEvent.setup()
    const { client } = createReactPythonApp(server.baseUrl)
    render(<PlaceOrderForm client={client} />)

    await user.clear(screen.getByLabelText('SKU'))
    await user.type(screen.getByLabelText('SKU'), 'does-not-exist')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Order rejected (code: unknown_sku).')
  })
})
