import { useEffect, useMemo, useState } from 'react'
import { useDesignState, type DesignStore } from './designState'
import { operationName } from './designShared'

type Props = {
  store: DesignStore
  onOpenPlan: () => void
}

type StructureOption = {
  id: string
  name: string
  moduleName: string
  moduleType: 'experience' | 'workflow' | 'domain'
  summary: string
  strengths: string
  tradeoff: string
  recommended?: boolean
}

type BoundaryDraft = {
  key: string
  moduleId: string
  name: string
  moduleType: 'experience' | 'workflow' | 'domain' | 'connection' | 'platform'
  responsibility: string
}

const STRUCTURE_OPTIONS: StructureOption[] = [
  {
    id: 'focused-core',
    name: 'Focused core',
    moduleName: 'Core workflow',
    moduleType: 'workflow',
    summary: 'Start with one workflow module and isolate each external system behind its own adapter.',
    strengths: 'Lowest coordination cost; clearest path from approved user task to implementation.',
    tradeoff: 'Split domain or experience modules later when their responsibilities become independently valuable.',
    recommended: true,
  },
  {
    id: 'domain-centered',
    name: 'Domain-centered',
    moduleName: 'Core domain',
    moduleType: 'domain',
    summary: 'Put rules and decisions at the center, with workflow orchestration around the domain boundary.',
    strengths: 'Strong fit when business rules are the durable center of the product.',
    tradeoff: 'Introduces an extra boundary earlier and requires explicit operation allocation.',
  },
  {
    id: 'experience-first',
    name: 'Experience-first',
    moduleName: 'User workspace',
    moduleType: 'experience',
    summary: 'Design the user workspace and keep multi-step process state in an application workflow.',
    strengths: 'Creates a traceable screen model and a separate workflow boundary for medium products.',
    tradeoff: 'Adds one boundary when the approved plan contains several independent user tasks.',
  },
]

const MODULE_TYPES = ['experience', 'workflow', 'domain', 'connection', 'platform'] as const

