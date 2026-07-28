import fs from 'node:fs'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  canonicalHash,
  evaluateApplicationSte,
  evaluateArchitectureSte,
  evaluateFoundationSte,
  evaluateModuleImplementationSte,
  type ApplicationSpecification,
  type ArchitectureSpecification,
  type FoundationPlan,
  type ModuleImplementationSpecification,
} from '../../src/capabilities/index.js'

const sampleRoot = path.resolve(
  process.cwd(),
  '../../examples/do178-audit-hub/capabilities/approved',
)
const moduleSchemaPath = path.resolve(
  process.cwd(),
  '../../standards/schemas/capabilities/module-implementation-specification.schema.json',
)
const implementationArchitecturePath = path.resolve(
  sampleRoot,
  '../implementation-architecture.json',
)

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

describe('DO-178 Audit Hub deterministic STE profile', () => {
  it('has no deterministic application or architecture defects', () => {
    const application = readJson<ApplicationSpecification>(
      path.join(sampleRoot, 'application.json'),
    )
    const architecture = readJson<ArchitectureSpecification>(
      path.join(sampleRoot, 'architecture.json'),
    )

    expect(evaluateApplicationSte(application).diagnostics).toEqual([])
    expect(evaluateArchitectureSte(architecture).diagnostics).toEqual([])
  })

  it('keeps the approved record hash chain current', () => {
    const application = readJson<ApplicationSpecification>(
      path.join(sampleRoot, 'application.json'),
    )
    const architecture = readJson<ArchitectureSpecification>(
      path.join(sampleRoot, 'architecture.json'),
    )
    const foundation = readJson<FoundationPlan>(
      path.join(sampleRoot, 'foundation.json'),
    )
    const implementationArchitecture = readJson<{
      refines: { architectureHash: string }
    }>(implementationArchitecturePath)
    const {
      contentHash: applicationHash,
      approvedAt: _applicationApprovedAt,
      ...applicationBody
    } = application
    const {
      contentHash: architectureHash,
      approvedAt: _architectureApprovedAt,
      ...architectureBody
    } = architecture

    expect(canonicalHash(applicationBody)).toBe(applicationHash)
    expect(architecture.applicationSpecHash).toBe(applicationHash)
    expect(canonicalHash(architectureBody)).toBe(architectureHash)
    expect(foundation.architectureHash).toBe(architectureHash)
    expect(implementationArchitecture.refines.architectureHash).toBe(architectureHash)
  })

  it('has a canonical foundation plan with no deterministic defects', () => {
    const foundation = readJson<FoundationPlan>(
      path.join(sampleRoot, 'foundation.json'),
    )
    const { contentHash, ...body } = foundation

    expect(foundation.schemaVersion).toBe('1.0')
    expect(foundation.deployables.length).toBeGreaterThan(0)
    expect(canonicalHash(body)).toBe(contentHash)
    expect(evaluateFoundationSte(foundation).diagnostics).toEqual([])
  })

  it('has no deterministic module defects', () => {
    const moduleRoot = path.join(sampleRoot, 'module-specifications')
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(readJson<Record<string, unknown>>(moduleSchemaPath))
    const schemaFailures: { fileName: string; errors: unknown }[] = []
    const failures = fs.readdirSync(moduleRoot)
      .filter((fileName) => fileName.endsWith('.json'))
      .sort()
      .flatMap((fileName) => {
        const record = readJson<ModuleImplementationSpecification>(path.join(moduleRoot, fileName))
        if (!validate(record)) {
          schemaFailures.push({
            fileName,
            errors: structuredClone(validate.errors),
          })
        }
        return evaluateModuleImplementationSte(record).diagnostics.map((item) => ({
          ...item,
          fieldPath: `${fileName}:${item.fieldPath ?? 'module'}`,
        }))
      })

    expect(schemaFailures).toEqual([])
    expect(failures).toEqual([])
  })
})
