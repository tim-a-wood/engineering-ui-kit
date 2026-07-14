/**
 * Illustrated in-app how-to guides.
 *
 * Each topic pairs a token-colored SVG illustration with short numbered steps.
 * Rendered by <GuideOverlay/> (topic rail + content pane), opened from the
 * titlebar help button, the sidebar tip card, and per-step "How this step
 * works" links.
 */

import { useEffect } from 'react'
import type { ReactElement } from 'react'

export type GuideTopicId =
  | 'workflow-overview'
  | 'getting-started'
  | 'prepare-context'
  | 'upload-run'
  | 'apply-safely'
  | 'verify-review'
  | 'capabilities-overview'
  | 'capabilities-define'
  | 'capabilities-architect'
  | 'capabilities-build'
  | 'capabilities-connect'
  | 'capabilities-verify'
  | 'capabilities-changes'

export type GuideGroup = 'Build & Test' | 'Capabilities'

export type GuideStep = { title: string; body: string }

export type GuideTopic = {
  id: GuideTopicId
  group: GuideGroup
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
  return (
    <svg viewBox="0 0 520 220" role="img" aria-label="The current Build and Test workflow">
      <rect x="18" y="20" width="300" height="164" rx="12" fill={panel} stroke={accent} strokeWidth="1.5" />
      <circle cx="42" cy="43" r="12" fill={accent} />
      <text x="42" y="47" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">1</text>
      <text x="62" y="47" fontSize="13" fontWeight="700" fill="var(--semantic-text-primary)">Build</text>
      <text x="34" y="69" fontSize="9.5" fill={muted}>WHAT ARE YOU BUILDING?</text>
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={34 + i * 38} y="79" width="30" height="30" rx="6" fill={i === 1 ? 'var(--semantic-accent-primary-tint)' : inset} stroke={i === 1 ? accent : stroke} />)}
      <rect x="34" y="121" width="126" height="35" rx="6" fill={inset} stroke={stroke} />
      <line x1="44" y1="132" x2="96" y2="132" stroke={muted} strokeWidth="3" strokeLinecap="round" />
      <line x1="44" y1="143" x2="133" y2="143" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <rect x="174" y="121" width="60" height="25" rx="6" fill={accent} />
      <text x="204" y="137" textAnchor="middle" fontSize="9" fontWeight="600" fill="#fff">Generate</text>
      <rect x="246" y="121" width="56" height="25" rx="6" fill={inset} stroke={stroke} />
      <text x="274" y="137" textAnchor="middle" fontSize="8.5" fill="var(--semantic-text-secondary)">Apply zip</text>
      <path d="M326 101 H370" stroke={accent} strokeWidth="1.8" markerEnd="url(#guide-arrow)" />
      <rect x="382" y="20" width="120" height="164" rx="12" fill={panel} stroke={stroke} />
      <circle cx="406" cy="43" r="12" fill={inset} stroke={accent} />
      <text x="406" y="47" textAnchor="middle" fontSize="10" fontWeight="700" fill={accentText}>2</text>
      <text x="426" y="47" fontSize="13" fontWeight="700" fill="var(--semantic-text-primary)">Test</text>
      <rect x="398" y="67" width="88" height="16" rx="8" fill={inset} stroke={ok} />
      <text x="442" y="78" textAnchor="middle" fontSize="7.5" fill={ok}>Checks · passed</text>
      <rect x="398" y="92" width="88" height="52" rx="6" fill={inset} stroke={stroke} />
      <rect x="406" y="100" width="72" height="5" rx="2" fill={stroke} />
      <rect x="406" y="112" width="45" height="20" rx="3" fill="var(--semantic-accent-primary-tint)" />
      <rect x="408" y="153" width="76" height="20" rx="6" fill={accent} />
      <text x="446" y="166" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff">Approve</text>
      <path d="M442 190 C442 214, 126 214, 126 188" fill="none" stroke={warn} strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#guide-arrow-warn)" />
      <rect x="174" y="188" width="220" height="22" rx="11" fill={panel} stroke={warn} strokeWidth="1" />
      <text x="284" y="202.5" textAnchor="middle" fontSize="9" fontWeight="600" fill={warn}>Feedback returns to Build for the next iteration</text>
      <defs>
        <marker id="guide-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={accent} />
        </marker>
        <marker id="guide-arrow-warn" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={warn} /></marker>
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