export function SystemDesignGate({ store, onOpenPlan }: Props) {
  const state = useDesignState(store)
  const analysisApproved = state.useCaseAnalysis.status === 'approved' || Boolean(state.useCaseAnalysis.previousApproval)
  const hasStructure = Boolean(state.architecture.revision)
  const structureApproved = state.architecture.status === 'approved'
  const moduleDefinitions = state.architecture.moduleDefinitions ?? []
  const [selectedOptionId, setSelectedOptionId] = useState('focused-core')
  const [selectedModuleId, setSelectedModuleId] = useState(moduleDefinitions[0]?.moduleId ?? '')
  const selectedOption = STRUCTURE_OPTIONS.find((option) => option.id === selectedOptionId) ?? STRUCTURE_OPTIONS[0]!
  const selectedModule = moduleDefinitions.find((module) => module.moduleId === selectedModuleId) ?? moduleDefinitions[0]
  const [moduleName, setModuleName] = useState(selectedModule?.name ?? '')
  const [responsibility, setResponsibility] = useState(selectedModule?.responsibility ?? '')
  const [moduleType, setModuleType] = useState<(typeof MODULE_TYPES)[number]>(selectedModule?.moduleType ?? 'workflow')
  const [operationId, setOperationId] = useState(state.architecture.operationAllocations[0]?.operationId ?? '')
  const [operationTargetId, setOperationTargetId] = useState(moduleDefinitions[0]?.moduleId ?? '')
  const [splitDrafts, setSplitDrafts] = useState<BoundaryDraft[]>([])
  const [splitOwners, setSplitOwners] = useState<Record<string, string>>({})
  const [dependencyFrom, setDependencyFrom] = useState(moduleDefinitions[0]?.moduleId ?? '')
  const [dependencyTo, setDependencyTo] = useState(moduleDefinitions[1]?.moduleId ?? '')
  const [dependencyReason, setDependencyReason] = useState('')

  useEffect(() => {
    const module = moduleDefinitions.find((candidate) => candidate.moduleId === selectedModuleId) ?? moduleDefinitions[0]
    if (!module) return
    setSelectedModuleId(module.moduleId)
    setModuleName(module.name)
    setResponsibility(module.responsibility)
    setModuleType(module.moduleType)
  }, [selectedModuleId, state.architecture.revision, moduleDefinitions])

  const allocationsForSelected = useMemo(
    () => state.architecture.operationAllocations.filter((allocation) => allocation.moduleId === selectedModule?.moduleId),
    [selectedModule?.moduleId, state.architecture.operationAllocations],
  )

  const startSplit = () => {
    if (!selectedModule) return
    const secondId = `${selectedModule.moduleId}.part-2`
    setSplitDrafts([
      {
        key: `${selectedModule.moduleId}.1`,
        moduleId: selectedModule.moduleId,
        name: selectedModule.name,
        moduleType: selectedModule.moduleType,
        responsibility: selectedModule.responsibility,
      },
      {
        key: `${selectedModule.moduleId}.2`,
        moduleId: secondId,
        name: 'New boundary',
        moduleType: 'domain',
        responsibility: 'Owns one cohesive system responsibility.',
      },
    ])
    setSplitOwners(Object.fromEntries(allocationsForSelected.map((allocation) => [allocation.operationId, selectedModule.moduleId])))
  }

  const updateSplitDraft = (key: string, patch: Partial<BoundaryDraft>) => {
    setSplitDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, ...patch } : draft))
  }

  const addSplitDraft = () => {
    if (!selectedModule) return
    const number = splitDrafts.length + 1
    setSplitDrafts((current) => [...current, {
      key: `${selectedModule.moduleId}.${number}`,
      moduleId: `${selectedModule.moduleId}.part-${number}`,
      name: `Boundary ${number}`,
      moduleType: 'domain',
      responsibility: 'Owns one cohesive system responsibility.',
    }])
  }

  return (
    <section className="design-system-gate" aria-label="System design gate">
      <div className="design-system-gate-heading">
        <div>
          <p className="overline">Design · System structure</p>
          <h2>{structureApproved ? 'System structure' : hasStructure ? 'Review system structure' : 'Choose system structure'}</h2>
          <p>
            {structureApproved
              ? 'This approved structure supplies module boundaries, dependencies, deployables, operation allocations, and use-case traces.'
              : 'Compare a starting approach, inspect the proposed boundaries, then adjust the structure before approval.'}
          </p>
        </div>
        <div className="design-system-gate-status" aria-label="Design prerequisites">
          <span className={analysisApproved ? 'complete' : 'blocked'}>{analysisApproved ? '✓ Use cases approved' : '○ Use cases not approved'}</span>
          <span className={hasStructure ? 'complete' : 'blocked'}>{hasStructure ? '✓ Structure drafted' : '○ Structure not drafted'}</span>
          <span className={structureApproved ? 'complete' : 'blocked'}>{structureApproved ? '✓ Structure approved' : '○ Approval required'}</span>
        </div>
      </div>

      {!analysisApproved && (
        <div className="design-inline-gate blocked" role="note">
          <div><b>System design is blocked</b><span>Approve the current use-case revision first.</span></div>
          <button type="button" className="btn btn-secondary" onClick={onOpenPlan}>Return to Plan</button>
        </div>
      )}

      {state.mode === 'project' && analysisApproved && !hasStructure && (
        <>
          <div className="design-structure-options" role="radiogroup" aria-label="Starting structure options">
            {STRUCTURE_OPTIONS.map((option) => (
              <label key={option.id} className={selectedOptionId === option.id ? 'selected' : ''}>
                <input type="radio" name="structure-option" value={option.id} checked={selectedOptionId === option.id} onChange={() => setSelectedOptionId(option.id)} />
                <span>{option.recommended ? 'Recommended' : 'Alternative'}</span>
                <b>{option.name}</b>
                <p>{option.summary}</p>
                <dl><dt>Best for</dt><dd>{option.strengths}</dd><dt>Tradeoff</dt><dd>{option.tradeoff}</dd></dl>
              </label>
            ))}
          </div>
          <div className="design-structure-choice-summary">
            <div>
              <b>Create {selectedOption.name}</b>
              <p>The generator will allocate approved operations to “{selectedOption.moduleName}” and isolate external systems as adapter modules. You can rename, retype, split, merge, move operations, and change dependencies before approval.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => store.createSystemStructure({
                primaryModuleId: `mod.${selectedOption.id}`,
                primaryModuleName: selectedOption.moduleName,
                primaryModuleType: selectedOption.moduleType,
                primaryDeployableId: 'deployable.primary',
              })}
              disabled={state.saveState === 'saving'}
            >
              Create this design
            </button>
          </div>
        </>
      )}

      {hasStructure && (
        <div className="design-structure-review">
          <section className="design-structure-summary" aria-label="Structure check summary">
            <div><strong>{moduleDefinitions.length}</strong><span>Modules</span></div>
            <div><strong>{state.architecture.operationAllocations.length}</strong><span>Operations allocated</span></div>
            <div><strong>{state.architecture.dependencyEdges.length}</strong><span>Dependencies</span></div>
            <div><strong>{state.architecture.deployables.length}</strong><span>Deployables</span></div>
            <div className={state.architecture.gateResult.passed ? 'pass' : 'blocked'}>
              <strong>{state.architecture.gateResult.passed ? 'Pass' : state.architecture.gateResult.diagnostics.length}</strong>
              <span>Structure checks</span>
            </div>
          </section>

          <div className="design-structure-review-grid">
            <section className="design-structure-rationale">
              <h3>Design rationale</h3>
              <p>The proposal starts with the fewest boundaries that satisfy the approved operations and creates one dedicated adapter boundary for each external system.</p>
              <details>
                <summary>Recorded split reasons ({state.architecture.proposals.length})</summary>
                <ul>
                  {state.architecture.proposals.map((proposal) => <li key={proposal.id}>{proposal.text}</li>)}
                </ul>
              </details>
              {state.architecture.gateResult.diagnostics.length > 0 && (
                <ul className="design-error-summary" aria-label="Structure blockers">
                  {state.architecture.gateResult.diagnostics.map((diagnostic) => <li key={`${diagnostic.code}.${diagnostic.id ?? ''}`}>{diagnostic.message}</li>)}
                </ul>
              )}
            </section>

            <section className="design-structure-editor" aria-label="Module inspector">
              <header>
                <div><p className="overline">Module inspector</p><h3>{selectedModule?.name ?? 'Select a module'}</h3></div>
                <label>Module<select value={selectedModule?.moduleId ?? ''} onChange={(event) => setSelectedModuleId(event.target.value)}>
                  {moduleDefinitions.map((module) => <option key={module.moduleId} value={module.moduleId}>{module.name}</option>)}
                </select></label>
              </header>
              {selectedModule && (
                structureApproved ? (
                  <>
                    <dl className="design-structure-approved-module">
                      <div><dt>Responsibility</dt><dd>{selectedModule.responsibility}</dd></div>
                      <div><dt>Module type</dt><dd>{selectedModule.moduleType}</dd></div>
                      <div><dt>Approved revision</dt><dd>{state.architecture.revision}</dd></div>
                    </dl>
                    <p className="design-structure-approved-note">This module boundary is read-only in the approved structure. Revise the structure to propose a change.</p>
                  </>
                ) : (
                  <>
                    <label>Name<input value={moduleName} onChange={(event) => setModuleName(event.target.value)} /></label>
                    <button type="button" className="btn btn-secondary btn-compact" disabled={moduleName.trim() === selectedModule.name || !moduleName.trim()} onClick={() => store.applySystemDesignDecision({ kind: 'rename', moduleId: selectedModule.moduleId, name: moduleName.trim() })}>Apply name</button>
                    <label>Responsibility<textarea rows={3} value={responsibility} onChange={(event) => setResponsibility(event.target.value)} /></label>
                    <button type="button" className="btn btn-secondary btn-compact" disabled={responsibility.trim() === selectedModule.responsibility || !responsibility.trim()} onClick={() => store.applySystemDesignDecision({ kind: 'changePurpose', moduleId: selectedModule.moduleId, responsibility: responsibility.trim(), reason: 'Reviewed in the system structure editor.' })}>Apply responsibility</button>
                    <label>Module type<select value={moduleType} onChange={(event) => setModuleType(event.target.value as (typeof MODULE_TYPES)[number])}>
                      {MODULE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select></label>
                    <button type="button" className="btn btn-secondary btn-compact" disabled={moduleType === selectedModule.moduleType} onClick={() => store.applySystemDesignDecision({ kind: 'changeType', moduleId: selectedModule.moduleId, moduleType })}>Apply type</button>
                  </>
                )
              )}
              {selectedModule && (
                <>
                  <details>
                    <summary>Allocated operations ({allocationsForSelected.length})</summary>
                    <ul>{allocationsForSelected.map((allocation) => (
                      <li key={allocation.operationId}>
                        {operationName(allocation.operationId)}
                        <small title="Stable operation ID"> {allocation.operationId}</small>
                      </li>
                    ))}</ul>
                  </details>
                  {!structureApproved && splitDrafts.length === 0 && (
                    <button type="button" className="btn btn-secondary" onClick={startSplit}>
                      Split module
                    </button>
                  )}
                </>
              )}
            </section>
          </div>

          {!structureApproved && selectedModule && splitDrafts.length > 0 && (
            <section className="design-boundary-editor" aria-label="Module boundary editor">
              <header>
                <div>
                  <p className="overline">Architecture refinement</p>
                  <h3>Split {selectedModule.name}</h3>
                  <p>Create cohesive frontend, workflow, domain, connection, or platform boundaries. Assign every approved operation before you apply the split.</p>
                </div>
                <button type="button" className="btn btn-ghost btn-compact" onClick={() => setSplitDrafts([])}>Cancel split</button>
              </header>
              <div className="design-boundary-grid">
                {splitDrafts.map((draft, index) => (
                  <fieldset key={draft.key} className="design-boundary-card">
                    <legend>Boundary {index + 1}</legend>
                    <label>Module ID<input value={draft.moduleId} onChange={(event) => updateSplitDraft(draft.key, { moduleId: event.target.value })} /></label>
                    <label>Module name<input value={draft.name} onChange={(event) => updateSplitDraft(draft.key, { name: event.target.value })} /></label>
                    <label>Module type<select value={draft.moduleType} onChange={(event) => updateSplitDraft(draft.key, { moduleType: event.target.value as BoundaryDraft['moduleType'] })}>
                      {MODULE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select></label>
                    <label>Responsibility<textarea rows={3} value={draft.responsibility} onChange={(event) => updateSplitDraft(draft.key, { responsibility: event.target.value })} /></label>
                  </fieldset>
                ))}
                <button type="button" className="design-add-boundary" onClick={addSplitDraft}>+ Add boundary</button>
              </div>
              <div className="design-boundary-operations">
                <h4>Operation ownership</h4>
                <p>Each operation must have one owning boundary.</p>
                {allocationsForSelected.map((allocation) => (
                  <label key={allocation.operationId}>
                    <span>{operationName(allocation.operationId)}</span>
                    <select
                      aria-label={`Owner for ${operationName(allocation.operationId)}`}
                      value={splitOwners[allocation.operationId] ?? splitDrafts[0]?.moduleId ?? ''}
                      onChange={(event) => setSplitOwners((current) => ({ ...current, [allocation.operationId]: event.target.value }))}
                    >
                      {splitDrafts.map((draft) => <option key={draft.key} value={draft.moduleId}>{draft.name}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="design-boundary-actions">
                <span>The split stays in this draft until the system structure is approved.</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={splitDrafts.length < 2 || splitDrafts.some((draft) => !draft.moduleId.trim() || !draft.name.trim() || !draft.responsibility.trim())}
                  onClick={() => {
                    store.applySystemDesignDecision({
                      kind: 'split',
                      moduleId: selectedModule.moduleId,
                      newModules: splitDrafts.map((draft) => ({
                        moduleId: draft.moduleId.trim(),
                        name: draft.name.trim(),
                        moduleType: draft.moduleType,
                        responsibility: draft.responsibility.trim(),
                        operationIds: allocationsForSelected
                          .filter((allocation) => (splitOwners[allocation.operationId] ?? splitDrafts[0]?.moduleId) === draft.moduleId)
                          .map((allocation) => allocation.operationId),
                      })),
                    })
                    setSplitDrafts([])
                  }}
                >
                  Apply module split
                </button>
              </div>
            </section>
          )}

          {!structureApproved && state.architecture.operationAllocations.length > 0 && moduleDefinitions.length > 1 && (
            <section className="design-operation-allocation">
              <h3>Preview operation move</h3>
              <p>Moving an operation changes the owning module and will make affected module designs require review.</p>
              <label>Operation<select value={operationId} onChange={(event) => setOperationId(event.target.value)}>
                {state.architecture.operationAllocations.map((allocation) => <option key={allocation.operationId} value={allocation.operationId}>{operationName(allocation.operationId)}</option>)}
              </select></label>
              <label>Target module<select value={operationTargetId} onChange={(event) => setOperationTargetId(event.target.value)}>
                {moduleDefinitions.map((module) => <option key={module.moduleId} value={module.moduleId}>{module.name}</option>)}
              </select></label>
              <button type="button" className="btn btn-secondary" disabled={!operationId || !operationTargetId} onClick={() => store.applySystemDesignDecision({ kind: 'moveOperation', operationId, toModuleId: operationTargetId })}>Move operation</button>
            </section>
          )}

          {!structureApproved && moduleDefinitions.length > 1 && (
            <section className="design-dependency-editor" aria-label="Dependency editor">
              <div>
                <h3>Dependency direction</h3>
                <p>Record only a required call or data direction. The structure check rejects dependency cycles.</p>
              </div>
              <div className="design-dependency-form">
                <label>Dependency source<select value={dependencyFrom} onChange={(event) => setDependencyFrom(event.target.value)}>
                  {moduleDefinitions.map((module) => <option key={module.moduleId} value={module.moduleId}>{module.name}</option>)}
                </select></label>
                <label>Dependency target<select value={dependencyTo} onChange={(event) => setDependencyTo(event.target.value)}>
                  {moduleDefinitions.map((module) => <option key={module.moduleId} value={module.moduleId}>{module.name}</option>)}
                </select></label>
                <label>Dependency reason<input value={dependencyReason} onChange={(event) => setDependencyReason(event.target.value)} /></label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!dependencyFrom || !dependencyTo || dependencyFrom === dependencyTo || !dependencyReason.trim()}
                  onClick={() => {
                    store.applySystemDesignDecision({ kind: 'addDependency', fromModuleId: dependencyFrom, toModuleId: dependencyTo, reason: dependencyReason.trim() })
                    setDependencyReason('')
                  }}
                >
                  Add dependency
                </button>
              </div>
              <ul className="design-dependency-list">
                {state.architecture.dependencyEdges.map((edge) => {
                  const from = moduleDefinitions.find((module) => module.moduleId === edge.fromModuleId)?.name ?? edge.fromModuleId
                  const to = moduleDefinitions.find((module) => module.moduleId === edge.toModuleId)?.name ?? edge.toModuleId
                  return (
                    <li key={`${edge.fromModuleId}.${edge.toModuleId}`}>
                      <span><b>{from}</b> → <b>{to}</b><small>{edge.reason}</small></span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-compact"
                        aria-label={`Remove dependency ${from} to ${to}`}
                        onClick={() => store.applySystemDesignDecision({ kind: 'removeDependency', fromModuleId: edge.fromModuleId, toModuleId: edge.toModuleId })}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {!structureApproved && (
            <div className="design-system-gate-actions">
              <div><b>Approval freezes this revision</b><span>Later structural changes create a new review impact and can make module designs old.</span></div>
              <button type="button" className="btn btn-primary" onClick={() => store.approveSystemStructure()} disabled={state.saveState === 'saving' || !state.architecture.gateResult.passed}>
                Approve system structure
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
