/**
 * CAP-TEST-053 — planning reads nothing outside supplied evidence (no `node:*`
 * imports anywhere in `generation/`), and dependency plans use exact
 * constraints and reject a floating specifier.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isExactVersionSpecifier } from '../../../src/capabilities/generation/profile.js'
import { buildGenerationPlan, type GenerationPlanInput } from '../../../src/capabilities/generation/plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generationSourceDir = path.resolve(__dirname, '../../../src/capabilities/generation')

function listTypeScriptFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(directory, entry.name))
}

// Strip block and line comments before scanning for forbidden calls, so that
// documentation mentioning `node:`, `Date.now()`, etc. is not mistaken for use.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

describe('CAP-TEST-053 pure generator boundary and exact dependency constraints', () => {
  it('no file under generation/ imports node:* or uses Date.now()/Math.random()', () => {
    const files = listTypeScriptFiles(generationSourceDir)
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const file of files) {
      const code = stripComments(fs.readFileSync(file, 'utf8'))
      expect(code, `${file} must not import a node: builtin`).not.toMatch(/from\s+['"]node:/)
      expect(code, `${file} must not require() a node: builtin`).not.toMatch(/require\(\s*['"]node:/)
      expect(code, `${file} must not call Date.now()`).not.toMatch(/Date\.now\(/)
      expect(code, `${file} must not call Math.random()`).not.toMatch(/Math\.random\(/)
      expect(code, `${file} must not reference the global crypto object`).not.toMatch(/\bcrypto\./)
    }
  })

  it('isExactVersionSpecifier accepts only a single pinned version', () => {
    expect(isExactVersionSpecifier('5.0.0')).toBe(true)
    expect(isExactVersionSpecifier('2.9.0')).toBe(true)
    expect(isExactVersionSpecifier('latest')).toBe(false)
    expect(isExactVersionSpecifier('*')).toBe(false)
    expect(isExactVersionSpecifier('^1.2.3')).toBe(false)
    expect(isExactVersionSpecifier('~1.2.3')).toBe(false)
    expect(isExactVersionSpecifier('>=1.2.3')).toBe(false)
    expect(isExactVersionSpecifier('>1.0.0 <2.0.0')).toBe(false)
  })

  it('a GenerationPlan rejects a floating dependency specifier as a blocker, not a silent pin', () => {
    const input: GenerationPlanInput = {
      planId: 'plan-0001',
      projectId: 'proj-1',
      inputRecords: [],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: '.', cleanState: 'clean' },
      dependencyChanges: [
        { packageName: 'fastify', language: 'typescript', toVersion: 'latest', reason: 'http host' },
        { packageName: 'pydantic', language: 'python', toVersion: '2.9.0', reason: 'model validation' },
      ],
      fileChanges: [],
      commands: [],
      rollbackStrategy: 'staged-rename-with-journal',
    }
    const plan = buildGenerationPlan(input)
    expect(plan.dependencyChanges).toHaveLength(1)
    expect(plan.dependencyChanges[0]?.packageName).toBe('pydantic')
    expect(plan.dependencyChanges[0]?.toVersion).toBe('2.9.0')
    expect(plan.blockers.some((message) => message.includes('fastify') && message.includes('latest'))).toBe(true)
  })

  it('an accepted exact dependency change records committed-lockfile resolution intent', () => {
    const input: GenerationPlanInput = {
      planId: 'plan-0002',
      projectId: 'proj-1',
      inputRecords: [],
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      targetRepository: { root: '.', cleanState: 'clean' },
      dependencyChanges: [
        { packageName: 'fastify', language: 'typescript', toVersion: '5.0.0', reason: 'http host' },
      ],
      fileChanges: [],
      commands: [],
      rollbackStrategy: 'staged-rename-with-journal',
    }
    const plan = buildGenerationPlan(input)
    expect(plan.dependencyChanges).toHaveLength(1)
    expect(plan.dependencyChanges[0]?.reason).toContain('committed lockfile resolution')
    expect(plan.dependencyChanges[0]?.reason).toContain('fastify@5.0.0')
    expect(plan.blockers).toEqual([])
  })
})