/* --------------------------------------------------- capabilities artwork */

function CapJourneyArt() {
  const stages = ['Define', 'Architect', 'Build', 'Connect', 'Verify']
  return (
    <svg viewBox="0 0 520 150" role="img" aria-label="The five-stage Capabilities journey">
      {stages.map((label, i) => {
        const x = 16 + i * 100
        const done = i < 2
        const current = i === 2
        return (
          <g key={label}>
            <rect x={x} y="46" width="84" height="58" rx="10" fill={current ? 'var(--semantic-accent-primary-tint)' : panel} stroke={current ? accent : done ? ok : stroke} strokeWidth={current ? '1.6' : '1'} />
            <circle cx={x + 18} cy="70" r="11" fill={done ? ok : current ? accent : inset} stroke={done || current ? 'none' : stroke} />
            <text x={x + 18} y="74" textAnchor="middle" fontSize="10" fontWeight="700" fill={done || current ? '#fff' : muted}>{done ? '✓' : i + 1}</text>
            <text x={x + 42} y="94" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--semantic-text-primary)">{label}</text>
            {i < 4 && <path d={`M${x + 84} 75 H${x + 100}`} stroke={stroke} strokeWidth="1.5" markerEnd="url(#cap-arrow)" />}
          </g>
        )
      })}
      <text x="260" y="28" textAnchor="middle" fontSize="10.5" fill={muted}>One canonical model · Guided is the task view · Design holds the detail</text>
      <text x="260" y="130" textAnchor="middle" fontSize="9.5" fill={muted}>Needs attention finds maintenance · Changes processes bounded updates</text>
      <defs>
        <marker id="cap-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={stroke} /></marker>
      </defs>
    </svg>
  )
}

/** Simple reusable "handoff loop" illustration used by the interview-driven stages. */
function CapHandoffArt(props: { label: string; aria: string }) {
  return (
    <svg viewBox="0 0 460 150" role="img" aria-label={props.aria}>
      <rect x="24" y="40" width="118" height="70" rx="10" fill={panel} stroke={accent} />
      <text x="83" y="70" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--semantic-text-primary)">{props.label}</text>
      <text x="83" y="90" textAnchor="middle" fontSize="9.5" fill={muted}>handoff files</text>
      <path d="M146 66 H196" stroke={accent} strokeWidth="1.8" markerEnd="url(#cap-h-arrow)" />
      <text x="171" y="58" textAnchor="middle" fontSize="8.5" fill={muted}>attach</text>
      <rect x="200" y="30" width="120" height="90" rx="10" fill={panel} stroke={stroke} />
      <text x="260" y="52" textAnchor="middle" fontSize="10" fill="var(--semantic-text-secondary)">Copilot</text>
      <rect x="214" y="64" width="92" height="16" rx="8" fill={inset} stroke={stroke} />
      <rect x="214" y="88" width="60" height="16" rx="8" fill="var(--semantic-accent-primary-tint)" />
      <path d="M324 84 H374" stroke={accent} strokeWidth="1.8" markerEnd="url(#cap-h-arrow)" />
      <text x="349" y="76" textAnchor="middle" fontSize="8.5" fill={muted}>import</text>
      <rect x="378" y="52" width="70" height="46" rx="8" fill={panel} stroke={ok} />
      <text x="413" y="79" textAnchor="middle" fontSize="9.5" fill={ok}>review</text>
      <defs>
        <marker id="cap-h-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={accent} /></marker>
      </defs>
    </svg>
  )
}

