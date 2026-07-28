import { useEffect, useMemo, useState } from 'react'
import type {
  ModuleDesignSession,
  ModuleDesignSpecification,
  ModuleDesignStep,
  NamedText,
  SteLexicon,
} from '@engineering-ui-kit/core'
import { evaluateModuleDesignSte } from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../bridge'
import { EmptyState } from '../../components'
import { Icon } from '../../icons'
import { UmlDiagramWorkspace } from './UmlDiagramWorkspace'
import { ModuleBehaviorEditor } from './ModuleBehaviorEditor'

type Props = {
  bridge: EuikBridge
  projectId: string
  moduleId: string
  moduleApproved: boolean
  projection: 'guided' | 'design'
  onChanged?: () => void | Promise<void>
  onOpenImpact?: () => void
}

const STEPS: { id: ModuleDesignStep; label: string; description: string }[] = [
  { id: 'boundary', label: 'Review boundary', description: 'Review responsibility, trace, dependencies, and ownership.' },
  { id: 'behavior', label: 'Define behavior', description: 'Define internal activities, states, failures, retry, and recovery.' },
  { id: 'contracts', label: 'Review contracts', description: 'Review ports, schemas, invariants, and persistent data.' },
  { id: 'diagrams', label: 'View diagrams', description: 'View UML projections from the design record.' },
  { id: 'checks', label: 'Review checks', description: 'Review acceptance coverage, evidence policy, and diagnostics.' },
  { id: 'approval', label: 'Approve design', description: 'Approve the complete module design.' },
]

function textLines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function namedLines(value: string, prefix: string): NamedText[] {
  return textLines(value).map((text, index) => ({ id: `${prefix}-${index + 1}`, text }))
}

function TextList(props: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="cap-design-list-field">
      <span>{props.label}</span>
      <textarea
        rows={props.rows ?? 4}
        value={props.value.join('\n')}
        placeholder={props.placeholder ?? 'One per line'}
        onChange={(event) => props.onChange(textLines(event.target.value))}
      />
    </label>
  )
}

function DesignDiagnostics({ design }: { design: ModuleDesignSpecification }) {
  const diagnostics = design.gates.flatMap((gate) => gate.diagnostics)
  if (!diagnostics.length) {
    return <p className="cap-module-design-clear">{Icon.shieldCheck(16)} All module-design gates pass.</p>
  }
  return (
    <ul className="cap-issue-list" aria-label="Module design diagnostics">
      {diagnostics.map((diagnostic) => (
        <li key={diagnostic.id}>{diagnostic.message} <code>{diagnostic.code}</code></li>
      ))}
    </ul>
  )
}

