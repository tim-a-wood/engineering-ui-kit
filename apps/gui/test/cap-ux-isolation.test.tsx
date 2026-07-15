// @vitest-environment jsdom
/**
 * CAP-UX state-safety — behavioral / race-condition tests.
 *
 * These drive the real components with @testing-library/react (jsdom) and prove the
 * project/module/connect isolation fixes. They are designed to FAIL against the
 * pre-fix behavior (shared `projectId`, no generation guard, module state that
 * survived selection changes) and pass because of the implementation.
 */

import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApplicationSpecification, CapabilityModuleRecord, ModuleManifest, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { CapabilitiesView } from '../src/views/capabilities/CapabilitiesView'
import { ModulesView } from '../src/views/capabilities/ModulesView'
import { GuidedConnect } from '../src/views/capabilities/GuidedConnect'
import { GuidedBuild } from '../src/views/capabilities/GuidedBuild'
import { ArchitectureInterview } from '../src/views/capabilities/ArchitectureInterview'
import { ArchitectureView } from '../src/views/capabilities/ArchitectureView'
import { CapabilityPreview } from '../src/views/capabilities/CapabilityPreview'
import { projectArchitecture } from '@engineering-ui-kit/core/browser'
import { GuideOverlay } from '../src/guides'

afterEach(cleanup)

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function project(id: string, name: string): Project {
  return { id, name, repoPath: `/tmp/${id}`, createdAt: 't', updatedAt: 't', status: 'active' } as Project
}

/** A bridge whose unspecified methods resolve to {}; overrides win. */
function makeBridge(over: Partial<EuikBridge> = {}): EuikBridge {
  const base: Record<string, unknown> = {
    capabilitiesEnsureInitialized: async () => ({ schemaVersion: '1.0', initializedAt: 't' }),
    capabilitiesGetApplication: async () => ({}),
    capabilitiesGetArchitecture: async () => ({}),
    capabilitiesListNeedsAttention: async () => [],
    capabilitiesListModules: async () => [],
    capabilitiesListBindings: async () => [],
    capabilitiesListRuns: async () => [],
  }
  const merged = { ...base, ...(over as Record<string, unknown>) }
  return new Proxy(merged, { get: (t, k) => (k in t ? (t as Record<string, unknown>)[k] : (async () => ({}))) }) as unknown as EuikBridge
}

const APPROVED_APP = { approved: { id: 'app.a', revision: '1' } }
const projects = [project('A', 'Project A'), project('B', 'Project B')]

const ARCH_PRODUCT: ApplicationSpecification = {
  schemaVersion: '1.0', projectId: 'p1', id: 'app.p1', revision: '1', status: 'approved',
  purpose: 'Test architecture imports', outcomes: ['A working system'],
  actors: [{ id: 'actor.user', text: 'User' }], goals: [],
  useCases: [{ id: 'usecase.main', text: 'Complete the main workflow' }], scenarios: [],
  information: [], rules: [], externalSystems: [], constraints: [],
  scope: { inScope: ['Main workflow'], outOfScope: [] },
  acceptanceCases: [{ id: 'accept.main', description: 'Run it', expectedOutcome: 'It works' }],
  sources: [], unresolvedQuestions: [], contentHash: 'app-hash',
}

function selectProject(value: string) {
  fireEvent.change(screen.getByLabelText('Capabilities project'), { target: { value } })
}

