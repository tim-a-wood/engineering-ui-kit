/**
 * CAP-TEST-044 — FrontendBinding (CAP-CONTRACT-013) migrates losslessly to a
 * ui InboundBinding (CAP-CONTRACT-028) and back.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  frontendBindingToInboundBinding,
  inboundBindingToFrontendBinding,
} from '../../src/capabilities/binding.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures')
const schemaDir = path.resolve(__dirname, '../../../../standards/schemas/capabilities')

function loadFrontendBinding(): FrontendBinding {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, 'frontend-binding-valid.json'), 'utf8'))
}

describe('CAP-TEST-044 FrontendBinding -> InboundBinding', () => {
  it('is lossless: the inverse recovers the original FrontendBinding exactly', () => {
    const original = loadFrontendBinding()
    const inbound = frontendBindingToInboundBinding(original, { deployableId: 'web' })
    expect(inbound.kind).toBe('ui')
    expect(inbound.exposure).toBe('private')
    expect(inbound.deployableId).toBe('web')
    expect(inboundBindingToFrontendBinding(inbound)).toEqual(original)
  })

  it('produces a schema-valid InboundBinding', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, 'inbound-binding.schema.json'), 'utf8'))
    const validate = ajv.compile(schema)
    const inbound = frontendBindingToInboundBinding(loadFrontendBinding(), { deployableId: 'web' })
    expect(validate(inbound), ajv.errorsText(validate.errors)).toBe(true)
  })
})
