import { useEffect, useMemo, useState } from 'react'
import { useDesignState, type DesignStore } from './designState'

type Props = { store: DesignStore }

function bindingTemplate(store: DesignStore, moduleId: string): string {
  const state = store.getState()
  const design = store.getDesign(moduleId)
  const operation = design?.providedOperations[0]
  return JSON.stringify({
    schemaVersion: '1.0',
    bindingId: `binding.${moduleId.replace(/^mod\./, '')}.cli`,
    version: '1.0.0',
    projectId: state.projectId,
    deployableId: design?.boundary.deployableId ?? '',
    operationId: operation?.operationId ?? '',
    operationVersion: operation?.version ?? '',
    kind: 'cli',
    command: 'replace-with-entry-command',
    inputMappings: [],
    outputMappings: [],
    validationBehavior: 'Reject invalid input before calling the operation.',
    domainRejectionBehavior: 'Return the operation rejection without retry.',
    technicalFailureBehavior: 'Record the failure and keep the last valid state.',
    timeoutBehavior: 'Cancel at the configured deadline.',
    cancellationBehavior: 'Stop the operation and record cancellation evidence.',
    retryBehavior: 'Do not retry without an idempotency key.',
    duplicateSubmissionBehavior: 'Return the first committed result.',
    exposure: 'private',
    generatedTargets: [],
    approvalState: 'approved'
  }, null, 2)
}

export function WorkflowConnectView({ store }: Props) {
  const state = useDesignState(store)
  const eligibleModuleIds = useMemo(
    () => state.progress.modules.filter((entry) => Boolean(store.getDesign(entry.moduleId)?.providedOperations.length)).map((entry) => entry.moduleId),
    [state.moduleDesigns, state.progress.modules, store],
  )
  const [moduleId, setModuleId] = useState(eligibleModuleIds[0] ?? state.selectedModuleId ?? '')
  const [text, setText] = useState(() => bindingTemplate(store, moduleId))
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    if (!eligibleModuleIds.includes(moduleId)) setModuleId(eligibleModuleIds[0] ?? '')
  }, [eligibleModuleIds, moduleId])

  useEffect(() => {
    setText(bindingTemplate(store, moduleId))
    setParseError('')
  }, [moduleId, store])

  const connection = state.connections[moduleId]
  const busy = connection?.status === 'configuring' || connection?.status === 'verifying'

  function parseBinding(): unknown | undefined {
    try {
      const value = JSON.parse(text) as unknown
      setParseError('')
      return value
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error))
      return undefined
    }
  }

  return (
    <section className="design-connect" aria-label="Connect">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Connect · Entry points</p>
          <h2>Configure and verify a real application entry point</h2>
          <p>The desktop service validates the binding against approved operation contracts, persists it, launches the configured command, and records the observed result.</p>
        </div>
        <span className="design-source-chain">Approved contract → binding → launch → evidence</span>
      </div>

      {state.mode === 'sample' ? (
        <p className="design-live-required" role="note">Connect execution requires a selected desktop project. The sample never fabricates a configured or passing connection.</p>
      ) : eligibleModuleIds.length === 0 ? (
        <p className="secondary-text">Approve a module design with a provided operation before configuring an entry point.</p>
      ) : (
        <div className="design-connect-layout">
          <aside>
            <label>
              Module
              <select value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
                {eligibleModuleIds.map((id) => <option key={id} value={id}>{state.progress.modules.find((entry) => entry.moduleId === id)?.name ?? id}</option>)}
              </select>
            </label>
            <dl className="design-definition-grid">
              <dt>Module</dt><dd><code>{moduleId}</code></dd>
              <dt>Deployable</dt><dd><code>{store.getDesign(moduleId)?.boundary.deployableId || 'Not defined'}</code></dd>
              <dt>Operation</dt><dd><code>{store.getDesign(moduleId)?.providedOperations[0]?.operationId || 'Not defined'}</code></dd>
              <dt>Status</dt><dd>{connection?.status ?? 'Not configured in this session'}</dd>
            </dl>
          </aside>
          <div className="design-connect-editor">
            <label>
              Inbound binding
              <textarea spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} />
            </label>
            {parseError && <p className="design-diagnostic-blocker" role="alert">{parseError}</p>}
            {connection?.message && <p className="design-diagnostic-blocker" role="alert">{connection.message}</p>}
            <div className="design-connect-actions">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => {
                const binding = parseBinding()
                if (binding !== undefined) store.configureConnection(moduleId, binding)
              }}>Configure binding</button>
              <button type="button" className="btn btn-primary" disabled={busy || connection?.status !== 'configured'} onClick={() => store.verifyConnection(moduleId)}>
                Verify connection
              </button>
            </div>
            {connection?.configuration !== undefined && (
              <details open className="design-connect-result">
                <summary>Persisted binding result</summary>
                <pre>{JSON.stringify(connection.configuration, null, 2)}</pre>
              </details>
            )}
            {connection?.verification !== undefined && (
              <details open className="design-connect-result">
                <summary>Connection evidence</summary>
                <pre>{JSON.stringify(connection.verification, null, 2)}</pre>
              </details>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