describe('project isolation', () => {
  it('discards a late Project A response after the user switches to Project B', async () => {
    const defA = deferred<{ approved?: unknown }>()
    const getApp = vi.fn((pid: string) => (pid === 'A' ? defA.promise : Promise.resolve({})))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A') // A's application load is pending
    selectProject('B') // switch before A resolves
    await waitFor(() => expect(screen.getByText('Understand the application.')).toBeTruthy()) // B (empty) is ready

    // A resolves LATE with an approved application — must be ignored.
    defA.resolve(APPROVED_APP)
    await new Promise((r) => setTimeout(r, 0))

    expect(screen.getByText('Understand the application.')).toBeTruthy()
    expect(screen.queryByText('Shape the solution.')).toBeNull()
  })

  it('clears the previous project immediately and shows a loading state on switch', async () => {
    const defB = deferred<{ approved?: unknown }>()
    const getApp = vi.fn((pid: string) => (pid === 'A' ? Promise.resolve(APPROVED_APP) : defB.promise))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A')
    await waitFor(() => expect(screen.getByText('Shape the solution.')).toBeTruthy())

    selectProject('B') // B load pending
    // A's records are gone immediately; a compact loading state shows instead.
    expect(screen.queryByText('Shape the solution.')).toBeNull()
    expect(screen.getByText('Loading this project…')).toBeTruthy()

    defB.resolve({})
    await waitFor(() => expect(screen.getByText('Understand the application.')).toBeTruthy())
  })

  it('disables writes while a project is loading (no stage workspace mounted)', async () => {
    const defA = deferred<{ approved?: unknown }>()
    const getApp = vi.fn(() => defA.promise)
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A')
    expect(screen.getByText('Loading this project…')).toBeTruthy()
    // The Define workspace and its write action are not present during loading.
    expect(screen.queryByRole('button', { name: /Start in Copilot/i })).toBeNull()

    defA.resolve({})
    await waitFor(() => expect(screen.getByRole('button', { name: /Start in Copilot/i })).toBeTruthy())
  })

  it('shows an error + Retry on failed load and never reveals the previous project', async () => {
    const getApp = vi.fn((pid: string) => (pid === 'A' ? Promise.resolve(APPROVED_APP) : Promise.reject(new Error('boom'))))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A')
    await waitFor(() => expect(screen.getByText('Shape the solution.')).toBeTruthy())

    selectProject('B')
    await waitFor(() => expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i)
    expect(screen.queryByText('Shape the solution.')).toBeNull()
  })

  it('resets canonical records on project change (B does not show A stage state)', async () => {
    const getApp = vi.fn((pid: string) => Promise.resolve(pid === 'A' ? APPROVED_APP : {}))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)
    selectProject('A')
    await waitFor(() => expect(screen.getByText('Shape the solution.')).toBeTruthy())
    selectProject('B')
    await waitFor(() => expect(screen.getByText('Understand the application.')).toBeTruthy())
    expect(screen.queryByText('Shape the solution.')).toBeNull()
  })

  it('ignores a refresh invoked by an unmounted Project A child after switching to B', async () => {
    const gate = deferred<{ passed: boolean; diagnostics: never[] }>()
    const draft = {
      schemaVersion: '1.0', id: 'app.a', revision: '1', name: 'A', purpose: 'A',
      outcomes: [], userRoles: [], domainTerms: [], constraints: [], successMeasures: [], useCases: [],
      contentHash: 'a', status: 'draft',
    }
    let approvedA = false
    const approveApplication = vi.fn(async () => {
      approvedA = true
      return { ok: true, gate: { passed: true, diagnostics: [] }, approved: { ...draft, status: 'approved' } }
    })
    const bridge = makeBridge({
      capabilitiesGetApplication: (async (pid: string) =>
        pid === 'A' ? (approvedA ? { approved: { ...draft, status: 'approved' } } : { draft }) : {}) as never,
      capabilitiesEvaluateProductGate: (async () => gate.promise) as never,
      capabilitiesApproveApplication: approveApplication as never,
    })
    render(<CapabilitiesView bridge={bridge} projects={projects} />)

    selectProject('A')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Approve definition' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Approve definition' }))
    selectProject('B')
    await waitFor(() => expect(screen.getByText('Understand the application.')).toBeTruthy())

    gate.resolve({ passed: true, diagnostics: [] })
    await waitFor(() => expect(approveApplication).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByText('Understand the application.')).toBeTruthy()
    expect(screen.queryByText('Shape the solution.')).toBeNull()
  })
})

