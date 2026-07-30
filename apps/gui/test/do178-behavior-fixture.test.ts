import { describe, expect, it } from 'vitest'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleManifest,
} from '@engineering-ui-kit/core'
import {
  canonicalHash,
  compileScenarioDefinitions,
  createModuleDesignDraft,
  evaluateApplicationWorkflows,
  evaluateModuleBehavior,
  evaluateSolutionAllocations,
  projectApplicationBehaviorDiagrams,
  projectModuleBehaviorDiagrams,
  projectSolutionAllocationDiagrams,
} from '@engineering-ui-kit/core/browser'
import sourceApplicationRecord from '../../../examples/do178-audit-hub/capabilities/approved/application.json'
import sourceArchitectureRecord from '../../../examples/do178-audit-hub/capabilities/approved/architecture.json'
import sourceManifestRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.assurance-workflow.json'
import {
  buildAssuranceModuleBehavior,
  buildDo178ApplicationWorkflows,
  buildDo178UseCases,
  buildDo178WorkflowAllocations,
} from '../src/do178BehaviorFixture'
import {
  analyzeUmlLayoutQuality,
  layoutUmlDiagram,
} from '../src/views/capabilities/umlDiagramLayout'

function fixture() {
  const sourceApplication = structuredClone(sourceApplicationRecord) as unknown as ApplicationSpecification
  const application: ApplicationSpecification = {
    ...sourceApplication,
    useCaseDefinitions: buildDo178UseCases(sourceApplication),
    applicationWorkflows: buildDo178ApplicationWorkflows(sourceApplication),
    scenarioDefinitions: undefined,
    contentHash: '',
  }
  application.scenarioDefinitions = compileScenarioDefinitions(application)
  application.contentHash = canonicalHash({ ...application, contentHash: undefined })

  const allocations = buildDo178WorkflowAllocations()
  const sourceArchitecture = structuredClone(sourceArchitectureRecord) as unknown as ArchitectureSpecification
  const architecture: ArchitectureSpecification = {
    ...sourceArchitecture,
    applicationSpecRevision: application.revision,
    applicationSpecHash: application.contentHash,
    workflowTraces: sourceArchitecture.workflowTraces.map((trace) => allocations[trace.useCaseId]
      ? {
        ...trace,
        moduleIds: [...new Set(allocations[trace.useCaseId]!.flatMap((allocation) => [
          allocation.primaryModuleId,
          ...allocation.participatingModuleIds,
        ]))],
        nodeAllocations: allocations[trace.useCaseId],
      }
      : trace),
    contentHash: '',
  }
  architecture.contentHash = canonicalHash({ ...architecture, contentHash: undefined })

  const sourceManifest = sourceManifestRecord as unknown as {
    nonResponsibilities?: string[]
    ownedConcerns?: string[]
  } & ModuleManifest
  const manifest: ModuleManifest = {
    ...sourceManifest,
    architectureVersion: '1.0',
    name: architecture.moduleDefinitions?.find((item) =>
      item.moduleId === sourceManifest.moduleId)?.name ?? sourceManifest.moduleId,
    ownedConcerns: sourceManifest.ownedConcerns ?? ['Assurance decisions'],
    excludedConcerns: sourceManifest.excludedConcerns ?? sourceManifest.nonResponsibilities ?? [],
    verificationSuiteIds: ['acceptance:assurance'],
    runtimeAllocation: 'local-embedded',
    events: ['finding.assigned', 'finding.closed', 'review.recorded', 'audit-package.exported'],
  }
  const design = createModuleDesignDraft({ application, architecture, manifest })
  design.behavior = buildAssuranceModuleBehavior(design.behavior)
  design.contentHash = canonicalHash({ ...design, contentHash: undefined })
  return { application, architecture, design }
}

