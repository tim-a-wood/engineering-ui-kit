/**
 * CAP-TEST-038 — Capabilities accessibility (labels, keyboard-reachable controls, list fallback).
 * Follows buildView.test.tsx: renderToStaticMarkup + attribute assertions (no axe dependency).
 */

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArchitectureProjection, AttentionItem, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../src/bridge'
import { CapabilitiesView } from '../src/views/capabilities/CapabilitiesView'
import { ArchitectureView } from '../src/views/capabilities/ArchitectureView'
import { BindingEditor } from '../src/views/capabilities/BindingEditor'
import { NeedsAttention } from '../src/views/capabilities/NeedsAttention'
import { VerificationPanel } from '../src/views/capabilities/VerificationPanel'
import { ApplicationDefinition } from '../src/views/capabilities/ApplicationDefinition'
import { ModulesView } from '../src/views/capabilities/ModulesView'
import { PreviewBindingPicker } from '../src/views/capabilities/PreviewBindingPicker'

function project(): Project {
  return {
    id: 'p1',
    name: 'demo',
    repoPath: '/tmp/demo',
    createdAt: '2026-07-12T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
    status: 'active',
  } as Project
}

function mockBridge(): EuikBridge {
  return {
    capabilitiesEnsureInitialized: vi.fn(async () => ({ schemaVersion: '1.0', initializedAt: '2026-07-12T00:00:00Z' })),
    capabilitiesGetApplication: vi.fn(async () => ({})),
    capabilitiesGetArchitecture: vi.fn(async () => ({})),
    capabilitiesSaveApplicationDraft: vi.fn(async () => ({ ok: true as const })),
    capabilitiesApproveApplication: vi.fn(async () => ({ ok: false })),
    capabilitiesEvaluateProductGate: vi.fn(async () => ({})),
    capabilitiesBuildInterviewPacket: vi.fn(async (input) => input),
    capabilitiesImportInterviewResponse: vi.fn(async () => ({})),
    capabilitiesSaveArchitectureDraft: vi.fn(async () => ({ ok: true as const })),
    capabilitiesApproveArchitecture: vi.fn(async () => ({ ok: false })),
    capabilitiesSaveModuleDraft: vi.fn(async () => ({ ok: true as const })),
    capabilitiesApproveModule: vi.fn(async () => ({ ok: false })),
    capabilitiesApproveBinding: vi.fn(async () => ({ ok: false })),
    capabilitiesRunModuleVerification: vi.fn(async () => ({})),
  } as unknown as EuikBridge
}

function sampleProjection(): ArchitectureProjection {
  return {
    mode: 'guided',
    architectureId: 'arch-1',
    architectureRevision: '1',
    architectureStatus: 'draft',
    nodes: [
      {
        id: 'mod.a',
        name: 'Module A',
        purposeGroup: 'Core',
        status: 'draft',
        statusLabel: 'Draft',
        statusIcon: 'draft',
        proposed: false,
        neighborIds: ['mod.b'],
        toolsAndData: [],
        layout: { x: 0, y: 0, column: 0, row: 0 },
      },
      {
        id: 'mod.b',
        name: 'Module B',
        purposeGroup: 'Core',
        status: 'draft',
        statusLabel: 'Draft',
        statusIcon: 'draft',
        proposed: false,
        neighborIds: ['mod.a'],
        toolsAndData: [],
        layout: { x: 160, y: 0, column: 1, row: 0 },
      },
    ],
    edges: [
      {
        id: 'mod.a->mod.b',
        from: 'mod.a',
        to: 'mod.b',
        reason: 'depends',
        suggested: false,
      },
    ],
    listItems: [
      {
        id: 'mod.a',
        name: 'Module A',
        purposeGroup: 'Core',
        statusLabel: 'Draft',
        statusIcon: 'draft',
        neighborIds: ['mod.b'],
        edgeSummaries: ['depends on Module B'],
      },
      {
        id: 'mod.b',
        name: 'Module B',
        purposeGroup: 'Core',
        statusLabel: 'Draft',
        statusIcon: 'draft',
        neighborIds: ['mod.a'],
        edgeSummaries: ['required by Module A'],
      },
    ],
  }
}

