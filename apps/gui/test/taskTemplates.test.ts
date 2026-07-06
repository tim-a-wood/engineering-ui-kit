import { describe, expect, it } from 'vitest'
import { TASK_TEMPLATES, applyTemplate, defaultTemplateId } from '../src/taskTemplates'

describe('TASK_TEMPLATES', () => {
  it('offers the eight repeatable jobs with unique ids', () => {
    expect(TASK_TEMPLATES.length).toBe(8)
    const ids = TASK_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'standards-refresh',
      'new-ui-from-requirements',
      'new-ui-existing-api',
      'monolithic-web-app',
      'add-screen',
      'a11y-remediation',
      'data-viz-screen',
      'form-crud-screen',
    ]))
  })

  it('fills every packet section in every template', () => {
    for (const t of TASK_TEMPLATES) {
      for (const key of ['taskTitle', 'goal', 'scope', 'constraints', 'acceptanceCriteria', 'references'] as const) {
        expect(t[key].trim().length, `${t.id}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps the standards guardrails in every template', () => {
    for (const t of TASK_TEMPLATES) {
      expect(t.constraints, t.id).toMatch(/[Dd]ark-first/)
      expect(t.acceptanceCriteria, t.id).toMatch(/typecheck/)
    }
  })

  it('marks task-specific slots with REPLACE where user input is mandatory', () => {
    const needsInput = TASK_TEMPLATES.filter((t) => t.id !== 'standards-refresh' && t.id !== 'a11y-remediation')
    for (const t of needsInput) {
      expect(t.scope + t.references, t.id).toContain('REPLACE')
    }
  })
})

describe('applyTemplate', () => {
  it('interpolates the project name everywhere', () => {
    const t = TASK_TEMPLATES.find((x) => x.id === 'standards-refresh')!
    const filled = applyTemplate(t, 'acme-console')
    expect(filled.taskTitle).toBe('Apply Engineering UI Kit standards to acme-console')
    expect(filled.goal).toContain('acme-console')
    expect(JSON.stringify(filled)).not.toContain('{project}')
  })
})

describe('defaultTemplateId', () => {
  it('matches by exact title, case-insensitively', () => {
    expect(defaultTemplateId('Apply UI Kit standards to an existing UI')).toBe('standards-refresh')
    expect(defaultTemplateId('create a monolithic web app'.toUpperCase())).toBe('monolithic-web-app')
  })

  it('matches by id and falls back to standards-refresh', () => {
    expect(defaultTemplateId('data-viz-screen')).toBe('data-viz-screen')
    expect(defaultTemplateId('Standard Web App')).toBe('standards-refresh')
    expect(defaultTemplateId('')).toBe('standards-refresh')
  })
})