describe('detailed DO-178C behavior fixture', () => {
  it('meets the complex non-linear acceptance fixture and all three behavior gates', () => {
    const { application, architecture, design } = fixture()
    const workflows = application.applicationWorkflows!
    const appNodes = workflows.flatMap((workflow) => workflow.graph.nodes)
    const appEdges = workflows.flatMap((workflow) => workflow.graph.edges)
    const activities = design.behavior.activityDefinitions!
    const interactions = design.behavior.interactionDefinitions!

    expect(application.useCaseDefinitions).toHaveLength(3)
    expect(application.actors.length).toBeGreaterThanOrEqual(4)
    expect(appNodes.length).toBeGreaterThanOrEqual(20)
    expect(appNodes.filter((node) => node.kind === 'decision').length).toBeGreaterThanOrEqual(3)
    expect(appNodes.filter((node) => node.kind === 'merge').length).toBeGreaterThanOrEqual(3)
    expect(appNodes.some((node) => node.kind === 'fork')).toBe(true)
    expect(appNodes.some((node) => node.kind === 'join')).toBe(true)
    expect(appEdges.some((edge) => edge.loop?.exitCondition && edge.loop.maximumIterations)).toBe(true)
    expect(design.behavior.domainRejections.length).toBeGreaterThanOrEqual(2)
    expect(design.behavior.technicalFailures.length).toBeGreaterThanOrEqual(1)
    expect(activities.filter((activity) => activity.graph.nodes.length >= 12).length).toBeGreaterThanOrEqual(2)
    expect(design.behavior.stateTransitions?.some((transition) => transition.guard)).toBe(true)
    expect(design.behavior.stateTransitions?.some((transition) =>
      transition.fromStateId === 'closed' && transition.toStateId === 'open')).toBe(true)
    expect(interactions[0]?.messages.some((message) => message.kind === 'synchronous')).toBe(true)
    expect(interactions[0]?.messages.some((message) => message.kind === 'reply')).toBe(true)
    expect(interactions[0]?.fragments?.some((fragment) => fragment.kind === 'alt')).toBe(true)

    expect(evaluateApplicationWorkflows(application).diagnostics).toEqual([])
    expect(evaluateSolutionAllocations(application, architecture).diagnostics).toEqual([])
    expect(evaluateModuleBehavior({ application, architecture, design }).diagnostics).toEqual([])

    const packageAllocation = projectSolutionAllocationDiagrams(application, architecture)
      .find((diagram) => diagram.id.includes('workflow:uc-package') && diagram.kind === 'activity')!
    expect(packageAllocation.nodes.filter((node) => node.kind === 'swimlane')).toHaveLength(6)
  })

  it('projects and lays out the complex fixture within the acceptance targets', async () => {
    const { application, architecture, design } = fixture()
    const projectionStarted = performance.now()
    const diagrams = [
      ...projectApplicationBehaviorDiagrams(application),
      ...projectSolutionAllocationDiagrams(application, architecture),
      ...projectModuleBehaviorDiagrams({ application, architecture, design }),
    ]
    const projectionDuration = performance.now() - projectionStarted
    expect(projectionDuration).toBeLessThan(100)

    const complex = diagrams
      .filter((diagram) => diagram.nodes.length)
      .sort((left, right) => right.nodes.length - left.nodes.length)[0]!
    const layoutStarted = performance.now()
    const layout = await layoutUmlDiagram(complex)
    const layoutDuration = performance.now() - layoutStarted
    expect(layoutDuration).toBeLessThan(500)
    expect(layout.nodes).toHaveLength(complex.nodes.length)
    expect(layout.edges).toHaveLength(complex.edges.length)
    expect(complex.textAlternative).not.toBe('')
    expect(complex.nodes.every((node) => node.sourceRecordId && node.traceIds.length)).toBe(true)
    expect(complex.edges.every((edge) => edge.sourceRecordId && edge.traceIds.length)).toBe(true)

    for (const diagram of diagrams) {
      const candidate = await layoutUmlDiagram(diagram)
      const quality = analyzeUmlLayoutQuality(candidate, diagram)
      expect(candidate.edges, diagram.title).toHaveLength(diagram.edges.length)
      expect(quality.nodeOverlaps, diagram.title).toBe(0)
      expect(quality.overlappingConnectorPairs, diagram.title).toBe(0)
      expect(quality.edgeNodeClearanceViolations, diagram.title).toBe(0)
      expect(quality.labelNodeOverlaps, diagram.title).toBe(0)
      expect(quality.labelLabelOverlaps, diagram.title).toBe(0)
      expect(quality.connectorLabelOverlaps, diagram.title).toBe(0)
      expect(quality.portAlignmentViolations, diagram.title).toBe(0)
      expect(quality.canvasBoundsViolations, diagram.title).toBe(0)
      expect(quality.crossings, diagram.title).toBeLessThanOrEqual(
        diagram.level === 'allocation' ? 2 : 1,
      )
    }
  })
})
