import { useDesignState, type DesignStore } from './designState'

type Props = {
  store: DesignStore
  onOpenPlan: () => void
}

export function SystemDesignGate({ store, onOpenPlan }: Props) {
  const state = useDesignState(store)
  const analysisApproved = state.useCaseAnalysis.status === 'approved'
  const hasStructure = Boolean(state.architecture.revision)
  const structureApproved = state.architecture.status === 'approved'

  return (
    <section className="design-system-gate" aria-label="System design gate">
      <div>
        <p className="overline">Design · System structure</p>
        <h2>{structureApproved ? 'Approved system structure' : hasStructure ? 'Review the system structure' : 'Create the system structure'}</h2>
        <p>
          {structureApproved
            ? 'This approved structure supplies module boundaries, dependencies, deployables, operation allocations, and use-case traces.'
            : 'The structure is generated from the approved use-case analysis and its compiled application specification.'}
        </p>
      </div>
      <div className="design-system-gate-status">
        <span className={analysisApproved ? 'complete' : 'blocked'}>{analysisApproved ? '✓ Use cases approved' : '○ Use cases not approved'}</span>
        <span className={hasStructure ? 'complete' : 'blocked'}>{hasStructure ? `✓ Structure ${state.architecture.revision}` : '○ No structure draft'}</span>
        <span className={structureApproved ? 'complete' : 'blocked'}>{structureApproved ? '✓ Structure approved' : '○ Approval required'}</span>
      </div>
      <div className="design-system-gate-actions">
        {!analysisApproved && <button type="button" className="btn btn-secondary" onClick={onOpenPlan}>Return to Plan</button>}
        {state.mode === 'project' && analysisApproved && !hasStructure && (
          <button type="button" className="btn btn-primary" onClick={() => store.createSystemStructure()} disabled={state.saveState === 'saving'}>
            Create system design
          </button>
        )}
        {state.mode === 'project' && hasStructure && !structureApproved && (
          <button type="button" className="btn btn-primary" onClick={() => store.approveSystemStructure()} disabled={state.saveState === 'saving'}>
            Approve system structure
          </button>
        )}
      </div>
    </section>
  )
}
