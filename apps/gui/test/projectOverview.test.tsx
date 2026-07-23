import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Project, ProjectWorkOverview, WorkflowMetrics } from '@engineering-ui-kit/core'
import { ProjectOverviewContent } from '../src/views/ProjectOverviewView'

const project: Project = {
  id: 'project-1',
  name: 'Audit Hub',
  repoPath: '/workspace/audit-hub',
  status: 'active',
  settingsSchemaVersion: '1',
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
}

const overview: ProjectWorkOverview = {
  schemaVersion: '1.0',
  projectId: project.id,
  targets: [],
  dimensions: [{
    id: 'modules',
    label: 'Modules',
    coverage: {
      total: 9,
      defined: 9,
      approved: 9,
      exported: 1,
      returned: 0,
      inspected: 0,
      applied: 0,
      verified: 0,
      integrated: 0,
      complete: 0,
    },
  }],
  history: [{
    runId: 'implementation-1',
    source: 'capability',
    kind: 'implementation',
    targetId: 'mod.audit-experience',
    targetKind: 'module',
    title: 'Audit experience',
    lifecycleState: 'exported',
    condition: 'current',
    outcome: 'pending',
    isEmptyDraft: false,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  }, {
    runId: 'empty-frontend-draft',
    source: 'frontend',
    kind: 'frontend-handoff',
    targetId: 'frontend',
    targetKind: 'frontend',
    title: 'Untitled frontend draft',
    lifecycleState: 'draft',
    condition: 'current',
    outcome: 'pending',
    isEmptyDraft: true,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  }],
  nextActions: [{
    actionId: 'project-1:run.return:mod.audit-experience',
    operation: 'run.return',
    reason: 'Return the exported implementation result.',
    targetIds: ['mod.audit-experience'],
    prerequisites: [],
    risk: 'low',
    requiresHumanApproval: false,
  }],
  complete: false,
  blockingDiagnostics: [],
}

const workflowMetrics: WorkflowMetrics = {
  schemaVersion: '1.0',
  projectId: project.id,
  events: 18,
  uniqueRuns: 3,
  completedRuns: 2,
  blockedActions: 1,
  failedActions: 1,
  handoffsExported: 3,
  medianActionDurationMs: 1_450,
  p95ActionDurationMs: 8_200,
  byAction: [],
}

describe('ProjectOverviewContent', () => {
  it('shows definition and executable coverage separately', () => {
    const html = renderToStaticMarkup(
      <ProjectOverviewContent
        project={project}
        overview={overview}
        onNextAction={() => {}}
        onOpenCapabilities={() => {}}
        onOpenResult={() => {}}
      />,
    )
    expect(html).toContain('Product coverage')
    expect(html).toContain('9 / 9')
    expect(html).toContain('1 / 9')
    expect(html).toContain('0 / 9')
    expect(html).toContain('Return with result')
  })

  it('excludes empty drafts from substantive history and explains the exclusion', () => {
    const html = renderToStaticMarkup(
      <ProjectOverviewContent
        project={project}
        overview={overview}
        onNextAction={() => {}}
        onOpenCapabilities={() => {}}
        onOpenResult={() => {}}
      />,
    )
    expect(html).toContain('1 empty draft is excluded from progress')
    expect(html).toContain('1 substantive')
    expect(html).not.toContain('Untitled frontend draft')
  })

  it('shows privacy-safe workflow measurements when local events exist', () => {
    const html = renderToStaticMarkup(
      <ProjectOverviewContent
        project={project}
        overview={overview}
        workflowMetrics={workflowMetrics}
        onNextAction={() => {}}
        onOpenCapabilities={() => {}}
        onOpenResult={() => {}}
      />,
    )
    expect(html).toContain('Workflow efficiency')
    expect(html).toContain('18 actions measured')
    expect(html).toContain('Prompt text, source paths, and user content are never recorded')
    expect(html).toContain('1.4 s')
  })
})
