import { describe, expect, it } from 'vitest'
import { lintTaskPacket, type TaskPacketLintFields } from '../src/index.js'

const valid: TaskPacketLintFields = {
  taskTitle: 'Build audit hub',
  goal: 'Implement a self-contained audit hub with a backend and file-based persistence.',
  scope: 'React frontend\nNode backend\nTyped JSON API',
  constraints: 'Keep client and server separated by the API.',
  acceptanceCriteria: 'Build passes\nRecords persist after restart.',
  references: 'REQUIREMENTS.md',
  intentProfile: {
    delivery: 'full-app',
    backend: 'required',
    network: 'required',
    persistence: 'required',
    filesystem: 'required',
  },
}

describe('lintTaskPacket', () => {
  it('accepts a complete internally consistent packet', () => {
    expect(lintTaskPacket(valid)).toEqual({ valid: true, diagnostics: [] })
  })

  it('blocks every unresolved template marker regardless of section', () => {
    const result = lintTaskPacket({
      ...valid,
      scope: 'REPLACE: describe the backend.',
      references: 'TODO: attach the requirements.',
    })
    expect(result.valid).toBe(false)
    expect(result.diagnostics.filter((item) => item.code === 'PACKET-PLACEHOLDER-001')).toHaveLength(2)
  })

  it('blocks structured intent that contradicts generic template constraints', () => {
    const result = lintTaskPacket({
      ...valid,
      constraints: 'Local React state only. No persistence, network requests, backend, or filesystem access.',
    })
    expect(result.valid).toBe(false)
    expect(result.diagnostics.filter((item) => item.code === 'PACKET-CONTRADICTION-001').map((item) => item.message))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('backend'),
        expect.stringContaining('network'),
        expect.stringContaining('persistence'),
        expect.stringContaining('filesystem'),
      ]))
  })

  it('detects a prose contradiction even when a legacy packet has no intent profile', () => {
    const result = lintTaskPacket({
      ...valid,
      intentProfile: undefined,
      goal: 'Implement a backend with file-based persistence.',
      constraints: 'No backend and no filesystem access. Do not persist records.',
    })
    expect(result.valid).toBe(false)
    expect(result.diagnostics.some((item) => item.code === 'PACKET-CONTRADICTION-001')).toBe(true)
  })
})
