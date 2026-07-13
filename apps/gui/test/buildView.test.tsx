/**
 * Accessibility and gating smoke tests for the consolidated Build view.
 * Uses static markup (same pattern as markdown.test.tsx) — no new test deps.
 */

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AppliedFiles, HandoffRun, OverlayInspectionSummary, Project } from '@engineering-ui-kit/core'
import { BuildWorkspace } from '../src/views/build/BuildWorkspace'
import { ProjectContextPanel } from '../src/views/build/ProjectContextPanel'
import { OverlayWorkspace } from '../src/views/build/OverlayWorkspace'
import type { EuikBridge } from '../src/bridge'
import type { BuildWorkspaceProps } from '../src/views/build/buildTypes'

function project(): Project {
  return {
    id: 'p1',
    name: 'demo',
    repoPath: '/tmp/demo',
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
    status: 'active',
  } as Project
}

function run(patch: Partial<HandoffRun> = {}): HandoffRun {
  return {
    id: 'r1',
    projectId: 'p1',
    currentStep: 'prepare-context',
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
    ...patch,
  }
}

function baseProps(patch: Partial<BuildWorkspaceProps> = {}): BuildWorkspaceProps {
  const bridge = {
    pickZipFile: vi.fn(),
    inspectOverlay: vi.fn(),
    applyOverlay: vi.fn(),
    getDroppedFilePath: vi.fn(),
  } as unknown as EuikBridge

  return {
    workspace: 'handoff',
    setWorkspace: vi.fn(),
    bridge,
    project: project(),
    run: run(),
    refreshRun: vi.fn(),
    packet: null,
    fields: {
      taskTitle: '',
      goal: '',
      scope: '',
      constraints: '',
      acceptanceCriteria: '',
      references: '',
    },
    setFields: vi.fn(),
    templateId: 'monolithic-web-app',
    setTemplateId: vi.fn(),
    onUseTemplate: vi.fn(),
    contextResult: null,
    contextBusy: false,
    packetBusy: false,
    packetStale: false,
    contextStale: false,
    status: { tone: 'info', text: 'Ready.' },
    setStatus: vi.fn(),
    onGenerateContext: vi.fn(),
    onBuildPacket: vi.fn(),
    onPreviewPacket: vi.fn(),
    onAddReference: vi.fn(),
    onNavigate: vi.fn(),
    inspection: null,
    setInspection: vi.fn(),
    warningsAccepted: false,
    setWarningsAccepted: vi.fn(),
    applied: null,
    overlayBusy: false,
    onPickAndInspect: vi.fn(),
    onInspectOverlayPath: vi.fn(),
    onApplyOverlay: vi.fn(),
    ...patch,
  }
}

describe('BuildWorkspace unified flow', () => {
  it('exposes one continuous surface instead of three tabs', () => {
    const html = renderToStaticMarkup(<BuildWorkspace {...baseProps({ workspace: 'copilot' })} />)
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('role="tab"')
    expect(html).toContain('What are you building?')
    expect(html).toContain('Hand off and apply')
    expect(html).toContain('Result zip')
    expect(html).not.toContain('Work in Copilot')
  })
})

describe('ProjectContextPanel disclosures', () => {
  it('marks disclosure buttons with aria-expanded and aria-controls', () => {
    const html = renderToStaticMarkup(
      <ProjectContextPanel
        bridge={baseProps().bridge}
        project={project()}
        run={run()}
        refreshRun={vi.fn()}
        onNavigate={vi.fn()}
        contextResult={null}
        contextBusy={false}
        onGenerateContext={vi.fn()}
        uploadSlotCount={0}
        packet={null}
      />,
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="context-privacy-dialog"')
    expect(html).toContain('aria-controls="output-upload-dialog"')
    expect(html).toContain('aria-controls="before-evidence-dialog"')
    expect(html).toContain('Context &amp; privacy')
    expect(html).toContain('Output &amp; upload set')
    expect(html).toContain('Before evidence')
  })
})

describe('Overlay apply gating', () => {
  it('disables Apply when inspection is blocked and explains the prerequisite', () => {
    const blocked: OverlayInspectionSummary = {
      runId: 'r1',
      zipFilename: 'ui-overlay.zip',
      inspectedAt: '2026-07-06T00:00:00Z',
      canApply: false,
      hardBlockers: [{ ruleId: 'AI-HANDOFF-030', message: 'absolute path', path: '/etc/passwd' }],
      warnings: [],
      normalizedEntries: [],
    }
    const html = renderToStaticMarkup(
      <OverlayWorkspace {...baseProps({ workspace: 'overlay', inspection: blocked })} />,
    )
    expect(html).toMatch(/disabled[^>]*>[\s\S]*?Apply changes/)
    expect(html).toContain('Hard blockers')
    expect(html).toContain('can never be applied')
  })

  it('keeps Test navigation out of the result panel', () => {
    const before = renderToStaticMarkup(<OverlayWorkspace {...baseProps({ workspace: 'overlay' })} />)
    expect(before).not.toContain('Continue to Test')

    const applied: AppliedFiles = {
      runId: 'r1',
      appliedAt: '2026-07-06T00:00:00Z',
      files: [{ relativePath: 'src/App.tsx', action: 'overwritten' }],
    }
    const passed: OverlayInspectionSummary = {
      runId: 'r1',
      zipFilename: 'ui-overlay.zip',
      inspectedAt: '2026-07-06T00:00:00Z',
      canApply: true,
      hardBlockers: [],
      warnings: [],
      normalizedEntries: [],
    }
    const after = renderToStaticMarkup(
      <OverlayWorkspace {...baseProps({ workspace: 'overlay', applied, inspection: passed })} />,
    )
    expect(after).not.toContain('Continue to Test')
    expect(after).toContain('Applied files')
  })
})
