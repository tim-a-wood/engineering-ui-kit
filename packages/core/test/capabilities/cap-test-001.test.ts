/**
 * CAP-TEST-001 — Version 1 schema family, fixtures, and schema/type parity.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  ADAPTER_SPECIFIC_CONTRACTS,
  CONTRACT_IDS,
  CONTRACT_REQUIRED_FIELDS,
  CONTRACT_SCHEMA_NAMES,
  FORBIDDEN_DOMAIN_PROPERTY_TOKENS,
  MODULE_TYPES,
  RESULT_OUTCOMES,
  FRESHNESS_STATES,
  type ContractId,
} from '../../src/capabilities/parity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaDir = path.resolve(__dirname, '../../../../standards/schemas/capabilities')
const fixtureDir = path.resolve(__dirname, 'fixtures')

function loadSchema(id: ContractId): object {
  const file = path.join(schemaDir, `${CONTRACT_SCHEMA_NAMES[id]}.schema.json`)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as object
}

function collectPropertyKeys(node: unknown, keys: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return keys
  const obj = node as Record<string, unknown>
  if (obj.properties && typeof obj.properties === 'object') {
    for (const key of Object.keys(obj.properties as object)) {
      keys.add(key.toLowerCase())
      collectPropertyKeys((obj.properties as Record<string, unknown>)[key], keys)
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectPropertyKeys(value, keys)
  }
  return keys
}

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv
}

describe('CAP-TEST-001 schema family and parity', () => {
  it('has a schema file for every CAP-CONTRACT-001–022', () => {
    for (const id of CONTRACT_IDS) {
      const file = path.join(schemaDir, `${CONTRACT_SCHEMA_NAMES[id]}.schema.json`)
      expect(fs.existsSync(file), file).toBe(true)
    }
  })

  it('validates all valid fixtures and rejects invalid fixtures', () => {
    const ajv = createAjv()
    for (const id of CONTRACT_IDS) {
      const schema = loadSchema(id)
      const validate = ajv.compile(schema)
      const base = CONTRACT_SCHEMA_NAMES[id]
      const validPath = path.join(fixtureDir, `${base}-valid.json`)
      const invalidPath = path.join(fixtureDir, `${base}-invalid.json`)
      expect(fs.existsSync(validPath), validPath).toBe(true)
      expect(fs.existsSync(invalidPath), invalidPath).toBe(true)
      const valid = JSON.parse(fs.readFileSync(validPath, 'utf8'))
      const invalid = JSON.parse(fs.readFileSync(invalidPath, 'utf8'))
      expect(validate(valid), `${id} valid: ${ajv.errorsText(validate.errors)}`).toBe(true)
      expect(validate(invalid), `${id} invalid should fail`).toBe(false)
      expect(validate.errors?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('accepts unrelated-domain application specifications against the same schema', () => {
    const ajv = createAjv()
    const validate = ajv.compile(loadSchema('CAP-CONTRACT-001'))
    const inventory = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'application-specification-valid.json'), 'utf8'),
    )
    const music = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'application-specification-valid-music.json'), 'utf8'),
    )
    expect(validate(inventory)).toBe(true)
    expect(validate(music)).toBe(true)
  })

  it('keeps domain-neutral property keys outside adapter-specific contracts', () => {
    for (const id of CONTRACT_IDS) {
      if ((ADAPTER_SPECIFIC_CONTRACTS as readonly string[]).includes(id)) continue
      const keys = collectPropertyKeys(loadSchema(id))
      for (const token of FORBIDDEN_DOMAIN_PROPERTY_TOKENS) {
        for (const key of keys) {
          expect(key.includes(token), `${id} property contains forbidden token ${token}: ${key}`).toBe(
            false,
          )
        }
      }
    }
  })

  it('maintains schema/type parity for required fields and shared enums', () => {
    for (const id of CONTRACT_IDS) {
      if (id === 'CAP-CONTRACT-009') {
        // oneOf — parity uses kind discriminator only at top catalogue level
        expect(CONTRACT_REQUIRED_FIELDS[id]).toEqual(['schemaVersion', 'kind'])
        continue
      }
      const schema = loadSchema(id) as { required?: string[]; properties?: Record<string, unknown> }
      expect(schema.required?.slice().sort()).toEqual(
        [...CONTRACT_REQUIRED_FIELDS[id]].slice().sort(),
      )
      for (const field of CONTRACT_REQUIRED_FIELDS[id]) {
        if (field === 'schemaVersion') continue
        expect(schema.properties?.[field], `${id} missing property ${field}`).toBeDefined()
      }
    }

    const moduleSchema = loadSchema('CAP-CONTRACT-003') as {
      properties: { moduleType: { enum: string[] } }
    }
    expect(moduleSchema.properties.moduleType.enum).toEqual([...MODULE_TYPES])

    const resultSchema = loadSchema('CAP-CONTRACT-005') as {
      properties: { outcome: { enum: string[] } }
    }
    expect(resultSchema.properties.outcome.enum).toEqual([...RESULT_OUTCOMES])

    const freshnessSchema = loadSchema('CAP-CONTRACT-012') as {
      properties: { primaryState: { enum: string[] } }
    }
    expect(freshnessSchema.properties.primaryState.enum).toEqual([...FRESHNESS_STATES])
  })

  it('rejects secret values on secret-reference fixtures (CAP-CONTRACT-009)', () => {
    const ajv = createAjv()
    const validate = ajv.compile(loadSchema('CAP-CONTRACT-009'))
    const secret = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'configuration-and-secret-reference-valid-secret.json'), 'utf8'),
    )
    expect(validate(secret)).toBe(true)
    const leaked = {
      ...secret,
      secretValue: 'CANARY-SECRET',
    }
    expect(validate(leaked)).toBe(false)
  })
})
