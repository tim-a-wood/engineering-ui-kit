/**
 * CAP-TEST-043 — canonical serialization and hash stability for the new
 * reference-architecture records (CAP-CONTRACT-023–031).
 *
 * canonicalHash is order-sensitive by design (sha256 of JSON.stringify), so
 * records must be hashed through canonicalRecordHash, which sorts object keys
 * recursively. This proves a record and any key-reordered clone hash identically.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { canonicalHash, canonicalRecordHash } from '../../src/capabilities/hash.js'
import { CONTRACT_SCHEMA_NAMES, type ContractId } from '../../src/capabilities/parity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

function loadValidFixture(id: ContractId): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, `${CONTRACT_SCHEMA_NAMES[id]}-valid.json`), 'utf8'))
}

/** Recursively reverse object key order to simulate a differently-ordered record. */
function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).reverse()
    const out: Record<string, unknown> = {}
    for (const [key, inner] of entries) out[key] = reorderKeys(inner)
    return out
  }
  return value
}

describe('CAP-TEST-043 canonical hash stability 023–031', () => {
  it('canonicalRecordHash is invariant to object key ordering', () => {
    for (const id of NEW_CONTRACT_IDS) {
      const fixture = loadValidFixture(id)
      const reordered = reorderKeys(fixture)
      expect(canonicalRecordHash(reordered), `${id} canonical hash must ignore key order`).toBe(
        canonicalRecordHash(fixture),
      )
    }
  })

  it('confirms the order-sensitive canonicalHash actually differs on reorder (guards the need for canonicalRecordHash)', () => {
    // reference-architecture-profile has multiple top-level keys; reversing them
    // must change the raw canonicalHash, proving canonicalRecordHash is required.
    const fixture = loadValidFixture('CAP-CONTRACT-023')
    const reordered = reorderKeys(fixture)
    expect(canonicalHash(reordered)).not.toBe(canonicalHash(fixture))
  })
})
