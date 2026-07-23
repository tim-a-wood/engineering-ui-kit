import { describe, expect, it } from 'vitest'
import {
  buildImplementationWaveHandoffMarkdown,
  implementationWaveDeliverable,
} from '../../src/capabilities/implementationWave.js'
import type { ImplementationWaveHandoffTarget } from '../../src/capabilities/implementationWave.js'

function target(moduleId: string, runId: string): ImplementationWaveHandoffTarget {
  return {
    runId,
    moduleId,
    name: moduleId,
    packet: {
      schemaVersion: '1.0',
      packetId: `packet-${moduleId}`,
      packetVersion: '1.0',
      projectId: 'project-1',
      targetKind: 'module',
      targetId: moduleId,
      inputHashes: {},
      architectureVersion: '1',
      architectureHash: 'hash',
      allowedPaths: [`src/${moduleId}`],
      expectedPaths: [],
      protectedPaths: [],
      excludedPaths: [],
      requiredTests: [`suite.${moduleId}`],
      acceptanceCases: [],
      unchangedBehavior: [],
      requiredOutput: 'ui-overlay.zip',
    },
    brief: {
      schemaVersion: '1.0',
      generatedAt: '2026-07-23T00:00:00.000Z',
      readiness: { status: 'ready', issues: [] },
      target: {
        moduleId,
        name: moduleId,
        moduleType: 'domain',
        responsibility: 'Own behavior.',
        runtimeAllocation: 'local-embedded',
        allowedPaths: [`src/${moduleId}`],
      },
      referenceArchitecture: {
        profileId: 'hexagonal-ports-and-adapters',
        version: '1.0',
        role: 'Domain',
        dependencyRules: [],
        implementationRules: [],
        portRules: [],
        testingRules: [],
      },
      approvedSpecification: {
        ownedConcerns: [],
        excludedConcerns: [],
        events: [],
        detailAnswers: [],
        rules: [],
        acceptanceCases: [],
      },
      contracts: {
        providedOperations: [],
        requiredOperations: [],
        providedOperationContracts: [],
        requiredOperationContracts: [],
        dataSchemas: [],
        behavioralEvidence: [],
      },
      architectureContext: {
        architectureId: 'architecture-1',
        revision: '1',
        dependencyEdges: [],
        operationAllocations: [],
        adapterAllocations: [],
        workflowTraces: [],
      },
      repositoryContext: {
        repositoryName: 'repo',
        detectedLanguages: [],
        detectedFrameworks: [],
        detectedPackageManager: 'unknown',
        manifestFiles: [],
        sourceRoots: [],
        packageScripts: {},
        configuredVerificationCommands: {},
        ownedPaths: [],
        existingFilesInScope: [],
        nearbyPatternFiles: [],
        testFiles: [],
      },
      implementationPlan: [],
      verificationPlan: {
        suiteIds: [],
        acceptanceCases: [],
        commands: {},
        requiredEvidence: [],
      },
      precedence: [],
    },
  }
}

describe('implementation-wave handoff', () => {
  it('creates one handoff with separate result and evidence identities', () => {
    const result = buildImplementationWaveHandoffMarkdown({
      groupId: 'group-1',
      projectId: 'project-1',
      waveIndex: 1,
      targets: [target('mod.audit-rules', 'run-1'), target('mod.matlab', 'run-2')],
    })

    expect(result.resultManifest.results).toEqual([
      {
        runId: 'run-1',
        moduleId: 'mod.audit-rules',
        deliverable: 'ui-overlay-audit-rules.zip',
        allowedPaths: ['src/mod.audit-rules'],
      },
      {
        runId: 'run-2',
        moduleId: 'mod.matlab',
        deliverable: 'ui-overlay-matlab.zip',
        allowedPaths: ['src/mod.matlab'],
      },
    ])
    expect(result.markdown).toContain('one ZIP per target')
    expect(result.markdown).toContain('Treat every target as a separate evidence scope')
  })

  it('normalizes deliverable names and rejects empty waves', () => {
    expect(implementationWaveDeliverable('mod.File System')).toBe('ui-overlay-file-system.zip')
    expect(() => buildImplementationWaveHandoffMarkdown({
      groupId: 'group-1',
      projectId: 'project-1',
      waveIndex: 1,
      targets: [],
    })).toThrow(/at least one target/)
  })
})
