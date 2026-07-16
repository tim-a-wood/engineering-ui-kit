/**
 * The single deployable UI trigger (§10.3, §19): a React component that
 * drives the `orders.place` operation entirely through the runtime's
 * `useOperation` hook (`@engineering-ui-kit/capabilities-runtime/react`) —
 * never by calling the Python operation or any HTTP client method
 * directly. `client` is expected to be the `OperationClient`
 * `../client/composition-root.js` builds over the REAL
 * `PythonHttpTransport` (`../client/http-transport.js`).
 */
import { useState } from 'react'
import { useOperation } from '@engineering-ui-kit/capabilities-runtime/react'
import type { OperationCallable } from '@engineering-ui-kit/capabilities-runtime/react'

import { PLACE_ORDER_OPERATION_CODE } from '../client/types.js'
import type { PlaceOrderInput, PlaceOrderRejection, PlaceOrderSuccess } from '../client/types.js'

export interface PlaceOrderFormProps {
  readonly client: OperationCallable
}

export function PlaceOrderForm({ client }: PlaceOrderFormProps) {
  const [sku, setSku] = useState('widget')
  const [quantity, setQuantity] = useState(1)
  const { state, isSubmitting, value, rejection, run } = useOperation<
    PlaceOrderInput,
    PlaceOrderSuccess,
    PlaceOrderRejection
  >(client, PLACE_ORDER_OPERATION_CODE)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void run({ customer_id: 'cust-1', sku, quantity })
      }}
    >
      <label htmlFor="place-order-sku">SKU</label>
      <input id="place-order-sku" value={sku} onChange={(event) => setSku(event.target.value)} />

      <label htmlFor="place-order-quantity">Quantity</label>
      <input
        id="place-order-quantity"
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(Number(event.target.value))}
      />

      <button type="submit" disabled={isSubmitting}>
        Place order
      </button>

      {state === 'loading' && <p role="status">Placing order…</p>}
      {state === 'success' && value !== undefined && (
        <p role="status">Order {value.order_id} placed (total {value.total_cents} cents).</p>
      )}
      {state === 'rejected' && rejection !== undefined && <p role="alert">Order rejected (code: {rejection.code}).</p>}
      {state === 'failed' && <p role="alert">Something went wrong. Please try again.</p>}
    </form>
  )
}