function CapConnectArt() {
  return (
    <svg viewBox="0 0 460 150" role="img" aria-label="Selecting a preview element and connecting it to a capability">
      <rect x="24" y="28" width="150" height="94" rx="10" fill={panel} stroke={stroke} />
      <text x="99" y="20" textAnchor="middle" fontSize="9.5" fill={muted}>Preview</text>
      <rect x="40" y="44" width="118" height="14" rx="4" fill={inset} stroke={stroke} />
      <rect x="40" y="66" width="70" height="40" rx="6" fill="var(--semantic-accent-primary-tint)" stroke={accent} strokeWidth="1.6" />
      <text x="75" y="90" textAnchor="middle" fontSize="8.5" fill={accentText}>selected</text>
      <path d="M178 86 H222" stroke={accent} strokeWidth="1.8" markerEnd="url(#cap-c-arrow)" />
      <rect x="228" y="40" width="96" height="30" rx="8" fill={panel} stroke={accent} />
      <text x="276" y="59" textAnchor="middle" fontSize="9.5" fill={accentText}>capability</text>
      <rect x="228" y="82" width="96" height="30" rx="8" fill={panel} stroke={stroke} />
      <text x="276" y="101" textAnchor="middle" fontSize="9" fill="var(--semantic-text-secondary)">behavior</text>
      <path d="M328 86 H372" stroke={stroke} strokeWidth="1.5" markerEnd="url(#cap-c-arrow2)" />
      <rect x="376" y="64" width="70" height="44" rx="8" fill={panel} stroke={ok} />
      <text x="411" y="90" textAnchor="middle" fontSize="9.5" fill={ok}>approve</text>
      <defs>
        <marker id="cap-c-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={accent} /></marker>
        <marker id="cap-c-arrow2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={stroke} /></marker>
      </defs>
    </svg>
  )
}

function CapVerifyArt() {
  return (
    <svg viewBox="0 0 460 150" role="img" aria-label="Running verification and reaching a ready state">
      <rect x="30" y="34" width="120" height="84" rx="10" fill={panel} stroke={stroke} />
      <text x="90" y="26" textAnchor="middle" fontSize="9.5" fill={muted}>modules</text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="46" y={46 + i * 22} width="88" height="16" rx="4" fill={inset} stroke={stroke} />
          <circle cx="54" cy={54 + i * 22} r="4" fill={i < 2 ? ok : warn} />
        </g>
      ))}
      <path d="M154 76 H198" stroke={accent} strokeWidth="1.8" markerEnd="url(#cap-v-arrow)" />
      <rect x="204" y="52" width="96" height="46" rx="8" fill={panel} stroke={accent} />
      <text x="252" y="79" textAnchor="middle" fontSize="9.5" fill={accentText}>run checks</text>
      <path d="M304 76 H348" stroke={stroke} strokeWidth="1.5" markerEnd="url(#cap-v-arrow2)" />
      <rect x="354" y="52" width="92" height="46" rx="8" fill={panel} stroke={ok} />
      <text x="400" y="73" textAnchor="middle" fontSize="9.5" fill={ok}>ready</text>
      <text x="400" y="88" textAnchor="middle" fontSize="8" fill={muted}>or repair</text>
      <defs>
        <marker id="cap-v-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={accent} /></marker>
        <marker id="cap-v-arrow2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={stroke} /></marker>
      </defs>
    </svg>
  )
}

