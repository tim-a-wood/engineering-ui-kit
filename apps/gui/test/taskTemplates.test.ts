import { describe, expect, it } from 'vitest'
import { TASK_TEMPLATES, applyTemplate, defaultTemplateId, parseFeedbackEntries } from '../src/taskTemplates'

describe('TASK_TEMPLATES', () => {
  it('offers the ten repeatable jobs with unique ids', () => {
    expect(TASK_TEMPLATES.length).toBe(10)
    const ids = TASK_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'standards-refresh',
      'requirements-from-brief',
      'new-ui-from-requirements',
      'new-ui-existing-api',
      'monolithic-web-app',
      'iterate-on-feedback',
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
    expect(filled.taskTitle).toBe('Visual refresh for acme-console')
    expect(filled.goal).toContain('acme-console')
    expect(JSON.stringify(filled)).not.toContain('{project}')
  })
})

describe('parseFeedbackEntries', () => {
  it('parses timestamped notes and skips malformed blocks', () => {
    const notes = [
      '## 2026-07-09T20:00:00.000Z',
      '',
      'Make the overdue badge bolder.',
      '',
      '## 2026-07-09T21:30:00.000Z',
      '',
      'Increase tag font size.',
      'Keep the table dense.',
      '',
      '## not-a-date',
      '',
      'ignored',
      '',
    ].join('\n')
    const entries = parseFeedbackEntries(notes)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ at: '2026-07-09T20:00:00.000Z', text: 'Make the overdue badge bolder.' })
    expect(entries[1]!.text).toContain('Keep the table dense.')
  })

  it('returns nothing for empty or headerless notes', () => {
    expect(parseFeedbackEntries('')).toHaveLength(0)
    expect(parseFeedbackEntries('free text without headers')).toHaveLength(0)
  })
})

describe('defaultTemplateId', () => {
  it('matches by exact title, case-insensitively', () => {
    expect(defaultTemplateId('Apply UI Kit standards to an existing UI')).toBe('standards-refresh')
    expect(defaultTemplateId('self-contained app'.toUpperCase())).toBe('monolithic-web-app')
  })

  it('matches by id and falls back to standards-refresh', () => {
    expect(defaultTemplateId('data-viz-screen')).toBe('data-viz-screen')
    expect(defaultTemplateId('Standard Web App')).toBe('standards-refresh')
    expect(defaultTemplateId('')).toBe('standards-refresh')
  })
})
