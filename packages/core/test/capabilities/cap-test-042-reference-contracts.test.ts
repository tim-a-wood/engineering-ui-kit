/**
 * CAP-TEST-042 — reference-architecture contracts (CAP-CONTRACT-023–031):
 * schema/fixture validity and secret-canary rejection.
 *
 * CAP-TEST-001 already covers schema existence, valid/invalid fixtures,
 * required-field parity, and forbidden-token checks for every registered id
 * (which now includes 023–031). This suite adds the CAP-ERA §15.1 guarantee
 * that a secret value can never survive on one of the new records.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { CONTRACT_SCHEMA_NAMES, type ContractId } from '../../src/capabilities/parity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaDir = path.resolve(__dirname, '../../../../standards/schemas/capabilities')
const fixtureDir = path.resolve(__dirname, 'fixtures')

const NEW_CONTRACT_IDS: ContractId[] = [
  'CAP-CONTRACT-023',
  'CAP-CONTRACT-024',
  'CAP-CONTRACT-025',
  'CAP-CONTRACT-026',
  'CAP-CONTRACT-027',
  'CAP-CONTRACT-028',
  'CAP-CONTRACT-029',
  'CAP-CONTRACT-030',
  'CAP-CONTRACT-031',
]

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv
}

function loadSchema(id: ContractId): object {
  return JSON.parse(fs.readFileSync(path.join(schemaDir, `${CONTRACT_SCHEMA_NAMES[id]}.schema.json`), 'utf8'))
}

function loadValidFixture(id: ContractId): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, `${CONTRACT_SCHEMA_NAMES[id]}-valid.json`), 'utf8'))
}

describe('CAP-TEST-042 reference-architecture contracts 023–031', () => {
  it('validates each new valid fixture and enforces additionalProperties:false', () => {
    const ajv = createAjv()
    for (const id of NEW_CONTRACT_IDS) {
      const schema = loadSchema(id) as { additionalProperties?: boolean }
      expect(schema.additionalProperties, `${id} must set additionalProperties:false`).toBe(false)
      const validate = ajv.compile(schema)
      const valid = loadValidFixture(id)
      expect(validate(valid), `${id} valid: ${ajv.errorsText(validate.errors)}`).toBe(true)
    }
  })

  it('rejects a leaked secret value on every new record (CAP-ERA §15.1)', () => {
    const ajv = createAjv()
    for (const id of NEW_CONTRACT_IDS) {
      const validate = ajv.compile(loadSchema(id))
      const leaked = { ...loadValidFixture(id), secretValue: 'CANARY-SECRET' }
      expect(validate(leaked), `${id} must reject an unknown secret field`).toBe(false)
    }
  })
})
