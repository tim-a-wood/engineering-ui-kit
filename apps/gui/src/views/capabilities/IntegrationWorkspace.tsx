import { useEffect, useState } from 'react'
import type { CapabilityIntegrationState, CompositionConfigurationState } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'

type Props = {
  bridge: EuikBridge
  projectId: string
  state?: CapabilityIntegrationState
  projection: 'guided' | 'design'
  onChanged: () => void | Promise<void>
}

export function IntegrationWorkspace({ bridge, projectId, state, projection, onChanged }: Props) {
  const [busyDeployable, setBusyDeployable] = useState('')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [acceptDirty, setAcceptDirty] = useState<Record<string, boolean>>({})
  const design = projection === 'design'
  const deployables = state?.deployables ?? []

  async function act(deployableId: string, action: () => Promise<unknown>, success: string) {
    setBusyDeployable(deployableId)
    setMessages((current) => ({ ...current, [deployableId]: '' }))
    try {
      await action()
      setMessages((current) => ({ ...current, [deployableId]: success }))
      await onChanged()
    } catch (error) {
      setMessages((current) => ({ ...current, [deployableId]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setBusyDeployable('')
    }
  }

  return (
    <section className="capabilities-integration-workspace" aria-label="Reference architecture integration">
      <div className="cap-stage-head">
        <div>
          <p className="capabilities-eyebrow">Executable reference architecture</p>
          <h3>Generate and apply deployable infrastructure</h3>
          <p className="lede">
            {design
              ? 'Review the canonical generation plan, ownership boundaries, hashes, commands, and rollback state for each deployable.'
              : 'Generate the application plumbing from the approved design, review what will change, then apply it safely.'}
          </p>
        </div>
      </div>

      {state?.migrationPreview ? (
        <section className="panel-raised cap-migration-preview" aria-label="Existing repository migration preview">
          <header>
            <div>
              <p className="capabilities-eyebrow">Existing repository adoption</p>
              <h4>Preserve the application while adding generated infrastructure</h4>
            </div>
            <span className={`badge ${state.migrationPreview.dataLossAssessment.hasLoss ? 'failed' : 'approved'}`}>
              {state.migrationPreview.dataLossAssessment.hasLoss ? 'Data-loss risk' : 'No data loss identified'}
            </span>
          </header>
          <p>
            This review-only migration preview records how the approved architecture fits the repository. Generation remains additive and transactional; existing behavior is retained and rollback restores every preimage.
          </p>
          <div className="cap-migration-summary">
            <span><strong>{state.migrationPreview.fileTransformations.length}</strong> repository transformation(s)</span>
            <span><strong>{state.migrationPreview.recordTransformations.length}</strong> canonical record transformation(s)</span>
            <span><strong>{state.migrationPreview.compatibilityShims.length}</strong> compatibility shim(s)</span>
          </div>
          {state.migrationPreview.blockedAmbiguities.length ? (
            <ul className="cap-issue-list">{state.migrationPreview.blockedAmbiguities.map((ambiguity) => <li key={ambiguity.id}>{ambiguity.description}</li>)}</ul>
          ) : <p className="capabilities-note">Repository conventions were detected without a blocking migration ambiguity.</p>}
          <details>
            <summary>Review preserved files and proposed transformations</summary>
            <ul>{state.migrationPreview.fileTransformations.map((change) => (
              <li key={`${change.path}-${change.action}`}><code>{change.path}</code> — {change.action}: {change.description}</li>
            ))}</ul>
          </details>
          {design ? (
            <dl className="capabilities-ids">
              <div><dt>Migration plan</dt><dd><code>{state.migrationPreview.migrationPlanId}</code></dd></div>
              <div><dt>Workspace</dt><dd>{state.migrationPreview.versions.fromWorkspaceVersion} → {state.migrationPreview.versions.toWorkspaceVersion}</dd></div>
              <div><dt>Rollback</dt><dd>{state.migrationPreview.rollbackInstructions}</dd></div>
            </dl>
          ) : null}
        </section>
      ) : null}

      {deployables.length === 0 ? (
        <p className="capabilities-note" role="status">Approve a foundation plan before generating deployable infrastructure.</p>
      ) : (
        <div className="cap-integration-grid">
          {deployables.map((deployable) => {
            const plan = deployable.currentPlan
            const apply = deployable.latestApply
            const busy = busyDeployable === deployable.deployableId
            const dirty = plan?.targetRepository.cleanState === 'dirty'
            const canApply = Boolean(plan && !plan.blockers.length && !plan.ambiguityQuestions.length && apply?.planHash !== plan.planHash)
            return (
              <article key={deployable.deployableId} className="panel-raised cap-integration-card" aria-label={`Integration for ${deployable.deployableId}`}>
                <header>
                  <div>
                    <span className="capabilities-eyebrow">Deployable</span>
                    <h4>{deployable.deployableId}</h4>
                  </div>
                  <span className={`badge cap-integration-status ${deployable.status}`}>{deployable.status.replaceAll('-', ' ')}</span>
                </header>

                {deployable.attention.length ? <ul className="cap-issue-list">{deployable.attention.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                {deployable.compositionConfiguration ? (
                  <CompositionConfigurationEditor
                    configuration={deployable.compositionConfiguration}
                    busy={busy}
                    onSave={(targets) => act(
                      deployable.deployableId,
                      () => bridge.capabilitiesSaveCompositionConfiguration({
                        projectId,
                        deployableId: deployable.deployableId,
                        targets,
                        explicit: true,
                      }),
                      'Composition configuration saved. Generate a fresh plan to apply it.',
                    )}
                  />
                ) : null}
                {plan ? (
                  <div className="cap-integration-plan">
                    <p><strong>{plan.fileChanges.length}</strong> file change(s), <strong>{plan.dependencyChanges.length}</strong> dependency change(s)</p>
                    {design ? (
                      <dl className="capabilities-ids">
                        <div><dt>Plan</dt><dd><code>{plan.planId}</code></dd></div>
                        <div><dt>Plan hash</dt><dd><code>{plan.planHash}</code></dd></div>
                        <div><dt>Generator</dt><dd>{plan.generatorVersion}</dd></div>
                        <div><dt>Profile</dt><dd>{plan.referenceProfileVersion}</dd></div>
                      </dl>
                    ) : null}
                    {plan.fileChanges.length ? (
                      <details>
                        <summary>Files and ownership</summary>
                        <ul>{plan.fileChanges.map((file) => <li key={file.path}><code>{file.path}</code> — {file.action}, {file.ownership}</li>)}</ul>
                      </details>
                    ) : null}
                    {plan.commands.length ? <details><summary>Commands after apply</summary><ol>{plan.commands.map((command) => <li key={command}><code>{command}</code></li>)}</ol></details> : null}
                    {plan.warnings.length ? <ul>{plan.warnings.map((warning) => <li key={warning}>Warning: {warning}</li>)}</ul> : null}
                    {plan.blockers.length ? <ul className="cap-issue-list">{plan.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
                    {plan.ambiguityQuestions.length ? <ul className="cap-issue-list">{plan.ambiguityQuestions.map((question) => <li key={question.id}>{question.question}</li>)}</ul> : null}
                  </div>
                ) : null}

                {dirty && canApply ? (
                  <label className="cap-accept-warnings">
                    <input type="checkbox" checked={acceptDirty[deployable.deployableId] ?? false} onChange={(event) => setAcceptDirty((current) => ({ ...current, [deployable.deployableId]: event.target.checked }))} />
                    I reviewed and accept applying this plan to the currently modified repository.
                  </label>
                ) : null}

                {deployable.latestCommandRun ? (
                  <div className={`cap-command-run ${deployable.latestCommandRun.status}`}>
                    <strong>Install/build/test: {deployable.latestCommandRun.status}</strong>
                    <ul>{deployable.latestCommandRun.results.map((result) => (
                      <li key={`${result.label}-${result.startedAt}`}><code>{result.command}</code> — {result.status}{result.exitCode === null ? '' : ` (${result.exitCode})`}</li>
                    ))}</ul>
                  </div>
                ) : null}

                <div className="capabilities-toolbar">
                  <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={() => void act(
                    deployable.deployableId,
                    () => bridge.capabilitiesPreviewGeneration({ projectId, deployableId: deployable.deployableId }),
                    'Generation plan is ready for review.',
                  )}>{plan ? 'Regenerate plan' : 'Preview generation'}</button>
                  {plan ? <button type="button" className="btn btn-primary btn-compact" disabled={busy || !canApply || (dirty && !acceptDirty[deployable.deployableId])} onClick={() => void act(
                    deployable.deployableId,
                    () => bridge.capabilitiesApplyGeneration({
                      projectId, deployableId: deployable.deployableId, planId: plan.planId, planHash: plan.planHash,
                      explicit: true, acceptDirtyWorktree: dirty && acceptDirty[deployable.deployableId] === true,
                    }),
                    'Reference-architecture infrastructure applied.',
                  )}>Apply generation plan</button> : null}
                  {apply?.status === 'applied' && apply.rollbackId ? <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={() => void act(
                    deployable.deployableId,
                    () => bridge.capabilitiesRollbackGeneration({ projectId, deployableId: deployable.deployableId, rollbackId: apply.rollbackId!, explicit: true }),
                    'Generation was rolled back.',
                  )}>Roll back</button> : null}
                  {plan && apply?.status === 'applied' && apply.planId === plan.planId && apply.planHash === plan.planHash ? <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={() => void act(
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
                    'Install, build, and test commands completed.',
                  )}>Install, build &amp; test</button> : null}
                </div>
                {messages[deployable.deployableId] ? <p role="status" className="capabilities-note">{messages[deployable.deployableId]}</p> : null}
              </article>
            )
          })}
        </div>
      )}
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
