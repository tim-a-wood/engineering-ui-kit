import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(here, '../../../..')
const schemaRoot = path.join(repository, 'standards/schemas/capabilities')
const sampleRoot = path.join(repository, 'examples/do178-audit-hub/capabilities/approved')

function json(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

describe('behavior model JSON schemas', () => {
  it('validates the migrated DO-178C application, architecture, and module designs', () => {
    const schemaNames = [
      'activity-graph.schema.json',
      'application-workflow.schema.json',
      'application-specification.schema.json',
      'architecture-specification.schema.json',
      'module-design-specification.schema.json',
      'capability-workspace-index.schema.json',
    ]
    const schemas = schemaNames.map((name) => json(path.join(schemaRoot, name)) as {
      $id: string
      title: string
    })
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    for (const schema of schemas) ajv.addSchema(schema)

    const cases = [
      ['CAP-CONTRACT-001', path.join(sampleRoot, 'application.json')],
      ['CAP-CONTRACT-002', path.join(sampleRoot, 'architecture.json')],
      ...fs.readdirSync(path.join(sampleRoot, 'module-designs'))
        .map((name) => ['Module design specification', path.join(sampleRoot, 'module-designs', name)]),
    ]
    for (const [title, filePath] of cases) {
      const schema = schemas.find((item) => item.title === title)!
      const valid = ajv.validate(schema.$id, json(filePath))
      expect(ajv.errors, filePath).toBeFalsy()
      expect(valid, filePath).toBe(true)
    }
  })
})
