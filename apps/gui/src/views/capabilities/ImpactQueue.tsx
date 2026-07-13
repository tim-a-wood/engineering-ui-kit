import { useEffect, useState } from 'react'
import type { CapabilityModuleRecord, ImpactClassification, ImpactRecord } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'

type Props = { bridge: EuikBridge; projectId: string; records: CapabilityModuleRecord[] }
const CLASSIFICATIONS: ImpactClassification[] = ['implementation-only', 'optional-additive', 'required-additive', 'breaking']

export function ImpactQueue({ bridge, projectId, records }: Props) {
  const approved = records.filter((record) => record.approved)
  const [moduleId, setModuleId] = useState('')
  const [classification, setClassification] = useState<ImpactClassification>('implementation-only')
  const [proposal, setProposal] = useState<ImpactRecord>()
  const [history, setHistory] = useState<ImpactRecord[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!moduleId && approved[0]) setModuleId(approved[0].moduleId)
    if (projectId) void bridge.capabilitiesListImpacts(projectId).then(setHistory)
  }, [bridge, projectId, records, moduleId])

  async function calculate() {
    if (!moduleId) return
    try {
      setProposal(await bridge.capabilitiesCalculateImpact({ projectId, changedModuleIds: [moduleId], classification }))
      setMessage('Impact calculated. Review affected and unaffected modules before approval.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  async function approve() {
    if (!proposal) return
    const approvedImpact = await bridge.capabilitiesApproveImpact(projectId, proposal)
    setProposal(approvedImpact)
    setHistory(await bridge.capabilitiesListImpacts(projectId))
    setMessage(`Approved impact ${approvedImpact.changeId}. Next actionable target: ${approvedImpact.proposedPacketOrder[0] ?? 'none'}.`)
  }

  return (
    <section aria-label="Impact and delta queue" className="capabilities-impact">
      <h3>Impact and delta queue</h3>
      <div className="capabilities-toolbar" role="group" aria-label="Impact controls">
        <label>Changed module<select aria-label="Changed module" value={moduleId} onChange={(e) => setModuleId(e.target.value)}><option value="">Select module</option>{approved.map((record) => <option key={record.moduleId} value={record.moduleId}>{record.approved?.name ?? record.moduleId}</option>)}</select></label>
        <label>Classification<select aria-label="Impact classification" value={classification} onChange={(e) => setClassification(e.target.value as ImpactClassification)}>{CLASSIFICATIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <button type="button" disabled={!moduleId} onClick={() => void calculate()}>Calculate impact</button>
        <button type="button" disabled={!proposal || proposal.userApproval?.approved} onClick={() => void approve()}>Approve impact</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {proposal ? <div><p>Classification: <strong>{proposal.classification}</strong></p><h4>Affected</h4><ul>{proposal.affectedModules.map((item) => <li key={item.moduleId}>{item.moduleId}: {item.reason}</li>)}</ul><h4>Unaffected</h4><ul>{proposal.unaffectedModules.map((item) => <li key={item.moduleId}>{item.moduleId}: {item.reason}</li>)}</ul><h4>Provider-first packet order</h4><ol>{proposal.proposedPacketOrder.map((id, index) => <li key={id}>{id}{index === 0 ? ' — next actionable' : ' — waiting'}</li>)}</ol></div> : null}
      {history.length ? <p className="capabilities-note">Persisted approved impacts: {history.filter((item) => item.userApproval?.approved).length}</p> : null}
    </section>
  )
}
