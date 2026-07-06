# Evidence-First Trial Readiness Checklist

## Purpose

Determine whether Roadmap Phase 1 has closed the minimum implementation contract
needed to handcraft one three-file Copilot trial packet.

## Scope

This checklist mirrors the 20 parent-spec acceptance criteria and records status,
evidence path, blocker owner, and corrective action.

No unchecked blocking item may be labeled ready.

## Checklist

| ID | Criterion | Status | Evidence path | Blocker owner | Corrective action |
|---|---|---|---|---|---|
| P1-AC-01 | A safe trial repo and one screen are selected. | pass | `trials/vertical-slice-01/target-selection.md` | | |
| P1-AC-02 | The baseline repo builds or typechecks before any AI change. | pass | `trials/vertical-slice-01/baseline.md` | | |
| P1-AC-03 | Baseline screenshots and protected behaviors are recorded. | pass | `trials/vertical-slice-01/baseline.md`, `trials/vertical-slice-01/baseline/` | | |
| P1-AC-04 | Acceptance criteria are specific enough to produce pass/fail evidence. | pass | `trials/vertical-slice-01/acceptance-criteria.md` | | |
| P1-AC-05 | No required trial architecture file retains scaffold-only wording. | pass | `standards/reference-architecture/*.md` | | |
| P1-AC-06 | No required handoff file retains scaffold-only wording. | pass | `standards/copilot-handoff/*.md` | | |
| P1-AC-07 | The exact three input files are defined. | pass | `standards/copilot-handoff/three-file-upload-strategy.md` | | |
| P1-AC-08 | Each input file has a complete artifact contract. | pass | `standards/copilot-handoff/contracts/` | | |
| P1-AC-09 | The overlay contract defines repo-relative changed/new files only. | pass | `standards/copilot-handoff/contracts/ui-overlay-contract.md` | | |
| P1-AC-10 | Context exclusions are deterministic and reviewable. | pass | `standards/copilot-handoff/context-exclusions.md` | | |
| P1-AC-11 | Overlay hard blockers and warnings are distinct. | pass | `standards/copilot-handoff/overlay-safety.md` | | |
| P1-AC-12 | The implementation prompt has no unresolved placeholders. | pass | `standards/prompts/implementation-prompt.md` | | |
| P1-AC-13 | The review prompt has no unresolved placeholders. | pass | `standards/prompts/review-prompt.md` | | |
| P1-AC-14 | Every included standard excerpt is traceable to stable IDs. | pass | contracts and prompts | | |
| P1-AC-15 | The approved visual reference is labeled and cited. | pass | `trials/vertical-slice-01/target-selection.md`, visual-reference strategy/contract | | |
| P1-AC-16 | Trial measurements and failure classifications are defined. | pass | `standards/validation/evidence-first-trial-measurement.md` | | |
| P1-AC-17 | A reviewer can handcraft the packet without reading the full chat history. | pass | handoff docs, contracts, trial records | | |
| P1-AC-18 | Both existing standards validators still pass. | pass | `trials/vertical-slice-01/phase-1-readiness-result.md` | | |
| P1-AC-19 | No reusable core library or Electron code has been introduced. | pass | repository tree / readiness result | | |
| P1-AC-20 | The readiness checklist contains no blockers. | pass | this file | | |

## Review Gates

| Gate | Result | Evidence |
|---|---|---|
| Gate A — Target Safety | pass | disposable target app builds and is fully reviewable |
| Gate B — Contract Completeness | pass | three inputs and overlay contracts complete |
| Gate C — Scope Discipline | pass | only trial-critical architecture, handoff, safety, prompts, and records authored |
| Gate D — Safety | pass | context exclusions and overlay blockers/warnings explicit |
| Gate E — Trial Reproducibility | pass | trial records and contracts support second-person packet preparation |

## Readiness Decision

Ready for Phase 2 packet handcrafting when every `P1-AC-*` item is `pass` and no
blocker owner is assigned.

Not ready if any blocking item is `fail` or `unchecked`.
