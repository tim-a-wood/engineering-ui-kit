// @vitest-environment jsdom
import { useEffect, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  ArchitectureSpecification,
  CapabilityModuleRecord,
} from '@engineering-ui-kit/core'
import { installMockBridge } from '../src/mockBridge'
import { ModulesView } from '../src/views/capabilities/ModulesView'

const architecture: ArchitectureSpecification = {
  schemaVersion: '1.0',
  projectId: 'batch-project',
  id: 'architecture-1',
  revision: '1',
  status: 'approved',
  applicationSpecId: 'application-1',
  applicationSpecRevision: '1',
  applicationSpecHash: 'application-hash',
  capabilityProjections: [],
  moduleIds: ['mod.domain', 'mod.experience'],
  moduleDefinitions: [
    { moduleId: 'mod.domain', name: 'Audit rules', moduleType: 'domain', responsibility: 'Evaluate audit rules.' },
    { moduleId: 'mod.experience', name: 'Audit workspace', moduleType: 'experience', responsibility: 'Present audit workflows.' },
  ],
  dependencyEdges: [
    { fromModuleId: 'mod.experience', toModuleId: 'mod.domain', reason: 'Presents rule outcomes.' },
  ],
  operationAllocations: [
    { operationId: 'audit.evaluate', moduleId: 'mod.domain' },
    { operationId: 'audit.present', moduleId: 'mod.experience' },
  ],
  adapterAllocations: [],
  workflowTraces: [],
  proposals: [],
  unresolvedQuestions: [],
  gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
  contentHash: 'architecture-hash',
}

describe('architecture-wide module fast path', () => {
  it('generates, explicitly approves, plans, and exports one wave handoff', async () => {
    const bridge = installMockBridge()
    await bridge.createProject({ name: 'Batch project', repoPath: '/mock/batch' })
    const project = (await bridge.listProjects()).find((candidate) => candidate.name === 'Batch project')!
    architecture.projectId = project.id
    await bridge.capabilitiesEnsureInitialized(project.id)
    await bridge.capabilitiesApproveArchitecture(project.id, architecture)

    function Harness() {
      const [records, setRecords] = useState<CapabilityModuleRecord[]>([])
      async function refresh() {
        setRecords(await bridge.capabilitiesListModules(project.id))
      }
      useEffect(() => { void refresh() }, [])
      return (
        <ModulesView
          bridge={bridge}
          projectId={project.id}
          architectureApproved
          projection="guided"
          records={records}
          onChanged={refresh}
          foundationGate={{ enabled: true }}
        />
      )
    }

    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate all 2 proposals' }))
    expect(await screen.findByText('Shared assumptions (4)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve selected proposals (2)' }))

    await waitFor(() => {
      expect(screen.getByText(/2 module proposal\(s\) approved/)).toBeTruthy()
      expect(screen.getByText('Wave 1')).toBeTruthy()
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Create one handoff/ })[0])

    expect(await screen.findByRole('region', { name: 'Ready for Copilot' })).toBeTruthy()
    expect(screen.getByText(/Each target keeps its own result ZIP/)).toBeTruthy()
  })
})
