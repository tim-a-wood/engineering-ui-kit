import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import { inspectOverlay } from '../../src/overlay.js'
import { resolveProjectRelativePath } from '../../src/capabilities/filesystem.js'
import { calculateImpact, classifyImpact, nextActionableTarget } from '../../src/capabilities/impact.js'
import {
  buildCapabilityHandoffMarkdown,
  buildDeltaPacket,
  buildImplementationPacket,
  buildInterviewPacket,
  evaluateCapabilityHandoffShellSte,
} from '../../src/capabilities/packets.js'
import type { ModuleManifest } from '../../src/capabilities/types.js'
import { STE_PROMPT_MARKER, withStePrompt } from '../../src/capabilities/simplifiedTechnicalEnglish.js'

const policy = {
  roots: {
    source: 'capabilities/modules',
    'generated-output': 'capabilities/generated',
    configuration: 'capabilities/config',
    'input-data': 'data',
    artifacts: 'artifacts',
  },
} as const

function expectSteSafeMarkdown(markdown: string): void {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-ste-handoff-'))
  try {
    const targetRoot = path.join(workDir, 'target')
    fs.mkdirSync(path.join(targetRoot, 'docs'), { recursive: true })
    const zip = new AdmZip()
    zip.addFile('docs/handoff.md', Buffer.from(markdown))
    const zipPath = path.join(workDir, 'handoff.zip')
    zip.writeZip(zipPath)
    const inspection = inspectOverlay(zipPath, {
      runId: 'ste-handoff-test',
      targetRoot,
      capabilityAllowedPaths: ['docs'],
    })
    expect(inspection.hardBlockers.filter((item) =>
      item.ruleId === 'AI-HANDOFF-STE-001')).toEqual([])
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

describe('CAP-TEST-025 filesystem policy (core)', () => {
  it('accepts project-relative paths and rejects traversal/absolute escapes', () => {
    expect(resolveProjectRelativePath(policy, 'data/input.csv', ['input-data']).ok).toBe(true)
    expect(resolveProjectRelativePath(policy, '/etc/passwd', ['input-data']).ok).toBe(false)
    expect(resolveProjectRelativePath(policy, '../secret', ['input-data']).ok).toBe(false)
    expect(resolveProjectRelativePath(policy, 'capabilities/modules/a/x.ts', ['source']).ok).toBe(true)
  })
})

describe('CAP-TEST-018/019 impact ordering', () => {
  it('orders provider before workflow/experience and exposes one next action', () => {
    const manifests: ModuleManifest[] = [
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.domain',
        moduleVersion: '1',
        moduleType: 'domain',
        name: 'd',
        responsibility: 'd',
        ownedConcerns: ['d'],
        excludedConcerns: ['u'],
        providedOperations: [{ operationId: 'op.1', contractVersion: '1' }],
        requiredOperations: [],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.domain/'],
      },
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.workflow',
        moduleVersion: '1',
        moduleType: 'workflow',
        name: 'w',
        responsibility: 'w',
        ownedConcerns: ['w'],
        excludedConcerns: ['u'],
        providedOperations: [],
        requiredOperations: [{ operationId: 'op.1', acceptedContractRange: '^1', reason: 'need' }],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.workflow/'],
      },
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.ui',
        moduleVersion: '1',
        moduleType: 'experience',
        name: 'e',
        responsibility: 'e',
        ownedConcerns: ['e'],
        excludedConcerns: ['d'],
        providedOperations: [],
        requiredOperations: [],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.ui/'],
      },
    ]
    const impact = calculateImpact({
      changeId: 'c1',
      initiatingRecordId: 'mod.domain',
      initiatingRevision: '2',
      classification: classifyImpact({
        contractChanged: true,
        additiveOnly: false,
        breaking: false,
        implementationOnly: false,
      }),
      graph: {
        nodes: manifests.map((m) => ({ id: m.moduleId, moduleType: m.moduleType })),
        edges: [
          { from: 'mod.workflow', to: 'mod.domain', reason: 'uses' },
          { from: 'mod.ui', to: 'mod.workflow', reason: 'calls' },
        ],
      },
      manifests,
      changedModuleIds: ['mod.domain'],
    })
    expect(impact.classification).toBe('required-additive')
    expect(impact.proposedPacketOrder[0]).toBe('mod.domain')
    expect(impact.proposedPacketOrder.indexOf('mod.workflow')).toBeLessThan(
      impact.proposedPacketOrder.indexOf('mod.ui'),
    )
    expect(nextActionableTarget(impact, new Set())).toBe('mod.domain')
    expect(nextActionableTarget(impact, new Set(['mod.domain']))).toBe('mod.workflow')
  })
})

