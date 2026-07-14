// @vitest-environment jsdom
/**
 * CAP-UX state-safety — behavioral / race-condition tests.
 *
 * These drive the real components with @testing-library/react (jsdom) and prove the
 * project/module/connect isolation fixes. They are designed to FAIL against the
 * pre-fix behavior (shared `projectId`, no generation guard, module state that
 * survived selection changes) and pass because of the implementation.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CapabilityModuleRecord, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { CapabilitiesView } from '../src/views/capabilities/CapabilitiesView'
import { ModulesView } from '../src/views/capabilities/ModulesView'
import { GuidedConnect } from '../src/views/capabilities/GuidedConnect'

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
    await waitFor(() => expect(screen.getByText('Not started.')).toBeTruthy()) // B (empty) is ready

    // A resolves LATE with an approved application — must be ignored.
    defA.resolve(APPROVED_APP)
    await new Promise((r) => setTimeout(r, 0))

    expect(screen.getByText('Not started.')).toBeTruthy()
    expect(screen.queryByText('Definition approved.')).toBeNull()
  })

  it('clears the previous project immediately and shows a loading state on switch', async () => {
    const defB = deferred<{ approved?: unknown }>()
    const getApp = vi.fn((pid: string) => (pid === 'A' ? Promise.resolve(APPROVED_APP) : defB.promise))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A')
    await waitFor(() => expect(screen.getByText('Definition approved.')).toBeTruthy())

    selectProject('B') // B load pending
    // A's records are gone immediately; a compact loading state shows instead.
    expect(screen.queryByText('Definition approved.')).toBeNull()
    expect(screen.getByText('Loading this project…')).toBeTruthy()

    defB.resolve({})
    await waitFor(() => expect(screen.getByText('Not started.')).toBeTruthy())
  })

  it('disables writes while a project is loading (no stage workspace mounted)', async () => {
    const defA = deferred<{ approved?: unknown }>()
    const getApp = vi.fn(() => defA.promise)
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A')
    expect(screen.getByText('Loading this project…')).toBeTruthy()
    // The Define workspace and its write action are not present during loading.
    expect(screen.queryByRole('button', { name: /Create interview handoff/i })).toBeNull()

    defA.resolve({})
    await waitFor(() => expect(screen.getByRole('button', { name: /Create interview handoff/i })).toBeTruthy())
  })

  it('shows an error + Retry on failed load and never reveals the previous project', async () => {
    const getApp = vi.fn((pid: string) => (pid === 'A' ? Promise.resolve(APPROVED_APP) : Promise.reject(new Error('boom'))))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)

    selectProject('A')
    await waitFor(() => expect(screen.getByText('Definition approved.')).toBeTruthy())

    selectProject('B')
    await waitFor(() => expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i)
    expect(screen.queryByText('Definition approved.')).toBeNull()
  })

  it('resets canonical records on project change (B does not show A stage state)', async () => {
    const getApp = vi.fn((pid: string) => Promise.resolve(pid === 'A' ? APPROVED_APP : {}))
    render(<CapabilitiesView bridge={makeBridge({ capabilitiesGetApplication: getApp as never })} projects={projects} />)
    selectProject('A')
    await waitFor(() => expect(screen.getByText('Definition approved.')).toBeTruthy())
    selectProject('B')
    await waitFor(() => expect(screen.getByText('Not started.')).toBeTruthy())
    expect(screen.queryByText('Definition approved.')).toBeNull()
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
    const runs = [{ runId: 'run-1', targetOwnerId: 'mod.orders', kind: 'implementation', createdAt: 't' }]
    const bridge = makeBridge({
      capabilitiesGetArchitecture: (async () => arch) as never,
      capabilitiesListRuns: (async () => runs) as never,
    })
    const approvedRecords: CapabilityModuleRecord[] = [{ moduleId: 'mod.orders', approved: { moduleId: 'mod.orders' } as never }]
    render(<ModulesView bridge={bridge} projectId="p1" architectureApproved projection="guided" records={approvedRecords} hideModuleList progressive externalSelectedModuleId="mod.orders" />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Select and inspect overlay/i })).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Create implementation handoff/i })).toBeNull()
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
})