function SteReviewItems({
  design,
  lexicon,
}: {
  design: ModuleDesignSpecification
  lexicon?: SteLexicon
}) {
  const items = evaluateModuleDesignSte(design, lexicon).reviewDiagnostics
  if (!items.length) return null
  return (
    <details className="cap-issues cap-ste-review" aria-label="Writing review items">
      <summary>Writing review ({items.length})</summary>
      <p className="capabilities-note">
        Review these items before publication.
      </p>
      <ul className="cap-issue-list">
        {items.map((item, index) => (
          <li key={`${item.code}-${item.fieldPath ?? index}`}>
            {item.message}{item.fieldPath ? ` (${item.fieldPath})` : ''}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function ModuleDesignWorkspace({
  bridge,
  projectId,
  moduleId,
  moduleApproved,
  projection,
  onChanged,
  onOpenImpact,
}: Props) {
  const [design, setDesign] = useState<ModuleDesignSpecification>()
  const [approved, setApproved] = useState<ModuleDesignSpecification>()
  const [session, setSession] = useState<ModuleDesignSession>()
  const [step, setStep] = useState<ModuleDesignStep>('boundary')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [steLexicon, setSteLexicon] = useState<SteLexicon | undefined>()

  async function refresh() {
    const [records, configuredLexicon] = await Promise.all([
      bridge.capabilitiesListModuleDesigns(projectId),
      bridge.capabilitiesGetSteLexicon(projectId) as Promise<SteLexicon | undefined>,
    ])
    const record = records.find((item) => item.moduleId === moduleId)
    setDesign(record?.draft ?? record?.approved)
    setApproved(record?.draft ? undefined : record?.approved)
    setSession(record?.session)
    setSteLexicon(configuredLexicon)
    if (record?.session?.currentStep) setStep(record.session.currentStep)
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      bridge.capabilitiesListModuleDesigns(projectId),
      bridge.capabilitiesGetSteLexicon(projectId) as Promise<SteLexicon | undefined>,
    ])
      .then(([records, configuredLexicon]) => {
        if (cancelled) return
        const record = records.find((item) => item.moduleId === moduleId)
        setDesign(record?.draft ?? record?.approved)
        setApproved(record?.draft ? undefined : record?.approved)
        setSession(record?.session)
        setSteLexicon(configuredLexicon)
        setStep(record?.session?.currentStep ?? 'boundary')
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error))
      })
    return () => { cancelled = true }
  }, [bridge, projectId, moduleId])

  const diagnostics = design?.gates.flatMap((gate) => gate.diagnostics) ?? []
  const canApprove = Boolean(design && !approved && diagnostics.length === 0 && design.status === 'readyForReview')
  const stepIndex = STEPS.findIndex((item) => item.id === step)
  const traceSummary = useMemo(() => design ? [
    ...design.trace.useCaseIds.map((id) => ({ id, kind: 'Use case' })),
    ...(design.trace.workflowNodeIds ?? []).map((id) => ({ id, kind: 'Application action' })),
    ...design.trace.scenarioStepIds.map((id) => ({ id, kind: 'Scenario step' })),
    ...design.verification.acceptanceCaseIds.map((id) => ({ id, kind: 'Acceptance' })),
  ] : [], [design])

  async function createDraft() {
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesCreateModuleDesignDraft({ projectId, moduleId })
      setDesign(result.design)
      setApproved(undefined)
      setSession(result.session)
      setStep(result.session.currentStep)
      setMessage('Created a module-design draft from the approved use cases, architecture allocation, and module manifest.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function persist(nextStep?: ModuleDesignStep) {
    if (!design) return
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesSaveModuleDesignDraft(projectId, design)
      setDesign(result.design)
      if (session) {
        const completed = [...new Set([
          ...session.completedSteps,
          ...(nextStep && nextStep !== step ? [step] : []),
        ])]
        const updated: ModuleDesignSession = {
          ...session,
          state: result.diagnostics.length ? 'needsInput' : 'readyForReview',
          currentStep: nextStep ?? step,
          completedSteps: completed,
          updatedAt: new Date().toISOString(),
        }
        await bridge.capabilitiesSaveModuleDesignSession(projectId, updated)
        setSession(updated)
      }
      if (nextStep) setStep(nextStep)
      setMessage(result.diagnostics.length
        ? `Saved. ${result.diagnostics.length} design issue(s) remain.`
        : 'Saved. The complete design is ready for approval.')
      await onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function approveDesign() {
    if (!design || !canApprove) return
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesApproveModuleDesign({
        projectId,
        draft: design,
        explicit: true,
      })
      if (!result.ok || !result.approved) {
        if (result.design) setDesign(result.design)
        setMessage(`Approval is blocked by ${result.diagnostics.length} design issue(s).`)
        return
      }
      setDesign(result.approved)
      setApproved(result.approved)
      if (session) {
        const complete: ModuleDesignSession = {
          ...session,
          state: 'completed',
          currentStep: 'approval',
          completedSteps: STEPS.map((item) => item.id),
          updatedAt: new Date().toISOString(),
        }
        await bridge.capabilitiesSaveModuleDesignSession(projectId, complete)
        setSession(complete)
      }
      setMessage('Module design approved. Implementation handoffs now use this design revision and its trace evidence.')
      await onChanged?.()
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  if (!moduleId) return null

  if (!design) {
    return (
      <section className="cap-module-design-workspace" aria-label="Module design">
        <EmptyState
          icon={Icon.layers(24)}
          title="Design this module"
          hint={moduleApproved
            ? 'Create the canonical boundary, behavior, contracts, diagrams, and checks before implementation.'
            : 'Approve the module manifest first; the design session will then inherit its architecture and workflow trace.'}
          action={moduleApproved ? (
            <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={createDraft}>
              {busy ? 'Creating…' : 'Start module design'}
            </button>
          ) : undefined}
        />
        {message ? <p className="capabilities-note" role="status">{message}</p> : null}
      </section>
    )
  }

  return (
    <section className="cap-module-design-workspace" aria-labelledby="cap-module-design-heading">
      <div className="cap-module-design-head">
        <div>
          <p className="capabilities-eyebrow">Module design</p>
          <h3 id="cap-module-design-heading">{design.module.name}</h3>
          <p>{design.module.responsibility}</p>
        </div>
        <div className="cap-module-design-state">
          <span className={`badge ${approved ? 'approved' : ''}`}>{approved ? 'Approved design' : design.status}</span>
          <code>{design.revision}</code>
          {approved ? (
            <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={createDraft}>
              Revise design
            </button>
          ) : null}
        </div>
      </div>

      <div className="cap-module-design-progress" role="tablist" aria-label="Module design steps">
        {STEPS.map((item, index) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            aria-selected={step === item.id}
            className={`${step === item.id ? 'active' : ''}${session?.completedSteps.includes(item.id) ? ' complete' : ''}`}
            onClick={setStep.bind(null, item.id)}
          >
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>

      <SteReviewItems design={design} lexicon={steLexicon} />

      <div className="cap-module-design-step">
        <header>
          <div>
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <h4>{STEPS[stepIndex]?.label}</h4>
            <p>{STEPS[stepIndex]?.description}</p>
          </div>
          {!approved && step !== 'approval' ? (
            <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={persist.bind(null, STEPS[stepIndex + 1]?.id)}>
              {busy ? 'Saving…' : stepIndex < STEPS.length - 1 ? 'Continue' : 'Save'}
            </button>
          ) : null}
        </header>

        {step === 'boundary' ? (
          <div className="cap-module-boundary-grid">
            <section>
              <h5>Responsibility boundary</h5>
              <label>
                Owns
                <textarea
                  rows={5}
                  disabled={Boolean(approved)}
                  value={design.module.ownedConcerns.join('\n')}
                  onChange={(event) => setDesign({ ...design, module: { ...design.module, ownedConcerns: textLines(event.target.value) } })}
                />
              </label>
              <label>
                Does not own
                <textarea
                  rows={5}
                  disabled={Boolean(approved)}
                  value={design.module.nonResponsibilities.join('\n')}
                  onChange={(event) => setDesign({ ...design, module: { ...design.module, nonResponsibilities: textLines(event.target.value) } })}
                />
              </label>
            </section>
            <section>
              <h5>Workflow trace</h5>
              <div className="cap-trace-stack">
                {traceSummary.map((item) => (
                  <div key={`${item.kind}:${item.id}`}><span>{item.kind}</span><code>{item.id}</code></div>
                ))}
              </div>
            </section>
            <section>
              <h5>Direct dependencies</h5>
              <dl className="capabilities-ids">
                <div><dt>Consumes</dt><dd>{design.boundary.directDependencyIds.map((id) => <code key={id}>{id}</code>)}</dd></div>
                <div><dt>Used by</dt><dd>{design.boundary.directConsumerIds.map((id) => <code key={id}>{id}</code>)}</dd></div>
                <div><dt>Runtime</dt><dd>{design.boundary.runtimeLanguage} · {design.boundary.runtimeAllocation}</dd></div>
                <div><dt>Owned paths</dt><dd>{design.boundary.ownedPaths.map((id) => <code key={id}>{id}</code>)}</dd></div>
              </dl>
            </section>
          </div>
        ) : null}

        {step === 'behavior' ? (
          <>
            <ModuleBehaviorEditor
              design={design}
              disabled={Boolean(approved)}
              onChange={setDesign}
            />
            <div className="cap-module-design-form-grid cap-module-behavior-rules">
              <TextList label="Preconditions" value={design.behavior.preconditions} onChange={(value) => setDesign({ ...design, behavior: { ...design.behavior, preconditions: value } })} />
              <TextList label="Postconditions" value={design.behavior.postconditions} onChange={(value) => setDesign({ ...design, behavior: { ...design.behavior, postconditions: value } })} />
              <TextList label="Domain rejections" value={design.behavior.domainRejections} onChange={(value) => setDesign({ ...design, behavior: { ...design.behavior, domainRejections: value } })} />
              <TextList label="Technical failures" value={design.behavior.technicalFailures} onChange={(value) => setDesign({ ...design, behavior: { ...design.behavior, technicalFailures: value } })} />
              <TextList label="Side effects" value={design.behavior.sideEffects} onChange={(value) => setDesign({ ...design, behavior: { ...design.behavior, sideEffects: value } })} />
              {([
                ['idempotency', 'Idempotency'],
                ['cancellation', 'Cancellation'],
                ['timeouts', 'Timeouts'],
                ['concurrency', 'Concurrency'],
                ['retry', 'Retry'],
                ['recovery', 'Recovery'],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    disabled={Boolean(approved)}
                    value={design.behavior[key]}
                    onChange={(event) => setDesign({ ...design, behavior: { ...design.behavior, [key]: event.target.value } })}
                  />
                </label>
              ))}
            </div>
          </>
        ) : null}

        {step === 'contracts' ? (
          <div className="cap-module-contract-layout">
            <section>
              <h5>Provided ports</h5>
              {design.providedOperations.length ? design.providedOperations.map((operation) => (
                <div className="cap-contract-row" key={operation.operationId}>
                  <span className="cap-port-symbol provided" aria-hidden="true" />
                  <code>{operation.operationId}@{operation.contractVersion}</code>
                </div>
              )) : <p className="capabilities-note">No provided operations.</p>}
            </section>
            <section>
              <h5>Required ports</h5>
              {design.requiredOperations.length ? design.requiredOperations.map((operation) => (
                <div className="cap-contract-row" key={operation.operationId}>
                  <span className="cap-port-symbol required" aria-hidden="true" />
                  <code>{operation.operationId}@{operation.acceptedContractRange}</code>
                </div>
              )) : <p className="capabilities-note">No required operations.</p>}
            </section>
            <TextList
              label="Schema definitions"
              value={design.schemas.map((item) => item.text)}
              onChange={(value) => setDesign({ ...design, schemas: namedLines(value.join('\n'), 'schema') })}
              placeholder="Schema ID and purpose, one per line"
            />
            <TextList label="Invariants" value={design.invariants} onChange={(value) => setDesign({ ...design, invariants: value })} />
            <TextList
              label="Persistent records"
              value={design.data.persistentRecords.map((item) => item.text)}
              onChange={(value) => setDesign({ ...design, data: { ...design.data, persistentRecords: namedLines(value.join('\n'), 'record') } })}
            />
            <label>
              <span>Confidentiality</span>
              <input
                disabled={Boolean(approved)}
                value={design.data.confidentiality}
                onChange={(event) => setDesign({ ...design, data: { ...design.data, confidentiality: event.target.value } })}
              />
            </label>
          </div>
        ) : null}

        {step === 'diagrams' ? <UmlDiagramWorkspace diagrams={design.diagrams} onOpenImpact={onOpenImpact} /> : null}

        {step === 'checks' ? (
          <div className="cap-module-checks">
            <div className="cap-module-check-metrics">
              <div><strong>{design.trace.useCaseIds.length}</strong><span>Use cases</span></div>
              <div><strong>{design.trace.scenarioStepIds.length}</strong><span>Scenario steps</span></div>
              <div><strong>{design.verification.acceptanceCaseIds.length}</strong><span>Acceptance checks</span></div>
              <div><strong>{design.verification.requiredEvidence.length}</strong><span>Evidence policies</span></div>
            </div>
            <DesignDiagnostics design={design} />
            <TextList label="Verification examples" value={design.verification.examples} onChange={(value) => setDesign({ ...design, verification: { ...design.verification, examples: value } })} />
            <TextList label="Edge cases" value={design.verification.edgeCases} onChange={(value) => setDesign({ ...design, verification: { ...design.verification, edgeCases: value } })} />
            <TextList label="Verification commands" value={design.verification.commands} onChange={(value) => setDesign({ ...design, verification: { ...design.verification, commands: value } })} />
          </div>
        ) : null}

        {step === 'approval' ? (
          <div className="cap-module-approval">
            <div>
              <h5>{approved ? 'Approved module design' : canApprove ? 'Ready for approval' : 'Approval is blocked'}</h5>
              <p>
                Approval binds this design to architecture revision {design.architecture.revision} and preserves
                its source hashes. Implementation and verification consume that immutable revision.
              </p>
            </div>
            <DesignDiagnostics design={design} />
            <dl className="capabilities-ids">
              <div><dt>Design hash</dt><dd><code>{design.contentHash}</code></dd></div>
              <div><dt>Architecture hash</dt><dd><code>{design.architecture.contentHash}</code></dd></div>
              {approved?.approval ? <div><dt>Approved at</dt><dd>{approved.approval.approvedAt}</dd></div> : null}
            </dl>
            {!approved ? (
              <button type="button" className="btn btn-primary" disabled={busy || !canApprove} onClick={approveDesign}>
                {busy ? 'Approving…' : 'Approve module design'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {message ? <p className="capabilities-note" role="status">{message}</p> : null}
      {projection === 'design' ? (
        <details className="cap-module-design-source">
          <summary>Show source context</summary>
          <pre className="capabilities-pre">{JSON.stringify(session?.sourceManifest ?? design.architecture, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}
