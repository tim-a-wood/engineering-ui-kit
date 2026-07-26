import { Fragment, useEffect, useMemo, useState } from 'react'
import { useDesignState, type DesignStore } from './designState'

type Props = { store: DesignStore }
type SupportedKind = 'cli' | 'http'
type MappingRow = { from: string; to: string }
type BindingRecord = Record<string, unknown>

const DEFAULT_POLICIES = {
  validationBehavior: 'Reject invalid input before calling the operation.',
  domainRejectionBehavior: 'Return the operation rejection without retry.',
  technicalFailureBehavior: 'Record the failure and keep the last valid state.',
  timeoutBehavior: 'Cancel at the configured deadline.',
  cancellationBehavior: 'Stop the operation and record cancellation evidence.',
  retryBehavior: 'Do not retry without an idempotency key.',
  duplicateSubmissionBehavior: 'Return the first committed result.',
}

const UNAVAILABLE_KINDS = [
  { name: 'User interface', detail: 'UI bindings can be designed, but this desktop executor cannot launch and prove them yet.' },
  { name: 'Schedule', detail: 'Schedule bindings are schema-supported but execution and clock evidence are not available here.' },
  { name: 'Embedded library', detail: 'Library bindings are schema-supported but no callable-loader verifier is installed.' },
]

function record(value: unknown): BindingRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as BindingRecord : undefined
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function mappings(value: unknown): MappingRow[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const candidate = record(item)
    return candidate ? [{ from: text(candidate.from), to: text(candidate.to) }] : []
  })
}