function CapChangesArt() {
  return (
    <svg viewBox="0 0 460 150" role="img" aria-label="Assessing impact and processing a delta queue one target at a time">
      <rect x="24" y="48" width="96" height="54" rx="10" fill={panel} stroke={warn} />
      <text x="72" y="72" textAnchor="middle" fontSize="10" fill={warn}>impact</text>
      <text x="72" y="88" textAnchor="middle" fontSize="8.5" fill={muted}>affected?</text>
      <path d="M124 75 H166" stroke={stroke} strokeWidth="1.5" markerEnd="url(#cap-ch-arrow)" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={172 + i * 96} y="56" width="86" height="38" rx="8" fill={i === 0 ? 'var(--semantic-accent-primary-tint)' : panel} stroke={i === 0 ? accent : stroke} />
          <text x={215 + i * 96} y="79" textAnchor="middle" fontSize="9" fill={i === 0 ? accentText : muted}>{i === 0 ? 'next →' : 'locked'}</text>
          {i < 2 && <path d={`M${258 + i * 96} 75 H${268 + i * 96}`} stroke={stroke} strokeWidth="1.5" />}
        </g>
      ))}
      <text x="240" y="120" textAnchor="middle" fontSize="9" fill={muted}>verify each target before the next unlocks</text>
      <defs>
        <marker id="cap-ch-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill={stroke} /></marker>
      </defs>
    </svg>
  )
}

/* ----------------------------------------------------------------- topics */

