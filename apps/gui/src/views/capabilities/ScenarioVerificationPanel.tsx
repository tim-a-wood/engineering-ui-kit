import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleDesignSpecification,
  ScenarioDefinition,
  ScenarioOutcome,
  ScenarioRunRecord,
  ScenarioStepEvidence,
  ScenarioStepTrace,
} from '@engineering-ui-kit/core'
import {
  allUseCaseSteps,
  compileScenarioDefinitions,
  materializeUseCaseDefinitions,
  projectScenarioStepTrace,
  summarizeScenarioRuns,
} from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../bridge'
import { EmptyState } from '../../components'
import { Icon } from '../../icons'

type Props = {
  bridge: EuikBridge
  projectId: string
  projection: 'guided' | 'design'
  onChanged?: () => void | Promise<void>
}

type RunIdentityDraft = {
  build: string
  sourceRevision: string
  environment: string
  testDataRevision: string
  runner: string
}

const OUTCOME_LABEL: Record<ScenarioOutcome, string> = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
  unverified: 'Not run',
}

function asApplication(value: unknown): ApplicationSpecification | undefined {
  return value && typeof value === 'object' ? value as ApplicationSpecification : undefined
}

function asArchitecture(value: unknown): ArchitectureSpecification | undefined {
  return value && typeof value === 'object' ? value as ArchitectureSpecification : undefined
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Evidence file could not be read.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      if (comma < 0) reject(new Error('Evidence file did not produce a data URL.'))
      else resolve(result.slice(comma + 1))
    }
    reader.readAsDataURL(file)
  })
}

function safeArtifactId(runId: string, stepId: string, file: File): string {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'evidence'
  const stem = `${stepId}-${Date.now()}-${extension}`.replace(/[^a-z0-9._-]+/gi, '-')
  return `${runId.slice(-12)}-${stem}`.slice(0, 120)
}

