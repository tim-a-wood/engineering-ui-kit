// @vitest-environment jsdom
/**
 * REAL single-deployable UI trigger -> operation end-to-end test (§10.3,
 * §19 — CAP-TEST-059): renders the ACTUAL `GreetForm` component wired to the
 * ACTUAL `OperationClient` the composition root builds, drives it with a
 * REAL user interaction (`@testing-library/user-event`), and asserts on the
 * loading -> success and loading -> domain-rejection states the component
 * renders. Nothing in this test calls `greetOperation` or `dispatch`
 * directly — the only path from "user clicks Greet" to "operation ran" is
 * `GreetForm` -> `useOperation` -> `OperationClient` -> `InProcessBrowserTransport`
 * -> `dispatch` -> `greetOperation`, exactly as a real browser deployment
 * would drive it (minus the network hop, which `InProcessBrowserTransport`
 * documents it deliberately elides).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { GreetForm } from '../src/GreetForm.js'
import { createReactWebApp } from '../src/client.js'

afterEach(() => {
  cleanup()
})

describe('capabilities-react-reference React-web slice (real end-to-end)', () => {
  it('triggers the greet operation through the hook and renders loading -> success', async () => {
    const user = userEvent.setup()
    const { client } = createReactWebApp()
    render(<GreetForm client={client} />)

    await user.type(screen.getByLabelText('Name'), 'Ada')

    const submit = screen.getByRole('button', { name: 'Greet' })
    await user.click(submit)

    // The operation resolves asynchronously through the real dispatch
    // boundary; `findByRole` waits for the success message to appear.
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('Hello, Ada!')
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('triggers the greet operation for a blank name and renders the domain rejection', async () => {
    const user = userEvent.setup()
    const { client } = createReactWebApp()
    render(<GreetForm client={client} />)

    const submit = screen.getByRole('button', { name: 'Greet' })
    await user.click(submit)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Please enter a name (code: blank-name).')
  })

  it('renders the loading state synchronously before the in-flight dispatch settles', () => {
    const { client } = createReactWebApp()
    render(<GreetForm client={client} />)

    const submit = screen.getByRole('button', { name: 'Greet' }) as HTMLButtonElement
    // `fireEvent.submit` (unlike awaited `userEvent.click`) does not itself
    // await any microtasks, so the `useOperation` controller's synchronous
    // `loading` snapshot update is observable here, before the real
    // dispatch call to `greetOperation` has had a chance to resolve.
    act(() => {
      fireEvent.submit(submit.closest('form') as HTMLFormElement)
    })

    expect(submit.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Greeting…')
  })
})
