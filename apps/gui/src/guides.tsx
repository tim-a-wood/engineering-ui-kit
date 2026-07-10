/**
 * Illustrated in-app how-to guides.
 *
 * Each topic pairs a token-colored SVG illustration with short numbered steps.
 * Rendered by <GuideOverlay/> (topic rail + content pane), opened from the
 * titlebar help button, the sidebar tip card, and per-step "How this step
 * works" links.
 */

import type { ReactElement } from 'react'

export type GuideTopicId =
  | 'workflow-overview'
  | 'getting-started'
  | 'prepare-context'
  | 'upload-run'
  | 'apply-safely'
  | 'verify-review'

export type GuideStep = { title: string; body: string }

export type GuideTopic = {
  id: GuideTopicId
  label: string
  title: string
  blurb: string
  art: ReactElement
  steps: GuideStep[]
}

/* ---------------------------------------------------------------- artwork */

const stroke = 'var(--semantic-border-strong)'
const accent = 'var(--semantic-accent-primary)'
const accentText = 'var(--semantic-accent-text)'
const muted = 'var(--semantic-text-muted)'
const ok = 'var(--semantic-status-success)'
const warn = 'var(--semantic-status-warning)'
const danger = 'var(--semantic-status-danger)'
const panel = 'var(--semantic-surface-panel-raised)'
const inset = 'var(--semantic-surface-inset)'

function StepsArt() {
  const steps = ['Prepare', 'Packet', 'Copilot', 'Apply', 'Verify']
  return (
    <svg viewBox="0 0 460 170" role="img" aria-label="The five workflow steps with an iterate loop">
      {steps.map((label, i) => {
        const x = 50 + i * 90
        return (
          <g key={label}>
            {i < steps.length - 1 && <line x1={x + 20} y1="70" x2={x + 70} y2="70" stroke={stroke} strokeWidth="1.5" />}
            <circle cx={x} cy="70" r="20" fill={i === 2 ? accent : panel} stroke={i === 2 ? accent : stroke} strokeWidth="1.5" />
            <text x={x} y="75" textAnchor="middle" fontSize="13" fontWeight="600" fill={i === 2 ? '#fff' : accentText}>{i + 1}</text>
            <text x={x} y="110" textAnchor="middle" fontSize="11" fill={muted}>{label}</text>
          </g>
        )
      })}
      <path d="M 410 90 C 410 140, 140 140, 140 92" fill="none" stroke={warn} strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#guide-arrow)" />
      <text x="275" y="152" textAnchor="middle" fontSize="10.5" fill={warn}>iterate: feedback becomes the next packet</text>
      <defs>
        <marker id="guide-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={warn} />
        </marker>
      </defs>
    </svg>
  )
}

function SetupArt() {
  return (
    <svg viewBox="0 0 460 170" role="img" aria-label="A project card with a launch URL and target views">
      <rect x="30" y="30" width="180" height="110" rx="10" fill={panel} stroke={stroke} />
      <rect x="46" y="46" width="26" height="22" rx="5" fill={inset} stroke={stroke} />
      <text x="84" y="61" fontSize="12" fontWeight="600" fill="var(--semantic-text-primary)">my-web-app</text>
      <text x="46" y="90" fontSize="10.5" fill={muted} fontFamily="monospace">C:\work\my-web-app</text>
      <rect x="46" y="102" width="120" height="20" rx="10" fill={inset} stroke={accent} />
      <text x="56" y="115" fontSize="10" fill={accentText} fontFamily="monospace">localhost:5173</text>
      <line x1="222" y1="85" x2="268" y2="85" stroke={stroke} strokeWidth="1.5" markerEnd="url(#setup-arrow)" />
      <rect x="280" y="22" width="150" height="34" rx="8" fill={panel} stroke={stroke} />
      <text x="295" y="43" fontSize="11" fill="var(--semantic-text-secondary)">Dashboard · /</text>
      <rect x="280" y="66" width="150" height="34" rx="8" fill={panel} stroke={stroke} />
      <text x="295" y="87" fontSize="11" fill="var(--semantic-text-secondary)">Orders · #/orders</text>
      <rect x="280" y="110" width="150" height="34" rx="8" fill={panel} stroke={stroke} />
      <text x="295" y="131" fontSize="11" fill="var(--semantic-text-secondary)">Reports · #/reports</text>
      <text x="355" y="14" textAnchor="middle" fontSize="10.5" fill={muted}>evidence target views</text>
      <defs>
        <marker id="setup-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={stroke} />
        </marker>
      </defs>
    </svg>
  )
}

