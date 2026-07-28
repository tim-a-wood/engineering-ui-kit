// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_SETTINGS } from '@engineering-ui-kit/core'
import { stePolicyNotice, withStePrompt } from '@engineering-ui-kit/core/browser'
import { installMockBridge } from '../src/mockBridge'
import { SettingsView } from '../src/views/SettingsView'
import { ApplicationDefinition } from '../src/views/capabilities/ApplicationDefinition'

afterEach(cleanup)

describe('product writing policy', () => {
  it('shows the required product policy in Settings', () => {
    render(
      <SettingsView
        bridge={installMockBridge()}
        settings={DEFAULT_SETTINGS}
        onSaved={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Writing standard' })).toBeTruthy()
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.getByText(stePolicyNotice())).toBeTruthy()
    expect(screen.getByText(/Built-in AI prompts require the same profile/)).toBeTruthy()
  })

  it('does not present the policy as sample-project configuration', async () => {
    render(
      <ApplicationDefinition
        bridge={installMockBridge()}
        projectId="do-178c-audit-hub"
        projection="design"
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Configure project vocabulary')).toBeNull()
      expect(screen.queryByLabelText('STE vocabulary status')).toBeNull()
    })
  })

  it('requires the product profile in human-facing AI output', () => {
    const prompt = withStePrompt('Create the requested design.')

    expect(prompt).toContain('Engineering UI Kit writing profile')
    expect(prompt).toContain('all human-facing AI output')
    expect(prompt).toContain('interface text, diagrams, design documents, and module descriptions')
  })
})
