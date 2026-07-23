// @vitest-environment jsdom
/**
 * CAP-UX state-safety — behavioral / race-condition tests.
 *
 * These drive the real components with @testing-library/react (jsdom) and prove the
 * project/module/entry-point isolation fixes. They are designed to FAIL against the
 * pre-fix behavior (shared `projectId`, no generation guard, module state that
 * survived selection changes) and pass because of the implementation.
 */

import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApplicationSpecification, ArchitectureSpecification, CapabilityModuleRecord, InterviewPacket, ModuleManifest, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { CapabilitiesView } from '../src/views/capabilities/CapabilitiesView'
import { architectureForDisplay } from '../src/views/capabilities/capabilitiesProjection'
import { ModulesView } from '../src/views/capabilities/ModulesView'
import { GuidedConnect } from '../src/views/capabilities/GuidedConnect'
import { GuidedBuild } from '../src/views/capabilities/GuidedBuild'
import { ArchitectureInterview } from '../src/views/capabilities/ArchitectureInterview'
import { ArchitectureView } from '../src/views/capabilities/ArchitectureView'
import { CapabilityPreview } from '../src/views/capabilities/CapabilityPreview'
import { projectArchitecture } from '@engineering-ui-kit/core/browser'
import { GuideOverlay } from '../src/guides'
import { installMockBridge } from '../src/mockBridge'

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
    capabilitiesListDeployables: async () => [],
    capabilitiesListInboundBindings: async () => [],
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
  it('carries an active Build & Test project into Capabilities without another selection', async () => {
    const ensureInitialized = vi.fn(async () => ({ schemaVersion: '1.0', initializedAt: 't' }))
    const onProjectSelected = vi.fn()
    render(
      <CapabilitiesView
        bridge={makeBridge({ capabilitiesEnsureInitialized: ensureInitialized as never })}
        projects={projects}
        activeProjectId="B"
        onProjectSelected={onProjectSelected}
      />,
    )

    await waitFor(() => expect((screen.getByLabelText('Capabilities project') as HTMLSelectElement).value).toBe('B'))
    await waitFor(() => expect(screen.getByText('Understand the application.')).toBeTruthy())
    expect(ensureInitialized).toHaveBeenCalledWith('B')
    expect(onProjectSelected).toHaveBeenCalledWith('B')
  })

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
    await waitFor(() => expect(screen.getByText('Understand the application.')).toBeTruthy(), { timeout: 5_000 })
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
    await waitFor(() => expect((screen.getByRole('button', { name: 'Approve plan' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }))
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
  it('starts a real revision, refreshes the workspace, and prepares a new immutable revision', async () => {
    const approved: ArchitectureSpecification = {
      schemaVersion: '1.0', projectId: 'p1', id: 'arch.p1', revision: '1', status: 'approved',
      applicationSpecId: ARCH_PRODUCT.id, applicationSpecRevision: ARCH_PRODUCT.revision, applicationSpecHash: ARCH_PRODUCT.contentHash,
      capabilityProjections: [{ id: 'cap.main', name: 'Main', moduleIds: ['mod.main'] }],
      moduleIds: ['mod.main'],
      moduleDefinitions: [{ moduleId: 'mod.main', name: 'Main', moduleType: 'domain', responsibility: 'Own the main workflow.' }],
      dependencyEdges: [], operationAllocations: [], adapterAllocations: [],
      workflowTraces: [{ useCaseId: 'usecase.main', moduleIds: ['mod.main'] }],
      proposals: [], unresolvedQuestions: [],
      gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] }, contentHash: 'approved-arch-hash',
    }
    const exportInterview = vi.fn(async (_input: unknown) => ({
      runId: 'run-revise', packetId: 'pkt-revise', recommendedPrompt: 'Revise the design.',
      files: [{ path: '/tmp/capability-architecture-handoff.md', bytes: 100, sha256: 'abc' }],
      uploadFiles: ['/tmp/capability-architecture-handoff.md'],
    }))
    const saveDraft = vi.fn(async () => ({ ok: true as const }))
    const onChanged = vi.fn(async () => undefined)
    const bridge = makeBridge({
      capabilitiesGetApplication: (async () => ({ approved: ARCH_PRODUCT })) as never,
      capabilitiesGetArchitecture: (async () => ({ approved })) as never,
      capabilitiesExportInterviewPacket: exportInterview as never,
      capabilitiesSaveArchitectureDraft: saveDraft as never,
    })
    render(
      <ArchitectureInterview
        bridge={bridge}
        projectId="p1"
        architectureApproved
        projection="guided"
        onChanged={onChanged}
      />,
    )

    const revise = await screen.findByRole('button', { name: 'Revise design' })
    fireEvent.click(revise)
    await waitFor(() => expect(exportInterview).toHaveBeenCalledTimes(1))
    const exportedPacket = exportInterview.mock.calls[0]![0] as InterviewPacket
    expect(exportedPacket.inputContext.facts).toContain(`currentArchitectureSpecification:${JSON.stringify(approved)}`)
    expect(exportedPacket.inputContext.facts).toContain('architectureRevision:replace approved revision 1 with revision 2')
    expect(await screen.findByText('Review the revised application structure')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Approve application structure' }) as HTMLButtonElement).disabled).toBe(true)

    const response = {
      architecture: {
        ...approved,
        status: 'proposed',
        revision: '1',
        moduleDefinitions: [{ ...approved.moduleDefinitions![0]!, responsibility: 'Own the revised main workflow.' }],
        gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] },
        contentHash: 'pending',
      },
      moduleNeedTraces: [{ moduleId: 'mod.main', needIds: ['usecase.main'] }],
      moduleJustifications: [{ moduleId: 'mod.main', justification: 'distinct-rules' }],
    }
    fireEvent.change(screen.getByLabelText('Interview response JSON'), { target: { value: JSON.stringify(response) } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Import proposed structure' })[1]!)

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1))
    const revisedDraft = saveDraft.mock.calls[0]![1] as ArchitectureSpecification
    expect(revisedDraft.revision).toBe('2')
    expect(revisedDraft.status).toBe('proposed')
    expect(revisedDraft.contentHash).not.toBe('pending')
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Approve application structure' }) as HTMLButtonElement).disabled).toBe(false)

    expect(architectureForDisplay({ approved, draft: revisedDraft })).toBe(revisedDraft)
    expect(architectureForDisplay({ approved, draft: { ...revisedDraft, revision: approved.revision } })).toBe(approved)
  })

  it('sends validation findings and the rejected JSON to Copilot for correction', async () => {
    const openExternal = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const bridge = makeBridge({
      capabilitiesGetApplication: (async () => ({ approved: ARCH_PRODUCT })) as never,
      capabilitiesGetArchitecture: (async () => ({})) as never,
      openExternal: openExternal as never,
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
    const rejected = JSON.stringify({ architecture: { schemaVersion: '1.0' } })
    fireEvent.change(screen.getByLabelText('Interview response JSON'), { target: { value: rejected } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Import proposed structure' })[1]!)

    const fixButton = await screen.findByRole('button', { name: 'Fix errors in Copilot' })
    expect(screen.getByRole('alert', { name: 'Architecture validation issues' })).toBeTruthy()
    fireEvent.click(fixButton)

    await waitFor(() => expect(openExternal).toHaveBeenCalledWith('https://m365.cloud.microsoft/chat'))
    expect(writeText).toHaveBeenCalledTimes(1)
    const prompt = writeText.mock.calls[0]![0]
    expect(prompt).toContain('architecture.moduleIds is required')
    expect(prompt).toContain(rejected)
    expect(prompt).toContain(`applicationSpecHash: ${ARCH_PRODUCT.contentHash}`)
    expect(prompt).toContain('Return one complete replacement JSON object only')
    expect(screen.getByText(/fix request on your clipboard/i)).toBeTruthy()
  })

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
    const importButtons = screen.getAllByRole('button', { name: 'Import proposed structure' })
    fireEvent.change(paste, { target: { value: JSON.stringify(response) } })
    fireEvent.click(importButtons[1]!)

    await waitFor(() => expect(screen.getByText('Imported the proposed application structure. Review it, then approve when ready.')).toBeTruthy())
    expect(screen.queryByText(/Cannot read properties of undefined/)).toBeNull()
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Approve application structure' }) as HTMLButtonElement).disabled).toBe(false)
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

    const approve = screen.getByRole('button', { name: 'Approve application structure' }) as HTMLButtonElement
    await waitFor(() => expect(approve.disabled).toBe(false))
    fireEvent.click(approve)

    await waitFor(() => expect(screen.getByText('Application structure approved.')).toBeTruthy())
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

    const dialog = screen.getByRole('dialog', { name: 'Flight Planner' })
    expect(dialog).toBeTruthy()
    expect(screen.getByText('Coordinates a complete flight planning workflow.')).toBeTruthy()
    expect(within(dialog).getByText('Workflow')).toBeTruthy()
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
    expect(outcome.textContent).not.toContain('suite.orders')
    expect(outcome.textContent).not.toContain('1.2.0')

    fireEvent.click(within(outcome).getByRole('button', { name: 'Technical specification' }))
    const technical = screen.getByRole('dialog', { name: 'Order Domain technical specification' })
    expect(technical.textContent).toContain('suite.orders')
    expect(technical.textContent).toContain('op.place-order@1.0.0')
    expect(technical.textContent).toContain('capabilities/modules/mod.orders/')
    fireEvent.click(within(technical).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Order Domain technical specification' })).toBeNull()

    fireEvent.click(within(outcome).getByRole('button', { name: 'Revisit interview' }))
    await waitFor(() => expect(exportInterview).toHaveBeenCalledTimes(1))
    expect(exportInterview).toHaveBeenCalledWith(expect.objectContaining({
      inputContext: expect.objectContaining({ facts: expect.arrayContaining(['moduleVersion:1.2.1']) }),
    }))
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
    expect(screen.getByText('Generate the module draft')).toBeTruthy()
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
    const compiledFields = {
      taskTitle: 'Build frontend from approved capabilities: Flight Planner UI',
      goal: '# Frontend brief — Flight Planner UI\n\n## Operation map\nplan.calculate',
      scope: 'Selected modules:\n- Flight Planner UI\n\nApproved paths:\n- src/features/planner/',
      constraints: 'Preserve route-optimization outside the frontend.',
      acceptanceCriteria: 'The approved journey works.',
      references: 'Architecture: arch.ui revision 3',
      intentProfile: {
        delivery: 'existing-api-ui' as const,
        backend: 'existing' as const,
        network: 'existing' as const,
        persistence: 'preserve' as const,
        filesystem: 'preserve' as const,
      },
    }
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => ({ approved: architecture })) as never,
      capabilitiesCompileFrontendBrief: (async () => ({
        schemaVersion: '1.0',
        projectId: 'p1',
        generatedAt: 't',
        source: {
          architectureRevision: '3',
          architectureHash: 'arch-hash',
          moduleVersions: { 'mod.ui': '1.0.0' },
          bindingVersions: {},
        },
        coverage: {
          moduleIds: ['mod.ui'],
          operationIds: ['plan.calculate', 'ui.show-plan'],
          bindingIds: [],
          routes: [],
          useCaseIds: [],
        },
        fields: compiledFields,
        gaps: [{ code: 'FRONTEND-BRIEF-BINDING', severity: 'warning', message: 'No approved UI binding.', relatedIds: [] }],
      })) as never,
    })
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={[{ moduleId: 'mod.ui', approved: manifest }]} hideModuleList progressive externalSelectedModuleId="mod.ui" onStartUiBuild={onStartUiBuild} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Compile frontend brief' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review compiled frontend brief' })
    expect(within(dialog).getByText(/2 operation\(s\)/)).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText('Task title'), { target: { value: 'Build polished flight planner' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Build with this brief' }))
    await waitFor(() => expect(onStartUiBuild).toHaveBeenCalledTimes(1))
    const [projectId, fields] = onStartUiBuild.mock.calls[0]
    expect(projectId).toBe('p1')
    expect(fields.taskTitle).toBe('Build polished flight planner')
    expect(fields.goal).toContain('# Frontend brief — Flight Planner UI')
    expect(fields.goal).toContain('plan.calculate')
    expect(fields.scope).toContain('src/features/planner/')
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

describe('guided connect isolation (WP6B trigger-first)', () => {
  const records: CapabilityModuleRecord[] = [{
    moduleId: 'mod.ui',
    approved: { schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.ui', moduleVersion: '1.0.0', moduleType: 'experience', name: 'ui', responsibility: '', ownedConcerns: [], excludedConcerns: [], providedOperations: [{ operationId: 'op.placeOrder', contractVersion: '2.0' }], requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded', events: [], ownedPaths: [] } as never,
  }]
  const evidence = { route: '/#/orders', documentTitle: 'Orders', selector: '#p', visibleText: 'Place', elementTag: 'button', stableMarker: 'data-cap-id=p', captureTime: '2026-07-14T00:00:00.000Z' }
  const uiDeployables = [{ deployableId: 'deployable.ui', kind: 'browser' as const, name: 'Application UI' }, { deployableId: 'deployable.main', kind: 'http-api' as const, name: 'Application' }]

  function fillAllBehaviors() {
    for (const label of ['While it runs', 'Invalid input', 'Request rejected', 'Something goes wrong', 'User cancels', 'Repeated submission']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'x' } })
    }
  }

  it('opens with the trigger question and requires the configured project UI to be confirmed before launching its preview', async () => {
    const launchApp = vi.fn(async () => ({ url: 'http://127.0.0.1:5402', started: false, rebuilt: false }))
    const configuredProject = {
      ...project('p1', 'Aircraft Performance'), repoPath: 'C:\\work\\aircraft-performance',
      launchUrl: 'http://127.0.0.1:5402', launchCommand: 'npm run dev',
    }
    const updateProject = vi.fn(async (_id, patch) => ({ ...configuredProject, ...patch }))
    render(<GuidedConnect bridge={makeBridge({ launchApp: launchApp as never, updateProject: updateProject as never })} projectId="p1" project={configuredProject} records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Configure application entry points' })).toBeTruthy()
    expect(launchApp).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    await waitFor(() => expect(screen.getByText('Aircraft Performance')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Use this UI' }))
    await waitFor(() => expect(launchApp).toHaveBeenCalledWith('p1', { open: false }))
    expect(await screen.findByTitle('Target application Preview')).toBeTruthy()
  })

  it('can configure a different application UI before element binding begins', async () => {
    const unconfiguredProject = project('p1', 'Aircraft Performance')
    const updatedProject = { ...unconfiguredProject, launchUrl: 'http://localhost:4400', launchCommand: 'npm run ui' }
    const updateProject = vi.fn(async (_id, patch) => ({ ...unconfiguredProject, ...patch }))
    const launchApp = vi.fn(async () => ({ url: updatedProject.launchUrl, started: true, rebuilt: false }))
    render(<GuidedConnect bridge={makeBridge({ updateProject: updateProject as never, launchApp: launchApp as never })} projectId="p1" project={unconfiguredProject} records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    await waitFor(() => expect(screen.getByLabelText('Application UI URL')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Application UI URL'), { target: { value: 'http://localhost:4400' } })
    fireEvent.change(screen.getByLabelText('Application UI start command'), { target: { value: 'npm run ui' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and use this UI' }))

    await waitFor(() => expect(updateProject).toHaveBeenLastCalledWith('p1', {
      launchUrl: 'http://localhost:4400', launchCommand: 'npm run ui',
    }))
    await waitFor(() => expect(launchApp).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Selected')).toBeTruthy()
  })

  it('applies preview selection evidence that arrives after the UI editor opened', async () => {
    const baseProps = {
      bridge: makeBridge(), projectId: 'p1', records, deployables: uiDeployables,
      onSelectionEvidence: () => {}, previewRef: { current: null }, onChanged: () => {},
    }
    const { rerender } = render(<GuidedConnect {...baseProps} selectionEvidence={undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    expect(screen.queryByLabelText('Capability')).toBeNull()

    rerender(<GuidedConnect {...baseProps} selectionEvidence={evidence} />)

    expect(await screen.findByLabelText('Capability')).toBeTruthy()
    expect(screen.getByText('Place', { selector: '.cap-connect-confirmed strong' })).toBeTruthy()
  })

  it('"decide later" defers without launching a preview and never completes Build on its own', async () => {
    const baseProject = project('p1', 'Service')
    const updateProject = vi.fn(async (_id, patch) => ({ ...baseProject, ...patch }))
    const launchApp = vi.fn()
    render(<GuidedConnect bridge={makeBridge({ updateProject: updateProject as never, launchApp: launchApp as never })} projectId="p1" project={baseProject} records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Decide later/i }))
    expect(screen.getByText(/Needs attention/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('p1', { capabilitiesConnectDisposition: 'deferred' }))
    expect(launchApp).not.toHaveBeenCalled()
  })

  it('prevents duplicate Approve actions on the UI editor (one persistence call for a double click)', async () => {
    const approveInboundBinding = vi.fn(() => new Promise(() => {})) // never resolves -> stays busy
    const saveInboundBindingDraft = vi.fn(async () => ({ ok: true as const }))
    const bridge = makeBridge({ capabilitiesApproveInboundBinding: approveInboundBinding as never, capabilitiesSaveInboundBindingDraft: saveInboundBindingDraft as never })
    render(<GuidedConnect bridge={bridge} projectId="p1" records={records} deployables={uiDeployables} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    fillAllBehaviors()

    const approve = screen.getByRole('button', { name: 'Approve entry point' })
    fireEvent.click(approve)
    fireEvent.click(approve) // second click in the same tick must be ignored
    await new Promise((r) => setTimeout(r, 0))
    expect(approveInboundBinding).toHaveBeenCalledTimes(1)
  })

  it('withholds approval until every behavior is described and leaves runtime proof to Verify', async () => {
    render(<GuidedConnect bridge={makeBridge()} projectId="p1" records={records} deployables={uiDeployables} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Approve entry point' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Run connected test/i })).toBeNull()
    expect(screen.getByText(/exercised later in Verify/i)).toBeTruthy()
    fillAllBehaviors()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Approve entry point' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('re-initializes (empty behaviors) when the project identity changes', async () => {
    const { rerender } = render(<GuidedConnect key="p1" bridge={makeBridge()} projectId="p1" records={records} deployables={uiDeployables} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('While it runs'), { target: { value: 'typed in project 1' } })
    expect((screen.getByLabelText('While it runs') as HTMLInputElement).value).toBe('typed in project 1')
    // Remount under a new project key (as the shell does) -> fresh, empty editor back at the trigger question.
    rerender(<GuidedConnect key="p2" bridge={makeBridge()} projectId="p2" records={records} deployables={uiDeployables} selectionEvidence={evidence} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Configure application entry points' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Existing or new UI/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    await waitFor(() => expect(screen.getByLabelText('While it runs')).toBeTruthy())
    expect((screen.getByLabelText('While it runs') as HTMLInputElement).value).toBe('')
  })

  it('the trigger picker offers every host and hides the UI choice when there is no UI deployable', () => {
    const headlessOnly = [{ deployableId: 'deployable.main', kind: 'http-api' as const, name: 'Application' }]
    render(<GuidedConnect bridge={makeBridge()} projectId="p1" records={records} deployables={headlessOnly} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)
    expect(screen.queryByRole('button', { name: /Existing or new UI/i })).toBeNull()
    expect(screen.getByRole('button', { name: /HTTP endpoint/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Command line/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Scheduled or background/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Embedded library/i })).toBeTruthy()
  })

  it('persists an HTTP entry point via the mock bridge and allows a second binding on the same operation', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    render(<GuidedConnect bridge={bridge} projectId="p1" records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /HTTP endpoint/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('HTTP path'), { target: { value: '/orders/place' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    // Wait for the APPROVE to actually land (not just the intermediate draft-save half of the flow).
    await waitFor(async () => {
      const list = await bridge.capabilitiesListInboundBindings('p1')
      expect(list.length).toBe(1)
      expect(list[0]?.approved).toBeTruthy()
    })

    // Back at the picker (or "add another") — add a second HTTP entry point for the SAME operation.
    fireEvent.click(await screen.findByRole('button', { name: /HTTP endpoint/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('HTTP path'), { target: { value: '/orders/place-alt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))

    const persisted = await waitFor(async () => {
      const list = await bridge.capabilitiesListInboundBindings('p1')
      expect(list.length).toBe(2)
      // Both must be fully APPROVED (not merely present as a draft mid-flight) before asserting on them.
      expect(list.every((r) => Boolean(r.approved))).toBe(true)
      return list
    })
    expect(persisted.every((r) => r.approved?.operationId === 'op.placeOrder')).toBe(true)
    expect(new Set(persisted.map((r) => r.bindingId)).size).toBe(2)
    expect(persisted.every((r) => r.approved?.exposure === 'private')).toBe(true)
  })

  it('CLI and scheduled entry points are keyboard-accessible (labeled native controls) and persist via the mock bridge', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    render(<GuidedConnect bridge={bridge} projectId="p1" records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Command line/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'orders place' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    await waitFor(async () => expect((await bridge.capabilitiesListInboundBindings('p1'))[0]?.approved?.kind).toBe('cli'))

    fireEvent.click(await screen.findByRole('button', { name: /Scheduled or background/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '0 * * * *' } })
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'UTC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    await waitFor(async () => expect((await bridge.capabilitiesListInboundBindings('p1')).length).toBe(2))
  })

  it('embedded-library entry points require an explicit reason before they can be approved', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    render(<GuidedConnect bridge={bridge} projectId="p1" records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Embedded library/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('Exported callable'), { target: { value: 'placeOrder' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    expect((await screen.findAllByText(/explain why this operation is only reachable/i)).length).toBeGreaterThan(0)
    expect(await bridge.capabilitiesListInboundBindings('p1')).toEqual([])

    fireEvent.change(screen.getByLabelText('Reason this is embedded-library only'), { target: { value: 'Only ever invoked in-process by the batch job runner.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    await waitFor(async () => expect((await bridge.capabilitiesListInboundBindings('p1'))[0]?.approved?.kind).toBe('embedded-library'))
  })

  it('elevating exposure beyond private requires the deliberate control', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    render(<GuidedConnect bridge={bridge} projectId="p1" records={records} deployables={uiDeployables} onSelectionEvidence={() => {}} previewRef={{ current: null }} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /HTTP endpoint/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('HTTP path'), { target: { value: '/orders/place' } })
    expect(screen.queryByLabelText('Exposure level')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    await waitFor(async () => expect((await bridge.capabilitiesListInboundBindings('p1'))[0]?.approved?.exposure).toBe('private'))

    fireEvent.click(await screen.findByRole('button', { name: /HTTP endpoint/i }))
    fireEvent.change(await screen.findByLabelText('Capability'), { target: { value: 'op.placeOrder@2.0' } })
    fireEvent.change(screen.getByLabelText('HTTP path'), { target: { value: '/orders/place-2' } })
    fireEvent.click(screen.getByLabelText('Allow this entry point to be reached from outside this application'))
    expect(screen.getByLabelText('Exposure level')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Exposure level'), { target: { value: 'public' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    await waitFor(async () => {
      const list = await bridge.capabilitiesListInboundBindings('p1')
      expect(list.some((r) => r.approved?.exposure === 'public')).toBe(true)
    })
  })

  it('keeps raw entry-point identifiers in the technical modal and supports audit-safe revise and remove actions', async () => {
    const approved = {
      schemaVersion: '1.0' as const, kind: 'http' as const,
      bindingId: 'binding.raw.orders-entry', version: '1.0.0', projectId: 'p1',
      deployableId: 'deployable.main', operationId: 'op.placeOrder', operationVersion: '2.0',
      inputMappings: [], outputMappings: [], validationBehavior: 'reject invalid input',
      domainRejectionBehavior: 'show the rejection', technicalFailureBehavior: 'show a safe failure',
      timeoutBehavior: 'show a timeout', cancellationBehavior: 'show cancellation', retryBehavior: 'retry once',
      duplicateSubmissionBehavior: 'ignore duplicates', exposure: 'protected' as const, generatedTargets: [],
      approvalState: 'approved', method: 'POST' as const, path: '/orders/place',
    }
    const saveDraft = vi.fn(async () => ({ ok: true as const }))
    const approve = vi.fn(async (_projectId, binding) => ({ ok: true as const, approved: binding }))
    const archive = vi.fn(async () => ({ ok: true as const }))
    render(
      <GuidedConnect
        bridge={makeBridge({
          capabilitiesSaveInboundBindingDraft: saveDraft as never,
          capabilitiesApproveInboundBinding: approve as never,
          capabilitiesArchiveInboundBinding: archive as never,
        })}
        projectId="p1"
        records={records}
        deployables={uiDeployables}
        inboundBindingRecords={[{ bindingId: approved.bindingId, approved }]}
        architectureVersion="3"
        architectureHash="architecture-raw-hash"
        onSelectionEvidence={() => {}}
        previewRef={{ current: null }}
        onChanged={() => {}}
      />,
    )

    expect(document.body.textContent).not.toContain('binding.raw.orders-entry')
    expect(document.body.textContent).not.toContain('architecture-raw-hash')
    fireEvent.click(screen.getByRole('button', { name: 'Technical specification' }))
    const technical = screen.getByRole('dialog', { name: 'Entry-point technical specification' })
    expect(technical.textContent).toContain('binding.raw.orders-entry')
    expect(technical.textContent).toContain('architecture-raw-hash')
    fireEvent.click(within(technical).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Entry-point technical specification' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect((screen.getByLabelText('Capability') as HTMLSelectElement).value).toBe('op.placeOrder@2.0')
    expect((screen.getByLabelText('HTTP path') as HTMLInputElement).value).toBe('/orders/place')
    fireEvent.change(screen.getByLabelText('HTTP path'), { target: { value: '/orders/place-revised' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve entry point' }))
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1))
    expect(saveDraft.mock.calls[0]?.[1]).toMatchObject({
      bindingId: 'binding.raw.orders-entry', version: '1.0.1', path: '/orders/place-revised',
      operationId: 'op.placeOrder', operationVersion: '2.0', approvalState: 'draft', exposure: 'protected',
    })
    expect(approve.mock.calls[0]?.[1]).toMatchObject({
      bindingId: 'binding.raw.orders-entry', version: '1.0.1', path: '/orders/place-revised',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('p1', 'binding.raw.orders-entry'))
    expect(screen.getByText(/Entry point removed/i)).toBeTruthy()
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
