// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  DiagramProjection,
  ModuleDesignSpecification,
} from '@engineering-ui-kit/core'
import applicationRecord from '../../../examples/do178-audit-hub/capabilities/approved/application.json'
import architectureRecord from '../../../examples/do178-audit-hub/capabilities/approved/architecture.json'
import moduleDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.assurance-workflow.json'

vi.mock('../src/views/capabilities/UmlDiagramWorkspace', async () => {
  const React = await import('react')
  return {
    UmlDiagramWorkspace: (props: {
      diagrams: DiagramProjection[]
      onSelectElement?: (diagram: DiagramProjection, elementId: string) => void
    }) => React.createElement(
      'div',
      { 'aria-label': 'Test diagram' },
      props.diagrams.flatMap((diagram) => [
        ...diagram.nodes.map((node) => React.createElement(
          'button',
          {
            key: `${diagram.id}:${node.id}`,
            type: 'button',
            'aria-label': `Select ${node.id}`,
            onClick: () => props.onSelectElement?.(diagram, node.id),
          },
          node.label,
        )),
        ...diagram.edges.map((edge) => React.createElement(
          'button',
          {
            key: `${diagram.id}:${edge.id}`,
            type: 'button',
            'aria-label': `Select ${edge.id}`,
            onClick: () => props.onSelectElement?.(diagram, edge.id),
          },
          edge.label ?? edge.kind,
        )),
      ]),
    ),
  }
})

import { ApplicationWorkflowWorkspace } from '../src/views/capabilities/ApplicationWorkflowWorkspace'
import { ModuleBehaviorEditor } from '../src/views/capabilities/ModuleBehaviorEditor'
import { WorkflowAllocationWorkspace } from '../src/views/capabilities/WorkflowAllocationWorkspace'
import { ScenarioVerificationPanel } from '../src/views/capabilities/ScenarioVerificationPanel'
import { installMockBridge } from '../src/mockBridge'

afterEach(cleanup)

function application(): ApplicationSpecification {
  return structuredClone(applicationRecord) as unknown as ApplicationSpecification
}

function architecture(): ArchitectureSpecification {
  return structuredClone(architectureRecord) as unknown as ArchitectureSpecification
}

function moduleDesign(): ModuleDesignSpecification {
  return structuredClone(moduleDesignRecord) as unknown as ModuleDesignSpecification
}