describe('CAP-TEST-014 implementation packet', () => {
  it('names one target and required ui-overlay.zip output', () => {
    const packet = buildImplementationPacket({
      packetId: 'p1',
      projectId: 'proj',
      targetKind: 'module',
      targetId: 'mod.domain',
      manifest: {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.domain',
        moduleVersion: '1.0.0',
        moduleType: 'domain',
        name: 'Domain',
        responsibility: 'rules',
        ownedConcerns: ['rules'],
        excludedConcerns: ['ui'],
        providedOperations: [{ operationId: 'op.1', contractVersion: '1.0.0' }],
        requiredOperations: [],
        verificationSuiteIds: ['suite.domain'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.domain/'],
      },
      architectureVersion: '1.0',
      architectureHash: 'h',
      inputHashes: { spec: 'a' },
      acceptanceCases: [{ id: 'ac', description: 'd', expectedOutcome: 'ok' }],
      unchangedBehavior: ['other modules'],
    })
    expect(packet.targetId).toBe('mod.domain')
    expect(packet.requiredOutput).toBe('ui-overlay.zip')
    expect(packet.allowedPaths).toEqual(['capabilities/modules/mod.domain/'])
    expect(packet.expectedPaths).toEqual([])

    const handoff = buildCapabilityHandoffMarkdown({
      kind: 'implementation',
      packet,
      recommendedPrompt: 'Implement production source code and tests for the domain module.',
      supportingRecord: {
        fileName: 'module-implementation-brief.json',
        value: { moduleManifest: { moduleId: 'mod.domain' } },
      },
    })
    expect(handoff).toContain('Return exactly one file named `ui-overlay.zip`')
    expect(handoff).toContain('changed and new implementation files')
    expect(handoff).toContain('## Supporting context')
    expect(handoff).toContain('File: `module-implementation-brief.json`')
    expect(handoff).toContain('Do not return, rewrite, or wrap this record as the result')
    expect(handoff).toContain('module-implementation-brief.json')
    expect(handoff).toContain('ASD-STE100')
    expect(handoff).toContain('VERB + OBJECT')
    expect(handoff).not.toContain('Return only the requested output named module-manifest.json')
    expect(handoff).not.toContain('Use exactly the top-level shape shown')
    expect(evaluateCapabilityHandoffShellSte('implementation').diagnostics).toEqual([])
    expectSteSafeMarkdown(handoff)
  })

  it('retains the JSON response contract for interview handoffs only', () => {
    const packet = buildInterviewPacket({
      packetId: 'interview-1',
      projectId: 'proj',
      interviewKind: 'module',
      gateId: 'gate.module',
      inputContext: {
        recordIds: ['mod.domain'], revisions: ['1'], hashes: ['hash'], facts: [], glossary: [],
      },
      interviewBoundary: 'mod.domain',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })
    const handoff = buildCapabilityHandoffMarkdown({
      kind: 'interview',
      packet,
      recommendedPrompt: 'Interview the user.',
      responseTemplate: {
        fileName: packet.outputFileName,
        value: { moduleManifest: { moduleId: 'Replace with the module id' } },
      },
    })
    expect(handoff).toContain(`Return only the JSON file named \`${packet.outputFileName}\``)
    expect(handoff).toContain('## Response template')
    expect(handoff).toContain(`File: \`${packet.outputFileName}\``)
    expect(handoff).toContain('Use the top-level shape in the response template')
    expect(handoff).toContain('ASD-STE100')
    expect(handoff).not.toContain('Return exactly one file named `ui-overlay.zip`')
    expect(evaluateCapabilityHandoffShellSte('interview').diagnostics).toEqual([])
    expectSteSafeMarkdown(handoff)
  })

  it('uses one prompt policy with the project preferred-term map', () => {
    const packet = buildInterviewPacket({
      packetId: 'interview-lexicon',
      projectId: 'proj',
      interviewKind: 'module',
      gateId: 'gate.module',
      inputContext: {
        recordIds: ['mod.domain'], revisions: ['1'], hashes: ['hash'], facts: [], glossary: [],
      },
      interviewBoundary: 'mod.domain',
      stateLabels: { confirmed: [], proposed: [], unresolved: [] },
    })
    const priorPrompt = withStePrompt('Interview the user.')
    const handoff = buildCapabilityHandoffMarkdown({
      kind: 'interview',
      packet,
      recommendedPrompt: priorPrompt,
      steLexicon: {
        technicalTerms: ['audit finding'],
        prohibitedAliases: { defect: 'audit finding' },
      },
    })

    expect(handoff.match(new RegExp(STE_PROMPT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1)
    expect(handoff).toContain('"defect":"audit finding"')
    expect(handoff).toContain('"audit finding"')
  })

  it('treats a delta packet as input and still requests an implementation overlay', () => {
    const base = buildImplementationPacket({
      packetId: 'delta-1',
      projectId: 'proj',
      targetKind: 'module',
      targetId: 'mod.domain',
      manifest: {
        schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.domain',
        moduleVersion: '1.0.0', moduleType: 'domain', name: 'Domain', responsibility: 'rules',
        ownedConcerns: ['rules'], excludedConcerns: ['ui'], providedOperations: [], requiredOperations: [],
        verificationSuiteIds: ['suite.domain'], runtimeAllocation: 'local-embedded', events: [],
        ownedPaths: ['capabilities/modules/mod.domain/'],
      },
      architectureVersion: '1.0', architectureHash: 'hash', inputHashes: { spec: 'hash' },
      acceptanceCases: [], unchangedBehavior: [],
    })
    const delta = buildDeltaPacket(base, {
      impactRecordId: 'impact-1', changeReason: 'Update the behavior', previousContractVersions: {},
      targetContractVersions: {}, preserveBehavior: [], addBehavior: ['Add behavior'],
      changeBehavior: [], newTests: ['suite.domain'], unchangedModuleIds: [],
    })
    const handoff = buildCapabilityHandoffMarkdown({
      kind: 'delta',
      packet: delta,
      recommendedPrompt: 'Apply the approved delta as source code and tests.',
    })
    expect(handoff).toContain('Return exactly one file named `ui-overlay.zip`')
    expect(handoff).toContain('delta-packet.json')
    expect(handoff).not.toContain('## Response template')
    expectSteSafeMarkdown(handoff)
  })
})
