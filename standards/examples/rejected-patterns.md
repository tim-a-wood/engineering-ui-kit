# Rejected Patterns

## Purpose

Rejected examples define common non-compliant output patterns to avoid.

## How to Use These Examples

Use this file during review. A rejected pattern does not automatically block all similar ideas, but the listed violation must be corrected.

## EX-REJECTED-001 — Generic SaaS dashboard drift

**What is wrong:** White cards, vanity KPIs, decorative charts, and no evidence links.  
**Violates:** `FND-PRI-001`, `FND-VIS-001`, `RCP-DASH-001`.  
**Do instead:** Use dark engineering panels, status/evidence links, and operational summaries.

## EX-REJECTED-002 — Decorative neon/glassmorphism treatment

**What is wrong:** Heavy glow, translucent panels, and gradients obscure hierarchy.  
**Violates:** `FND-VIS-002`, `FND-VIS-006`, `FND-VIS-010`.  
**Do instead:** Use restrained accent/focus tokens and clear surface hierarchy.

## EX-REJECTED-003 — Color-only status

**What is wrong:** Pass/fail conveyed only by red/green color.  
**Violates:** `FND-A11Y-006`, `VAL-UI-008`.  
**Do instead:** Include text labels and accessible status semantics.

## EX-REJECTED-004 — Placeholder-only form fields

**What is wrong:** Inputs have no visible labels and errors are not linked to fields.  
**Violates:** `FND-A11Y-009`, `CMP-FORM-FIELD`.  
**Do instead:** Use labels, hints, and linked error text.

## EX-REJECTED-005 — Spinner-only long operation

**What is wrong:** A long validation run shows only a spinner and no operation context.  
**Violates:** `FND-INT-004`, feedback rules.  
**Do instead:** Show job status, current step, evidence/log link, and completion/failure state.

## EX-REJECTED-006 — Hidden destructive action

**What is wrong:** Delete/overwrite appears only as an unlabeled icon or menu item with no confirmation.  
**Violates:** `FND-INT-001`, `FND-CONTENT-009`, overlay rules.  
**Do instead:** Use explicit destructive labels and confirmation when appropriate.

## EX-REJECTED-007 — Unstructured dense technical page

**What is wrong:** Large technical content is placed in one undifferentiated wall with no headings, panels, status, or actions.  
**Violates:** `FND-PRI-003`, `RCP-DETAIL-001`, `LAY-SHELL-001`.  
**Do instead:** Use panels, section headers, metadata groups, evidence regions, and scoped actions.

## Traceability

Rejected patterns directly reflect anti-drift guardrails from the PRD, Phase 3 implementation spec, accessibility posture, and mockup calibration notes.
