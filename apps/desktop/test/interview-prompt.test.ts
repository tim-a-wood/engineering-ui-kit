import { describe, expect, it } from 'vitest'
import { buildInterviewPacket, buildProductInterviewPacket } from '@engineering-ui-kit/core'
import { interactiveInterviewPrompt } from '../src/capabilities/interviewPrompt.js'

describe('interactive capability interview prompt', () => {
  it('runs product discovery as one draft-first review instead of a serial questionnaire', () => {
    const prompt = interactiveInterviewPrompt(buildProductInterviewPacket({
      packetId: 'packet-product',
      projectId: 'project',
      facts: ['purpose:Coordinate maintenance work', 'actor:Dispatcher'],
    }))

    expect(prompt).toMatch(/fast, draft-first review/i)
    expect(prompt).toMatch(/reply “accept” or list corrections/i)
    expect(prompt).toMatch(/no more than five decision-rich prompts/i)
    expect(prompt).toMatch(/at most one follow-up batch/i)
    expect(prompt).toMatch(/do not walk through schema fields one by one/i)
    expect(prompt).toMatch(/empty unresolvedQuestions array/i)
    expect(prompt).toMatch(/return only a new capability-interview-response\.json/i)
  })

  it('preserves concrete contracts and schemas while shortening module definition', () => {
    const packet = buildInterviewPacket({
      packetId: 'packet-module',
      projectId: 'project',
      interviewKind: 'module',
      gateId: 'CAP-GATE-003',
      inputContext: {
        recordIds: ['app', 'mod.orders'],
        revisions: ['1'],
        hashes: ['hash'],
        facts: ['moduleType:domain', 'moduleVersion:1.0.0', 'detail:responsibility'],
        glossary: [],
      },
      interviewBoundary: 'Define mod.orders only.',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })
    const prompt = interactiveInterviewPrompt(packet)

    expect(prompt).toMatch(/draft concrete answers for every applicable detail/i)
    expect(prompt).toMatch(/do not conduct a serial,? field-by-field interview/i)
    expect(prompt).toMatch(/matching operationContracts entry/i)
    expect(prompt).toMatch(/resolve to concrete dataSchemas entries/i)
  })
})
