// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CapabilityIntegrationState, GenerationPlan } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { IntegrationWorkspace } from '../src/views/capabilities/IntegrationWorkspace'

afterEach(cleanup)

function plan(overrides: Partial<GenerationPlan> = {}): GenerationPlan {
  return {
    schemaVersion: '1.0', planId: 'plan-1', projectId: 'project-1', inputRecords: [],
    generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0', targetRepository: { root: '.', cleanState: 'clean' },
    dependencyChanges: [],
    fileChanges: [{ path: 'src/generated/types.g.ts', action: 'create', ownership: 'generated', reason: 'contracts', postimageHash: 'hash' }],
    commands: ['npm test'], warnings: [], blockers: [], ambiguityQuestions: [], rollbackStrategy: 'journal', planHash: 'plan-hash-1',
    ...overrides,
  }
}

function state(currentPlan?: GenerationPlan): CapabilityIntegrationState {
  return {
    schemaVersion: '1.0', projectId: 'project-1', updatedAt: '2026-07-16T00:00:00.000Z',
    deployables: [{ deployableId: 'http-api', status: currentPlan ? 'plan-ready' : 'ready-to-generate', attention: [], currentPlan, connectionVerifications: [], currentConnectionVerificationIds: [] }],
  }
}

describe('CAP-TEST-110 visible production integration workspace', () => {
  it('disables the first generation preview while required module specifications are incomplete', () => {
    const blocked = state()
    blocked.deployables[0]!.status = 'blocked'
    blocked.deployables[0]!.attention = ['Generation prerequisites are incomplete: approved module not found: mod.ui']

    render(<IntegrationWorkspace bridge={{} as EuikBridge} projectId="project-1" state={blocked} projection="guided" onChanged={() => {}} />)

    expect(document.body.textContent).toContain('Approve the required module details before preparing this part.')
    expect(document.body.textContent).not.toContain('approved module not found: mod.ui')
    expect((screen.getByRole('button', { name: 'Prepare setup' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Technical specification' }))
    expect(screen.getByRole('dialog', { name: 'Shared setup technical specification' }).textContent).toContain('approved module not found: mod.ui')
  })

  it('restores a failed apply after restart as visible, retryable state', async () => {
    const retry = vi.fn().mockRejectedValue(new Error("Error invoking remote method 'capabilities:apply-generation': GenerationApplyRolledBackError: generation apply failed and was fully rolled back: disk unavailable"))
    const refresh = vi.fn()
    const failed = state(plan())
    failed.deployables[0]!.status = 'failed'
    failed.deployables[0]!.latestApply = {
      schemaVersion: '1.0', projectId: 'project-1', deployableId: 'http-api', planId: 'plan-1', planHash: 'plan-hash-1',
      applyRunId: 'apply-failed-1', status: 'failed', ownershipManifests: [], commands: [],
      error: 'generation apply failed and was fully rolled back: injected write failure',
      startedAt: '2026-07-16T00:00:00.000Z', completedAt: '2026-07-16T00:00:01.000Z',
    }
    render(<IntegrationWorkspace bridge={{ capabilitiesApplyGeneration: retry } as unknown as EuikBridge} projectId="project-1" state={failed} projection="guided" onChanged={refresh} />)

    expect(screen.getByRole('alert').textContent).toContain('safely restored')
    const button = screen.getByRole('button', { name: 'Apply setup' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() => expect(retry).toHaveBeenCalledOnce())
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    await waitFor(() => expect(document.body.textContent).toContain('The setup could not be completed. Open the technical specification for details.'))
    expect(document.body.textContent).not.toContain('Error invoking remote method')
    fireEvent.click(screen.getByRole('button', { name: 'Technical specification' }))
    expect(screen.getByRole('dialog', { name: 'Shared setup technical specification' }).textContent).toContain('Generation failed and the repository was fully restored. disk unavailable')
  })

  it('shows the no-loss existing-repository migration preview before generation', () => {
    const migrationState = state()
    migrationState.migrationPreview = {
      schemaVersion: '1.0', migrationPlanId: 'migration-existing-1', projectId: 'project-1',
      versions: { fromWorkspaceVersion: '1.0', toWorkspaceVersion: '2.0' },
      recordTransformations: [{ recordId: 'repo:conventions', kind: 'preserve-conventions', description: 'Preserve npm and src.' }],
      fileTransformations: [{ path: 'src/index.ts', action: 'update', description: 'Wrap and extend without replacement.' }],
      compatibilityShims: [], dataLossAssessment: { hasLoss: false, details: ['No source file is deleted.'] },
      blockedAmbiguities: [], previewHashes: ['hash-1'], backupInstructions: 'Create a backup.',
      rollbackInstructions: 'Restore preimages.', conformanceCommands: ['npm test'],
    }

    render(<IntegrationWorkspace bridge={{} as EuikBridge} projectId="project-1" state={migrationState} projection="design" onChanged={() => {}} />)

    expect(screen.getByRole('region', { name: 'Existing project safety review' }).textContent).toContain('Safe to continue')
    expect(document.body.textContent).not.toContain('migration-existing-1')
    expect(document.body.textContent).not.toContain('src/index.ts')
    fireEvent.click(screen.getByRole('button', { name: 'Technical specification' }))
    const dialog = screen.getByRole('dialog', { name: 'Shared setup technical specification' })
    expect(within(dialog).getByRole('region', { name: 'Existing repository migration preview' }).textContent).toContain('No data loss identified')
    expect(dialog.textContent).toContain('migration-existing-1')
    expect(dialog.textContent).toContain('src/index.ts')
  })

  it('shows exact plan ownership and invokes ID/hash-gated apply', async () => {
    const apply = vi.fn().mockResolvedValue({ status: 'applied' })
    const bridge = { capabilitiesApplyGeneration: apply } as unknown as EuikBridge
    render(<IntegrationWorkspace bridge={bridge} projectId="project-1" state={state(plan())} projection="design" onChanged={() => {}} />)
    expect(document.body.textContent).not.toContain('src/generated/types.g.ts')
    expect(document.body.textContent).not.toContain('plan-hash-1')
    fireEvent.click(screen.getByRole('button', { name: 'Technical specification' }))
    const dialog = screen.getByRole('dialog', { name: 'Shared setup technical specification' })
    expect(dialog.textContent).toContain('src/generated/types.g.ts')
    expect(dialog.textContent).toContain('plan-hash-1')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply setup' }))
    await waitFor(() => expect(apply).toHaveBeenCalledWith({
      projectId: 'project-1', deployableId: 'http-api', planId: 'plan-1', planHash: 'plan-hash-1',
      explicit: true, acceptDirtyWorktree: false,
    }))
  })

  it('explains blockers and disables apply while still allowing regeneration', () => {
    const blocked = plan({ blockers: ['No approved composition manifest exists.'] })
    const rendered = render(<IntegrationWorkspace bridge={{} as EuikBridge} projectId="project-1" state={state(blocked)} projection="guided" onChanged={() => {}} />)
    const view = within(rendered.container)
    expect(rendered.container.textContent).not.toContain('No approved composition manifest exists.')
    expect(rendered.container.textContent).toContain('1 technical item need attention')
    expect((view.getByRole('button', { name: 'Apply setup' }) as HTMLButtonElement).disabled).toBe(true)
    expect(view.getByRole('button', { name: 'Refresh setup' })).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: 'Technical specification' }))
    expect(screen.getByRole('dialog', { name: 'Shared setup technical specification' }).textContent).toContain('No approved composition manifest exists.')
  })
})