function EvidencePreview(props: {
  bridge: EuikBridge
  projectId: string
  runId: string
  artifactId: string
  label: string
}) {
  const [dataUrl, setDataUrl] = useState('')
  const [mediaType, setMediaType] = useState('')

  useEffect(() => {
    let cancelled = false
    void props.bridge.capabilitiesGetScenarioEvidence({
      projectId: props.projectId,
      runId: props.runId,
      artifactId: props.artifactId,
    }).then((result) => {
      if (cancelled || !result) return
      setMediaType(result.reference.mediaType)
      if (result.reference.mediaType.startsWith('image/')) {
        setDataUrl(`data:${result.reference.mediaType};base64,${result.base64}`)
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [props.bridge, props.projectId, props.runId, props.artifactId])

  if (dataUrl) {
    return (
      <figure className="cap-scenario-evidence-preview">
        <img src={dataUrl} alt={props.label} />
        <figcaption>Original evidence · {props.artifactId}</figcaption>
      </figure>
    )
  }
  return <span className="cap-scenario-structured-evidence">{mediaType || 'Evidence'} · {props.artifactId}</span>
}

function ScenarioStepRecorder(props: {
  bridge: EuikBridge
  projectId: string
  run: ScenarioRunRecord
  step: ScenarioRunRecord['steps'][number]
  policy: string
  onRecorded: (record: ScenarioRunRecord) => void
  onInspectTrace: () => void
}) {
  const [actualResult, setActualResult] = useState(props.step.actualResult)
  const [outcome, setOutcome] = useState<Exclude<ScenarioOutcome, 'unverified'>>(
    props.step.outcome === 'unverified' ? 'passed' : props.step.outcome,
  )
  const [evidence, setEvidence] = useState<ScenarioStepEvidence[]>(props.step.evidence)
  const [notApplicableReason, setNotApplicableReason] = useState(
    props.step.evidence.find((item) => item.kind === 'not-applicable')?.reason ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function attach(file: File) {
    setBusy(true)
    setMessage('')
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Evidence files must be 25 MB or smaller.')
      const artifactId = safeArtifactId(props.run.runId, props.step.scenarioStepId, file)
      const base64 = await fileBase64(file)
      await props.bridge.capabilitiesSaveScenarioEvidence({
        projectId: props.projectId,
        runId: props.run.runId,
        artifactId,
        mediaType: file.type || 'application/octet-stream',
        base64,
        provenanceSource: `User-recorded evidence for scenario step ${props.step.scenarioStepId}`,
      })
      const item: ScenarioStepEvidence = {
        kind: file.type.startsWith('image/') ? 'screenshot' : 'structured',
        artifactId,
      }
      setEvidence((current) => [...current.filter((entry) => entry.kind !== item.kind), item])
      setMessage('Evidence stored with an immutable SHA-256 hash.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function record() {
    setBusy(true)
    setMessage('')
    try {
      const recordedEvidence = props.policy === 'not-applicable'
        ? [{ kind: 'not-applicable' as const, reason: notApplicableReason }]
        : evidence
      const timestamp = new Date().toISOString()
      const record = await props.bridge.capabilitiesRecordScenarioStep({
        projectId: props.projectId,
        runId: props.run.runId,
        scenarioStepId: props.step.scenarioStepId,
        actualResult,
        outcome,
        evidence: recordedEvidence,
        startedAt: props.step.startedAt || timestamp,
        completedAt: timestamp,
      })
      props.onRecorded(record)
      setMessage('Observed result recorded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  function changeResult(event: ChangeEvent<HTMLTextAreaElement>) {
    setActualResult(event.target.value)
  }

  function changeOutcome(event: ChangeEvent<HTMLSelectElement>) {
    setOutcome(event.target.value as Exclude<ScenarioOutcome, 'unverified'>)
  }

  function changeEvidenceReason(event: ChangeEvent<HTMLInputElement>) {
    setNotApplicableReason(event.target.value)
  }

  function selectEvidence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void attach(file)
    event.target.value = ''
  }

  const evidenceAccept = props.policy === 'screenshot' ? 'image/png,image/jpeg' : undefined
  const hasRequiredEvidence = props.policy === 'screenshot'
    ? evidence.some((item) => item.kind === 'screenshot' && item.artifactId)
    : props.policy === 'structured'
      ? evidence.some((item) => item.kind === 'structured' && item.artifactId)
      : props.policy === 'either'
        ? evidence.some((item) =>
          (item.kind === 'screenshot' || item.kind === 'structured') && item.artifactId)
        : Boolean(notApplicableReason.trim())

  return (
    <article className={`cap-scenario-step ${props.step.outcome}`} aria-label={`Scenario step ${props.step.scenarioStepId}`}>
      <div className="cap-scenario-step-head">
        <span className="cap-scenario-step-marker" aria-hidden="true" />
        <div>
          <strong>{props.step.action}</strong>
          <p>Expected: {props.step.expectedResult}</p>
        </div>
        <span className={`cap-scenario-outcome ${props.step.outcome}`}>{OUTCOME_LABEL[props.step.outcome]}</span>
      </div>
      <div className="cap-scenario-step-form">
        <label>
          Observed result
          <textarea rows={3} value={actualResult} onChange={changeResult} />
        </label>
        <div className="cap-connect-field">
          <label htmlFor={`scenario-outcome-${props.step.scenarioStepId}`}>
            Outcome
          </label>
          <select id={`scenario-outcome-${props.step.scenarioStepId}`} value={outcome} onChange={changeOutcome}>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="cancelled">Canceled</option>
          </select>
        </div>
        <div className="cap-scenario-evidence-field">
          <span>Required evidence: <strong>{props.policy}</strong></span>
          {props.policy === 'not-applicable' ? (
            <label>
              Evidence exception
              <input value={notApplicableReason} onChange={changeEvidenceReason} />
            </label>
          ) : (
            <label className="btn btn-secondary btn-compact cap-scenario-file">
              {busy ? 'Storing…' : 'Attach observed evidence'}
              <input
                type="file"
                accept={evidenceAccept}
                disabled={busy}
                onChange={selectEvidence}
              />
            </label>
          )}
        </div>
      </div>
      {evidence.length ? (
        <div className="cap-scenario-evidence-grid">
          {evidence.flatMap((item) => item.artifactId ? [(
            <EvidencePreview
              key={item.artifactId}
              bridge={props.bridge}
              projectId={props.projectId}
              runId={props.run.runId}
              artifactId={item.artifactId}
              label={`Evidence for ${props.step.action}`}
            />
          )] : [])}
        </div>
      ) : null}
      <div className="cap-scenario-step-actions">
        <button type="button" className="btn btn-secondary btn-compact" onClick={props.onInspectTrace}>
          Inspect trace
        </button>
        <button
          type="button"
          className="btn btn-primary btn-compact"
          disabled={busy || !actualResult.trim() || !hasRequiredEvidence}
          onClick={record}
        >
          Record observed step
        </button>
        {message ? <span role="status">{message}</span> : null}
      </div>
    </article>
  )
}

function ScenarioTraceDrawer(props: {
  trace: ScenarioStepTrace
  onClose: () => void
}) {
  const [moduleFilter, setModuleFilter] = useState<'all' | 'current' | 'stale' | 'missing'>('all')
  const modules = props.trace.modules.filter((module) => {
    if (moduleFilter === 'current') return !module.stale && Boolean(module.moduleDesignId)
    if (moduleFilter === 'stale') return module.stale
    if (moduleFilter === 'missing') return !module.moduleDesignId
    return true
  })
  const stale = props.trace.staleApplication
    || props.trace.staleArchitecture
    || props.trace.staleModuleIds.length > 0

  return (
    <aside className="cap-scenario-trace-drawer" aria-label="Behavior trace">
      <header>
        <div>
          <p className="capabilities-eyebrow">Trace evidence</p>
          <h4>{props.trace.scenarioStepId}</h4>
          <p>
            This view follows the observed application step through allocation,
            module refinement, operations, events, and evidence.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-compact" onClick={props.onClose}>
          Close
        </button>
      </header>

      <div className="cap-scenario-trace-status">
        <span className={`badge ${stale ? 'warning' : 'approved'}`}>
          {stale ? 'Earlier design revision' : 'Current design trace'}
        </span>
        {props.trace.result ? (
          <span className={`cap-scenario-outcome ${props.trace.result.outcome}`}>
            Application step: {OUTCOME_LABEL[props.trace.result.outcome]}
          </span>
        ) : null}
      </div>

      <dl className="cap-scenario-trace-ids">
        <div><dt>Workflow</dt><dd><code>{props.trace.workflowId ?? 'Not linked'}</code></dd></div>
        <div>
          <dt>Application actions</dt>
          <dd>{props.trace.workflowNodeIds.length
            ? props.trace.workflowNodeIds.map((id) => <code key={id}>{id}</code>)
            : 'No workflow action is linked.'}</dd>
        </div>
      </dl>

      <div className="cap-scenario-trace-filter">
        <label>
          Module behavior view
          <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value as typeof moduleFilter)}>
            <option value="all">All allocated modules</option>
            <option value="current">Current designs</option>
            <option value="stale">Earlier designs</option>
            <option value="missing">Missing designs</option>
          </select>
        </label>
        <p>Module behavior status stays separate from the application scenario result.</p>
      </div>

      <div className="cap-scenario-trace-modules">
        {modules.length ? modules.map((module) => (
          <article key={module.moduleId}>
            <div>
              <strong>{module.moduleId}</strong>
              <span className={`badge ${module.stale ? 'warning' : module.moduleDesignId ? 'approved' : 'neutral'}`}>
                {module.stale ? 'Earlier revision' : module.moduleDesignId ? 'Design linked' : 'Design missing'}
              </span>
            </div>
            <dl>
              <div><dt>Module design</dt><dd><code>{module.moduleDesignId ?? 'Not linked'}</code></dd></div>
              <div><dt>Refining activities</dt><dd>{module.activityIds.length ? module.activityIds.join(', ') : 'None'}</dd></div>
              <div><dt>Refining nodes</dt><dd>{module.activityNodeIds.length ? module.activityNodeIds.join(', ') : 'None'}</dd></div>
              <div><dt>Operations</dt><dd>{module.operationIds.length ? module.operationIds.join(', ') : 'None'}</dd></div>
              <div><dt>Events</dt><dd>{module.eventIds.length ? module.eventIds.join(', ') : 'None'}</dd></div>
              <div><dt>Participants</dt><dd>{module.participatingModuleIds.length ? module.participatingModuleIds.join(', ') : 'None'}</dd></div>
            </dl>
          </article>
        )) : <p className="capabilities-note">No modules match this filter.</p>}
      </div>

      <section className="cap-scenario-trace-evidence">
        <h5>Recorded evidence</h5>
        {props.trace.evidence.length ? (
          <ul>{props.trace.evidence.map((item, index) => (
            <li key={`${item.kind}:${item.artifactId ?? index}`}>
              <strong>{item.kind}</strong> · {item.artifactId ?? item.reason ?? 'No reference'}
            </li>
          ))}</ul>
        ) : <p>No evidence is recorded for this step.</p>}
      </section>
    </aside>
  )
}

export function ScenarioVerificationPanel({ bridge, projectId, projection, onChanged }: Props) {
  const [application, setApplication] = useState<ApplicationSpecification>()
  const [architecture, setArchitecture] = useState<ArchitectureSpecification>()
  const [moduleDesigns, setModuleDesigns] = useState<ModuleDesignSpecification[]>([])
  const [runs, setRuns] = useState<ScenarioRunRecord[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [activeRun, setActiveRun] = useState<ScenarioRunRecord>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [diagnostics, setDiagnostics] = useState<{ code?: string; message?: string }[]>([])
  const [traceStepId, setTraceStepId] = useState('')
  const [identity, setIdentity] = useState<RunIdentityDraft>({
    build: 'local',
    sourceRevision: 'working-tree',
    environment: 'local desktop',
    testDataRevision: 'current',
    runner: 'manual evidence recorder',
  })

  async function refresh() {
    const [applicationRecord, architectureRecord, designRecords, records] = await Promise.all([
      bridge.capabilitiesGetApplication(projectId),
      bridge.capabilitiesGetArchitecture(projectId),
      bridge.capabilitiesListModuleDesigns(projectId),
      bridge.capabilitiesListScenarioRuns(projectId),
    ])
    const approved = asApplication(applicationRecord.approved)
    setApplication(approved)
    setArchitecture(asArchitecture(architectureRecord.approved))
    setModuleDesigns(designRecords.flatMap((record) => {
      const design = record.approved ?? record.draft
      return design ? [design] : []
    }))
    setRuns(records)
    setSelectedScenarioId((current) => current || (approved ? compileScenarioDefinitions(approved)[0]?.id ?? '' : ''))
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      bridge.capabilitiesGetApplication(projectId),
      bridge.capabilitiesGetArchitecture(projectId),
      bridge.capabilitiesListModuleDesigns(projectId),
      bridge.capabilitiesListScenarioRuns(projectId),
    ]).then(([applicationRecord, architectureRecord, designRecords, records]) => {
      if (cancelled) return
      const approved = asApplication(applicationRecord.approved)
      setApplication(approved)
      setArchitecture(asArchitecture(architectureRecord.approved))
      setModuleDesigns(designRecords.flatMap((record) => {
        const design = record.approved ?? record.draft
        return design ? [design] : []
      }))
      setRuns(records)
      const scenarios = approved ? compileScenarioDefinitions(approved) : []
      setSelectedScenarioId(scenarios[0]?.id ?? '')
    }).catch((error) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : String(error))
    })
    return () => { cancelled = true }
  }, [bridge, projectId])

  const scenarios = application ? compileScenarioDefinitions(application) : []
  const summary = application ? summarizeScenarioRuns(application, runs) : undefined
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId)
  const latestRun = selectedScenario ? summary?.currentRunByScenario[selectedScenario.id] : undefined
  const useCases = application ? materializeUseCaseDefinitions(application) : []
  const policyByStep = useMemo(() => new Map(useCases.flatMap((useCase) =>
    allUseCaseSteps(useCase).map((step) => [step.id, step.evidencePolicy] as const))), [useCases])

  useEffect(() => {
    setActiveRun(latestRun)
    setDiagnostics([])
    setTraceStepId('')
  }, [selectedScenarioId, latestRun?.runId])

  const trace = application && architecture && selectedScenario && traceStepId
    ? projectScenarioStepTrace({
      application,
      architecture,
      moduleDesigns,
      scenarioId: selectedScenario.id,
      scenarioStepId: traceStepId,
      record: activeRun,
    })
    : undefined

  async function createRun(scenario: ScenarioDefinition) {
    setBusy(true)
    setMessage('')
    setDiagnostics([])
    try {
      const record = await bridge.capabilitiesCreateScenarioRun({
        projectId,
        scenarioId: scenario.id,
        ...identity,
      })
      setActiveRun(record)
      setRuns((current) => [record, ...current])
      setMessage('Prepared an unverified scenario run. No step is marked passed until an observed result is recorded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function runConfiguredCommand() {
    if (!activeRun) return
    setBusy(true)
    setMessage('')
    setDiagnostics([])
    try {
      const result = await bridge.capabilitiesRunScenarioCommand({
        projectId,
        runId: activeRun.runId,
        explicit: true,
      })
      setActiveRun(result.record)
      setRuns((current) => [result.record, ...current.filter((item) => item.runId !== result.record.runId)])
      setDiagnostics(result.diagnostics as { code?: string; message?: string }[])
      setMessage(result.command.status === 'passed'
        ? result.diagnostics.length
          ? 'The configured test passed, but evidence policy still requires additional observed evidence.'
          : 'The configured scenario test passed with stored command evidence.'
        : `The configured scenario test ${result.command.status}.`)
      await onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function finalize() {
    if (!activeRun) return
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesFinalizeScenarioRun({ projectId, runId: activeRun.runId })
      setActiveRun(result.record)
      setRuns((current) => [result.record, ...current.filter((item) => item.runId !== result.record.runId)])
      setDiagnostics(result.diagnostics as { code?: string; message?: string }[])
      setMessage(result.record.outcome === 'passed'
        ? 'Scenario passed with complete, hashed evidence.'
        : `Scenario remains ${OUTCOME_LABEL[result.record.outcome].toLowerCase()}; ${result.diagnostics.length} evidence or result issue(s) remain.`)
      await onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  function updateRun(record: ScenarioRunRecord) {
    setActiveRun(record)
    setRuns((current) => [record, ...current.filter((item) => item.runId !== record.runId)])
  }

  if (!application) {
    return (
      <section className="cap-scenario-verification" aria-label="Scenario verification">
        <EmptyState
          icon={Icon.listChecks(24)}
          title="Approve use cases"
          hint="Scenario verification uses an approved application revision. Drafts cannot produce passing evidence."
        />
      </section>
    )
  }

  return (
    <section className="cap-scenario-verification" aria-labelledby="cap-scenario-heading">
      <div className="cap-scenario-head">
        <div>
          <p className="capabilities-eyebrow">End-to-end verification</p>
          <h3 id="cap-scenario-heading">Scenario evidence</h3>
          <p>Run approved use-case paths and preserve the observed result, original evidence, identity, and hashes for every step.</p>
        </div>
        {summary ? (
          <div className="cap-scenario-summary" aria-label="Scenario result summary">
            <span className="passed"><strong>{summary.passed}</strong> passed</span>
            <span className="failed"><strong>{summary.failed}</strong> failed</span>
            <span><strong>{summary.unverified}</strong> not verified</span>
          </div>
        ) : null}
      </div>

      {!scenarios.length ? (
        <EmptyState
          icon={Icon.listChecks(24)}
          title="No executable scenarios"
          hint="Add stable steps to the approved use cases. Main, alternate, failure, and recovery paths compile into scenarios automatically."
        />
      ) : (
        <div className="cap-scenario-layout">
          <nav className="cap-scenario-list" aria-label="Approved scenarios">
            {scenarios.map((scenario) => {
              const run = summary?.currentRunByScenario[scenario.id]
              return (
                <button
                  type="button"
                  key={scenario.id}
                  className={scenario.id === selectedScenarioId ? 'active' : undefined}
                  aria-current={scenario.id === selectedScenarioId ? 'true' : undefined}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                >
                  <span className={`cap-scenario-status-dot ${run?.outcome ?? 'unverified'}`} aria-hidden="true" />
                  <span><strong>{scenario.name}</strong><small>{scenario.kind} · {scenario.stepIds.length} steps</small></span>
                  <em>{OUTCOME_LABEL[run?.outcome ?? 'unverified']}</em>
                </button>
              )
            })}
          </nav>

          {selectedScenario ? (
            <div className="cap-scenario-run">
              <header className="cap-scenario-run-head">
                <div>
                  <span className={`cap-scenario-kind ${selectedScenario.kind}`}>{selectedScenario.kind} path</span>
                  <h4>{selectedScenario.name}</h4>
                  <p><code>{selectedScenario.id}</code> · Evidence: {selectedScenario.requiredEvidence}</p>
                </div>
                <div className="cap-scenario-run-actions">
                  <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={createRun.bind(null, selectedScenario)}>
                    {activeRun ? 'Start another run' : 'Prepare run'}
                  </button>
                  {activeRun && selectedScenario.testCommand ? (
                    <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={runConfiguredCommand}>
                      Run configured test
                    </button>
                  ) : null}
                </div>
              </header>

              {!activeRun ? (
                <div className="cap-scenario-identity">
                  <h5>Run identity</h5>
                  <div>
                    {(Object.entries(identity) as [keyof RunIdentityDraft, string][]).map(([key, value]) => (
                      <label key={key}>
                        <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <input value={value} onChange={(event) => setIdentity((current) => ({ ...current, [key]: event.target.value }))} />
                      </label>
                    ))}
                  </div>
                  <p>Preparing a run creates an unverified record only. It does not fabricate execution or screenshots.</p>
                </div>
              ) : (
                <>
                  <div className="cap-scenario-run-identity">
                    <span><strong>Build</strong>{activeRun.identity.build}</span>
                    <span><strong>Source</strong>{activeRun.identity.sourceRevision}</span>
                    <span><strong>Environment</strong>{activeRun.identity.environment}</span>
                    <span><strong>Runner</strong>{activeRun.identity.runner}</span>
                    <span><strong>Started</strong>{new Date(activeRun.startedAt).toLocaleString()}</span>
                    <span><strong>Outcome</strong>{OUTCOME_LABEL[activeRun.outcome]}</span>
                  </div>
                  <div className="cap-scenario-steps">
                    {activeRun.steps.map((step) => (
                      <ScenarioStepRecorder
                        key={`${activeRun.runId}:${step.scenarioStepId}:${step.completedAt}`}
                        bridge={bridge}
                        projectId={projectId}
                        run={activeRun}
                        step={step}
                        policy={policyByStep.get(step.scenarioStepId) ?? 'structured'}
                        onRecorded={updateRun}
                        onInspectTrace={() => setTraceStepId(step.scenarioStepId)}
                      />
                    ))}
                  </div>
                  <div className="cap-scenario-finalize">
                    <div>
                      <strong>Finalize against the approved scenario</strong>
                      <p>Every step, required evidence type, and immutable artifact hash is checked again.</p>
                    </div>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={finalize}>
                      Finalize run
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {diagnostics.length ? (
        <details className="cap-scenario-diagnostics" open>
          <summary>Review verification issues ({diagnostics.length})</summary>
          <ul>{diagnostics.map((item, index) => <li key={`${item.code}-${index}`}>{item.message ?? item.code}</li>)}</ul>
        </details>
      ) : null}
      {message ? <p className="capabilities-note" role="status">{message}</p> : null}

      {trace ? <ScenarioTraceDrawer trace={trace} onClose={() => setTraceStepId('')} /> : null}

      {projection === 'design' && activeRun ? (
        <details>
          <summary>Show run identity</summary>
          <pre className="capabilities-pre">{JSON.stringify({
            runId: activeRun.runId,
            identity: activeRun.identity,
            evidenceHashes: activeRun.evidenceHashes,
            contentHash: activeRun.contentHash,
          }, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}
