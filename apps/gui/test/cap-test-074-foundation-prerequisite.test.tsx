/**
 * CAP-TEST-074 — WP5 gate bullet (d): the module implementation handoff / From
 * spec Build action is blocked, with a clear prerequisite message, until an
 * approved, non-stale foundation plan exists (`foundationHandoffGate`), and
 * becomes enabled once one does.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CapabilityModuleRecord, ModuleManifest } from '@engineering-ui-kit/core'
import { installMockBridge } from '../src/mockBridge'
import { ModulesView } from '../src/views/capabilities/ModulesView'

function uiManifest(): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: 'mod.ui',
    moduleVersion: '1.0.0',
    moduleType: 'experience',
    name: 'UI',
    responsibility: 'Presents orders to the operator.',
    ownedConcerns: [],
    excludedConcerns: [],
    providedOperations: [],
    requiredOperations: [],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: ['capabilities/modules/mod.ui/'],
  }
}

describe('CAP-TEST-074 foundation prerequisite gates the Build handoff', () => {
  it('blocks the guided handoff (Build UI with agent + implementation handoff) with a prerequisite message when the foundation is not approved', () => {
    const bridge = installMockBridge()
    const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.ui', approved: uiManifest() }]

    const html = renderToStaticMarkup(
      <ModulesView
        bridge={bridge}
        projectId="p1"
        architectureApproved
        projection="guided"
        records={records}
        hideModuleList
        progressive
        externalSelectedModuleId="mod.ui"
        onStartUiBuild={vi.fn()}
        foundationGate={{ enabled: false, reason: 'No approved foundation plan exists for this project.' }}
      />,
    )
    expect(html).toContain('Foundation must be approved first.')
    expect(html).toContain('No approved foundation plan exists for this project.')
    expect(html).toMatch(/disabled[^>]*>[\s\S]*?Compile frontend brief/)
    expect(html).toMatch(/disabled[^>]*>[\s\S]*?Create implementation handoff/)
  })

  it('enables the guided handoff once the foundation gate reports enabled', () => {
    const bridge = installMockBridge()
    const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.ui', approved: uiManifest() }]

    const html = renderToStaticMarkup(
      <ModulesView
        bridge={bridge}
        projectId="p1"
        architectureApproved
        projection="guided"
        records={records}
        hideModuleList
        progressive
        externalSelectedModuleId="mod.ui"
        onStartUiBuild={vi.fn()}
        foundationGate={{ enabled: true }}
      />,
    )
    expect(html).not.toContain('Foundation must be approved first.')
    expect(html).not.toMatch(/disabled[^>]*>[\s\S]*?Compile frontend brief/)
    expect(html).not.toMatch(/disabled[^>]*>[\s\S]*?Create implementation handoff/)
  })

  it('defaults to enabled when no foundationGate prop is supplied (backward compatibility for pre-WP5A callers)', () => {
    const bridge = installMockBridge()
    const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.ui', approved: uiManifest() }]
    const html = renderToStaticMarkup(
      <ModulesView
        bridge={bridge}
        projectId="p1"
        architectureApproved
        projection="guided"
        records={records}
        hideModuleList
        progressive
        externalSelectedModuleId="mod.ui"
        onStartUiBuild={vi.fn()}
      />,
    )
    expect(html).not.toContain('Foundation must be approved first.')
  })

  it('also blocks the Design (non-progressive) implementation handoff export button, with the same prerequisite message', () => {
    const bridge = installMockBridge()
    const records: CapabilityModuleRecord[] = [{ moduleId: 'mod.ui', approved: uiManifest() }]

    const blocked = renderToStaticMarkup(
      <ModulesView
        bridge={bridge}
        projectId="p1"
        architectureApproved
        projection="design"
        records={records}
        externalSelectedModuleId="mod.ui"
        foundationGate={{ enabled: false, reason: 'The approved foundation plan is stale.' }}
      />,
    )
    expect(blocked).toContain('Foundation must be approved first.')
    expect(blocked).toContain('The approved foundation plan is stale.')
    expect(blocked).toMatch(/disabled[^>]*>Export implementation packet/)

    const enabled = renderToStaticMarkup(
      <ModulesView
        bridge={bridge}
        projectId="p1"
        architectureApproved
        projection="design"
        records={records}
        externalSelectedModuleId="mod.ui"
        foundationGate={{ enabled: true }}
      />,
    )
    expect(enabled).not.toContain('Foundation must be approved first.')
    expect(enabled).not.toMatch(/disabled[^>]*>Export implementation packet/)
  })
})