describe('architecture import recovery', () => {
  it('repairs mechanical interview omissions and enables approval without a follow-up interview', async () => {
    const saveDraft = vi.fn(async () => ({ ok: true as const }))
    const bridge = makeBridge({
      capabilitiesGetApplication: (async () => ({ approved: ARCH_PRODUCT })) as never,
      capabilitiesGetArchitecture: (async () => ({})) as never,
      capabilitiesSaveArchitectureDraft: saveDraft as never,
    })
    render(
      <ArchitectureInterview
        bridge={bridge}
        projectId="p1"
        architectureApproved={false}
        projection="guided"
      />,
    )

    await waitFor(() => expect(screen.getByLabelText('Interview response JSON')).toBeTruthy())
    const architecture = {
      schemaVersion: '1.0', projectId: 'p1', id: 'arch.p1', revision: '1', status: 'proposed',
      applicationSpecId: ARCH_PRODUCT.id, applicationSpecRevision: '1', applicationSpecHash: 'app-hash',
      capabilityProjections: [{ id: 'cap.main', name: 'Main', moduleIds: ['mod.workflow', 'mod.domain'] }],
      moduleIds: ['mod.workflow', 'mod.domain'],
      dependencyEdges: [{
        fromModuleId: 'mod.workflow',
        toModuleId: 'mod.domain',
        reason: undefined as string | undefined,
      }],
      operationAllocations: [], adapterAllocations: [],
      workflowTraces: [{ useCaseId: 'usecase.main', moduleIds: ['mod.workflow', 'mod.domain'] }],
      proposals: [], unresolvedQuestions: [],
      gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'pending',
    }
    const response = {
      architecture,
      moduleNeedTraces: [
        { moduleId: 'mod.workflow', needIds: ['usecase.main'] },
        { moduleId: 'mod.domain', needIds: ['usecase.main'] },
      ],
      moduleJustifications: [
        { moduleId: 'mod.workflow', justification: 'independent-change' },
        { moduleId: 'mod.domain', justification: 'distinct-rules' },
      ],
    }
    const paste = screen.getByLabelText('Interview response JSON')
    const importButtons = screen.getAllByRole('button', { name: 'Import architecture proposal' })
    fireEvent.change(paste, { target: { value: JSON.stringify(response) } })
    fireEvent.click(importButtons[1]!)

    await waitFor(() => expect(screen.getByText('Imported architecture proposal as draft. Review cycles and findings, then approve.')).toBeTruthy())
    expect(screen.queryByText(/Cannot read properties of undefined/)).toBeNull()
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Approve architecture' }) as HTMLButtonElement).disabled).toBe(false)
    const saved = saveDraft.mock.calls[0]![1] as ArchitectureSpecification
    expect(saved.dependencyEdges[0]?.reason).toContain('Workflow uses Domain')
    expect(saved.moduleDefinitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ moduleId: 'mod.workflow', moduleType: 'workflow' }),
      expect.objectContaining({ moduleId: 'mod.domain', moduleType: 'domain' }),
    ]))
  })

  it('heals a draft saved by an older build when the user approves it', async () => {
    const legacyDraft: ArchitectureSpecification = {
      schemaVersion: '1.0', projectId: 'p1', id: 'arch.legacy', revision: '1', status: 'proposed',
      applicationSpecId: ARCH_PRODUCT.id, applicationSpecRevision: '1', applicationSpecHash: 'app-hash',
      capabilityProjections: [{ id: 'cap.main', name: 'Main', moduleIds: ['mod.workflow', 'mod.domain'] }],
      moduleIds: ['mod.workflow', 'mod.domain'],
      dependencyEdges: [{ fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: undefined as unknown as string }],
      operationAllocations: [], adapterAllocations: [],
      workflowTraces: [{ useCaseId: 'usecase.main', moduleIds: ['mod.workflow'] }],
      proposals: [], unresolvedQuestions: [],
      gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'legacy-hash',
    }
    const saveDraft = vi.fn(async () => ({ ok: true as const }))
    const approveArchitecture = vi.fn(async (_projectId: string, architecture: ArchitectureSpecification) => ({
      ok: true as const, approved: { ...architecture, status: 'approved' as const },
      gate: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    }))
    const bridge = makeBridge({
      capabilitiesGetApplication: (async () => ({ approved: ARCH_PRODUCT })) as never,
      capabilitiesGetArchitecture: (async () => ({ draft: legacyDraft })) as never,
      capabilitiesSaveArchitectureDraft: saveDraft as never,
      capabilitiesApproveArchitecture: approveArchitecture as never,
    })
    render(<ArchitectureInterview bridge={bridge} projectId="p1" architectureApproved={false} projection="guided" />)

    const approve = screen.getByRole('button', { name: 'Approve architecture' }) as HTMLButtonElement
    await waitFor(() => expect(approve.disabled).toBe(false))
    fireEvent.click(approve)

    await waitFor(() => expect(screen.getByText('Architecture approved.')).toBeTruthy())
    const normalized = (approveArchitecture.mock.calls as unknown[][])[0]![1] as ArchitectureSpecification
    expect(normalized.dependencyEdges[0]?.reason).toContain('Workflow uses Domain')
    expect(normalized.workflowTraces[0]?.moduleIds).toEqual(['mod.workflow', 'mod.domain'])
    expect(normalized.moduleDefinitions?.map((definition) => definition.moduleType)).toEqual(['workflow', 'domain'])
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })
})

