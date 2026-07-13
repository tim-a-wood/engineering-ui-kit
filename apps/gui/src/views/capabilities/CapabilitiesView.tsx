/**
 * Capabilities top-level page — Guided/Design projections over one canonical model.
 * CAP-PKT-006 / CAP-PKT-007
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { projectArchitecture } from '@engineering-ui-kit/core/browser'
import type {
  ArchitectureSpecification,
  AttentionItem,
  CapabilityModuleRecord,
  CapabilityBindingRecord,
  ModuleManifest,
  Project,
  SelectionEvidence,
} from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import { ApplicationDefinition } from './ApplicationDefinition'
import { ArchitectureInterview } from './ArchitectureInterview'
import { ArchitectureView } from './ArchitectureView'
import { BindingEditor } from './BindingEditor'
import { CapabilityPreview, type CapabilityPreviewHandle } from './CapabilityPreview'
import { DeltaQueue } from './DeltaQueue'
import { ModulesView } from './ModulesView'
import { ImpactQueue } from './ImpactQueue'
import { NeedsAttention } from './NeedsAttention'
import { PreviewBindingPicker } from './PreviewBindingPicker'
import { VerificationPanel } from './VerificationPanel'

export type CapabilitiesProjection = 'guided' | 'design'

type Props = {
  bridge: EuikBridge
  projects: Project[]
  activeProjectId?: string
}

const SECTIONS = [
  'Application definition',
  'Architecture',
  'Needs attention',
  'Modules',
  'Delta queue',
  'Connections',
  'Verification',
] as const

export function CapabilitiesView({ bridge, projects, activeProjectId }: Props) {
  const [projection, setProjection] = useState<CapabilitiesProjection>('guided')
  const [projectId, setProjectId] = useState(activeProjectId ?? projects[0]?.id ?? '')
  const [status, setStatus] = useState('Select a project to begin.')
  const [application, setApplication] = useState<{ draft?: unknown; approved?: unknown }>({})
  const [architecture, setArchitecture] = useState<{ draft?: unknown; approved?: unknown }>({})
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([])
  const [moduleRecords, setModuleRecords] = useState<CapabilityModuleRecord[]>([])
  const [bindingRecords, setBindingRecords] = useState<CapabilityBindingRecord[]>([])
  const [selectionEvidence, setSelectionEvidence] = useState<SelectionEvidence | undefined>()
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('Application definition')
  const previewRef = useRef<CapabilityPreviewHandle | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    ;(async () => {
      await bridge.capabilitiesEnsureInitialized(projectId)
      const [app, arch, attention, modules, bindings] = await Promise.all([
        bridge.capabilitiesGetApplication(projectId),
        bridge.capabilitiesGetArchitecture(projectId),
        bridge.capabilitiesListNeedsAttention(projectId),
        bridge.capabilitiesListModules(projectId),
        bridge.capabilitiesListBindings(projectId),
      ])
      if (cancelled) return
      setApplication(app)
      setArchitecture(arch)
      setAttentionItems(attention)
      setModuleRecords(modules)
      setBindingRecords(bindings)
      const approved = app.approved as { id?: string; revision?: string } | undefined
      const draft = app.draft as { id?: string; revision?: string } | undefined
      setStatus(
        approved
          ? `Canonical application ${approved.id} revision ${approved.revision}`
          : draft
            ? `Draft application ${draft.id} revision ${draft.revision}`
            : 'No application specification yet — start a product interview.',
      )
    })().catch((error) => setStatus(error instanceof Error ? error.message : String(error)))
    return () => {
      cancelled = true
    }
  }, [bridge, projectId])

  useEffect(() => {
    setSelectionEvidence(undefined)
  }, [projectId])

  const recordIds = {
    application: (application.approved as { id?: string; revision?: string } | undefined) ??
      (application.draft as { id?: string; revision?: string } | undefined),
    architecture: (architecture.approved as { id?: string; revision?: string } | undefined) ??
      (architecture.draft as { id?: string; revision?: string } | undefined),
  }

  const architectureProjection = useMemo(() => {
    const arch = (architecture.approved ?? architecture.draft) as ArchitectureSpecification | undefined
    if (!arch) return undefined
    const manifests = moduleRecords
      .map((record) => record.approved ?? record.draft)
      .filter((manifest): manifest is ModuleManifest => Boolean(manifest))
    const freshnessByModule = Object.fromEntries(
      moduleRecords
        .filter((record) => Boolean(record.freshness))
        .map((record) => [record.moduleId, record.freshness!]),
    )
    return projectArchitecture(arch, manifests, freshnessByModule, { mode: projection })
  }, [architecture, moduleRecords, projection])

  const archSpec = (architecture.approved ?? architecture.draft) as ArchitectureSpecification | undefined

  async function refreshAttention() {
    if (!projectId) return
    const attention = await bridge.capabilitiesListNeedsAttention(projectId)
    setAttentionItems(attention)
  }

  async function refreshModules() {
    if (!projectId) return
    setModuleRecords(await bridge.capabilitiesListModules(projectId))
  }

  async function refreshBindings() {
    if (!projectId) return
    setBindingRecords(await bridge.capabilitiesListBindings(projectId))
  }

  return (
    <div className="capabilities-view" role="region" aria-label="Capabilities">
      <header className="capabilities-header">
        <div>
          <h1>Capabilities</h1>
          <p className="lede" id="capabilities-projection-summary">
            {projection === 'guided'
              ? 'Describe what the application must accomplish, review capabilities, and supervise Copilot implementation.'
              : 'Inspect contracts, modules, paths, hashes, and verification provenance for the same records.'}
          </p>
        </div>
        <div
          className="capabilities-toolbar"
          role="group"
          aria-label="Projection mode"
          aria-describedby="capabilities-projection-summary"
        >
          <button
            type="button"
            className={projection === 'guided' ? 'active' : undefined}
            aria-pressed={projection === 'guided'}
            aria-label="Guided projection"
            onClick={() => setProjection('guided')}
          >
            Guided
          </button>
          <button
            type="button"
            className={projection === 'design' ? 'active' : undefined}
            aria-pressed={projection === 'design'}
            aria-label="Design projection"
            onClick={() => setProjection('design')}
          >
            Design
          </button>
        </div>
      </header>

      <label className="capabilities-project">
        Project
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Capabilities project"
        >
          {projects.length === 0 ? <option value="">No projects</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <nav className="capabilities-sections" aria-label="Capabilities sections">
        {SECTIONS.map((name) => (
          <button
            key={name}
            type="button"
            className={section === name ? 'active' : undefined}
            aria-current={section === name ? 'page' : undefined}
            aria-label={`${name} section`}
            onClick={() => {
              setSection(name)
              if (name === 'Needs attention') void refreshAttention()
            }}
          >
            {name}
          </button>
        ))}
      </nav>

      <section
        className="capabilities-panel"
        role="region"
        aria-label={section}
        aria-live="polite"
      >
        <h2>{section}</h2>
        <p role="status">{status}</p>
        {section === 'Application definition' ? (
          <ApplicationDefinition
            bridge={bridge}
            projectId={projectId}
            projection={projection}
            onChanged={() => {
              void bridge.capabilitiesGetApplication(projectId).then((app) => {
                setApplication(app)
                const approved = app.approved as { id?: string; revision?: string } | undefined
                const draft = app.draft as { id?: string; revision?: string } | undefined
                setStatus(
                  approved
                    ? `Canonical application ${approved.id} revision ${approved.revision}`
                    : draft
                      ? `Draft application ${draft.id} revision ${draft.revision}`
                      : 'No application specification yet — start a product interview.',
                )
              })
            }}
          />
        ) : section === 'Architecture' ? (
          <>
            <ArchitectureInterview
              bridge={bridge}
              projectId={projectId}
              architectureApproved={Boolean(architecture.approved)}
              projection={projection}
              onApproved={() => {
                void bridge.capabilitiesGetArchitecture(projectId).then((arch) => {
                  setArchitecture(arch)
                  void refreshAttention()
                  void refreshModules()
                })
              }}
            />
            {architectureProjection ? (
              <ArchitectureView projection={architectureProjection} mode={projection} />
            ) : (
              <p className="capabilities-note">
                Diagram appears after an architecture draft or approval exists (CAP-DEC-006).
              </p>
            )}
          </>
        ) : section === 'Needs attention' ? (
          <>
            <NeedsAttention items={attentionItems} projection={projection} />
            <ImpactQueue bridge={bridge} projectId={projectId} records={moduleRecords} />
            {projection === 'design' ? (
              <dl className="capabilities-ids" aria-label="Record identifiers">
                <div>
                  <dt>Application record</dt>
                  <dd>
                    {recordIds.application
                      ? `${recordIds.application.id} @ ${recordIds.application.revision}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Architecture record</dt>
                  <dd>
                    {recordIds.architecture
                      ? `${recordIds.architecture.id} @ ${recordIds.architecture.revision}`
                      : '—'}
                  </dd>
                </div>
              </dl>
            ) : null}
          </>
        ) : section === 'Modules' ? (
          <ModulesView
            bridge={bridge}
            projectId={projectId}
            architectureApproved={Boolean(architecture.approved)}
            projection={projection}
            records={moduleRecords}
            onChanged={refreshModules}
          />
        ) : section === 'Delta queue' ? (
          <DeltaQueue bridge={bridge} projectId={projectId} projection={projection} />
        ) : section === 'Connections' ? (
          <div className="capabilities-connections" aria-label="Connections">
            <p className="lede">
              {projection === 'guided'
                ? 'Select a Preview element, map it to one operation, and approve the binding when all behaviors are complete.'
                : 'Inspect selection evidence, binding IDs, hashes, and connection packet provenance for the same records.'}
            </p>
            <CapabilityPreview ref={previewRef} bridge={bridge} projectId={projectId} />
            <PreviewBindingPicker
              disabled={!projectId}
              pickFromPreview={() =>
                previewRef.current?.pickElement() ?? Promise.reject(new Error('Target-app Preview is unavailable.'))
              }
              onEvidenceReady={setSelectionEvidence}
              onCancel={() => setSelectionEvidence(undefined)}
            />
            <BindingEditor
              bridge={bridge}
              projectId={projectId}
              projection={projection}
              selectionEvidence={selectionEvidence}
              architectureVersion={archSpec?.revision}
              architectureHash={archSpec?.contentHash}
              records={moduleRecords}
              initialBinding={bindingRecords[0]?.draft ?? bindingRecords[0]?.approved}
              onChanged={refreshBindings}
            />
          </div>
        ) : section === 'Verification' ? (
          <VerificationPanel
            bridge={bridge}
            projectId={projectId}
            projection={projection}
            records={moduleRecords}
            onVerified={refreshModules}
          />
        ) : null}
      </section>
    </div>
  )
}