function ContextArt() {
  return (
    <svg viewBox="0 0 460 170" role="img" aria-label="Repository filtered into a flatfile and inventory, with baseline screenshots">
      <rect x="24" y="40" width="110" height="90" rx="10" fill={panel} stroke={stroke} />
      <text x="79" y="30" textAnchor="middle" fontSize="10.5" fill={muted}>your repo</text>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={38 + (i % 2) * 44} y={56 + Math.floor(i / 2) * 34} width="36" height="24" rx="4" fill={inset} stroke={stroke} />
      ))}
      <path d="M148 85 L196 85" stroke={stroke} strokeWidth="1.5" markerEnd="url(#ctx-arrow)" />
      <path d="M210 52 L250 68 L250 102 L210 118 Z" fill={inset} stroke={warn} />
      <text x="230" y="140" textAnchor="middle" fontSize="10" fill={warn}>exclusions</text>
      <path d="M262 85 L306 85" stroke={stroke} strokeWidth="1.5" markerEnd="url(#ctx-arrow)" />
      <rect x="318" y="34" width="112" height="44" rx="8" fill={panel} stroke={accent} />
      <text x="374" y="60" textAnchor="middle" fontSize="10.5" fill={accentText} fontFamily="monospace">repo-flatfile.txt</text>
      <rect x="318" y="92" width="112" height="44" rx="8" fill={panel} stroke={stroke} />
      <text x="374" y="112" textAnchor="middle" fontSize="10.5" fill="var(--semantic-text-secondary)" fontFamily="monospace">inventory.json</text>
      <text x="374" y="126" textAnchor="middle" fontSize="9" fill={muted}>+ baseline screenshots</text>
      <defs>
        <marker id="ctx-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={stroke} />
        </marker>
      </defs>
    </svg>
  )
}

function UploadArt() {
  return (
    <svg viewBox="0 0 460 170" role="img" aria-label="Dragging the two upload files into the Copilot chat">
      <rect x="40" y="60" width="150" height="30" rx="15" fill={inset} stroke={accent} strokeDasharray="5 4" />
      <text x="58" y="79" fontSize="10" fill={accentText} fontFamily="monospace">⣿ 2 files</text>
      <rect x="250" y="20" width="180" height="130" rx="10" fill={panel} stroke={stroke} />
      <text x="340" y="42" textAnchor="middle" fontSize="11" fill="var(--semantic-text-secondary)">Microsoft 365 Copilot</text>
      <rect x="266" y="110" width="148" height="26" rx="13" fill={inset} stroke={stroke} />
      <text x="280" y="127" fontSize="10" fill={muted}>Message Copilot…</text>
      <rect x="266" y="58" width="90" height="20" rx="6" fill={inset} stroke={accent} />
      <text x="276" y="72" fontSize="9" fill={accentText}>attachments</text>
      <path d="M 196 74 C 230 70, 240 68, 268 68" fill="none" stroke={accent} strokeWidth="1.8" markerEnd="url(#up-arrow)" />
      <path d="M214 88 l-6 14 5-2 3 6 4-2-3-6 6-1z" fill="var(--semantic-text-primary)" stroke={stroke} strokeWidth="0.5" />
      <defs>
        <marker id="up-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={accent} />
        </marker>
      </defs>
    </svg>
  )
}

