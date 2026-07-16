/**
 * Plans the OpenAPI 3.1 document from the canonical records in
 * `./contract.js`, via the real `planOpenApiDocument` (CAP-ERA-001 §5.3,
 * §11.1 `python.ts`) — never hand-written. This IS the generated boundary
 * contract CAP-TEST-069 diffs against the live Python host's actually
 * served `/openapi.json` (structural agreement on path/method/request
 * schema shape), and the reference the typed React/TS client
 * (`../client/**`) is built against.
 */
import { planOpenApiDocument } from '../../../../packages/core/src/capabilities/generation/python.js'
import { HTTP_BINDINGS, OPERATIONS, SCHEMAS } from './contract.js'

export function generatePlaceOrderOpenApiDocument() {
  return planOpenApiDocument({
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    title: 'Capabilities React<->Python Reference API',
    apiVersion: '1.0.0',
    schemas: SCHEMAS,
    operations: OPERATIONS,
    httpBindings: HTTP_BINDINGS,
    documentFilePath: 'src/generated/openapi.json',
  })
}