function MappingEditor(props: {
  label: string
  description: string
  rows: MappingRow[]
  onChange: (rows: MappingRow[]) => void
}) {
  return (
    <fieldset className="design-connect-mappings">
      <legend>{props.label}</legend>
      <p>{props.description}</p>
      {props.rows.length === 0 ? (
        <p className="secondary-text">No mappings. The operation receives and returns its native contract shape.</p>
      ) : (
        <div className="design-connect-mapping-table">
          <span>Entry-point field</span><span>Operation field</span><span className="sr-only">Actions</span>
          {props.rows.map((row, index) => (
            <div className="design-connect-mapping-row" key={`${index}-${row.from}-${row.to}`}>
              <input
                aria-label={`${props.label} source ${index + 1}`}
                value={row.from}
                onChange={(event) => props.onChange(props.rows.map((item, rowIndex) => rowIndex === index ? { ...item, from: event.target.value } : item))}
                placeholder="source.path"
              />
              <span aria-hidden="true">→</span>
              <input
                aria-label={`${props.label} target ${index + 1}`}
                value={row.to}
                onChange={(event) => props.onChange(props.rows.map((item, rowIndex) => rowIndex === index ? { ...item, to: event.target.value } : item))}
                placeholder="operation.path"
              />
              <button type="button" className="btn btn-ghost btn-compact" onClick={() => props.onChange(props.rows.filter((_, rowIndex) => rowIndex !== index))}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onChange([...props.rows, { from: '', to: '' }])}>
        Add mapping
      </button>
    </fieldset>
  )
}

export function WorkflowConnectView({ store }: Props) {
  const state = useDesignState(store)
  const eligibleModuleIds = useMemo(
    () => state.progress.modules
      .filter((entry) => Boolean(store.getDesign(entry.moduleId)?.providedOperations.length))
      .map((entry) => entry.moduleId),
    [state.moduleDesigns, state.progress.modules, store],
  )
  const [moduleId, setModuleId] = useState(eligibleModuleIds[0] ?? state.selectedModuleId ?? '')
  const design = store.getDesign(moduleId)
  const operations = useMemo(() => design?.providedOperations ?? [], [design])
  const [operationKey, setOperationKey] = useState('')
  const [kind, setKind] = useState<SupportedKind>('cli')
  const [command, setCommand] = useState('')
  const [method, setMethod] = useState('POST')
  const [path, setPath] = useState('/')
  const [localBaseUrl, setLocalBaseUrl] = useState('http://127.0.0.1:3000')
  const [exposure, setExposure] = useState('private')
  const [inputMappings, setInputMappings] = useState<MappingRow[]>([])
  const [outputMappings, setOutputMappings] = useState<MappingRow[]>([])
  const connection = state.connections[moduleId]
  const busy = connection?.status === 'configuring' || connection?.status === 'verifying'

  useEffect(() => {
    if (!eligibleModuleIds.includes(moduleId)) setModuleId(eligibleModuleIds[0] ?? '')
  }, [eligibleModuleIds, moduleId])

  useEffect(() => {
    const persisted = record(connection?.configuration)
    const firstOperation = operations[0]
    const persistedOperationId = text(persisted?.operationId)
    const persistedOperationVersion = text(persisted?.operationVersion)
    setOperationKey(
      persistedOperationId
        ? `${persistedOperationId}\u0000${persistedOperationVersion}`
        : firstOperation
          ? `${firstOperation.operationId}\u0000${firstOperation.version}`
          : '',
    )
    const persistedKind = persisted?.kind
    setKind(persistedKind === 'http' ? 'http' : 'cli')
    setCommand(text(persisted?.command))
    setMethod(text(persisted?.method, 'POST'))
    setPath(text(persisted?.path, '/'))
    setLocalBaseUrl(text(persisted?.localBaseUrl, 'http://127.0.0.1:3000'))
    setExposure(text(persisted?.exposure, 'private'))
    setInputMappings(mappings(persisted?.inputMappings))
    setOutputMappings(mappings(persisted?.outputMappings))
  }, [moduleId, connection?.configuration, operations])

  const operation = operations.find((candidate) => `${candidate.operationId}\u0000${candidate.version}` === operationKey) ?? operations[0]
  const launchCommands = design?.verification.configuredCommands ?? []
  const incompleteMapping = [...inputMappings, ...outputMappings].some((mapping) => !mapping.from.trim() || !mapping.to.trim())
  const bindingError =
    !operation ? 'Choose an approved operation.'
      : kind === 'cli' && !command.trim() ? 'Enter the CLI command that invokes the operation.'
        : kind === 'http' && !path.startsWith('/') ? 'The HTTP route must start with “/”.'
          : kind === 'http' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(localBaseUrl) ? 'Verification is intentionally limited to a localhost base URL.'
            : incompleteMapping ? 'Complete or remove every field mapping.'
              : !launchCommands.length ? 'Add a launch or health command in the module verification design before verifying this connection.'
                : undefined

  function buildBinding(): BindingRecord | undefined {
    if (!design || !operation || bindingError) return undefined
    const bindingId = `binding.${moduleId.replace(/^mod\./, '')}.${kind}`
    return {
      schemaVersion: '1.0',
      bindingId,
      version: '1.0.0',
      projectId: state.projectId,
      deployableId: design.boundary.deployableId,
      operationId: operation.operationId,
      operationVersion: operation.version,
      kind,
      ...(kind === 'cli'
        ? { command: command.trim(), argumentMappings: [] }
        : { method, path: path.trim(), localBaseUrl: localBaseUrl.trim(), statusMapping: [] }),
      inputMappings,
      outputMappings,
      ...DEFAULT_POLICIES,
      exposure,
      generatedTargets: [],
      approvalState: 'approved',
    }
  }

  const verification = record(connection?.verification)
  const verificationPassed = verification?.verificationStatus === 'pass'
  const recordedShowcaseRuns = state.scenarioRuns.filter((run) => Boolean(run.identity.connectionRevision))
  const recordedConnectionRevisions = [...new Set(recordedShowcaseRuns.map((run) => run.identity.connectionRevision).filter(Boolean))]
  const recordedPassedRuns = recordedShowcaseRuns.filter((run) => run.outcome === 'passed').length

  return (
    <section className="design-connect" aria-label="Connect">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Connect · Entry points</p>
          <h2>Connect the approved capability to a real entry point</h2>
          <p>Choose an operation, map its fields, save the binding, then launch and prove the configured process from the project repository.</p>
        </div>
        <span className="design-source-chain">Approved operation → entry point → health check → evidence</span>
      </div>

      {state.mode === 'sample' ? (
        <>
          <p className="design-live-required" role="note">Connection execution requires a selected desktop project. The sample does not claim a fabricated live connection.</p>
          <section className="design-connect-coverage" aria-label="Recorded showcase connection proof">
            <div>
              <p className="overline">Recorded showcase proof</p>
              <h3>Prior synthetic connection evidence</h3>
              <p>This is read-only fixture evidence from earlier deterministic runs. It demonstrates the trace shape; it is not a live connection or a current verification.</p>
            </div>
            <ul>
              <li><span>Connection revisions</span><b>{recordedConnectionRevisions.length}</b><small>{recordedConnectionRevisions[0] || 'None recorded'}</small></li>
              <li><span>Recorded runs</span><b>{recordedShowcaseRuns.length}</b><small>{recordedPassedRuns} passed when captured</small></li>
              <li><span>Runner</span><b>{recordedShowcaseRuns[0]?.identity.runner ?? 'Not recorded'}</b><small>{recordedShowcaseRuns[0]?.identity.environment ?? 'Environment not recorded'}</small></li>
            </ul>
          </section>
        </>
      ) : eligibleModuleIds.length === 0 ? (
        <p className="secondary-text">Approve a module design with a provided operation before configuring an entry point.</p>
      ) : (
        <>
          <div className="design-connect-layout">
            <aside>
              <label>
                Module
                <select value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
                  {eligibleModuleIds.map((id) => <option key={id} value={id}>{state.progress.modules.find((entry) => entry.moduleId === id)?.name ?? id}</option>)}
                </select>
              </label>
              <div className={`design-connect-status design-connect-status-${connection?.status ?? 'idle'}`} role="status">
                <span>{verificationPassed ? 'Connection proved' : connection?.status === 'configured' ? 'Ready to verify' : connection?.status === 'failed' ? 'Needs attention' : 'Not connected'}</span>
                <strong>{busy ? connection?.status === 'verifying' ? 'Launching and checking…' : 'Saving…' : connection?.status ?? 'Not configured'}</strong>
                {verification && <small>{text(verification.outcomeSummary, 'Verification evidence recorded.')}</small>}
              </div>
              <div className="design-connect-check">
                <span>Launch / health command</span>
                {launchCommands.length ? (
                  <code>{launchCommands[0]}</code>
                ) : (
                  <p>Missing. Return to module design and define a configured verification command.</p>
                )}
              </div>
              <details>
                <summary>Technical identity</summary>
                <dl className="design-definition-grid">
                  <dt>Module</dt><dd><code>{moduleId}</code></dd>
                  <dt>Deployable</dt><dd><code>{design?.boundary.deployableId || 'Not defined'}</code></dd>
                  <dt>Revision</dt><dd><code>{design?.revision || 'Not defined'}</code></dd>
                </dl>
              </details>
            </aside>

            <form className="design-connect-editor" onSubmit={(event) => {
              event.preventDefault()
              const binding = buildBinding()
              if (binding) store.configureConnection(moduleId, binding)
            }}>
              <section>
                <span className="design-section-number">1</span>
                <div>
                  <h3>Choose what this entry point invokes</h3>
                  <label>
                    Approved operation
                    <select value={operationKey} onChange={(event) => setOperationKey(event.target.value)}>
                      {operations.map((candidate) => (
                        <option key={`${candidate.operationId}-${candidate.version}`} value={`${candidate.operationId}\u0000${candidate.version}`}>
                          {candidate.operationId} · v{candidate.version}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <span className="design-section-number">2</span>
                <div>
                  <h3>Choose the executable entry point</h3>
                  <div className="design-connect-kind-options" role="radiogroup" aria-label="Supported entry point kind">
                    <label className={kind === 'cli' ? 'selected' : ''}>
                      <input type="radio" name="binding-kind" value="cli" checked={kind === 'cli'} onChange={() => setKind('cli')} />
                      <b>Command line</b>
                      <small>Launch a repository command and invoke a CLI command with a bounded sample payload.</small>
                    </label>
                    <label className={kind === 'http' ? 'selected' : ''}>
                      <input type="radio" name="binding-kind" value="http" checked={kind === 'http'} onChange={() => setKind('http')} />
                      <b>Local HTTP</b>
                      <small>Launch a local service, prove its health route, then call the configured operation route.</small>
                    </label>
                  </div>
                  {kind === 'cli' ? (
                    <label>
                      Invocation command
                      <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="node ./bin/app.mjs execute" />
                      <small>The verifier appends a redacted sample JSON argument. Shell expansion is not used.</small>
                    </label>
                  ) : (
                    <div className="design-connect-http-fields">
                      <label>
                        Method
                        <select value={method} onChange={(event) => setMethod(event.target.value)}>
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                      <label>
                        Route
                        <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/api/operation" />
                      </label>
                      <label>
                        Local base URL
                        <input value={localBaseUrl} onChange={(event) => setLocalBaseUrl(event.target.value)} placeholder="http://127.0.0.1:3000" />
                        <small>For safety, verification is restricted to localhost and checks <code>/health</code> first.</small>
                      </label>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <span className="design-section-number">3</span>
                <div>
                  <h3>Map fields</h3>
                  <MappingEditor label="Inputs" description="Translate entry-point values into the approved operation input." rows={inputMappings} onChange={setInputMappings} />
                  <MappingEditor label="Outputs" description="Translate the operation result back to the caller." rows={outputMappings} onChange={setOutputMappings} />
                </div>
              </section>

              <details className="design-connect-policies">
                <summary>Failure, retry, and exposure policy</summary>
                <label>
                  Exposure
                  <select value={exposure} onChange={(event) => setExposure(event.target.value)}>
                    <option value="private">Private</option>
                    <option value="protected">Protected</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <dl className="design-definition-grid">
                  {Object.entries(DEFAULT_POLICIES).map(([key, value]) => (
                    <Fragment key={key}>
                      <dt>{key.replace(/Behavior$/, '').replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</dt>
                      <dd>{value}</dd>
                    </Fragment>
                  ))}
                </dl>
              </details>

              {bindingError && <p className="design-inline-blocker" role="alert">{bindingError}</p>}
              {connection?.message && <p className="design-inline-blocker" role="alert">{connection.message}</p>}
              <div className="design-connect-actions">
                <button type="submit" className="btn btn-secondary" disabled={busy || Boolean(bindingError)}>
                  {connection?.configuration ? 'Save updated binding' : 'Save binding'}
                </button>
                <button type="button" className="btn btn-primary" disabled={busy || connection?.status !== 'configured' || Boolean(bindingError)} onClick={() => {
                  const binding = buildBinding()
                  if (binding) store.verifyConnection(moduleId, binding)
                }}>
                  {connection?.status === 'verifying' ? 'Verifying…' : 'Verify connection'}
                </button>
              </div>

              {connection?.configuration !== undefined && (
                <details className="design-connect-result">
                  <summary>Saved binding record</summary>
                  <pre>{JSON.stringify(connection.configuration, null, 2)}</pre>
                </details>
              )}
              {connection?.verification !== undefined && (
                <details className="design-connect-result">
                  <summary>Connection evidence</summary>
                  <pre>{JSON.stringify(connection.verification, null, 2)}</pre>
                </details>
              )}
            </form>
          </div>

          <section className="design-connect-coverage" aria-labelledby="design-connect-coverage-heading">
            <div>
              <p className="overline">Executor coverage</p>
              <h3 id="design-connect-coverage-heading">What can be proved in this build</h3>
              <p>No unavailable connector is presented as working. Outbound adapters and composition-root generation remain part of module Build; Connect currently proves the process, health route, inbound adapter, and approved operation route.</p>
            </div>
            <ul>
              {UNAVAILABLE_KINDS.map((entry) => (
                <li key={entry.name}>
                  <span>Unavailable</span>
                  <b>{entry.name}</b>
                  <small>{entry.detail}</small>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  )
}
