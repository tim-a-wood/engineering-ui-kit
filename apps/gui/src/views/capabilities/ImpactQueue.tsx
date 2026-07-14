import { useEffect, useState } from 'react'
import type { CapabilityModuleRecord, ImpactClassification, ImpactRecord } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import { humanizeIdentifier, impactClassificationLabel } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  records: CapabilityModuleRecord[]
  projection?: 'guided' | 'design'
}
const CLASSIFICATIONS: ImpactClassification[] = ['implementation-only', 'optional-additive', 'required-additive', 'breaking']

export function ImpactQueue({ bridge, projectId, records, projection = 'design' }: Props) {
  const approved = records.filter((record) => record.approved)
  const [moduleId, setModuleId] = useState('')
  const [classification, setClassification] = useState<ImpactClassification>('implementation-only')
  const [proposal, setProposal] = useState<ImpactRecord>()
  const [history, setHistory] = useState<ImpactRecord[]>([])
  const [message, setMessage] = useState('')
  const guided = projection === 'guided'
  const modName = (id: string) =>
    guided ? (approved.find((r) => r.moduleId === id)?.approved?.name ?? humanizeIdentifier(id)) : id
  const reasonText = (reason: string) => (guided ? humanizeIdentifier(reason) : reason)

  useEffect(() => {
    if (!moduleId && approved[0]) setModuleId(approved[0].moduleId)
    if (projectId) void bridge.capabilitiesListImpacts(projectId).then(setHistory)
  }, [bridge, projectId, records, moduleId])

  async function calculate() {
    if (!moduleId) return
    try {
      setProposal(await bridge.capabilitiesCalculateImpact({ projectId, changedModuleIds: [moduleId], classification }))
      setMessage('Impact calculated. Review affected and unaffected capabilities before approval.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  async function approve() {
    if (!proposal) return
    const approvedImpact = await bridge.capabilitiesApproveImpact(projectId, proposal)
    setProposal(approvedImpact)
    setHistory(await bridge.capabilitiesListImpacts(projectId))
    setMessage('Impact approved. Work the change one target at a time below.')
  }

  return (
    <section aria-label="Impact and delta queue" className="capabilities-impact">
      <h3>Assess a change</h3>
      <div className="capabilities-toolbar cap-form-row" role="group" aria-label="Impact controls">
        <label>Changed capability
          <select aria-label="Changed module" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">Select…</option>
            {approved.map((record) => (
              <option key={record.moduleId} value={record.moduleId}>{modName(record.moduleId)}</option>
            ))}
          </select>
        </label>
        <label>Kind of change
          <select aria-label="Impact classification" value={classification} onChange={(e) => setClassification(e.target.value as ImpactClassification)}>
            {CLASSIFICATIONS.map((value) => (
              <option key={value} value={value}>{guided ? impactClassificationLabel(value) : value}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-secondary btn-compact" disabled={!moduleId} onClick={() => void calculate()}>Assess impact</button>
        <button type="button" className="btn btn-primary btn-compact" disabled={!proposal || proposal.userApproval?.approved} onClick={() => void approve()}>Approve impact</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {proposal ? (
        <div className="cap-impact-result">
          <p>Kind of change: <strong>{guided ? impactClassificationLabel(proposal.classification) : proposal.classification}</strong></p>
          <h4>Affected</h4>
          <ul>{proposal.affectedModules.map((item) => <li key={item.moduleId}>{modName(item.moduleId)} — {reasonText(item.reason)}</li>)}</ul>
          <h4>Unaffected</h4>
          <ul>{proposal.unaffectedModules.map((item) => <li key={item.moduleId}>{modName(item.moduleId)} — {reasonText(item.reason)}</li>)}</ul>
          {!guided ? (
            <>
              <h4>Provider-first packet order</h4>
              <ol>{proposal.proposedPacketOrder.map((id, index) => <li key={id}>{id}{index === 0 ? ' — next actionable' : ' — waiting'}</li>)}</ol>
            </>
          ) : null}
        </div>
      ) : null}
      {!guided && history.length ? <p className="capabilities-note">Persisted approved impacts: {history.filter((item) => item.userApproval?.approved).length}</p> : null}
    </section>
  )
}
