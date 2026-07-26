// @vitest-environment jsdom
/**
 * §4, §17.3, §20.2, §25.3 — `ProjectSetupPanel` tests (second-review P1
 * finding: "nothing configures the repository adapter or project roles").
 *
 * Drives `ProjectSetupPanel` directly against a FAKE
 * `window.euik.designOperation` bridge (same recording-stub style as
 * `design-bridge-routing.test.tsx`), asserting:
 *  - the repository-root read/configure round trip and its rendered states;
 *  - the session-principal read and its graceful "requires a newer desktop
 *    build" fallback on `EUC16-UNKNOWN-OPERATION`;
 *  - the "Grant design authorities to this session user" action calls
 *    `adapter:configureProjectRoles` with the full §4 authority list for the
 *    just-read principal, and its own graceful fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ALL_DESIGN_AUTHORITIES, DesignStore } from '../src/views/design/designState'
import { ProjectSetupPanel } from '../src/views/design/ProjectSetupPanel'
import type { DesignBridgeRequest } from '../src/views/design/designBridgeClient'

afterEach(cleanup)
beforeEach(() => {
  window.localStorage.clear()
})

const PROJECT_ID = 'proj.setup-panel-test'

type Handler = (args: unknown[]) => unknown

/**
 * A minimal `project`-mode store + fake bridge. `getWorkflowStatus` /
 * `listModuleDesigns` / `getImplementationWaves` / `getValidNextActions`
 * (the construction-time refresh every `DesignStore` in `project` mode
 * issues) get empty-but-valid responses since this suite only exercises the
 * `adapter:*` operations `ProjectSetupPanel` calls.
 */
function setup(overrides: Record<string, Handler> = {}) {
  const calls: DesignBridgeRequest[] = []
  const responses: Record<string, Handler> = {
    getWorkflowStatus: () => ({
      projectId: PROJECT_ID,
      useCaseAnalysis: {},
      systemStructure: {},
      baseline: {},
      policy: { projectId: PROJECT_ID, mode: 'completeBaseline', changedAt: '2026-07-25T00:00:00.000Z', changedBy: 'user:none' },
    }),
    listModuleDesigns: () => ({ projectId: PROJECT_ID, architectureRevision: '', total: 0, notStarted: 0, draft: 0, needsInput: 0, readyForReview: 0, approved: 0, stale: 0, blocked: 0, modules: [] }),
    getImplementationWaves: () => ({ projectId: PROJECT_ID, architectureRevision: '', waves: [], autoDispatch: false }),
    getValidNextActions: () => [],
    ...overrides,
  }
  const call = vi.fn(async (request: DesignBridgeRequest) => {
    calls.push(request)
    const handler = responses[request.operation]
    if (!handler) throw new Error(`fake bridge: no handler configured for ${request.operation}`)
    return handler(request.args)
  })
  const store = new DesignStore({ bridge: { projectId: PROJECT_ID, call } })
  return { store, calls, responses }
}

describe('ProjectSetupPanel — repository root (adapter:getProjectRepository / adapter:configureProjectRepository)', () => {
  it('shows "not configured" and a working form; submitting configures the repository root', async () => {
    const { store, calls, responses } = setup({
      'adapter:getProjectRepository': () => ({
        ok: false,
        diagnostics: [{ id: 'r1', code: 'EUC16-ADAPTER-REPOSITORY-NOT-CONFIGURED', severity: 'blocker', message: `no repository is configured for project "${PROJECT_ID}"` }],
      }),
      'adapter:getPrincipal': () => ({ ok: true, principal: 'user:remote-principal' }),
    })
    await store.ready

    render(<ProjectSetupPanel store={store} />)

    await waitFor(() => expect(screen.getByTestId('design-repository-root-not-configured')).toBeTruthy())
    expect(screen.getByTestId('design-repository-root-not-configured').textContent).toContain('no repository is configured')

    responses['adapter:configureProjectRepository'] = () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/srv/repo', auditEventId: 'audit.repo.1' })

    fireEvent.change(screen.getByLabelText('Configure repository root'), { target: { value: '/srv/repo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Configure repository root' }))

    await waitFor(() => expect(screen.getByTestId('design-repository-root-configured')).toBeTruthy())
    expect(screen.getByTestId('design-repository-root-configured').textContent).toContain('/srv/repo')

    const configureCall = calls.find((c) => c.operation === 'adapter:configureProjectRepository')!
    const input = configureCall.args[0] as Record<string, unknown>
    expect(input.projectId).toBe(PROJECT_ID)
    expect(input.repositoryRoot).toBe('/srv/repo')
    expect(typeof input.idempotencyKey).toBe('string')
    // §4, §20.2 — the desktop IPC stamps the real principal; this GUI never
    // asserts one (second-review P1 fix).
    expect('actor' in input).toBe(true)
    expect(input.actor).toBeUndefined()
  })

  it('renders an already-configured repository root without requiring the form', async () => {
    const { store } = setup({
      'adapter:getProjectRepository': () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/already/configured' }),
      'adapter:getPrincipal': () => ({ ok: true, principal: 'user:remote-principal' }),
    })
    await store.ready
    render(<ProjectSetupPanel store={store} />)
    await waitFor(() => expect(screen.getByTestId('design-repository-root-configured').textContent).toContain('/already/configured'))
  })
})

