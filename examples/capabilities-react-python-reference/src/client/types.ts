/**
 * Typed shapes for the `place order` operation, as seen from the
 * React/TS client side of the generated HTTP boundary. These types
 * describe the wire contract only (the generated OpenAPI component
 * schemas) — they contain no operation/domain logic of their own; the
 * REAL decision of success vs. `unknown_sku` vs. `insufficient_stock`
 * happens exclusively inside the live Python `PlaceOrderOperation`.
 */
import { PLACE_ORDER_OPERATION_ID } from '../generation/contract.js'

export const PLACE_ORDER_OPERATION_CODE = PLACE_ORDER_OPERATION_ID

export interface PlaceOrderInput {
  readonly customer_id: string
  readonly sku: string
  readonly quantity: number
}

export interface PlaceOrderSuccess {
  readonly order_id: string
  readonly customer_id: string
  readonly sku: string
  readonly quantity: number
  readonly unit_price_cents: number
  readonly total_cents: number
}

export interface UnknownSkuRejection {
  readonly sku: string
}

export interface InsufficientStockRejection {
  readonly sku: string
  readonly requested: number
  readonly available: number
}

/** `dispatch`'s own schema-validation rejection (`invalid_input`) — one entry per JSON-Schema violation. */
export type InvalidInputRejection = ReadonlyArray<{
  readonly path: unknown[]
  readonly message: string
  readonly validator: string
}>

export type PlaceOrderRejection = UnknownSkuRejection | InsufficientStockRejection | InvalidInputRejection
