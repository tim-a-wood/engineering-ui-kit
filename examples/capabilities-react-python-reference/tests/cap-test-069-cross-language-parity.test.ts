/**
 * CAP-TEST-069 (WP4B-react-python gate — handoff §Wave-4 gate): genuine
 * cross-language parity, in two parts.
 *
 * (a) TS and Python accept/reject the SAME canonical fixture bytes
 *     (`../fixtures/*.json`, read once and reused verbatim by both
 *     languages — never re-typed per language):
 *     - TS's OWN validator (`AjvValidator`, Draft 2020-12 — the exact
 *       validator `dispatch` uses on the TS side) validates each fixture
 *       against `PLACE_ORDER_INPUT_JSON_SCHEMA`
 *       (`../src/client/place-order-schema.ts`), hand-mirrored
 *       byte-for-byte against the Python literal.
 *     - Python's OWN validator is exercised for real: each fixture is
 *       POSTed, unmodified, to the REAL live Python
 *       `HttpOperationHost` subprocess (the same `dispatch` +
 *       `jsonschema.Draft202012Validator` path CAP-TEST-066 drives via
 *       the React client), and the HTTP response's `code` is inspected.
 *     - A schema-malformed fixture is rejected by BOTH; a schema-valid
 *       fixture is accepted by BOTH (independent of whether Python's
 *       OWN domain logic later also rejects it for a business reason —
 *       that is a *separate*, correctly-agreeing layer, not schema
 *       rejection).
 *
 * (b) The generated OpenAPI 3.1 document (`planOpenApiDocument`, via
 *     `../src/generation/generate-openapi.ts`) agrees with the Python
 *     server's ACTUALLY SERVED `/openapi.json` on the operation's path,
 *     method, and request schema shape — the generated doc IS the
 *     contract the server honors (`host.assert_openapi_consistent()` in
 *     `http_app.py` already proves the served doc matches what
 *     `dispatch` validates against on the Python side; this test proves
 *     the TS-generated doc agrees with that same served doc).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AjvValidator } from '@engineering-ui-kit/capabilities-runtime'

import { PLACE_ORDER_INPUT_JSON_SCHEMA } from '../src/client/place-order-schema.js'
import { generatePlaceOrderOpenApiDocument } from '../src/generation/generate-openapi.js'
import { PLACE_ORDER_HTTP_PATH } from '../src/generation/contract.js'
import { startPythonServer, type PythonServerHandle } from './support/python-server.js'

const FIXTURES_DIR = path.resolve(fileURLToPath(new URL('../fixtures', import.meta.url)))

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), 'utf8'))
}

const ACCEPT_FIXTURE = readFixture('canonical-accept.json')
const REJECT_DOMAIN_FIXTURE = readFixture('canonical-reject-domain-unknown-sku.json')
const REJECT_MALFORMED_FIXTURE = readFixture('canonical-reject-malformed.json')

interface JsonSchemaObjectShape {
  readonly type: string
  readonly properties: Record<string, { readonly type: string }>
  readonly required?: readonly string[]
  readonly additionalProperties?: boolean
}

async function postOrder(baseUrl: string, input: unknown): Promise<{ status: number; body: { kind: string; code?: string } }> {
  const response = await fetch(`${baseUrl}${PLACE_ORDER_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return { status: response.status, body: await response.json() }
}

describe('CAP-TEST-069 cross-language parity (TS <-> live Python)', () => {
  let server: PythonServerHandle

  beforeAll(async () => {
    server = await startPythonServer()
  }, 30_000)

  afterAll(async () => {
    await server?.stop()
  })

  describe('(a) canonical fixtures accept/reject identically in both languages', () => {
    const validator = new AjvValidator(PLACE_ORDER_INPUT_JSON_SCHEMA)

    it('a schema-valid, domain-success fixture is accepted by TS validation and by the live Python host', async () => {
      expect(validator.validate(ACCEPT_FIXTURE).valid).toBe(true)

      const { status, body } = await postOrder(server.baseUrl, ACCEPT_FIXTURE)
      expect(status).toBe(201)
      expect(body.kind).toBe('success')
    })

    it('a schema-valid, domain-rejected fixture is accepted by TS SCHEMA validation and reaches the Python operation (which then rejects it for a business reason)', async () => {
      // TS has no domain logic of its own (per this packet's constraints);
      // it only proves the fixture is well-formed input, exactly as
      // `dispatch`'s JSON-Schema validation step does on the Python side
      // BEFORE `PlaceOrderOperation.execute` ever runs.
      expect(validator.validate(REJECT_DOMAIN_FIXTURE).valid).toBe(true)

      const { status, body } = await postOrder(server.baseUrl, REJECT_DOMAIN_FIXTURE)
      expect(status).toBe(422)
      expect(body.kind).toBe('rejected')
      expect(body.code).toBe('unknown_sku')
      // Confirms the rejection is a DOMAIN rejection, not a schema one —
      // parity is specifically about schema-level accept/reject here.
      expect(body.code).not.toBe('invalid_input')
    })

    it('a malformed fixture (missing a required field) is rejected by BOTH TS validation and the live Python host', async () => {
      const result = validator.validate(REJECT_MALFORMED_FIXTURE)
      expect(result.valid).toBe(false)
      expect(result.errors?.some((error) => error.message.includes('quantity'))).toBe(true)

      const { status, body } = await postOrder(server.baseUrl, REJECT_MALFORMED_FIXTURE)
      expect(status).toBe(422)
      expect(body.kind).toBe('rejected')
      expect(body.code).toBe('invalid_input')
    })
  })

  describe('(b) the generated OpenAPI document agrees with the Python host\'s actually-served /openapi.json', () => {
    it('agrees on path, method, and request-body schema shape', async () => {
      const generated = generatePlaceOrderOpenApiDocument()
      expect(generated.diagnostics).toEqual([])

      const served = (await (await fetch(`${server.baseUrl}/openapi.json`)).json()) as {
        openapi: string
        paths: Record<string, Record<string, { requestBody: { required: boolean; content: { 'application/json': { schema: JsonSchemaObjectShape } } } }>>
      }

      // Both are OpenAPI 3.1.x documents.
      expect(generated.document.openapi).toMatch(/^3\.1\.\d+$/)
      expect(served.openapi).toMatch(/^3\.1\.\d+$/)

      // Same path, same method.
      const generatedPaths = generated.document.paths as Record<string, Record<string, unknown>>
      expect(Object.keys(generatedPaths)).toContain(PLACE_ORDER_HTTP_PATH)
      expect(Object.keys(served.paths)).toContain(PLACE_ORDER_HTTP_PATH)
      expect(generatedPaths[PLACE_ORDER_HTTP_PATH]).toHaveProperty('post')
      expect(served.paths[PLACE_ORDER_HTTP_PATH]).toHaveProperty('post')

      const generatedRequestBody = (
        generatedPaths[PLACE_ORDER_HTTP_PATH]!.post as {
          requestBody: { required: boolean; content: { 'application/json': { schema: { $ref: string } } } }
        }
      ).requestBody
      const servedRequestBody = served.paths[PLACE_ORDER_HTTP_PATH]!.post!.requestBody

      expect(generatedRequestBody.required).toBe(true)
      expect(servedRequestBody.required).toBe(true)
      expect(generatedRequestBody.content['application/json']).toBeDefined()
      expect(servedRequestBody.content['application/json']).toBeDefined()

      // Dereference the generated doc's request schema $ref against its
      // own components, since `planOpenApiDocument` emits component
      // references rather than inlining, while Python's auto-generated
      // doc inlines the schema literally (`openapi_extra`, see
      // `runtimes/python/.../http/routing.py`). "Shape" agreement here
      // means: same property names, same required set, same
      // `additionalProperties: false`, and matching per-property JSON
      // Schema `type` — the generator does not emit finer-grained
      // keywords like `minLength`/`minimum` (see `python.ts`
      // `schemaNodeToJsonSchema`), so those extra Python-side constraints
      // are intentionally not part of this comparison.
      const generatedSchemaRef = generatedRequestBody.content['application/json'].schema.$ref
      const componentName = generatedSchemaRef.replace('#/components/schemas/', '')
      const generatedSchema = (generated.document.components as { schemas: Record<string, JsonSchemaObjectShape> })
        .schemas[componentName]!
      const servedSchema = servedRequestBody.content['application/json'].schema

      expect(generatedSchema.type).toBe(servedSchema.type)
      expect(generatedSchema.additionalProperties).toBe(servedSchema.additionalProperties)
      expect([...(generatedSchema.required ?? [])].sort()).toEqual([...(servedSchema.required ?? [])].sort())
      expect(Object.keys(generatedSchema.properties).sort()).toEqual(Object.keys(servedSchema.properties).sort())
      for (const propertyName of Object.keys(generatedSchema.properties)) {
        expect(generatedSchema.properties[propertyName]!.type).toBe(servedSchema.properties[propertyName]!.type)
      }
    })

    it('both documents declare a response for the success status, with a JSON content type', async () => {
      const generated = generatePlaceOrderOpenApiDocument()
      const served = (await (await fetch(`${server.baseUrl}/openapi.json`)).json()) as {
        paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, unknown> }> }>>
      }

      const generatedResponses = (
        (generated.document.paths as Record<string, Record<string, unknown>>)[PLACE_ORDER_HTTP_PATH]!
          .post as { responses: Record<string, { content: Record<string, unknown> }> }
      ).responses
      const servedResponses = served.paths[PLACE_ORDER_HTTP_PATH]!.post!.responses

      expect(generatedResponses['200']!.content['application/json']).toBeDefined()
      // Known, documented gap (out of scope for this packet — shared
      // runtime code, not this example): `add_operation_route` never
      // registers a `response_model`, so Python's auto-generated doc
      // leaves the success response schema unconstrained (`{}`). Real
      // response-shape agreement is instead proven at runtime by
      // CAP-TEST-066's live round-trip (the actual JSON body returned
      // matches the generated `PlaceOrderSuccess` component shape byte
      // for byte); this assertion only confirms BOTH documents declare a
      // JSON success response entry for the operation at all.
      expect(servedResponses['200']!.content?.['application/json']).toBeDefined()
    })
  })
})
