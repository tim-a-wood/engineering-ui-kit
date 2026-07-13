import { useState } from 'react'
import { Dialog } from '../../components'
import { Icon } from '../../icons'

type StepHelpButtonProps = {
  step: number
  variant: 'build' | 'handoff' | 'review'
  title: string
  description: string
  items: string[]
  flow: { icon: 'files' | 'copilot' | 'prompt' | 'zip' | 'check'; label: string }[]
}

const flowIcons = {
  files: Icon.folder,
  copilot: Icon.sparkle,
  prompt: Icon.doc,
  zip: Icon.downloadTray,
  check: Icon.shieldCheck,
}

function PanelMiniature({ variant, index }: { variant: StepHelpButtonProps['variant']; index: number }) {
  if (variant === 'build') {
    if (index === 0) return <span className="help-mini help-mini-tiles"><i /><i className="active" /><i /><i /></span>
    if (index === 1) return <span className="help-mini help-mini-form"><i /><i /><b /></span>
    return <span className="help-mini help-mini-action"><b>Generate</b></span>
  }
  if (variant === 'handoff') {
    if (index === 0) return <span className="help-mini help-mini-files"><i /><i /><i /></span>
    if (index === 1) return <span className="help-mini help-mini-prompt"><i /><i /><b>Copy</b></span>
    if (index === 2) return <span className="help-mini help-mini-drop"><i>↓</i><b>ui-overlay.zip</b></span>
    return <span className="help-mini help-mini-action"><b>Apply changes</b></span>
  }
  if (index === 0) return <span className="help-mini help-mini-chips"><i /><i /><i /></span>
  if (index === 1) return <span className="help-mini help-mini-preview"><i /><b /></span>
  if (index === 2) return <span className="help-mini help-mini-note"><i /><i /><b>＋</b></span>
  return <span className="help-mini help-mini-action"><b>Approve</b></span>
}

export function StepHelpButton({ step, variant, title, description, items, flow }: StepHelpButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="step-help-button"
        aria-label={`Help with step ${step}: ${title}`}
        title={`How to complete step ${step}`}
        onClick={() => setOpen(true)}
      >
        {Icon.help(15)} <span>Help</span>
      </button>
      {open && (
        <Dialog
          title={`Step ${step}: ${title}`}
          wide
          onClose={() => setOpen(false)}
          actions={<button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Got it</button>}
        >
          <div className="step-help-overlay">
            <div className="step-help-hero">
              <span className="step-help-hero-number" aria-hidden="true">{step}</span>
              <div>
                <span className="step-help-eyebrow">How this panel works</span>
                <p className="step-help-intro">{description}</p>
              </div>
            </div>
            <div className="step-help-flow" aria-label={`Step ${step} workflow`}>
              {flow.map((node, index) => {
                const icon = flowIcons[node.icon]
                return (
                  <div className="step-help-flow-part" key={`${node.label}-${index}`}>
                    <div className="step-help-flow-node">
                      <span className="step-help-node-order">{index + 1}</span>
                      <span className="step-help-node-icon" aria-hidden="true">{icon(22)}</span>
                      <PanelMiniature variant={variant} index={index} />
                      <strong>{node.label}</strong>
                    </div>
                    {index < flow.length - 1 && (
                      <span className="step-help-flow-arrow" aria-hidden="true">
                        <span />{Icon.chevronRight(18)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <h3 className="step-help-list-title">Do this</h3>
            <ol className="step-help-checklist">
              {items.map((item) => <li key={item}>{item}</li>)}
            </ol>
            <div className="step-help-success">
              <span className="step-help-success-icon" aria-hidden="true">{Icon.check(18)}</span>
              <span><strong>You’re ready to continue</strong><small>Complete the three actions above, then move to the next panel.</small></span>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
