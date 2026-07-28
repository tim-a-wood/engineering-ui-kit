import { describe, expect, it } from 'vitest'
import { buildInterviewPacket, buildProductInterviewPacket } from '@engineering-ui-kit/core'
import { interactiveInterviewPrompt } from '../src/capabilities/interviewPrompt.js'
import { interviewResponseStarter } from '../src/capabilities/interviewResponseStarter.js'

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
    expect(prompt).toContain('ASD-STE100')
    expect(prompt).toContain('VERB + OBJECT')
    expect(prompt).toMatch(/structured applicationWorkflows/i)
    expect(prompt).toMatch(/do not allocate modules or add internal software design/i)
  })

  it('keeps solution allocation out of application and internal algorithms out of architecture', () => {
    const packet = buildInterviewPacket({
      packetId: 'packet-architecture',
      projectId: 'project',
      interviewKind: 'architecture',
      gateId: 'CAP-GATE-002',
      inputContext: {
        recordIds: ['app'],
        revisions: ['1'],
        hashes: ['hash'],
        facts: [],
        glossary: [],
      },
      interviewBoundary: 'Define solution allocation only.',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })
    const prompt = interactiveInterviewPrompt(packet)

    expect(prompt).toMatch(/allocate every executable application workflow node/i)
    expect(prompt).toMatch(/operation, event, entry point, or output/i)
    expect(prompt).toMatch(/do not add internal module algorithms/i)
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
        glossary: [{ id: 'term.work-order', text: 'work order' }],
      },
      interviewBoundary: 'Define mod.orders only.',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })
    const prompt = interactiveInterviewPrompt(packet)

    expect(prompt).toMatch(/draft concrete answers for every applicable detail/i)
    expect(prompt).toMatch(/do not conduct a serial,? field-by-field interview/i)
    expect(prompt).toMatch(/matching operationContracts entry/i)
    expect(prompt).toMatch(/resolve to concrete dataSchemas entries/i)
    expect(prompt).toContain('ASD-STE100')
    expect(prompt).toContain('work order')
    expect(prompt).toContain('behaviorDraft')
    expect(prompt).toMatch(/refine only allocated workflow nodes/i)
    expect(prompt).toMatch(/do not add application scope or copy the application workflow/i)
  })

  it('embeds structured starters for all three behavior levels', () => {
    const productPacket = buildProductInterviewPacket({
      packetId: 'packet-product',
      projectId: 'project',
      facts: [],
    })
    const architecturePacket = buildInterviewPacket({
      packetId: 'packet-architecture',
      projectId: 'project',
      interviewKind: 'architecture',
      gateId: 'CAP-GATE-002',
      inputContext: {
        recordIds: ['app'],
        revisions: ['1'],
        hashes: ['hash'],
        facts: [],
        glossary: [],
      },
      interviewBoundary: 'Define solution allocation only.',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })
    const modulePacket = buildInterviewPacket({
      packetId: 'packet-module',
      projectId: 'project',
      interviewKind: 'module',
      gateId: 'CAP-GATE-003',
      inputContext: {
        recordIds: ['app', 'mod.orders'],
        revisions: ['1'],
        hashes: ['hash'],
        facts: ['moduleType:domain', 'moduleVersion:1.0.0'],
        glossary: [],
      },
      interviewBoundary: 'Define mod.orders only.',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })

    const product = interviewResponseStarter(productPacket) as {
      applicationWorkflows?: unknown[]
    }
    const architecture = interviewResponseStarter(architecturePacket) as {
      architecture: { workflowTraces: { nodeAllocations?: unknown[]; stepAllocations?: unknown[] }[] }
    }
    const module = interviewResponseStarter(modulePacket) as {
      behaviorDraft?: { activityDefinitions?: unknown[] }
    }

    expect(product.applicationWorkflows).toHaveLength(1)
    expect(architecture.architecture.workflowTraces[0]?.nodeAllocations).toHaveLength(1)
    expect(architecture.architecture.workflowTraces[0]?.stepAllocations).toBeUndefined()
    expect(module.behaviorDraft?.activityDefinitions).toHaveLength(1)
  })
})