describe('behavior workspaces', () => {
  it('maps application diagram selection to canonical fields and keeps approved records immutable', () => {
    const specification = application()
    const workflow = specification.applicationWorkflows![0]!
    const action = workflow.graph.nodes.find((node) => node.kind === 'action')!
    const edge = workflow.graph.edges.find((item) => item.guard)!
    const save = vi.fn()
    const view = render(
      <ApplicationWorkflowWorkspace
        specification={specification}
        approved={false}
        onSave={save}
      />,
    )

    fireEvent.click(screen.getByLabelText(`Select workflow:${workflow.id}:node:${action.id}`))
    expect((screen.getByLabelText('Concise label') as HTMLInputElement).value).toBe(action.label)
    fireEvent.change(screen.getByLabelText('Concise label'), { target: { value: 'Review evidence' } })
    expect(save).toHaveBeenCalled()
    const saved = save.mock.calls.at(-1)![0] as ApplicationSpecification
    expect(saved.applicationWorkflows![0]!.graph.nodes.find((node) => node.id === action.id)?.label)
      .toBe('Review evidence')

    fireEvent.click(screen.getByLabelText(`Select workflow:${workflow.id}:edge:${edge.id}`))
    expect((screen.getByLabelText('Guard') as HTMLInputElement).value).toBe(edge.guard)

    view.rerender(
      <ApplicationWorkflowWorkspace
        specification={specification}
        approved
        onSave={save}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Add decision' })).toBeNull()
    fireEvent.click(screen.getByLabelText(`Select workflow:${workflow.id}:node:${action.id}`))
    expect((screen.getByLabelText('Concise label') as HTMLInputElement).disabled).toBe(true)
  })

  it('creates every supported module activity symbol through structured commands', () => {
    let design = moduleDesign()
    design.status = 'draft'
    const change = vi.fn((next: ModuleDesignSpecification) => {
      design = next
    })
    const view = render(<ModuleBehaviorEditor design={design} disabled={false} onChange={change} />)

    const commandKinds: Array<[string, string[]]> = [
      ['Add action', ['action']],
      ['Add call', ['call-operation']],
      ['Add receive', ['receive-event']],
      ['Add send', ['send-event']],
      ['Add decision', ['decision', 'merge']],
      ['Add parallel work', ['fork', 'join']],
    ]
    for (const [command, expectedKinds] of commandKinds) {
      const before = design.behavior.activityDefinitions!
        .flatMap((activity) => activity.graph.nodes)
        .length
      fireEvent.click(screen.getByRole('button', { name: command }))
      expect(change).toHaveBeenCalled()
      const nodes = design.behavior.activityDefinitions!.flatMap((activity) => activity.graph.nodes)
      expect(nodes.length).toBeGreaterThan(before)
      for (const kind of expectedKinds) expect(nodes.some((node) => node.kind === kind)).toBe(true)
      view.rerender(<ModuleBehaviorEditor design={design} disabled={false} onChange={change} />)
    }

    const kinds = new Set(design.behavior.activityDefinitions!
      .flatMap((activity) => activity.graph.nodes)
      .map((node) => node.kind))
    expect(kinds).toEqual(new Set([
      'initial',
      'action',
      'call-operation',
      'decision',
      'merge',
      'fork',
      'join',
      'send-event',
      'receive-event',
      'final',
    ]))
  })

  it('edits internal sequence participants, messages, fragments, and refinement links', () => {
    let design = moduleDesign()
    design.status = 'draft'
    const change = vi.fn((next: ModuleDesignSpecification) => {
      design = next
    })
    const view = render(<ModuleBehaviorEditor design={design} disabled={false} onChange={change} />)
    const interaction = design.behavior.interactionDefinitions![0]!

    fireEvent.click(screen.getAllByRole('button', { name: 'Add participant' })[0]!)
    expect(design.behavior.interactionDefinitions![0]!.participants.length)
      .toBe(interaction.participants.length + 1)
    view.rerender(<ModuleBehaviorEditor design={design} disabled={false} onChange={change} />)

    const messagesBefore = design.behavior.interactionDefinitions![0]!.messages.length
    fireEvent.click(screen.getAllByRole('button', { name: 'Add message' })[0]!)
    expect(design.behavior.interactionDefinitions![0]!.messages).toHaveLength(messagesBefore + 1)
    view.rerender(<ModuleBehaviorEditor design={design} disabled={false} onChange={change} />)

    const fragmentsBefore = design.behavior.interactionDefinitions![0]!.fragments?.length ?? 0
    fireEvent.click(screen.getAllByRole('button', { name: 'Add fragment' })[0]!)
    expect(design.behavior.interactionDefinitions![0]!.fragments).toHaveLength(fragmentsBefore + 1)
    view.rerender(<ModuleBehaviorEditor design={design} disabled={false} onChange={change} />)

    const latestMessage = design.behavior.interactionDefinitions![0]!.messages.at(-1)!
    fireEvent.change(screen.getByLabelText(`Guard for ${latestMessage.id}`), {
      target: { value: 'The call is permitted.' },
    })
    expect(design.behavior.interactionDefinitions![0]!.messages.at(-1)!.guard)
      .toBe('The call is permitted.')
    const refinement = screen.getByLabelText(`Refinements for ${latestMessage.id}`) as HTMLSelectElement
    refinement.options[0]!.selected = true
    fireEvent.change(refinement)
    expect(design.behavior.interactionDefinitions![0]!.messages.at(-1)!.refinesActivityNodeIds)
      .toHaveLength(1)
  })

  it('shows missing allocations, saves the canonical allocation, and disables approved controls', () => {
    const app = application()
    const arch = architecture()
    const workflow = app.applicationWorkflows![0]!
    const trace = arch.workflowTraces.find((item) => item.useCaseId === workflow.useCaseId)!
    trace.nodeAllocations = trace.nodeAllocations!.slice(1)
    arch.status = 'draft'
    const save = vi.fn()
    const view = render(
      <WorkflowAllocationWorkspace
        application={app}
        architecture={arch}
        approved={false}
        onSave={save}
      />,
    )

    expect(screen.getByText('Module required')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Primary module'), {
      target: { value: arch.moduleIds[0] },
    })
    const saved = save.mock.calls.at(-1)![0] as ArchitectureSpecification
    expect(saved.workflowTraces
      .flatMap((item) => item.nodeAllocations ?? [])
      .some((allocation) => allocation.workflowId === workflow.id)).toBe(true)

    view.rerender(
      <WorkflowAllocationWorkspace
        application={app}
        architecture={arch}
        approved
        onSave={save}
      />,
    )
    expect((screen.getByLabelText('Primary module') as HTMLSelectElement).disabled).toBe(true)
  })

  it('renders stable narrow-screen editor structures without hiding semantic controls', () => {
    const design = moduleDesign()
    const { container } = render(
      <div style={{ width: 640 }}>
        <ModuleBehaviorEditor design={design} disabled onChange={() => undefined} />
      </div>,
    )
    expect(container.querySelector('.cap-behavior-layout')).toBeTruthy()
    expect(screen.getByLabelText('Sequence participants')).toBeTruthy()
    expect(screen.getByLabelText('Sequence fragments')).toBeTruthy()
    expect(screen.getByText('Missing refinement')).toBeTruthy()
  })

  it('reads legacy behavior without changing approved records and creates explicit migration drafts', () => {
    const legacyApplication = application()
    legacyApplication.applicationWorkflows = undefined
    const saveApplication = vi.fn()
    const appView = render(
      <ApplicationWorkflowWorkspace
        specification={legacyApplication}
        approved
        onSave={saveApplication}
      />,
    )
    expect(screen.getByText(/read-only compatibility workflow/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add action' })).toBeNull()
    expect(saveApplication).not.toHaveBeenCalled()
    appView.unmount()

    const legacyDesign = moduleDesign()
    legacyDesign.behavior.activityDefinitions = undefined
    legacyDesign.behavior.activities = [{
      id: 'legacy-check',
      text: 'Check legacy evidence',
    }]
    const change = vi.fn()
    const moduleView = render(
      <ModuleBehaviorEditor design={legacyDesign} disabled onChange={change} />,
    )
    expect(screen.getAllByText('Check legacy evidence').length).toBeGreaterThan(0)
    expect(change).not.toHaveBeenCalled()
    moduleView.rerender(
      <ModuleBehaviorEditor design={legacyDesign} disabled={false} onChange={change} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create behavior draft' }))
    const migrated = change.mock.calls[0]![0] as ModuleDesignSpecification
    expect(migrated.status).toBe('draft')
    expect(migrated.behavior.activityDefinitions?.[0]?.graph.nodes
      .some((node) => node.label === 'Check legacy evidence')).toBe(true)
  })

  it('opens the end-to-end trace drawer without merging module status into the scenario result', async () => {
    const bridge = installMockBridge()
    const projectId = 'do-178c-audit-hub'
    await bridge.capabilitiesEnsureInitialized(projectId)
    const record = await bridge.capabilitiesGetApplication(projectId)
    const scenarioId = (record.approved as ApplicationSpecification).scenarioDefinitions![0]!.id
    await bridge.capabilitiesCreateScenarioRun({
      projectId,
      scenarioId,
      build: 'test build',
      sourceRevision: 'test source',
      environment: 'test environment',
      testDataRevision: 'test data',
      runner: 'test runner',
    })

    render(
      <ScenarioVerificationPanel
        bridge={bridge}
        projectId={projectId}
        projection="design"
      />,
    )
    const inspect = await screen.findAllByRole('button', { name: 'Inspect trace' })
    fireEvent.click(inspect[0]!)
    expect(await screen.findByLabelText('Behavior trace')).toBeTruthy()
    expect(screen.getByText('Current design trace')).toBeTruthy()
    expect(screen.getByText('Module behavior status stays separate from the application scenario result.'))
      .toBeTruthy()
    expect(screen.getByText('Application step: Not run')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Module behavior view'), { target: { value: 'missing' } })
    await waitFor(() => expect(screen.getByText('No modules match this filter.')).toBeTruthy())
  })
})
