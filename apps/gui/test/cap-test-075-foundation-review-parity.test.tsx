/**
 * CAP-TEST-075 — WP5 gate bullets (f) and (e):
 *  (f) Guided and Design render the SAME canonical `FoundationPlan` records
 *      (deployables + module allocations) from `<FoundationReview>`.
 *  (e) A From-spec Build launch with an enriched brief (`brief.deployment`
 *      populated) carries the generated contract/path/command references
 *      into the prefilled detailed spec.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ArchitectureSpecification, FoundationPlan, ModuleManifest } from '@engineering-ui-kit/core'
import { installMockBridge } from '../src/mockBridge'
import { FoundationReview } from '../src/views/capabilities/FoundationReview'
import { BuildWorkspace } from '../src/views/build/BuildWorkspace'
import { buildUiModuleTaskFields, type UiModuleDeploymentContext } from '../src/views/capabilities/ModulesView'
import type { EuikBridge } from '../src/bridge'

function architecture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'p1',
    id: 'arch.1',
    revision: '1.0.0',
    status: 'approved',
    applicationSpecId: 'app.1',
    applicationSpecRevision: '1.0.0',
    applicationSpecHash: 'hash-app',
    capabilityProjections: [],
    moduleIds: ['mod.orders', 'mod.ui'],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'hash-arch',
  }
}

function plan(): FoundationPlan {
  const deployables: FoundationPlan['deployables'] = [
    {
      schemaVersion: '1.0',
      deployableId: 'http-api',
      name: 'Http Api',
      kind: 'http-api',
      runtimeLanguage: 'typescript',
      runtimeVersionRange: '>=22',
      moduleIds: ['mod.orders'],
      inboundBindingIds: [],
      compositionRootPath: 'src/composition/http-api.ts',
      commands: { build: 'npm run build', test: 'npm test' },
      configurationRefs: [],
      secretReferenceIds: [],
      proposedLocations: [],
    },
    {
      schemaVersion: '1.0',
      deployableId: 'browser',
      name: 'Browser',
      kind: 'browser',
      runtimeLanguage: 'typescript',
      runtimeVersionRange: '>=22',
      moduleIds: ['mod.ui'],
      inboundBindingIds: [],
      compositionRootPath: 'src/composition/browser.ts',
      commands: { build: 'npm run build', launch: 'npm run dev' },
      configurationRefs: [],
      secretReferenceIds: [],
      proposedLocations: [],
    },
  ]
  const allocations: FoundationPlan['allocations'] = [
    { moduleId: 'mod.orders', deployableId: 'http-api', moduleType: 'domain', rationale: 'non-experience module → backend host `http-api`' },
    { moduleId: 'mod.ui', deployableId: 'browser', moduleType: 'experience', rationale: 'experience module → UI host `browser`' },
  ]
  return {
    schemaVersion: '1.0',
    projectId: 'p1',
    architectureId: 'arch.1',
    architectureRevision: '1.0.0',
    architectureHash: 'hash-arch',
    deployables,
    allocations,
    resolvedAnswers: [],
    unresolvedAmbiguities: [],
    readiness: { status: 'ready', issues: [] },
    contentHash: 'hash-plan',
  }
}

describe('CAP-TEST-075 bullet (f) — Guided and Design project the same foundation records', () => {
  it('renders identical deployables and module allocations under both projections', () => {
    const bridge = installMockBridge()
    const arch = architecture()
    const foundationPlan = plan()

    const guidedHtml = renderToStaticMarkup(
      <FoundationReview
        bridge={bridge}
        projectId="p1"
        plan={foundationPlan}
        approvedFoundation={undefined}
        approvedArchitecture={arch}
        projection="guided"
      />,
    )
    const designHtml = renderToStaticMarkup(
      <FoundationReview
        bridge={bridge}
        projectId="p1"
        plan={foundationPlan}
        approvedFoundation={undefined}
        approvedArchitecture={arch}
        projection="design"
      />,
    )

    // Same deployable identity/topology in both projections.
    for (const deployable of foundationPlan.deployables) {
      expect(guidedHtml).toContain(deployable.name)
      expect(guidedHtml).toContain(deployable.compositionRootPath)
      expect(designHtml).toContain(deployable.name)
      expect(designHtml).toContain(deployable.compositionRootPath)
    }

    // Same module -> deployable allocation rationale in both projections.
    for (const allocation of foundationPlan.allocations) {
      expect(guidedHtml).toContain(allocation.deployableId)
      expect(guidedHtml).toContain(allocation.rationale)
      expect(designHtml).toContain(allocation.deployableId)
      expect(designHtml).toContain(allocation.rationale)
    }
  })

  it('surfaces unresolved ambiguities as answerable questions identically in both projections', () => {
    const bridge = installMockBridge()
    const arch = architecture()
    const ambiguousPlan: FoundationPlan = {
      ...plan(),
      unresolvedAmbiguities: [
        { id: 'deployable-language', question: 'Which language should the default deployable use?', choices: ['python', 'typescript'] },
      ],
      readiness: { status: 'ambiguous', issues: [{ id: 'deployable-language', text: 'Which language should the default deployable use?' }] },
    }

    for (const projection of ['guided', 'design'] as const) {
      const html = renderToStaticMarkup(
        <FoundationReview
          bridge={bridge}
          projectId="p1"
          plan={ambiguousPlan}
          approvedFoundation={undefined}
          approvedArchitecture={arch}
          projection={projection}
        />,
      )
      expect(html).toContain('Which language should the default deployable use?')
      // Not ready: approve action must be disabled while ambiguities remain unresolved.
      expect(html).toMatch(/disabled[^>]*>\s*Approve foundation/)
    }
  })
})

describe('CAP-TEST-075 bullet (e) — enriched From-spec Build launch carries generated references', () => {
  const manifest: ModuleManifest = {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: 'mod.ui',
    moduleVersion: '1.0.0',
    moduleType: 'experience',
    name: 'Orders UI',
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

  const deployment: UiModuleDeploymentContext = {
    deployableId: 'browser',
    kind: 'browser',
    runtimeLanguage: 'typescript',
    runtimeVersionRange: '>=22',
    compositionRootPath: 'src/composition/browser.ts',
    commands: { build: 'npm run build', launch: 'npm run dev' },
    generatedContractRefs: ['schema.orders.v1'],
    generatedTypeTargets: ['src/generated/orders.types.ts'],
    acceptanceCommands: ['npm run typecheck', 'npm test'],
  }

  it('includes the generated contract/path/command references in buildUiModuleTaskFields output when a brief.deployment is supplied', () => {
    const fields = buildUiModuleTaskFields(manifest, architecture(), deployment)
    expect(fields.goal).toContain('Generated deployment references')
    expect(fields.goal).toContain(deployment.compositionRootPath)
    expect(fields.goal).toContain('schema.orders.v1')
    expect(fields.goal).toContain('src/generated/orders.types.ts')
    expect(fields.goal).toContain('npm run typecheck')
    expect(fields.goal).toContain('npm run build')
    expect(fields.references).toContain(deployment.compositionRootPath)
    expect(fields.references).toContain('schema.orders.v1')
  })

  it('omits the generated deployment section when no deployment is supplied (backward compatibility)', () => {
    const fields = buildUiModuleTaskFields(manifest, architecture())
    expect(fields.goal).not.toContain('Generated deployment references')
  })

  it('carries the enriched spec through the From-spec Build workspace prefill', () => {
    const bridge = {
      pickZipFile: vi.fn(),
      inspectOverlay: vi.fn(),
      applyOverlay: vi.fn(),
      getDroppedFilePath: vi.fn(),
    } as unknown as EuikBridge
    const fields = buildUiModuleTaskFields(manifest, architecture(), deployment)
    const html = renderToStaticMarkup(
      <BuildWorkspace
        workspace="handoff"
        setWorkspace={vi.fn()}
        bridge={bridge}
        project={{
          id: 'p1',
          name: 'demo',
          repoPath: '/tmp/demo',
          createdAt: '2026-07-15T00:00:00Z',
          updatedAt: '2026-07-15T00:00:00Z',
          status: 'active',
        } as never}
        run={{
          id: 'r1',
          projectId: 'p1',
          currentStep: 'prepare-context',
          createdAt: '2026-07-15T00:00:00Z',
          updatedAt: '2026-07-15T00:00:00Z',
        }}
        refreshRun={vi.fn()}
        packet={null}
        fields={fields}
        setFields={vi.fn()}
        templateId="new-ui-from-requirements"
        setTemplateId={vi.fn()}
        onUseTemplate={vi.fn()}
        contextResult={null}
        contextBusy={false}
        packetBusy={false}
        packetStale={false}
        contextStale={false}
        status={{ tone: 'info', text: 'Ready.' }}
        setStatus={vi.fn()}
        onGenerateContext={vi.fn()}
        onBuildPacket={vi.fn()}
        onPreviewPacket={vi.fn()}
        onAddReference={vi.fn()}
        onNavigate={vi.fn()}
        inspection={null}
        setInspection={vi.fn()}
        warningsAccepted={false}
        setWarningsAccepted={vi.fn()}
        applied={null}
        overlayBusy={false}
        onPickAndInspect={vi.fn()}
        onInspectOverlayPath={vi.fn()}
        onApplyOverlay={vi.fn()}
      />,
    )
    expect(html).toContain('Generated deployment references')
    expect(html).toContain('src/composition/browser.ts')
  })
})
