# Phase 3 Core Standards Validation Checklist

## Purpose

This checklist validates the Phase 3 core standards package.

## Gate A — Baseline integrity

- Phase 2 package extracted successfully.
- Phase 2 validation passed before Phase 3 edits.
- Required Phase 2 files remain present.

## Gate B — Required files authored

- Required foundation, component, layout, example, and validation files exist.
- Files contain substantive Phase 3 prose.

## Gate C — Scaffold language removed or contained

- Authored files do not retain stale scaffold-only language.
- Historical references, if any, are clearly marked.

## Gate D — Rule IDs present

- Foundation files use `FND-*` rule IDs.
- Component docs use manifest `CMP-*` IDs.
- Layout/recipe docs use `LAY-*` and `RCP-*` IDs.
- Examples use `EX-*` IDs.
- Validation docs use `VAL-*` IDs where applicable.

## Gate E — Token contract preserved

- `tokens.json` parses.
- `tokens.schema.json` parses.
- Dark-first posture preserved.
- No raw-color component guidance introduced.

## Gate F — Component manifest preserved

- `component-manifest.json` parses.
- No manifest components removed.
- Component IDs remain stable.
- Reserved components remain reserved.

## Gate G — Component prose coverage

- Every manifest component appears in component prose.
- Tier 1/2/3 treatments are appropriate.

## Gate H — Layout recipe coverage

- Application shell, dashboard, detail, workflow, split-panel, and state recipes are authored.

## Gate I — Accessibility coverage

- Foundation accessibility and checklist are authored.
- Forms, tables, overlays, charts, and status include accessibility rules.

## Gate J — Visual language coverage

- Dark-first hierarchy, accent discipline, density, and drift rules are clear.

## Gate K — Examples coverage

- Approved and rejected patterns are authored and rule-linked.

## Gate L — Validation coverage

- UI rubric, accessibility, visual drift, component completeness, implementation readiness, Phase 3 checklist, and result template exist.

## Gate M — Overengineering guardrail

- No app implementation, Storybook, website scaffolding, speculative component explosion, or full light-mode system is introduced.

## Gate N — Evidence-first trial readiness

- Core standards are authored.
- Examples and validation checks are available.
- Minimum architecture, handoff, artifact, and safety contracts still require focused
  completion before the trial.
- The mechanical Phase 3 pass does not establish product usefulness or broad
  implementation readiness.

## Result Summary

Use `phase-3-validation-result-template.md` for the final report.