describe('ProjectSetupPanel — session principal (adapter:getPrincipal)', () => {
  it('shows the real principal once loaded', async () => {
    const { store } = setup({
      'adapter:getProjectRepository': () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/repo' }),
      'adapter:getPrincipal': () => ({ ok: true, principal: 'user:remote-principal' }),
    })
    await store.ready
    render(<ProjectSetupPanel store={store} />)
    await waitFor(() => expect(screen.getByText('user:remote-principal')).toBeTruthy())
  })

  it('degrades gracefully to "requires a newer desktop build" on EUC16-UNKNOWN-OPERATION, never an error or a crash', async () => {
    const { store } = setup({
      'adapter:getProjectRepository': () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/repo' }),
      'adapter:getPrincipal': () => ({
        ok: false,
        diagnostics: [{ id: 'unknown', code: 'EUC16-UNKNOWN-OPERATION', severity: 'blocker', message: 'unknown operation: adapter:getPrincipal' }],
        validNextActions: [],
      }),
      'adapter:getProjectRoles': () => ({
        ok: false,
        diagnostics: [{ id: 'unknown-roles', code: 'EUC16-UNKNOWN-OPERATION', severity: 'blocker', message: 'unknown operation: adapter:getProjectRoles' }],
        validNextActions: [],
      }),
    })
    await store.ready
    render(<ProjectSetupPanel store={store} />)
    await waitFor(() => expect(screen.getByText('Principal display requires a newer desktop build.')).toBeTruthy())
    expect(document.querySelector('.design-project-error')).toBeNull()
  })
})

describe('ProjectSetupPanel — grant design authorities (adapter:configureProjectRoles)', () => {
  it('calls adapter:configureProjectRoles with the full §4 authority list for the loaded principal, and shows confirmation', async () => {
    const { store, calls } = setup({
      'adapter:getProjectRepository': () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/repo' }),
      'adapter:getPrincipal': () => ({ ok: true, principal: 'user:remote-principal' }),
      'adapter:configureProjectRoles': () => ({ ok: true, auditEventId: 'audit.roles.1' }),
    })
    await store.ready
    render(<ProjectSetupPanel store={store} />)
    await waitFor(() => expect(screen.getByText('user:remote-principal')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Grant design authorities to this session user' }))

    await waitFor(() => expect(screen.getByTestId('design-roles-granted')).toBeTruthy())
    expect(screen.getByTestId('design-roles-granted').textContent).toContain('user:remote-principal')

    const rolesCall = calls.find((c) => c.operation === 'adapter:configureProjectRoles')!
    const input = rolesCall.args[0] as Record<string, unknown>
    expect(input.grantee).toBe('user:remote-principal')
    expect(input.authorities).toEqual([...ALL_DESIGN_AUTHORITIES])
  })

  it('degrades gracefully to "requires a newer desktop build" when adapter:configureProjectRoles is unknown', async () => {
    const { store } = setup({
      'adapter:getProjectRepository': () => ({ ok: true, projectId: PROJECT_ID, repositoryRoot: '/repo' }),
      'adapter:getPrincipal': () => ({ ok: true, principal: 'user:remote-principal' }),
      'adapter:configureProjectRoles': () => ({
        ok: false,
        diagnostics: [{ id: 'unknown', code: 'EUC16-UNKNOWN-OPERATION', severity: 'blocker', message: 'unknown operation: adapter:configureProjectRoles' }],
        validNextActions: [],
      }),
    })
    await store.ready
    render(<ProjectSetupPanel store={store} />)
    await waitFor(() => expect(screen.getByText('user:remote-principal')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Grant design authorities to this session user' }))

    await waitFor(() => expect(screen.getByText('Granting authorities requires a newer desktop build.')).toBeTruthy())
  })
})