function ShieldArt() {
  return (
    <svg viewBox="0 0 460 170" role="img" aria-label="The overlay inspector blocking unsafe zips and flagging element loss">
      <rect x="30" y="60" width="80" height="52" rx="8" fill={panel} stroke={stroke} />
      <text x="70" y="90" textAnchor="middle" fontSize="10.5" fill="var(--semantic-text-secondary)" fontFamily="monospace">ui-overlay</text>
      <text x="70" y="103" textAnchor="middle" fontSize="10.5" fill="var(--semantic-text-secondary)" fontFamily="monospace">.zip</text>
      <line x1="116" y1="86" x2="168" y2="86" stroke={stroke} strokeWidth="1.5" markerEnd="url(#sh-arrow)" />
      <path d="M215 34 L250 46 L250 92 C250 116 215 132 215 132 C215 132 180 116 180 92 L180 46 Z" fill={inset} stroke={accent} strokeWidth="1.5" />
      <text x="215" y="80" textAnchor="middle" fontSize="9.5" fill={accentText}>inspector</text>
      <text x="215" y="94" textAnchor="middle" fontSize="8.5" fill={muted}>030…048</text>
      <line x1="256" y1="60" x2="308" y2="44" stroke={danger} strokeWidth="1.5" markerEnd="url(#sh-arrow-d)" />
      <rect x="316" y="26" width="118" height="34" rx="8" fill="var(--semantic-status-danger-tint)" stroke={danger} />
      <text x="375" y="47" textAnchor="middle" fontSize="10" fill={danger}>blockers: never applied</text>
      <line x1="256" y1="106" x2="308" y2="122" stroke={warn} strokeWidth="1.5" markerEnd="url(#sh-arrow-w)" />
      <rect x="316" y="106" width="118" height="46" rx="8" fill="var(--semantic-status-warning-tint)" stroke={warn} />
      <text x="375" y="125" textAnchor="middle" fontSize="10" fill={warn}>warnings need your OK</text>
      <text x="375" y="141" textAnchor="middle" fontSize="9.5" fill={warn} fontFamily="monospace">svg 4→0 in App.tsx</text>
      <defs>
        <marker id="sh-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={stroke} /></marker>
        <marker id="sh-arrow-d" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={danger} /></marker>
        <marker id="sh-arrow-w" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={warn} /></marker>
      </defs>
    </svg>
  )
}

function EvidenceArt() {
  return (
    <svg viewBox="0 0 460 170" role="img" aria-label="Before and after screenshots compared into a review packet PDF">
      <rect x="30" y="34" width="130" height="94" rx="8" fill={panel} stroke={stroke} />
      <text x="95" y="26" textAnchor="middle" fontSize="10" fill={muted}>BEFORE</text>
      <polyline points="44,104 64,76 84,90 104,60 124,70 144,54" fill="none" stroke={ok} strokeWidth="2" />
      <rect x="44" y="46" width="30" height="8" rx="2" fill={inset} />
      <rect x="180" y="34" width="130" height="94" rx="8" fill={panel} stroke={danger} />
      <text x="245" y="26" textAnchor="middle" fontSize="10" fill={muted}>AFTER</text>
      <rect x="194" y="46" width="30" height="8" rx="2" fill={inset} />
      <line x1="196" y1="104" x2="294" y2="104" stroke={stroke} strokeDasharray="3 3" />
      <text x="245" y="86" textAnchor="middle" fontSize="9.5" fill={danger} fontFamily="monospace">svg 1→0</text>
      <line x1="316" y1="81" x2="352" y2="81" stroke={stroke} strokeWidth="1.5" markerEnd="url(#ev-arrow)" />
      <rect x="360" y="42" width="72" height="86" rx="6" fill={panel} stroke={accent} />
      <text x="396" y="70" textAnchor="middle" fontSize="10" fill={accentText}>review</text>
      <text x="396" y="84" textAnchor="middle" fontSize="10" fill={accentText}>evidence</text>
      <text x="396" y="102" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--semantic-text-primary)">.pdf</text>
      <defs>
        <marker id="ev-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={stroke} /></marker>
      </defs>
    </svg>
  )
}

