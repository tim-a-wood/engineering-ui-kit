import { useEffect, useState } from 'react'
import type { CapabilityIntegrationState, CompositionConfigurationState } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import { Dialog } from '../../components'
import { humanizeIdentifier } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  state?: CapabilityIntegrationState
  projection: 'guided' | 'design'
  /** Shared setup is downstream of approved entry points and cannot be generated before them. */
  entryPointsReady?: boolean
  /** Module approval is the first Build prerequisite, including for entry-point-exempt libraries. */
  modulesReady?: boolean
  onChanged: () => void | Promise<void>
}

function presentIntegrationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const withoutBridgePrefix = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^GenerationApplyRolledBackError:\s*/i, '')
  const rollbackMarker = 'generation apply failed and was fully rolled back:'
  const markerIndex = withoutBridgePrefix.toLowerCase().indexOf(rollbackMarker)
  if (markerIndex >= 0) {
    const detail = withoutBridgePrefix.slice(markerIndex + rollbackMarker.length).trim()
    return `Generation failed and the repository was fully restored.${detail ? ` ${detail}` : ''}`
  }
  return withoutBridgePrefix
}

function deployableName(deployableId: string): string {
  switch (deployableId) {
    case 'browser': return 'User interface'
    case 'http-api': return 'Application service'
    case 'electron-main': return 'Desktop application'
    case 'cli': return 'Command-line tool'
    case 'worker': return 'Background processing'
    case 'embedded-library': return 'Built-in application logic'
    default: return humanizeIdentifier(deployableId)
  }
}

function integrationStatus(status: string): { label: string; description: string } {
  switch (status) {
    case 'blocked': return { label: 'Waiting', description: 'Approve the required module details before preparing this part.' }
    case 'ready-to-generate': return { label: 'Ready to prepare', description: 'The approved module details are ready to become a working application foundation.' }
    case 'plan-ready': return { label: 'Ready to apply', description: 'The shared setup has been prepared and is ready to add to the project.' }
    case 'applied': return { label: 'Ready', description: 'The shared setup has been added to the project.' }
    case 'failed': return { label: 'Needs attention', description: 'The setup was safely restored after a problem.' }
    case 'stale': return { label: 'Needs refresh', description: 'Module details changed after this setup was prepared.' }
    default: return { label: humanizeIdentifier(status), description: 'Review this application part before continuing.' }
  }
}

