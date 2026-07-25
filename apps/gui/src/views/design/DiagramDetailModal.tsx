/**
 * §9.8 module-diagram element/relationship detail modal.
 *
 * Shows the required fields for a selected UML element or relationship (UML
 * element type, stable element id, label, source record, definition,
 * connected elements, trace links, discussion history) and the two actions
 * `Discuss with agent` and `Propose change` (§9.8). `Propose change` always
 * runs impact analysis before any record change; `Approve change plan` is a
 * separate, explicit user action (§9.8, §10).
 *
 * Reuses `Dialog` from `../../components` for focus trap + focus return.
 */

import { useId, useState, type FormEvent } from 'react'
import type { DiagramDiscussionEntry, DesignImpactRecord, DiagramProjection, UmlElement, UmlRelationship } from '@engineering-ui-kit/core/design-browser'
import { Dialog } from '../../components'
import type { DiagramElementTarget } from './designState'

export type DiagramDetailSelection = { kind: 'element'; element: UmlElement } | { kind: 'relationship'; relationship: UmlRelationship }

export type DiagramDetailModalProps = {
  diagramTitle: string
  target: DiagramElementTarget
  selection: DiagramDetailSelection
  projection: DiagramProjection
  discussion: DiagramDiscussionEntry[]
  pendingImpact?: DesignImpactRecord
  canApproveChangePlan: boolean
  onDiscuss: (text: string) => void
  onProposeChange: (description: string) => void
  onApproveChangePlan: () => void
  onClose: () => void
}

const DISCUSSION_KIND_LABEL: Record<DiagramDiscussionEntry['kind'], string> = {
  discussion: 'Discussion',
  proposedChange: 'Proposed change',
  impactAnalysis: 'Impact analysis',
  approvedChangePlan: 'Approved change plan',
}

function labelById(projection: DiagramProjection): Map<string, string> {
  return new Map(projection.elements.map((element) => [element.id, element.label]))
}

export function DiagramDetailModal(props: DiagramDetailModalProps) {
  const { selection, projection } = props
  const [discussText, setDiscussText] = useState('')
  const [proposeText, setProposeText] = useState('')
  const discussFieldId = useId()
  const proposeFieldId = useId()
  const names = labelById(projection)

  const isElement = selection.kind === 'element'
  const umlType = isElement ? selection.element.umlType : selection.relationship.kind
  const stableId = isElement ? selection.element.id : selection.relationship.id
  const label = isElement ? selection.element.label : selection.relationship.label ?? '(no label)'
  const sourceRecordId = isElement ? selection.element.sourceRecordId : selection.relationship.sourceRecordId
  const definition = isElement ? selection.element.definition : undefined
  const traceLinks = isElement ? selection.element.traceLinks ?? [] : []

  const connected = isElement
    ? [
        ...projection.relationships
          .filter((rel) => rel.fromId === selection.element.id)
          .map((rel) => `→ ${names.get(rel.toId) ?? rel.toId}${rel.label ? ` (${rel.label})` : ''}`),
        ...projection.relationships
          .filter((rel) => rel.toId === selection.element.id)
          .map((rel) => `← ${names.get(rel.fromId) ?? rel.fromId}${rel.label ? ` (${rel.label})` : ''}`),
      ]
    : [
        `from: ${names.get(selection.relationship.fromId) ?? selection.relationship.fromId}`,
        `to: ${names.get(selection.relationship.toId) ?? selection.relationship.toId}`,
      ]

  function submitDiscuss(event: FormEvent) {
    event.preventDefault()
    if (!discussText.trim()) return
    props.onDiscuss(discussText.trim())
    setDiscussText('')
  }

  function submitPropose(event: FormEvent) {
    event.preventDefault()
    if (!proposeText.trim()) return
    props.onProposeChange(proposeText.trim())
    setProposeText('')
  }

  return (
    <Dialog title={`${label} — ${props.diagramTitle}`} onClose={props.onClose} wide>
      <dl className="design-definition-grid design-diagram-detail-fields">
        <dt>UML element type</dt>
        <dd>{umlType}</dd>
        <dt>Stable element ID</dt>
        <dd className="design-diagram-detail-id">{stableId}</dd>
        <dt>Label</dt>
        <dd>{label}</dd>
        <dt>Source record</dt>
        <dd>{sourceRecordId}</dd>
        {isElement && (
          <>
            <dt>Definition</dt>
            <dd>{definition || 'No definition recorded yet.'}</dd>
          </>
        )}
      </dl>

      <h3>Connected elements</h3>
      {connected.length === 0 ? (
        <p className="secondary-text">No connected elements.</p>
      ) : (
        <ul>
          {connected.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <h3>Trace links</h3>
      {traceLinks.length === 0 ? (
        <p className="secondary-text">No trace links recorded.</p>
      ) : (
        <ul>
          {traceLinks.map((link) => (
            <li key={link}>{link}</li>
          ))}
        </ul>
      )}

      <h3>Discussion history</h3>
      {props.discussion.length === 0 ? (
        <p className="secondary-text">No discussion yet.</p>
      ) : (
        <ol className="design-diagram-discussion" aria-label="Discussion history">
          {props.discussion.map((entry) => (
            <li key={entry.id} className={`design-diagram-discussion-entry design-diagram-discussion-${entry.kind}`}>
              <span className="design-diagram-discussion-kind">{DISCUSSION_KIND_LABEL[entry.kind]}</span>
              <span className="design-diagram-discussion-text">{entry.text}</span>
            </li>
          ))}
        </ol>
      )}

      {props.pendingImpact && (
        <div className="design-diagram-impact" role="region" aria-label="Impact analysis">
          <h3>Impact analysis</h3>
          <p>{props.pendingImpact.description}</p>
          {props.pendingImpact.items.length === 0 ? (
            <p className="secondary-text">No affected records identified.</p>
          ) : (
            <ul>
              {props.pendingImpact.items.map((item, index) => (
                <li key={`${item.category}.${item.targetId}.${index}`}>
                  <strong>{item.category}</strong> {item.targetId} — {item.reason} ({item.invalidation})
                </li>
              ))}
            </ul>
          )}
          {props.canApproveChangePlan && (
            <button type="button" className="btn btn-primary" onClick={props.onApproveChangePlan}>
              Approve change plan
            </button>
          )}
        </div>
      )}

      <form className="design-diagram-propose-form" onSubmit={submitPropose}>
        <h3>Propose change</h3>
        <label htmlFor={proposeFieldId}>{props.target.isRenameable ? 'New name' : 'Describe the proposed change'}</label>
        <textarea id={proposeFieldId} rows={2} value={proposeText} onChange={(event) => setProposeText(event.target.value)} />
        <button type="submit" className="btn btn-secondary" disabled={!proposeText.trim()}>
          Propose change
        </button>
      </form>

      <form className="design-diagram-discuss-form" onSubmit={submitDiscuss}>
        <h3>Discuss with agent</h3>
        <label htmlFor={discussFieldId}>Message</label>
        <textarea id={discussFieldId} rows={2} value={discussText} onChange={(event) => setDiscussText(event.target.value)} />
        <button type="submit" className="btn btn-secondary" disabled={!discussText.trim()}>
          Discuss with agent
        </button>
      </form>
    </Dialog>
  )
}
