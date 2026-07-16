// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CapabilityIntegrationState, GenerationPlan } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { IntegrationWorkspace } from '../src/views/capabilities/IntegrationWorkspace'

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

    expect(screen.getByRole('region', { name: 'Existing repository migration preview' }).textContent).toContain('No data loss identified')
    expect(document.body.textContent).toContain('migration-existing-1')
    expect(document.body.textContent).toContain('src/index.ts')
  })

  it('shows exact plan ownership and invokes ID/hash-gated apply', async () => {
    const apply = vi.fn().mockResolvedValue({ status: 'applied' })
    const bridge = { capabilitiesApplyGeneration: apply } as unknown as EuikBridge
    render(<IntegrationWorkspace bridge={bridge} projectId="project-1" state={state(plan())} projection="design" onChanged={() => {}} />)
    expect(document.body.textContent).toContain('src/generated/types.g.ts')
    expect(document.body.textContent).toContain('plan-hash-1')
    fireEvent.click(screen.getByRole('button', { name: 'Apply generation plan' }))
    await waitFor(() => expect(apply).toHaveBeenCalledWith({
      projectId: 'project-1', deployableId: 'http-api', planId: 'plan-1', planHash: 'plan-hash-1',
      explicit: true, acceptDirtyWorktree: false,
    }))
  })

  it('explains blockers and disables apply while still allowing regeneration', () => {
    const blocked = plan({ blockers: ['No approved composition manifest exists.'] })
    const rendered = render(<IntegrationWorkspace bridge={{} as EuikBridge} projectId="project-1" state={state(blocked)} projection="guided" onChanged={() => {}} />)
    const view = within(rendered.container)
    expect(rendered.container.textContent).toContain('No approved composition manifest exists.')
    expect((view.getByRole('button', { name: 'Apply generation plan' }) as HTMLButtonElement).disabled).toBe(true)
    expect(view.getByRole('button', { name: 'Regenerate plan' })).toBeTruthy()
  })
})
