// @vitest-environment jsdom
/**
 * §9.2 module queue tests: 17 sample modules with states and counts, filters
 * (including `Old` and `Blocked`), and the "selecting a blocked module opens
 * it and explains the block" behavior.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildSampleAuditHub, computeModuleDesignProgress, selectDefaultModule, type ModuleDesignProgress } from '@engineering-ui-kit/core/design-browser'
import { ModuleQueue } from '../src/views/design/ModuleQueue'

afterEach(cleanup)

function sampleProgress(): ModuleDesignProgress {
  const sample = buildSampleAuditHub()
  const blockers: Record<string, string[]> = {}
  return computeModuleDesignProgress(sample.architecture, sample.moduleDesigns, sample.sessions, blockers)
}

function blockedProgress(): ModuleDesignProgress {
  return {
    projectId: 'p1',
    architectureRevision: 'r1',
    total: 3,
    notStarted: 0,
    draft: 0,
    needsInput: 0,
    readyForReview: 0,
    approved: 1,
    stale: 0,
    blocked: 1,
    modules: [
      {
        moduleId: 'mod.a',
        name: 'Module A',
        moduleType: 'domain',
        responsibility: 'Owns A.',
        state: 'approved',
        directDependencyCount: 0,
        directConsumerCount: 1,
        blockingIssueCount: 0,
        changedUpstream: false,
        recommendedOrder: 1,
        blockingIds: [],
        validNextActions: [],
      },
      {
        moduleId: 'mod.b',
        name: 'Module B',
        moduleType: 'workflow',
        responsibility: 'Owns B, depends on the unapproved Module C.',
        state: 'blocked',
        directDependencyCount: 1,
        directConsumerCount: 0,
        blockingIssueCount: 1,
        changedUpstream: false,
        recommendedOrder: 2,
        blockingIds: ['mod.c'],
        validNextActions: ['Resolve blocking issue'],
      },
      {
        moduleId: 'mod.c',
        name: 'Module C',
        moduleType: 'platform',
        responsibility: 'Not started.',
        state: 'notStarted',
        directDependencyCount: 0,
        directConsumerCount: 1,
        blockingIssueCount: 0,
        changedUpstream: false,
        recommendedOrder: 3,
        blockingIds: [],
        validNextActions: ['Create module draft'],
      },
    ],
  }
}

describe('ModuleQueue (§9.2)', () => {
  it('renders all 17 sample modules with name, type, state, and counts', () => {
    const progress = sampleProgress()
    render(<ModuleQueue progress={progress} filter="all" onFilterChange={() => {}} onSelectModule={() => {}} />)
    expect(screen.getAllByRole('listitem').length).toBe(17)
    expect(screen.getByText('Evidence Graph')).toBeTruthy()
    expect(screen.getByText(/17 modules shown/)).toBeTruthy()
    // Appendix C: the filter chip and row copy never say "percent"/"%".
    expect(document.body.textContent).not.toMatch(/%/)
  })

  it('supports the Old and Blocked filters with Appendix C wording', () => {
    const progress = sampleProgress()
    const { rerender } = render(<ModuleQueue progress={progress} filter="old" onFilterChange={() => {}} onSelectModule={() => {}} />)
    expect(screen.getAllByRole('listitem').length).toBe(1)
    expect(screen.getByText('Lifecycle Explorer')).toBeTruthy()
    expect(screen.getAllByText('Old').length).toBeGreaterThanOrEqual(2) // the "Old" filter chip and the row's state badge

    const blocked = blockedProgress()
    rerender(<ModuleQueue progress={blocked} filter="blocked" onFilterChange={() => {}} onSelectModule={() => {}} />)
    expect(screen.getAllByRole('listitem').length).toBe(1)
    expect(screen.getByText('Module B')).toBeTruthy()
  })

  it('shows filter counts and switches filters when a chip is clicked', () => {
    const progress = sampleProgress()
    const onFilterChange = vi.fn()
    render(<ModuleQueue progress={progress} filter="all" onFilterChange={onFilterChange} onSelectModule={() => {}} />)
    const approvedChip = screen.getByRole('button', { name: /Approved 13/ })
    fireEvent.click(approvedChip)
    expect(onFilterChange).toHaveBeenCalledWith('approved')
  })

  it('applies the default-selection precedence rule (first incomplete dependency, then stable order, then first approved)', () => {
    const progress = sampleProgress()
    expect(selectDefaultModule(progress)).toBe('mod.evidence-graph')

    const allApprovedProgress: ModuleDesignProgress = {
      ...progress,
      modules: progress.modules.map((entry) => ({ ...entry, state: 'approved' as const })),
    }
    // Rule 4: when every module is complete, fall back to the first approved module in stable (id) order.
    const expectedFirstApproved = [...allApprovedProgress.modules].sort((a, b) => a.moduleId.localeCompare(b.moduleId))[0]!.moduleId
    expect(selectDefaultModule(allApprovedProgress)).toBe(expectedFirstApproved)
  })

  it('selecting a blocked module opens it and explains the block', () => {
    const progress = blockedProgress()
    const onSelectModule = vi.fn()
    render(<ModuleQueue progress={progress} filter="all" onFilterChange={() => {}} onSelectModule={onSelectModule} />)

    expect(screen.getByText(/Waiting for dependency: Module C/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Module B/ }))
    expect(onSelectModule).toHaveBeenCalledWith('mod.b')
  })
})