describe('CAP-TEST-038 Capabilities accessibility', () => {
  it('labels the Capabilities shell and does not initialize a project implicitly', () => {
    const bridge = mockBridge()
    const html = renderToStaticMarkup(
      <CapabilitiesView bridge={bridge} projects={[project()]} activeProjectId="p1" />,
    )

    // Shell region + standard page header.
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Capabilities"')
    expect(html).toContain('class="page-header"')
    // Guided/Design segmented control conveys state without relying on color.
    expect(html).toContain('aria-label="View mode"')
    expect((html.match(/aria-pressed="(true|false)"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    // Explicit project selector with an unselected default.
    expect(html).toMatch(/<select[^>]*aria-label="Capabilities project"/)
    expect(html).toContain('Select a project…')
    // No project selected -> a polished empty state with one primary action, and
    // NO capability workspace is initialized (Section 31).
    expect(html).toContain('class="empty-state"')
    expect(html).toMatch(/<button[^>]*class="btn btn-primary"/)
    expect(bridge.capabilitiesEnsureInitialized).not.toHaveBeenCalled()
    expect(bridge.capabilitiesGetApplication).not.toHaveBeenCalled()
  })

  it('labels application, modules, verification, binding, and attention panels', () => {
    const bridge = mockBridge()
    const appHtml = renderToStaticMarkup(
      <ApplicationDefinition bridge={bridge} projectId="p1" projection="guided" />,
    )
    expect(appHtml).toContain('aria-label="Application definition"')
    expect(appHtml).toContain('aria-label="Application definition actions"')
    expect(appHtml).toContain('aria-label="Import interview response"')

    const modulesHtml = renderToStaticMarkup(
      <ModulesView bridge={bridge} projectId="p1" architectureApproved={false} projection="guided" />,
    )
    expect(modulesHtml).toContain('aria-label="Modules"')
    expect(modulesHtml).toContain('role="status"')

    const verificationHtml = renderToStaticMarkup(
      <VerificationPanel
        bridge={bridge}
        projectId="p1"
        projection="guided"
        records={[
          {
            moduleId: 'mod.domain',
            approved: {
              schemaVersion: '1.0',
              architectureVersion: '1.0',
              moduleId: 'mod.domain',
              moduleVersion: '1.0.0',
              moduleType: 'domain',
              name: 'Domain module',
              responsibility: 'domain',
              ownedConcerns: [],
              excludedConcerns: [],
              providedOperations: [],
              requiredOperations: [],
              verificationSuiteIds: [],
              runtimeAllocation: 'local-embedded',
              events: [],
              ownedPaths: ['capabilities/modules/mod.domain/'],
            },
          } as never,
        ]}
        onVerified={() => {}}
      />,
    )
    expect(verificationHtml).toContain('aria-label="Module verification"')
    expect(verificationHtml).toContain('aria-label="Verification controls"')
    expect(verificationHtml).toContain('aria-label="Approved module"')
    expect(verificationHtml).toMatch(/<button[^>]*type="button"/)

    // Design mode exposes the technical Binding ID; Guided mode hides it.
    const bindingDesign = renderToStaticMarkup(<BindingEditor bridge={bridge} projectId="p1" projection="design" />)
    expect(bindingDesign).toContain('aria-label="Binding editor"')
    expect(bindingDesign).toContain('aria-label="Binding actions"')
    expect(bindingDesign).toContain('aria-label="Binding ID"')
    expect(bindingDesign).toMatch(/Approve binding/)
    const bindingGuided = renderToStaticMarkup(<BindingEditor bridge={bridge} projectId="p1" projection="guided" />)
    expect(bindingGuided).not.toContain('aria-label="Binding ID"')
    expect(bindingGuided).not.toContain('binding.draft')

    const emptyAttention = renderToStaticMarkup(<NeedsAttention items={[]} projection="guided" />)
    expect(emptyAttention).toContain('aria-label="Needs attention"')
    expect(emptyAttention).toContain('role="status"')

    const items: AttentionItem[] = [
      {
        moduleId: 'mod.a',
        primaryState: 'needs-review',
        nextAction: 'Re-verify module',
        reasonCodes: ['freshness'],
      },
    ]
    const attentionHtml = renderToStaticMarkup(<NeedsAttention items={items} projection="design" />)
    expect(attentionHtml).toContain('aria-label="Attention items in dependency order"')
    expect(attentionHtml).toContain('aria-label="state needs-review"')
  })

  it('exposes keyboard-focusable architecture diagram and list fallback', () => {
    const html = renderToStaticMarkup(
      <ArchitectureView projection={sampleProjection()} mode="guided" />,
    )
    expect(html).toContain('aria-label="Architecture diagram"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-keyshortcuts=')
    expect(html).toContain('aria-label="Architecture list alternative"')
    expect(html).toContain('aria-label="Module A, Module, Draft. Open details"')
    expect(html).toContain('role="button"')
    expect(html).toContain('role="status"')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*Module A/)
  })

  it('labels preview binding picker and keeps pick action as a button', () => {
    const html = renderToStaticMarkup(<PreviewBindingPicker onCancel={() => undefined} />)
    expect(html).toContain('aria-label="Preview binding picker"')
    expect(html).toMatch(/<button[^>]*type="button"/)
  })

  it('retains reduced-motion and focus-visible rules for Capabilities surfaces', () => {
    const css = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/styles.css'),
      'utf8',
    )
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/\.capabilities-view/)
    expect(css).toMatch(/\.capabilities-view button:focus-visible|\.capabilities-toolbar button:focus-visible/)
  })
})