/* ----------------------------------------------------------------- topics */

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'workflow-overview',
    label: 'The workflow',
    title: 'The five-step handoff, in one picture',
    blurb: 'You package your repo and task, Microsoft 365 Copilot returns a zip of changed files, and the workbench inspects, applies, and proves the result — nothing lands in your repo without passing the safety and fidelity gates.',
    art: <StepsArt />,
    steps: [
      { title: 'Prepare Context', body: 'The workbench turns your repo into an uploadable flatfile with secrets, binaries, and build output deterministically excluded — and captures baseline screenshots of your target views.' },
      { title: 'Create Task Packet', body: 'Pick a template, describe goal, scope, constraints, and acceptance criteria. The standards pack rides along automatically.' },
      { title: 'Run in Copilot', body: 'Drag the two upload files straight onto the Copilot chat and paste the prompt (already on your clipboard). Copilot returns ui-overlay.zip.' },
      { title: 'Apply Zip Overlay', body: 'The inspector hard-blocks unsafe archives and flags anything that would lose icons, images, or controls. Warnings apply only with your explicit OK.' },
      { title: 'Verify & Review', body: 'Run your own typecheck/build, capture after-screenshots, and generate a review packet with before/after proof. Approve, or iterate with your feedback.' },
    ],
  },
  {
    id: 'getting-started',
    label: 'Getting started',
    title: 'Set up a project in two minutes',
    blurb: 'A project is a repo plus how to see it running. Configure it once; every handoff reuses it.',
    art: <SetupArt />,
    steps: [
      { title: 'Create the project', body: 'Projects → + New Project, point it at a React/Vite/TypeScript repo on disk. No repo handy? Use the built-in sample at examples/work-orders-monolith — a full multi-page work-order app made to be restyled.' },
      { title: 'Set the launch URL', body: 'Projects → Launch & evidence. Enter the URL your dev server serves (e.g. http://localhost:5173). The Launch App button and evidence capture both use it.' },
      { title: 'List your target views', body: 'In the same dialog, add one line per view you care about: "Dashboard | /", "Orders | #/orders". These are the screens the workbench screenshots before and after every handoff.' },
      { title: 'Start a handoff', body: 'Hub → Start handoff. The stepper at the top always shows where you are; every step keeps its artifacts in the run folder.' },
    ],
  },
  {
    id: 'prepare-context',
    label: 'Prepare Context',
    title: 'What leaves your machine (and what never does)',
    blurb: 'Copilot only sees text that survives the exclusion rules. The same step records what your app looks like before any change.',
    art: <ContextArt />,
    steps: [
      { title: 'Generate the context', body: 'One click builds repo-flatfile.txt (full text contents) and repo-inventory.json (what was included, what was excluded, and why).' },
      { title: 'Excluded, always', body: 'Git metadata, dependencies, build output, binaries, and anything secret-shaped (.env, keys, credential-named files). Content that merely looks secret raises a warning for your review.' },
      { title: 'Capture the baseline', body: 'With your dev server running, hit Capture Baseline. Each target view gets a screenshot plus an element census (how many svg/img/button/input elements rendered) — the "before" your review packet compares against.' },
    ],
  },
  {
    id: 'upload-run',
    label: 'Run in Copilot',
    title: 'Two files, one drag, one paste',
    blurb: 'No folder digging: the upload set is a chip you drag straight into the chat, and the prompt is on your clipboard the moment Copilot opens.',
    art: <UploadArt />,
    steps: [
      { title: 'Drag the chip', body: 'Grab the dashed strip (repo-flatfile.txt + task-and-standard-pack.md) and drop it on the Copilot attach area. Prefer keyboard? Copy Files puts the same files on your OS clipboard for Ctrl/Cmd+V.' },
      { title: 'Open Copilot (copies prompt)', body: 'The button opens the chat and drops the recommended prompt onto your clipboard — attach, paste, send.' },
      { title: 'Get the overlay back', body: 'Copilot must return one file: ui-overlay.zip, containing only changed and new files with repo-relative paths. Download it and hit Continue.' },
    ],
  },
  {
    id: 'apply-safely',
    label: 'Apply safely',
    title: 'Nothing is applied that you did not accept',
    blurb: 'Inspection runs before anything touches your repo. Blockers stop the overlay outright; warnings — including visual element loss — wait for your explicit acceptance. Nothing is ever deleted.',
    art: <ShieldArt />,
    steps: [
      { title: 'Hard blockers', body: 'Absolute paths, traversal, git metadata, dependency folders, secret-shaped files, and repo dumps are rejected outright (rules AI-HANDOFF-030…039). These can never be applied.' },
      { title: 'The fidelity gate', body: 'If a file the overlay overwrites would lose icons, images, buttons, or inputs, warning AI-HANDOFF-048 tells you exactly what disappears — "svg 4→0 in src/App.tsx" — before anything is written.' },
      { title: 'Accept knowingly', body: 'Warnings list every overwrite, config change, and asset addition. Applying requires ticking the acceptance box — and the applier only creates or overwrites files, never deletes.' },
    ],
  },
  {
    id: 'verify-review',
    label: 'Verify & review',
    title: 'Prove what the handoff actually did',
    blurb: 'Compiles-fine is not the same as looks-right. This step pairs your build checks with visual evidence and packages both for review.',
    art: <EvidenceArt />,
    steps: [
      { title: 'Run your checks', body: 'Typecheck and build run with your project’s own commands; output is captured into the run folder.' },
      { title: 'Capture After', body: 'The same target views are screenshotted again. Any rendered element loss against the baseline is badged per view — this is what catches "the icons disappeared".' },
      { title: 'Generate the review packet', body: 'One click produces review-packet.md, review-evidence.pdf (before/after contact sheet with acceptance criteria and losses), and changes.zip — a 3-file set a reviewer can judge without repo access.' },
      { title: 'Approve or iterate', body: 'Happy? Approve & complete. Not yet? Add feedback and generate a new task packet — your notes and the evidence travel into the next run.' },
    ],
  },
]