const CAPABILITIES_TOPICS: GuideTopic[] = [
  {
    id: 'capabilities-overview',
    group: 'Capabilities',
    label: 'The journey',
    title: 'Capabilities, in one picture',
    blurb: 'Capabilities turns "what should this application do" into approved, verified modules through five stages: Define, Architect, Build, Connect, Verify. Guided is the task-focused view; Design holds the technical detail. Both read the same records.',
    art: <CapJourneyArt />,
    steps: [
      { title: 'Guided vs Design', body: 'Guided walks the five stages one at a time and shows the next action. Design exposes the same records as six technical areas: Application, Architecture, Needs attention, Modules, Connections, Verification.' },
      { title: 'One model', body: 'Switching modes never duplicates or forks your work — both projections read and write the same canonical records.' },
      { title: 'Maintenance', body: 'Needs attention lists modules that have drifted and the one action each needs. Changes assesses the impact of an edit and walks the affected modules in dependency order.' },
    ],
  },
  {
    id: 'capabilities-define',
    group: 'Capabilities',
    label: 'Define',
    title: 'Define what the application must do',
    blurb: 'Capture outcomes and user-visible behavior through a Copilot interview, then approve the definition. Nothing downstream unlocks until it is approved.',
    art: <CapHandoffArt label="Interview" aria="Product interview handoff and import loop" />,
    steps: [
      { title: 'Create the handoff', body: 'Generate the product-interview files and open them in Copilot with the recommended prompt.' },
      { title: 'Attach and prompt', body: 'Attach the files in Copilot, paste the prompt, and let it draft the definition.' },
      { title: 'Import the response', body: 'Bring the response file back. Review proposed and unresolved items — unresolved first.' },
      { title: 'Approve', body: 'When the definition is complete, approve it. Approval unlocks Architect.' },
    ],
  },
  {
    id: 'capabilities-architect',
    group: 'Capabilities',
    label: 'Architect',
    title: 'Shape the modules and their dependencies',
    blurb: 'A second interview proposes the module structure. Review the modules and dependencies, resolve any cycles, and approve the architecture.',
    art: <CapHandoffArt label="Architecture" aria="Architecture interview handoff and import loop" />,
    steps: [
      { title: 'Create the handoff', body: 'Generate the architecture-interview files from the approved definition.' },
      { title: 'Import the proposal', body: 'Bring the proposal back and review the derived module diagram and dependency list.' },
      { title: 'Resolve findings', body: 'Dependency cycles and invalid structure are flagged in plain language — fix them before approving.' },
      { title: 'Approve', body: 'Approve the architecture to unlock Build.' },
    ],
  },
  {
    id: 'capabilities-build',
    group: 'Capabilities',
    label: 'Build',
    title: 'Interview, approve, and implement each module',
    blurb: 'Work one allocated module at a time: interview it, approve its manifest, hand off implementation to Copilot, then inspect and apply the returned overlay.',
    art: <CapHandoffArt label="Module" aria="Module interview and implementation overlay loop" />,
    steps: [
      { title: 'Select one module', body: 'Pick a module from the list. Its status and the single next action are shown.' },
      { title: 'Interview and approve', body: 'Run the module interview, import the response, and approve the manifest.' },
      { title: 'Implementation handoff', body: 'Generate the implementation files and return with ui-overlay.zip from Copilot.' },
      { title: 'Inspect and apply', body: 'Inspect the overlay: blockers can never be applied; warnings need your explicit acceptance. Then mark it ready for verification.' },
    ],
  },
  {
    id: 'capabilities-connect',
    group: 'Capabilities',
    label: 'Connect',
    title: 'Connect an element to a capability',
    blurb: 'When the application has a user interface, connect a Preview element to one approved capability and describe how it should behave.',
    art: <CapConnectArt />,
    steps: [
      { title: 'Start Preview', body: 'Launch the application preview. Element selection is available in the packaged desktop app.' },
      { title: 'Select an element', body: 'Pick the element you want to wire up. Its visible text and location are confirmed.' },
      { title: 'Choose a capability', body: 'Choose exactly one approved operation and describe the visible behavior in plain language.' },
      { title: 'Test and approve', body: 'Test the connection — connected or simulated — then approve it. Simulations never touch adapters.' },
    ],
  },
  {
    id: 'capabilities-verify',
    group: 'Capabilities',
    label: 'Verify',
    title: 'Verify every module is ready',
    blurb: 'Run each approved module’s configured checks and read the outcome. A module is ready when its checks pass; failures route you back to repair.',
    art: <CapVerifyArt />,
    steps: [
      { title: 'Select an approved module', body: 'Choose a module and see its total ready progress.' },
      { title: 'Run checks', body: 'Run the module’s configured verification. Watch the pending state while it runs.' },
      { title: 'Read the outcome', body: 'Passed, setup failure, behavioral failure, technical failure, or cancelled — each shown with an icon and text.' },
      { title: 'Repair failures', body: 'A failure offers a clear route back to Build or the relevant repair action. When every module is ready, the journey is complete.' },
    ],
  },
  {
    id: 'capabilities-changes',
    group: 'Capabilities',
    label: 'Changes',
    title: 'Process a bounded change',
    blurb: 'When something changes, assess its impact, approve it, then work the affected modules one at a time. Each delta target must verify before the next unlocks.',
    art: <CapChangesArt />,
    steps: [
      { title: 'Assess impact', body: 'Calculate which modules a change affects and which it does not — each with a reason.' },
      { title: 'Review and approve', body: 'Review affected and unaffected capabilities, then approve the impact.' },
      { title: 'Process one target', body: 'The delta queue shows the provider-first order. Only the next target is actionable; later targets stay locked.' },
      { title: 'Verify each target', body: 'Export, apply, and verify each target before the next one unlocks.' },
    ],
  },
]

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'workflow-overview',
    group: 'Build & Test',
    label: 'The workflow',
    title: 'Build and Test, in one picture',
    blurb: 'The current app has two main work areas. Build defines the change, prepares the Copilot handoff, and safely applies the returned zip. Test shows the result, captures feedback, and completes or repeats the loop.',
    art: <StepsArt />,
    steps: [
      { title: 'Build', body: 'Choose a use-case tile, describe what should change, and optionally add a reference. Generate the handoff, send its files and prompt to Copilot, then inspect and apply ui-overlay.zip in the same panel.' },
      { title: 'Test', body: 'Run checks, inspect the live preview, add notes and evidence, then approve the result or turn your feedback into the next Build iteration.' },
    ],
  },
  {
    id: 'getting-started',
    group: 'Build & Test',
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
    group: 'Build & Test',
    label: 'Define the change',
    title: 'Use “What are you building?” to define the work',
    blurb: 'The Build panel now brings the use case, requirements, reference material, project context, and handoff generation together in one place.',
    art: <ContextArt />,
    steps: [
      { title: 'Choose a use case', body: 'Select the square tile that best matches the work. The guidance underneath updates to show the information that task needs.' },
      { title: 'Describe and reference', body: 'Write the project-specific requirements and add a document, mockup, PDF, or image when it will help Copilot understand the intended result.' },
      { title: 'Generate safely', body: 'Generate screens the project context, excludes dependencies, build output, Git data, and secret-shaped files, then prepares the handoff packet.' },
    ],
  },
  {
    id: 'upload-run',
    group: 'Build & Test',
    label: 'Run in Copilot',
    title: 'Attach the files, then paste the prompt',
    blurb: 'No folder digging: the upload set is a chip you drag straight into the chat, and the prompt is on your clipboard the moment Copilot opens.',
    art: <UploadArt />,
    steps: [
      { title: 'Drag the chip', body: 'Grab the dashed strip (repo-flatfile.txt + task-and-standard-pack.md) and drop it on the Copilot attach area. Prefer keyboard? Copy Files puts the same files on your OS clipboard for Ctrl/Cmd+V.' },
      { title: 'Open Copilot (copies prompt)', body: 'The button opens the chat and drops the recommended prompt onto your clipboard — attach, paste, send.' },
      { title: 'Get the overlay back', body: 'Copilot must return one file: ui-overlay.zip, containing only changed and new files with repo-relative paths. Download it and return to the Apply area in Build.' },
    ],
  },
  {
    id: 'apply-safely',
    group: 'Build & Test',
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
    group: 'Build & Test',
    label: 'Test and review',
    title: 'Use “What changes are needed?” to judge the result',
    blurb: 'Test brings checks, the live application preview, feedback notes, evidence, and final approval into one review panel.',
    art: <EvidenceArt />,
    steps: [
      { title: 'Run your checks', body: 'Typecheck and build run with your project’s own commands; output is captured into the run folder.' },
      { title: 'Capture After', body: 'The same target views are screenshotted again. Any rendered element loss against the baseline is badged per view — this is what catches "the icons disappeared".' },
      { title: 'Generate the review packet', body: 'One click produces review-packet.md, review-evidence.pdf (before/after contact sheet with acceptance criteria and losses), and changes.zip — a 3-file set a reviewer can judge without repo access.' },
      { title: 'Approve or iterate', body: 'Happy? Approve & complete. Not yet? Add feedback and generate a new task packet — your notes and the evidence travel into the next run.' },
    ],
  },
  ...CAPABILITIES_TOPICS,
]

/** Distinct group order for the guide rail. */
const GUIDE_GROUP_ORDER: GuideGroup[] = ['Build & Test', 'Capabilities']

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

  // Escape closes the guide and focus is restored to the previously focused control.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        props.onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="guide-scrim" role="dialog" aria-modal="true" aria-label="How-to guides" onClick={props.onClose}>
      <div className="guide-panel" onClick={(e) => e.stopPropagation()}>
        <aside className="guide-rail">
          <h2 className="guide-rail-title">How-to guides</h2>
          {GUIDE_GROUP_ORDER.map((group) => {
            const groupTopics = GUIDE_TOPICS.filter((t) => t.group === group)
            if (groupTopics.length === 0) return null
            return (
              <div key={group} className="guide-rail-group">
                <span className="guide-rail-group-label">{group}</span>
                <ul>
                  {groupTopics.map((t, i) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={t.id === topic.id ? 'guide-topic active' : 'guide-topic'}
                        aria-current={t.id === topic.id ? 'true' : undefined}
                        onClick={() => props.onSelectTopic(t.id)}
                      >
                        <span className="guide-topic-num num">{i + 1}</span>
                        {t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
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