export function IntegrationWorkspace({ bridge, projectId, state, projection, entryPointsReady = true, modulesReady = true, onChanged }: Props) {
  const [busyDeployable, setBusyDeployable] = useState('')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [messageFailures, setMessageFailures] = useState<Record<string, boolean>>({})
  const [acceptDirty, setAcceptDirty] = useState<Record<string, boolean>>({})
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const deployables = state?.deployables ?? []

  async function act(deployableId: string, action: () => Promise<unknown>, success: string) {
    setBusyDeployable(deployableId)
    setMessages((current) => ({ ...current, [deployableId]: '' }))
    setMessageFailures((current) => ({ ...current, [deployableId]: false }))
    try {
      await action()
      setMessages((current) => ({ ...current, [deployableId]: success }))
      await onChanged()
    } catch (error) {
      setMessages((current) => ({ ...current, [deployableId]: presentIntegrationError(error) }))
      setMessageFailures((current) => ({ ...current, [deployableId]: true }))
      // Apply failures are persisted by the desktop transaction boundary
      // before the IPC call rejects. Refresh even on failure so Guided shows
      // the durable, retryable "safely restored" state immediately instead
      // of leaving the pre-apply plan on screen until an app restart.
      try {
        await onChanged()
      } catch {
        // Preserve the original action failure. A secondary refresh failure
        // must not replace the transaction/rollback diagnostic shown below.
      }
    } finally {
      setBusyDeployable('')
    }
  }

  return (
    <section className="capabilities-integration-workspace" aria-label="Shared application setup">
      <div className="cap-stage-head cap-integration-head">
        <div>
          <p className="capabilities-eyebrow">Build step 3</p>
          <h3>Prepare the shared application setup</h3>
          <p className="lede">Once module details and entry points are approved, prepare the shared files they need to run together.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => setTechnicalOpen(true)}>
          Technical specification
        </button>
      </div>

      {!modulesReady ? (
        <div className="panel-raised cap-blocker" role="status">
          <p>Approve every module above before preparing the shared setup.</p>
        </div>
      ) : !entryPointsReady ? (
        <div className="panel-raised cap-blocker" role="status">
          <p>Configure the required application entry points above before preparing the shared setup.</p>
        </div>
      ) : null}

      {state?.migrationPreview ? (
        <section className="panel-raised cap-migration-preview cap-migration-summary-card" aria-label="Existing project safety review">
          <header>
            <div>
              <p className="capabilities-eyebrow">Existing project</p>
              <h4>{state.migrationPreview.dataLossAssessment.hasLoss ? 'Review required before continuing' : 'Existing files will be preserved'}</h4>
            </div>
            <span className={`badge ${state.migrationPreview.dataLossAssessment.hasLoss ? 'failed' : 'approved'}`}>
              {state.migrationPreview.dataLossAssessment.hasLoss ? 'Needs attention' : 'Safe to continue'}
            </span>
          </header>
          <p>{state.migrationPreview.dataLossAssessment.hasLoss
            ? 'The proposed setup could affect existing information. Review the technical specification before applying it.'
            : 'The shared setup will be added without removing the application’s existing behavior.'}</p>
        </section>
      ) : null}

      {deployables.length === 0 ? (
        <p className="capabilities-note" role="status">Approve the application structure and module details before preparing the shared setup.</p>
      ) : (
        <div className="cap-integration-grid">
          {deployables.map((deployable) => {
            const plan = deployable.currentPlan
            const apply = deployable.latestApply
            const busy = busyDeployable === deployable.deployableId
            const dirty = plan?.targetRepository.cleanState === 'dirty'
            const currentPlanApplied = apply?.status === 'applied' && apply.planHash === plan?.planHash
            const prerequisitesReady = modulesReady && entryPointsReady
            const canApply = prerequisitesReady && Boolean(plan && !plan.blockers.length && !plan.ambiguityQuestions.length && !currentPlanApplied)
            const canPreview = prerequisitesReady && Boolean(plan || deployable.status !== 'blocked')
            const status = integrationStatus(deployable.status)
            const technicalIssueCount = deployable.attention.length
              + (plan?.blockers.length ?? 0)
              + (plan?.ambiguityQuestions.length ?? 0)
              + (deployable.compositionConfiguration?.attention.length ?? 0)
            return (
              <article key={deployable.deployableId} className="panel-raised cap-integration-card cap-integration-summary-card" aria-label={`Setup for ${deployableName(deployable.deployableId)}`}>
                <header>
                  <div>
                    <span className="capabilities-eyebrow">Application part</span>
                    <h4>{deployableName(deployable.deployableId)}</h4>
                  </div>
                  <span className={`badge cap-integration-status ${deployable.status}`}>{status.label}</span>
                </header>
                <p className="cap-integration-description">{status.description}</p>
                {technicalIssueCount ? (
                  <p className="cap-integration-attention" role="status">{technicalIssueCount} technical item{technicalIssueCount === 1 ? '' : 's'} need attention. Open the technical specification for details.</p>
                ) : null}
                {deployable.latestCommandRun ? (
                  <p className={`cap-integration-check ${deployable.latestCommandRun.status}`}>
                    Setup check: <strong>{deployable.latestCommandRun.status === 'passed' ? 'Passed' : 'Needs attention'}</strong>
                  </p>
                ) : null}
                {apply?.status === 'failed' ? (
                  <div className="cap-apply-failure" role="alert">
                    <strong>The project was safely restored after the setup could not be applied.</strong>
                    <p>Open the technical specification for the failure details, then refresh and try again.</p>
                  </div>
                ) : null}
                {dirty && canApply ? (
                  <label className="cap-accept-warnings">
                    <input type="checkbox" checked={acceptDirty[deployable.deployableId] ?? false} onChange={(event) => setAcceptDirty((current) => ({ ...current, [deployable.deployableId]: event.target.checked }))} />
                    I understand this project has uncommitted changes and want to continue.
                  </label>
                ) : null}
                <div className="capabilities-toolbar">
                  <button type="button" className="btn btn-secondary btn-compact" disabled={busy || !canPreview} onClick={() => void act(
                    deployable.deployableId,
                    () => bridge.capabilitiesPreviewGeneration({ projectId, deployableId: deployable.deployableId }),
                    'The shared setup is ready for review.',
                  )}>{plan ? 'Refresh setup' : 'Prepare setup'}</button>
                  {plan && !currentPlanApplied ? <button type="button" className="btn btn-primary btn-compact" disabled={busy || !canApply || (dirty && !acceptDirty[deployable.deployableId])} onClick={() => void act(
                    deployable.deployableId,
                    () => bridge.capabilitiesApplyGeneration({
                      projectId, deployableId: deployable.deployableId, planId: plan.planId, planHash: plan.planHash,
                      explicit: true, acceptDirtyWorktree: dirty && acceptDirty[deployable.deployableId] === true,
                    }),
                    'The shared application setup was applied.',
                  )}>Apply setup</button> : null}
                  {apply?.status === 'applied' && apply.rollbackId ? <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={() => void act(
                    deployable.deployableId,
                    () => bridge.capabilitiesRollbackGeneration({ projectId, deployableId: deployable.deployableId, rollbackId: apply.rollbackId!, explicit: true }),
                    'The setup changes were undone.',
                  )}>Undo setup</button> : null}
                  {plan && apply?.status === 'applied' && apply.planId === plan.planId && apply.planHash === plan.planHash ? <button type="button" className="btn btn-primary btn-compact" disabled={busy || !entryPointsReady} onClick={() => void act(
                    deployable.deployableId,
                    async () => {
                      const run = await bridge.capabilitiesRunIntegrationCommands({
                        projectId, deployableId: deployable.deployableId, planId: plan.planId, planHash: plan.planHash, explicit: true,
                      })
                      if (run.status !== 'passed') {
                        const failed = run.results.find((result) => result.status !== 'passed')
                        throw new Error(failed
                          ? `Install, build, and test failed while running "${failed.command}"${failed.exitCode === null ? '' : ` (exit ${failed.exitCode})`}.`
                          : 'Install, build, and test did not pass.')
                      }
                      return run
                    },
                    'The shared setup checks completed.',
                  )}>Check setup</button> : null}
                </div>
                {messages[deployable.deployableId] ? (
                  <p role="status" className="capabilities-note">{messageFailures[deployable.deployableId]
                    ? 'The setup could not be completed. Open the technical specification for details.'
                    : messages[deployable.deployableId]}</p>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {technicalOpen ? (
        <Dialog
          title="Shared setup technical specification"
          wide
          onClose={() => setTechnicalOpen(false)}
          actions={<button type="button" className="btn btn-primary" onClick={() => setTechnicalOpen(false)}>Close</button>}
        >
          <p className="lede">Generation plans, repository changes, composition factories, commands, hashes, and rollback information used to produce the application foundation.</p>
          <p className="capabilities-note">View: {projection === 'design' ? 'Design' : 'Guided'}</p>
          {state?.migrationPreview ? (
            <section className="panel-raised cap-migration-preview" aria-label="Existing repository migration preview">
              <header>
                <div><p className="capabilities-eyebrow">Existing repository adoption</p><h3>Migration plan</h3></div>
                <span className={`badge ${state.migrationPreview.dataLossAssessment.hasLoss ? 'failed' : 'approved'}`}>
                  {state.migrationPreview.dataLossAssessment.hasLoss ? 'Data-loss risk' : 'No data loss identified'}
                </span>
              </header>
              <div className="cap-migration-summary">
                <span><strong>{state.migrationPreview.fileTransformations.length}</strong> repository transformation(s)</span>
                <span><strong>{state.migrationPreview.recordTransformations.length}</strong> canonical record transformation(s)</span>
                <span><strong>{state.migrationPreview.compatibilityShims.length}</strong> compatibility shim(s)</span>
              </div>
              {state.migrationPreview.blockedAmbiguities.length ? <ul className="cap-issue-list">{state.migrationPreview.blockedAmbiguities.map((ambiguity) => <li key={ambiguity.id}>{ambiguity.description}</li>)}</ul> : null}
              <details open><summary>Preserved files and proposed transformations</summary><ul>{state.migrationPreview.fileTransformations.map((change) => (
                <li key={`${change.path}-${change.action}`}><code>{change.path}</code> — {change.action}: {change.description}</li>
              ))}</ul></details>
              <dl className="capabilities-ids">
                <div><dt>Migration plan</dt><dd><code>{state.migrationPreview.migrationPlanId}</code></dd></div>
                <div><dt>Workspace</dt><dd>{state.migrationPreview.versions.fromWorkspaceVersion} → {state.migrationPreview.versions.toWorkspaceVersion}</dd></div>
                <div><dt>Rollback</dt><dd>{state.migrationPreview.rollbackInstructions}</dd></div>
              </dl>
            </section>
          ) : null}
          <div className="cap-integration-grid cap-integration-technical-grid">
            {deployables.map((deployable) => {
              const plan = deployable.currentPlan
              const apply = deployable.latestApply
              const busy = busyDeployable === deployable.deployableId
              return (
                <article key={deployable.deployableId} className="panel-raised cap-integration-card" aria-label={`Technical specification for ${deployable.deployableId}`}>
                  <header><div><span className="capabilities-eyebrow">Deployable</span><h4>{deployable.deployableId}</h4></div><span className={`badge cap-integration-status ${deployable.status}`}>{deployable.status.replaceAll('-', ' ')}</span></header>
                  {deployable.attention.length ? <ul className="cap-issue-list">{deployable.attention.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                  {deployable.compositionConfiguration ? (
                    <CompositionConfigurationEditor
                      configuration={deployable.compositionConfiguration}
                      busy={busy}
                      onSave={(targets) => act(
                        deployable.deployableId,
                        () => bridge.capabilitiesSaveCompositionConfiguration({ projectId, deployableId: deployable.deployableId, targets, explicit: true }),
                        'Composition configuration saved. Refresh the setup before applying it.',
                      )}
                    />
                  ) : null}
                  {plan ? (
                    <div className="cap-integration-plan">
                      <p><strong>{plan.fileChanges.length}</strong> file change(s), <strong>{plan.dependencyChanges.length}</strong> dependency change(s)</p>
                      <dl className="capabilities-ids">
                        <div><dt>Plan</dt><dd><code>{plan.planId}</code></dd></div>
                        <div><dt>Plan hash</dt><dd><code>{plan.planHash}</code></dd></div>
                        <div><dt>Generator</dt><dd>{plan.generatorVersion}</dd></div>
                        <div><dt>Profile</dt><dd>{plan.referenceProfileVersion}</dd></div>
                      </dl>
                      {plan.fileChanges.length ? <details open><summary>Files and ownership</summary><ul>{plan.fileChanges.map((file) => <li key={file.path}><code>{file.path}</code> — {file.action}, {file.ownership}</li>)}</ul></details> : null}
                      {plan.commands.length ? <details><summary>Commands after apply</summary><ol>{plan.commands.map((command) => <li key={command}><code>{command}</code></li>)}</ol></details> : null}
                      {plan.warnings.length ? <ul>{plan.warnings.map((warning) => <li key={warning}>Warning: {warning}</li>)}</ul> : null}
                      {plan.blockers.length ? <ul className="cap-issue-list">{plan.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
                      {plan.ambiguityQuestions.length ? <ul className="cap-issue-list">{plan.ambiguityQuestions.map((question) => <li key={question.id}>{question.question}</li>)}</ul> : null}
                    </div>
                  ) : null}
                  {deployable.latestCommandRun ? <div className={`cap-command-run ${deployable.latestCommandRun.status}`}><strong>Install/build/test: {deployable.latestCommandRun.status}</strong><ul>{deployable.latestCommandRun.results.map((result) => (
                    <li key={`${result.label}-${result.startedAt}`}><code>{result.command}</code> — {result.status}{result.exitCode === null ? '' : ` (${result.exitCode})`}</li>
                  ))}</ul></div> : null}
                  {apply?.status === 'failed' ? <div className="cap-apply-failure" role="alert"><strong>Apply failed and the transaction restored the repository.</strong><p>{apply.error ?? 'No additional failure detail was recorded.'}</p></div> : null}
                  {messages[deployable.deployableId] ? <p role="status" className="capabilities-note">{messages[deployable.deployableId]}</p> : null}
                </article>
              )
            })}
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}

function CompositionConfigurationEditor(props: {
  configuration: CompositionConfigurationState
  busy: boolean
  onSave: (targets: { contractId: string; implementationTarget: string }[]) => Promise<void>
}) {
  const [targets, setTargets] = useState<Record<string, string>>({})
  const signature = JSON.stringify(props.configuration.registrations.map((registration) => [
    registration.contractId,
    registration.implementationTarget,
    registration.suggestedImplementationTarget,
  ]))
  useEffect(() => {
    setTargets(Object.fromEntries(props.configuration.registrations.map((registration) => [
      registration.contractId,
      registration.implementationTarget ?? registration.suggestedImplementationTarget ?? '',
    ])))
  }, [signature])

  if (props.configuration.registrations.length === 0) {
    return (
      <div className="cap-composition-config ready">
        <p><strong>Composition root:</strong> <code>{props.configuration.compositionRootPath}</code></p>
        <p className="capabilities-note">This deployable has no operation factories to register yet.</p>
        {!props.configuration.ready ? (
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            disabled={props.busy}
            onClick={() => void props.onSave([])}
          >
            Create empty composition root
          </button>
        ) : null}
      </div>
    )
  }
  const complete = props.configuration.registrations.every((registration) => Boolean(targets[registration.contractId]?.trim()))
  return (
    <div className={`cap-composition-config ${props.configuration.ready ? 'ready' : 'attention'}`}>
      <div>
        <p className="capabilities-eyebrow">Composition root</p>
        <p><code>{props.configuration.compositionRootPath}</code> · {props.configuration.runtimeLanguage}</p>
      </div>
      <p className="capabilities-note">Confirm the editable factory that implements each generated operation port. Suggested paths come only from the module’s approved editable boundary.</p>
      {props.configuration.registrations.map((registration) => (
        <label key={registration.contractId} className="cap-composition-target">
          <span><strong>{registration.contractId}</strong> · {registration.providerModuleId} · {registration.lifecycle}</span>
          <input
            value={targets[registration.contractId] ?? ''}
            onChange={(event) => setTargets((current) => ({ ...current, [registration.contractId]: event.target.value }))}
            placeholder="src/module/file.ts#createOperation"
            aria-label={`Implementation factory for ${registration.contractId}`}
          />
          {registration.dependencies.length ? <small>Uses {registration.dependencies.join(', ')}</small> : null}
        </label>
      ))}
      {props.configuration.attention.length ? <ul className="cap-issue-list">{props.configuration.attention.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <button
        type="button"
        className="btn btn-secondary btn-compact"
        disabled={props.busy || !complete}
        onClick={() => void props.onSave(props.configuration.registrations.map((registration) => ({
          contractId: registration.contractId,
          implementationTarget: targets[registration.contractId]!.trim(),
        })))}
      >
        Save composition factories
      </button>
    </div>
  )
}