describe('architecture exploration', () => {
  it('opens polished module details from the diagram', () => {
    const architecture: ArchitectureSpecification = {
      schemaVersion: '1.0', projectId: 'p1', id: 'arch.p1', revision: '1', status: 'approved',
      applicationSpecId: 'app.p1', applicationSpecRevision: '1', applicationSpecHash: 'app-hash',
      capabilityProjections: [{ id: 'cap.plan', name: 'Planning', moduleIds: ['mod.planner'] }],
      moduleIds: ['mod.planner'], moduleDefinitions: [{
        moduleId: 'mod.planner', name: 'Flight Planner', moduleType: 'workflow',
        responsibility: 'Coordinates a complete flight planning workflow.',
      }],
      dependencyEdges: [], operationAllocations: [], adapterAllocations: [],
      workflowTraces: [{ useCaseId: 'usecase.main', moduleIds: ['mod.planner'] }],
      proposals: [], unresolvedQuestions: [],
      gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] }, contentHash: 'arch-hash',
    }
    render(<ArchitectureView projection={projectArchitecture(architecture, [], {}, { mode: 'guided' })} mode="guided" />)

    fireEvent.click(screen.getByRole('button', { name: 'Flight Planner, Workflow, Planned. Open details' }))

    expect(screen.getByRole('dialog', { name: 'Flight Planner' })).toBeTruthy()
    expect(screen.getByText('Coordinates a complete flight planning workflow.')).toBeTruthy()
    expect(screen.getByText('Workflow')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('module isolation', () => {
  const arch = { approved: { schemaVersion: '1.0', id: 'arch', revision: '1', moduleIds: ['mod.orders'] } }
  const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders' }]

  it('rejects an interview response for a different module and does not save it', async () => {
    const saveModuleDraft = vi.fn(async () => ({ ok: true as const }))
    const bridge = makeBridge({ capabilitiesGetArchitecture: (async () => arch) as never, capabilitiesSaveModuleDraft: saveModuleDraft as never })
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="design" records={records} />)

    await waitFor(() => expect(screen.getByLabelText('Interview response JSON')).toBeTruthy())
    // A valid response but for mod.other, not the selected mod.orders.
    const wrong = JSON.stringify({ moduleId: 'mod.other', moduleType: 'domain', name: 'x', moduleVersion: '1.0.0', responsibility: 'x', ownedConcerns: [], excludedConcerns: [], providedOperations: [], requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded', events: [], ownedPaths: [], answers: [], acceptanceCases: [], rules: [] })
    fireEvent.change(screen.getByLabelText('Interview response JSON'), { target: { value: wrong } })
    fireEvent.click(screen.getByRole('button', { name: 'Import module interview response' }))

    await waitFor(() => expect(screen.getByText(/does not match selected module/i)).toBeTruthy())
    expect(saveModuleDraft).not.toHaveBeenCalled()
  })

  it('resumes a persisted implementation lifecycle instead of restarting at handoff', async () => {
    const runs = [{ runId: 'run-1', targetOwnerId: 'mod.orders', kind: 'implementation', lifecycleState: 'packet-exported', createdAt: 't', updatedAt: 't' }]
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => arch) as never,
      capabilitiesListRuns: (async () => runs) as never,
    })
    const approvedRecords: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: { moduleId: 'mod.orders' } as never }]
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={approvedRecords} hideModuleList progressive externalSelectedModuleId="mod.orders" />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Select and inspect overlay/i })).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Create implementation handoff/i })).toBeNull()
  })

  it('resumes persisted module state under the app StrictMode wrapper', async () => {
    const runs = [{ runId: 'run-1', targetOwnerId: 'mod.orders', kind: 'implementation', lifecycleState: 'packet-exported', createdAt: 't', updatedAt: 't' }]
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => arch) as never,
      capabilitiesListRuns: (async () => runs) as never,
    })
    const approvedRecords: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: { moduleId: 'mod.orders' } as never }]
    render(
      <StrictMode>
        <ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={approvedRecords} hideModuleList progressive externalSelectedModuleId="mod.orders" />
      </StrictMode>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: /Select and inspect overlay/i })).toBeTruthy())
  })

  it('resumes an overlay-applied implementation run at verification', async () => {
    const runs = [{ runId: 'run-1', targetOwnerId: 'mod.orders', kind: 'implementation', lifecycleState: 'overlay-applied', createdAt: 't', updatedAt: 't' }]
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => arch) as never,
      capabilitiesListRuns: (async () => runs) as never,
    })
    const approvedRecords: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: { moduleId: 'mod.orders' } as never }]
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={approvedRecords} hideModuleList progressive externalSelectedModuleId="mod.orders" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Run verification/i })).toBeTruthy())
  })

  it('visualizes the persisted interview outcome and lets the user revisit it', async () => {
    const manifest: ModuleManifest = {
      schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.orders', moduleVersion: '1.2.0',
      moduleType: 'domain', name: 'Order Domain', responsibility: 'Owns order lifecycle decisions.',
      ownedConcerns: ['order-rules'], excludedConcerns: ['user-interface'],
      providedOperations: [{ operationId: 'op.place-order', contractVersion: '1.0.0' }],
      requiredOperations: [{ operationId: 'op.lookup-customer', acceptedContractRange: '^1.0.0' }],
      verificationSuiteIds: ['suite.orders'], runtimeAllocation: 'local-embedded', events: [],
      ownedPaths: ['capabilities/modules/mod.orders/'], configurationSchemaRef: null,
    }
    const contextualArch = { approved: {
      schemaVersion: '1.0', id: 'arch', revision: '1', moduleIds: ['mod.orders'],
      moduleDefinitions: [{ moduleId: 'mod.orders', name: 'Order Domain', moduleType: 'domain', responsibility: 'Owns order lifecycle decisions.' }],
      capabilityProjections: [], dependencyEdges: [], operationAllocations: [], adapterAllocations: [], workflowTraces: [],
      contentHash: 'arch-hash',
    } }
    const exportInterview = vi.fn(async () => ({
      runId: 'run-revisit', packetId: 'pkt-revisit', recommendedPrompt: 'Revisit this module.',
      files: [{ path: '/tmp/module-interview.md', bytes: 1024, sha256: 'abc123' }], uploadFiles: ['/tmp/module-interview.md'],
    }))
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => contextualArch) as never,
      capabilitiesExportInterviewPacket: exportInterview as never,
    })
    const approvedRecords: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: manifest }]
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={approvedRecords} hideModuleList progressive externalSelectedModuleId="mod.orders" />)

    const outcome = await screen.findByRole('region', { name: 'Interview outcome for Order Domain' })
    expect(within(outcome).getByText('Owns order lifecycle decisions.')).toBeTruthy()
    expect(within(outcome).getByText('Lookup Customer')).toBeTruthy()
    expect(within(outcome).getByText('Place Order')).toBeTruthy()
    expect(within(outcome).getByText('Order Rules')).toBeTruthy()
    expect(within(outcome).getByText('User Interface')).toBeTruthy()

    fireEvent.click(within(outcome).getByRole('button', { name: 'Revisit interview' }))
    await waitFor(() => expect(exportInterview).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('region', { name: 'Ready for Copilot' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Import module interview response' }).some((button) => !(button as HTMLButtonElement).disabled)).toBe(true)
    expect(within(outcome).getByText('Revising')).toBeTruthy()
  })

  it('clears an imported module draft when the user selects another module', async () => {
    const twoModuleArch = { approved: { schemaVersion: '1.0', id: 'arch', revision: '1', moduleIds: ['mod.orders', 'mod.other'] } }
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => twoModuleArch) as never,
      capabilitiesSaveModuleDraft: (async () => ({ ok: true })) as never,
    })
    const twoRecords: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders' }, { moduleId: 'mod.other' }]
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="design" records={twoRecords} />)
    await waitFor(() => expect(screen.getByLabelText('Interview response JSON')).toBeTruthy())
    const response = JSON.stringify({ moduleId: 'mod.orders', moduleType: 'domain', name: 'Orders', moduleVersion: '1.0.0', responsibility: 'orders', ownedConcerns: [], excludedConcerns: [], providedOperations: [], requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded', events: [], ownedPaths: [], answers: [], acceptanceCases: [], rules: [] })
    fireEvent.change(screen.getByLabelText('Interview response JSON'), { target: { value: response } })
    fireEvent.click(screen.getByRole('button', { name: 'Import module interview response' }))
    await waitFor(() => expect(screen.getByText(/Manifest draft mod\.orders/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Select module mod.other' }))
    await waitFor(() => expect(screen.queryByText(/Manifest draft mod\.orders/i)).toBeNull())
    expect((screen.getByRole('button', { name: 'Approve module' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('auto-advances Guided Build to the next incomplete module', async () => {
    const architecture = { schemaVersion: '1.0', id: 'arch', revision: '1', moduleIds: ['mod.orders', 'mod.other'] }
    const bridge = makeBridge({ capabilitiesGetArchitecture: (async () => ({ approved: architecture })) as never })
    const initial: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders' }, { moduleId: 'mod.other' }]
    const { rerender } = render(<GuidedBuild bridge={bridge} projectId="p1" archSpec={architecture as never} records={initial} onChanged={() => {}} />)
    expect(screen.getByRole('button', { name: /Orders, Not started/i }).getAttribute('aria-current')).toBe('true')

    const afterApproval: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: { moduleId: 'mod.orders' } as never }, { moduleId: 'mod.other' }]
    rerender(<GuidedBuild bridge={bridge} projectId="p1" archSpec={architecture as never} records={afterApproval} onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Other, Not started/i }).getAttribute('aria-current')).toBe('true'))
    expect(screen.getByText('Create the module interview')).toBeTruthy()
  })

  it('offers an agent-assisted build for an approved experience module with approved context', async () => {
    const manifest: ModuleManifest = {
      schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.ui', moduleVersion: '1.0.0',
      moduleType: 'experience', name: 'Flight Planner UI', responsibility: 'Lets dispatchers plan flights.',
      ownedConcerns: ['flight-plan-presentation'], excludedConcerns: ['route-optimization'],
      providedOperations: [{ operationId: 'ui.show-plan', contractVersion: '1.0.0' }],
      requiredOperations: [{ operationId: 'plan.calculate', acceptedContractRange: '^1.0.0', reason: 'Calculate the route' }],
      verificationSuiteIds: ['suite.ui'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/features/planner/'],
    }
    const architecture = {
      schemaVersion: '1.0', id: 'arch.ui', revision: '3', moduleIds: ['mod.ui'],
      moduleDefinitions: [{ moduleId: 'mod.ui', name: 'Flight Planner UI', moduleType: 'experience', responsibility: manifest.responsibility }],
    }
    const onStartUiBuild = vi.fn(async () => {})
    const bridge = makeBridge({ capabilitiesGetArchitecture: (async () => ({ approved: architecture })) as never })
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={[{ moduleId: 'mod.ui', approved: manifest }]} hideModuleList progressive externalSelectedModuleId="mod.ui" onStartUiBuild={onStartUiBuild} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Build UI with agent' }))
    await waitFor(() => expect(onStartUiBuild).toHaveBeenCalledTimes(1))
    const [projectId, fields] = onStartUiBuild.mock.calls[0]
    expect(projectId).toBe('p1')
    expect(fields.taskTitle).toBe('Build UI module: Flight Planner UI')
    expect(fields.scope).toContain('plan.calculate')
    expect(fields.constraints).toContain('route-optimization')
    expect(fields.references).toContain('arch.ui revision 3')
  })
})

describe('capability preview recovery', () => {
  it('installs missing project dependencies and automatically retries the preview', async () => {
    const launchApp = vi.fn()
      .mockRejectedValueOnce(new Error('Project setup required: dependencies are not installed.'))
      .mockResolvedValueOnce({ url: 'http://127.0.0.1:4180', started: true, rebuilt: false })
    const createRun = vi.fn(async () => ({ id: 'run-setup', projectId: 'p1', currentStep: 'prepare-context', createdAt: 't', updatedAt: 't' }))
    const installDependencies = vi.fn(async () => ({
      runId: 'run-setup', commandLabel: 'install-dependencies', commandText: 'npm ci', workingDirectory: '/tmp/project',
      startedAt: 't', endedAt: 't', exitCode: 0, status: 'passed' as const, wasCancelledByUser: false,
    }))
    const bridge = makeBridge({ launchApp: launchApp as never, createRun: createRun as never, installDependencies: installDependencies as never })

    render(<CapabilityPreview bridge={bridge} projectId="p1" />)
    expect(await screen.findByText('Project setup required')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Install dependencies and retry' }))

    await waitFor(() => expect(installDependencies).toHaveBeenCalledWith('run-setup'))
    await waitFor(() => expect(launchApp).toHaveBeenCalledTimes(2))
    expect(await screen.findByTitle('Target application Preview')).toBeTruthy()
  })
})

describe('guided connect isolation', () => {
  const records: CapabilityModuleRecord[] = [{
    moduleId: 'mod.ui',
    approved: { schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.ui', moduleVersion: '1.0.0', moduleType: 'experience', name: 'ui', responsibility: '', ownedConcerns: [], excludedConcerns: [], providedOperations: [{ operationId: 'op.placeOrder', contractVersion: '2.0' }], requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded', events: [], ownedPaths: [] } as never,
  }]
  const evidence = { route: '/#/orders', documentTitle: 'Orders', selector: '#p', visibleText: 'Place', elementTag: 'button', stableMarker: 'data-cap-id=p', captureTime: '2026-07-14T00:00:00.000Z' }

  function fillAllBehaviors() {
    for (const label of ['While it runs', 'Invalid input', 'Request rejected', 'Something goes wrong', 'User cancels', 'Repeated submission']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'x' } })
    }
  }

  it('requires the configured project UI to be confirmed before launching its preview', async () => {
    const launchApp = vi.fn(async () => ({ url: 'http://127.0.0.1:5402', started: false, rebuilt: false }))
    const configuredProject = {
      ...project('p1', 'Aircraft Performance'), repoPath: 'C:\\work\\aircraft-performance',
      launchUrl: 'http://127.0.0.1:5402', launchCommand: 'npm run dev',
    }
    const updateProject = vi.fn(async (_id, patch) => ({ ...configuredProject, ...patch }))
    render(<GuidedConnect bridge={makeBridge({ launchApp: launchApp as never, updateProject: updateProject as never })} projectId="p1" project={configuredProject} records={records} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    expect(screen.getByRole('region', { name: 'Step 1: Choose how this application connects' })).toBeTruthy()
    expect(launchApp).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Connect a UI now/i }))
    await waitFor(() => expect(screen.getByText('Aircraft Performance')).toBeTruthy())
    expect(screen.getByText('C:\\work\\aircraft-performance')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use this UI' }))
    await waitFor(() => expect(launchApp).toHaveBeenCalledWith('p1', { open: false }))
    expect(await screen.findByTitle('Target application Preview')).toBeTruthy()
  })

  it('can configure a different application UI before element binding begins', async () => {
    const unconfiguredProject = project('p1', 'Aircraft Performance')
    const updatedProject = { ...unconfiguredProject, launchUrl: 'http://localhost:4400', launchCommand: 'npm run ui' }
    const updateProject = vi.fn(async (_id, patch) => ({ ...unconfiguredProject, ...patch }))
    const launchApp = vi.fn(async () => ({ url: updatedProject.launchUrl, started: true, rebuilt: false }))
    render(<GuidedConnect bridge={makeBridge({ updateProject: updateProject as never, launchApp: launchApp as never })} projectId="p1" project={unconfiguredProject} records={records} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Connect a UI now/i }))
    await waitFor(() => expect(screen.getByLabelText('Application UI URL')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Application UI URL'), { target: { value: 'http://localhost:4400' } })
    fireEvent.change(screen.getByLabelText('Application UI start command'), { target: { value: 'npm run ui' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and use this UI' }))

    await waitFor(() => expect(updateProject).toHaveBeenLastCalledWith('p1', {
      launchUrl: 'http://localhost:4400', launchCommand: 'npm run ui', capabilitiesConnectDisposition: 'connect-now',
    }))
    await waitFor(() => expect(launchApp).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it.each(['no-ui', 'deferred'] as const)('persists the %s choice without launching a preview', async (disposition) => {
    const baseProject = project('p1', 'Service')
    const updateProject = vi.fn(async (_id, patch) => ({ ...baseProject, ...patch }))
    const launchApp = vi.fn()
    const onProjectChanged = vi.fn(async () => {})
    render(<GuidedConnect bridge={makeBridge({ updateProject: updateProject as never, launchApp: launchApp as never })} projectId="p1" project={baseProject} records={records} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} onProjectChanged={onProjectChanged} />)

    fireEvent.click(screen.getByRole('button', { name: disposition === 'no-ui' ? /No UI for this application/i : /Decide later/i }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('p1', { capabilitiesConnectDisposition: disposition }))
    expect(onProjectChanged).toHaveBeenCalledTimes(1)
    expect(launchApp).not.toHaveBeenCalled()
  })

  it('prevents duplicate Approve actions (one persistence call for a double click)', async () => {
    const approveBinding = vi.fn(() => new Promise(() => {})) // never resolves -> stays busy
    const saveBindingDraft = vi.fn(async () => ({ ok: true as const }))
    const bridge = makeBridge({ capabilitiesApproveBinding: approveBinding as never, capabilitiesSaveBindingDraft: saveBindingDraft as never })
    render(<GuidedConnect bridge={bridge} projectId="p1" records={records} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.change(screen.getByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    fillAllBehaviors()

    const approve = screen.getByRole('button', { name: 'Approve connection' })
    fireEvent.click(approve)
    fireEvent.click(approve) // second click in the same tick must be ignored
    await new Promise((r) => setTimeout(r, 0))
    expect(approveBinding).toHaveBeenCalledTimes(1)
  })

  it('withholds Test and Approve until every behavior is described', async () => {
    render(<GuidedConnect bridge={makeBridge()} projectId="p1" records={records} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    fireEvent.change(screen.getByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    // No behaviors filled yet -> both actions disabled.
    expect((screen.getByRole('button', { name: 'Approve connection' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Run connected test/i }) as HTMLButtonElement).disabled).toBe(true)
    fillAllBehaviors()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Approve connection' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('re-initializes (empty behaviors) when the project identity changes', async () => {
    const { rerender } = render(<GuidedConnect key="p1" bridge={makeBridge()} projectId="p1" records={records} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    fireEvent.change(screen.getByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('While it runs'), { target: { value: 'typed in project 1' } })
    expect((screen.getByLabelText('While it runs') as HTMLInputElement).value).toBe('typed in project 1')
    // Remount under a new project key (as the shell does) -> fresh, empty editor.
    rerender(<GuidedConnect key="p2" bridge={makeBridge()} projectId="p2" records={records} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    fireEvent.change(screen.getByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    expect((screen.getByLabelText('While it runs') as HTMLInputElement).value).toBe('')
  })

  it('reflects a refreshed canonical binding when its id and version are unchanged', async () => {
    const canonical = (loadingBehavior: string) => ({
      bindingId: 'binding.same', version: '1.0.0', projectId: 'p1', selectionEvidence: evidence,
      trigger: 'activate' as const, operationId: 'op.placeOrder', operationVersion: '2.0',
      inputMappings: [], outputMappings: [], loadingBehavior, validationBehavior: 'v',
      domainRejectionBehavior: 'd', technicalFailureBehavior: 't', cancellationBehavior: 'c',
      duplicateSubmissionBehavior: 'x', dataMode: 'connected' as const,
    })
    const props = { bridge: makeBridge(), projectId: 'p1', records, selectionEvidence: evidence, onSelectionEvidence: () => {}, previewRef: { current: null }, onChanged: () => {} }
    const { rerender } = render(<GuidedConnect {...props} initialBinding={canonical('old behavior')} />)
    expect((screen.getByLabelText('While it runs') as HTMLInputElement).value).toBe('old behavior')
    rerender(<GuidedConnect {...props} initialBinding={canonical('canonical refreshed behavior')} />)
    await waitFor(() => expect((screen.getByLabelText('While it runs') as HTMLInputElement).value).toBe('canonical refreshed behavior'))
  })
})

describe('help modal accessibility', () => {
  it('focuses the dialog, closes on Escape, restores focus, and keeps Prev/Next within a group', async () => {
    const invoker = document.createElement('button')
    invoker.textContent = 'open help'
    document.body.appendChild(invoker)
    invoker.focus()
    expect(document.activeElement).toBe(invoker)

    const onClose = vi.fn()
    const onSelect = vi.fn()
    const { rerender, unmount } = render(<GuideOverlay topic="capabilities-overview" onSelectTopic={onSelect} onClose={onClose} />)

    // Initial focus enters the dialog (close button).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close guides' })))

    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    // The Capabilities overview is the first topic in its group -> no Previous action.
    expect(screen.queryByRole('button', { name: /←/ })).toBeNull()
    // Next stays inside the Capabilities group (Plan · Understand), not Build & Test.
    fireEvent.click(screen.getByRole('button', { name: /Plan · Understand →/ }))
    expect(onSelect).toHaveBeenCalledWith('capabilities-define')

    // Escape closes.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()

    // Unmount restores focus to the invoking control.
    unmount()
    void rerender
    await waitFor(() => expect(document.activeElement).toBe(invoker))
    invoker.remove()
  })
})
