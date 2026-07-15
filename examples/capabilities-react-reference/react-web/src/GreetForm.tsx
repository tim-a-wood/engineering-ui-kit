/**
 * The single deployable UI trigger (§10.3, §19, CAP-TEST-059): a React
 * component that drives the `greet` operation entirely through the runtime's
 * `useOperation` hook (`@engineering-ui-kit/capabilities-runtime/react`) —
 * never by calling `greetOperation`/`dispatch` directly. `client` is expected
 * to be the `OperationClient` `./client.js` builds over the composition
 * root's in-process transport.
 */
import { useState } from 'react'
import { useOperation } from '@engineering-ui-kit/capabilities-runtime/react'
import type { OperationCallable } from '@engineering-ui-kit/capabilities-runtime/react'

import type { GreetInput, GreetRejection, GreetSuccess } from './domain/greet.js'
import { GREET_OPERATION_CODE } from './domain/greet.js'

export interface GreetFormProps {
  readonly client: OperationCallable
}

export function GreetForm({ client }: GreetFormProps) {
  const [name, setName] = useState('')
  const { state, isSubmitting, value, rejection, run } = useOperation<GreetInput, GreetSuccess, GreetRejection>(
    client,
    GREET_OPERATION_CODE,
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void run({ name })
      }}
    >
      <label htmlFor="greet-name">Name</label>
      <input id="greet-name" value={name} onChange={(event) => setName(event.target.value)} />
      <button type="submit" disabled={isSubmitting}>
        Greet
      </button>

      {state === 'loading' && <p role="status">Greeting…</p>}
      {state === 'success' && value !== undefined && <p role="status">{value.greeting}</p>}
      {state === 'rejected' && rejection !== undefined && (
        <p role="alert">Please enter a name (code: {rejection.code}).</p>
      )}
      {state === 'failed' && <p role="alert">Something went wrong. Please try again.</p>}
    </form>
  )
}