/* ---------------------------------------------------------------- overlay */

export function GuideOverlay(props: {
  topic: GuideTopicId
  onSelectTopic: (id: GuideTopicId) => void
  onClose: () => void
}) {
  const index = Math.max(0, GUIDE_TOPICS.findIndex((t) => t.id === props.topic))
  const topic = GUIDE_TOPICS[index]!
  const prev = GUIDE_TOPICS[index - 1]
  const next = GUIDE_TOPICS[index + 1]

  return (
    <div className="guide-scrim" role="dialog" aria-modal="true" aria-label="How-to guides" onClick={props.onClose}>
      <div className="guide-panel" onClick={(e) => e.stopPropagation()}>
        <aside className="guide-rail">
          <h2 className="guide-rail-title">How-to guides</h2>
          <ul>
            {GUIDE_TOPICS.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={t.id === topic.id ? 'guide-topic active' : 'guide-topic'}
                  onClick={() => props.onSelectTopic(t.id)}
                >
                  <span className="guide-topic-num num">{i + 1}</span>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="guide-content">
          <div className="guide-content-head">
            <h3>{topic.title}</h3>
            <button type="button" className="icon-btn" aria-label="Close guides" onClick={props.onClose}>✕</button>
          </div>
          <div className="guide-art" aria-hidden="false">{topic.art}</div>
          <p className="guide-blurb">{topic.blurb}</p>
          <ol className="guide-steps">
            {topic.steps.map((step) => (
              <li key={step.title}>
                <strong>{step.title}.</strong> {step.body}
              </li>
            ))}
          </ol>
          <div className="guide-foot">
            {prev ? (
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onSelectTopic(prev.id)}>
                ← {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="btn btn-primary btn-compact" onClick={() => props.onSelectTopic(next.id)}>
                {next.label} →
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-compact" onClick={props.onClose}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
