#!/usr/bin/env python3
"""Mechanical Phase 3 validation for the Engineering UI Kit standards package.

This script checks file presence, JSON parseability, metadata, required headings,
component prose coverage, and obvious stale scaffold wording. It does not validate
visual quality, accessibility compliance, or prose correctness.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    'README.md', 'package-metadata.json', 'tokens.json', 'component-manifest.json',
    'foundation/principles.md', 'foundation/visual-language.md', 'foundation/tokens.md',
    'foundation/accessibility.md', 'foundation/content-and-language.md', 'foundation/interaction-model.md',
    'components/manifest.md', 'components/component-specs.md', 'components/forms.md',
    'components/tables.md', 'components/navigation.md', 'components/feedback-and-status.md',
    'components/overlays-and-dialogs.md', 'components/data-visualization.md',
    'layouts-and-recipes/application-shell.md', 'layouts-and-recipes/dashboard-layouts.md',
    'layouts-and-recipes/detail-pages.md', 'layouts-and-recipes/workflow-pages.md',
    'layouts-and-recipes/split-panel-layouts.md', 'layouts-and-recipes/empty-loading-error-states.md',
    'examples/approved-patterns.md', 'examples/rejected-patterns.md',
    'examples/component-examples.md', 'examples/page-examples.md',
    'validation/ui-compliance-rubric.md', 'validation/accessibility-checklist.md',
    'validation/visual-drift-checklist.md', 'validation/component-completeness-checklist.md',
    'validation/implementation-readiness-checklist.md',
    'validation/phase-3-core-standards-validation-checklist.md',
    'validation/phase-3-validation-result-template.md',
    'validation/evidence-first-trial-measurement.md',
    'validation/evidence-first-trial-readiness-checklist.md',
    'reference-architecture/frontend-architecture.md',
    'reference-architecture/styling-and-theming.md',
    'reference-architecture/state-and-data-flow.md',
    'reference-architecture/file-and-folder-conventions.md',
    'copilot-handoff/README.md',
    'copilot-handoff/handoff-model.md',
    'copilot-handoff/three-file-upload-strategy.md',
    'copilot-handoff/implementation-instructions.md',
    'copilot-handoff/review-instructions.md',
    'copilot-handoff/visual-reference-strategy.md',
    'copilot-handoff/context-exclusions.md',
    'copilot-handoff/overlay-safety.md',
    'copilot-handoff/contracts/README.md',
    'copilot-handoff/contracts/repo-flatfile-contract.md',
    'copilot-handoff/contracts/task-packet-contract.md',
    'copilot-handoff/contracts/standards-pack-contract.md',
    'copilot-handoff/contracts/task-and-standard-pack-contract.md',
    'copilot-handoff/contracts/visual-reference-pack-contract.md',
    'copilot-handoff/contracts/ui-overlay-contract.md',
    'prompts/implementation-prompt.md',
    'prompts/review-prompt.md',
]

TRIAL_CRITICAL_HEADINGS = {
    'reference-architecture/frontend-architecture.md': [
        '# Frontend Architecture', '## Purpose', '## Scope', '## Controlling Decisions',
        '## Required Architecture', '## Allowed Patterns', '## Prohibited Patterns',
        '## Trial Application', '## Validation Checks', '## Traceability',
    ],
    'reference-architecture/styling-and-theming.md': [
        '# Styling and Theming Architecture', '## Purpose', '## Scope', '## Controlling Decisions',
        '## Required Architecture', '## Allowed Patterns', '## Prohibited Patterns',
        '## Trial Application', '## Validation Checks', '## Traceability',
    ],
    'reference-architecture/state-and-data-flow.md': [
        '# State and Data Flow', '## Purpose', '## Scope', '## Controlling Decisions',
        '## Required Architecture', '## Allowed Patterns', '## Prohibited Patterns',
        '## Trial Application', '## Validation Checks', '## Traceability',
    ],
    'reference-architecture/file-and-folder-conventions.md': [
        '# File and Folder Conventions', '## Purpose', '## Scope', '## Controlling Decisions',
        '## Required Architecture', '## Allowed Patterns', '## Prohibited Patterns',
        '## Trial Application', '## Validation Checks', '## Traceability',
    ],
    'copilot-handoff/handoff-model.md': [
        '# Handoff Model', '## Purpose', '## Scope', '## Controlling Decisions',
        '## Required Architecture', '## Allowed Patterns', '## Prohibited Patterns',
        '## Trial Application', '## Validation Checks', '## Traceability',
    ],
    'copilot-handoff/contracts/repo-flatfile-contract.md': [
        '# Repo Flatfile Contract', '## Purpose', '## Producer', '## Consumer',
        '## Required Structure', '## Required Metadata', '## Size and Scope Constraints',
        '## Validation Rules', '## Prohibited Content', '## Minimal Valid Example',
        '## Invalid Example', '## Traceability',
    ],
    'copilot-handoff/contracts/task-packet-contract.md': [
        '# Task Packet Contract', '## Purpose', '## Producer', '## Consumer',
        '## Required Structure', '## Required Metadata', '## Size and Scope Constraints',
        '## Validation Rules', '## Prohibited Content', '## Minimal Valid Example',
        '## Invalid Example', '## Traceability',
    ],
    'copilot-handoff/contracts/standards-pack-contract.md': [
        '# Standards Pack Contract', '## Purpose', '## Producer', '## Consumer',
        '## Required Structure', '## Required Metadata', '## Size and Scope Constraints',
        '## Validation Rules', '## Prohibited Content', '## Minimal Valid Example',
        '## Invalid Example', '## Traceability',
    ],
    'copilot-handoff/contracts/task-and-standard-pack-contract.md': [
        '# Combined Task and Standards Pack Contract', '## Purpose', '## Producer', '## Consumer',
        '## Required Structure', '## Required Metadata', '## Size and Scope Constraints',
        '## Validation Rules', '## Prohibited Content', '## Minimal Valid Example',
        '## Invalid Example', '## Traceability',
    ],
    'copilot-handoff/contracts/visual-reference-pack-contract.md': [
        '# Visual Reference Pack Contract', '## Purpose', '## Producer', '## Consumer',
        '## Required Structure', '## Required Metadata', '## Size and Scope Constraints',
        '## Validation Rules', '## Prohibited Content', '## Minimal Valid Example',
        '## Invalid Example', '## Traceability',
    ],
    'copilot-handoff/contracts/ui-overlay-contract.md': [
        '# UI Overlay Contract', '## Purpose', '## Producer', '## Consumer',
        '## Required Structure', '## Required Metadata', '## Size and Scope Constraints',
        '## Validation Rules', '## Prohibited Content', '## Minimal Valid Example',
        '## Invalid Example', '## Traceability',
    ],
    'prompts/implementation-prompt.md': [
        '# Implementation Prompt', '## Canonical Variable Markers', '## Canonical Prompt',
        '## Vertical Slice 01 Substituted Dry Run',
    ],
    'prompts/review-prompt.md': [
        '# Review Prompt', '## Canonical Variable Markers', '## Canonical Prompt',
        '## Vertical Slice 01 Substituted Dry Run',
    ],
    'validation/evidence-first-trial-measurement.md': [
        '# Evidence-First Trial Measurement', '## Measurement Table',
    ],
    'validation/evidence-first-trial-readiness-checklist.md': [
        '# Evidence-First Trial Readiness Checklist', '## Checklist', '## Review Gates',
        '## Readiness Decision',
    ],
}

TRIAL_CRITICAL_PATTERNS = {
    'reference-architecture/frontend-architecture.md': r'ARCH-FE-\d{3}',
    'reference-architecture/styling-and-theming.md': r'ARCH-THEME-\d{3}',
    'reference-architecture/state-and-data-flow.md': r'ARCH-STATE-\d{3}',
    'reference-architecture/file-and-folder-conventions.md': r'ARCH-FILE-\d{3}',
    'copilot-handoff/handoff-model.md': r'AI-HANDOFF-\d{3}',
    'copilot-handoff/implementation-instructions.md': r'AI-IMPL-\d{3}',
    'copilot-handoff/review-instructions.md': r'AI-REVIEW-\d{3}',
    'copilot-handoff/visual-reference-strategy.md': r'AI-VIS-\d{3}',
    'prompts/implementation-prompt.md': r'\{\{PROJECT_NAME\}\}',
    'prompts/review-prompt.md': r'\{\{ACCEPTANCE_CRITERIA\}\}',
}

REQUIRED_HEADINGS = {
    'foundation/principles.md': ['# Foundation Principles','## Purpose','## Scope','## Source Inputs','## Principles Summary','## FND-PRI-001 — Engineering workbench over generic dashboard','## FND-PRI-010 — Mockups calibrate visual direction but do not exhaust the standard','## Approved Patterns','## Rejected Patterns','## Traceability Notes'],
    'foundation/visual-language.md': ['# Visual Language','## Visual Direction Summary','## FND-VIS-001 — Dark-first surface hierarchy','## FND-VIS-010 — What visual drift looks like','## Approved Visual Patterns','## Rejected Visual Patterns','## Mockup Calibration Notes'],
    'foundation/tokens.md': ['# Tokens','## Token Contract Source','## FND-TOK-001 — Use semantic tokens in component and page guidance','## FND-TOK-015 — Chart tokens','## Token Reference Syntax','## Component Alias Usage','## Token Review Checklist'],
    'foundation/accessibility.md': ['# Accessibility','## Authority','## FND-A11Y-001 — WCAG 2.2 AA target','## FND-A11Y-012 — Target sizes and dense UI exceptions','## Component Accessibility Matrix','## Accessibility Anti-Patterns','## Accessibility Validation Notes'],
    'foundation/content-and-language.md': ['# Content and Language','## FND-CONTENT-001 — Use direct engineering language','## FND-CONTENT-009 — Confirmation copy','## Approved Copy Examples','## Rejected Copy Examples'],
    'foundation/interaction-model.md': ['# Interaction Model','## FND-INT-001 — Manual control for consequential actions','## FND-INT-010 — Toasts, alerts, and persistent feedback','## Interaction Anti-Patterns'],
    'components/manifest.md': ['# Component Manifest','## Manifest Source','## Coverage Classification Definitions','## Category Definitions','## Component ID Stability Rules','## Phase 3 Authoring Depth Rules','## Component-to-Document Map','## Reserved Component Rule'],
    'components/component-specs.md': ['# Component Specifications','## Component Spec Template','## Shared Component Rules','## Action Components','## Surface Components','## Content Components','## Status Components','## Workflow Components','## Engineering Artifact Components','## Code and Log Components','## Reserved Component Notes','## Component Compliance Checklist'],
    'components/forms.md': ['# Forms','## Form Field Anatomy','## Text Input','## Number Input','## Select','## Combobox','## Textarea','## Checkbox','## Radio Group','## Switch','## Date Time Input','## File Dropzone','## Validation Summary','## Accessibility Rules','## Approved Form Patterns','## Rejected Form Patterns'],
    'components/tables.md': ['# Tables','## Table vs Data Grid Decision Rule','## Data Table Anatomy','## Column Headers','## Sorting','## Filtering','## Selection','## Row Actions','## Pagination','## Empty, Loading, Error, and Partial Data States','## Engineering Data Density','## Accessibility Rules','## Approved Table Patterns','## Rejected Table Patterns'],
    'components/navigation.md': ['# Navigation','## Primary Navigation','## Secondary Navigation','## Breadcrumbs','## Command Action Bar','## Tabs and Local Navigation','## Navigation State','## Accessibility Rules','## Approved Navigation Patterns','## Rejected Navigation Patterns'],
    'components/feedback-and-status.md': ['# Feedback and Status','## Status Vocabulary','## Status Badge','## Job Status Indicator','## Loading State','## Error State','## Alert','## Toast','## Progress Indicator','## Validation Summary','## Persistent vs Temporary Feedback','## Accessibility Rules','## Approved Feedback Patterns','## Rejected Feedback Patterns'],
    'components/overlays-and-dialogs.md': ['# Overlays and Dialogs','## Dialog','## Confirmation Dialog','## Drawer','## Popover','## Tooltip','## Context Menu','## Overlay Layering','## Dismissal Rules','## Focus Management','## Accessibility Rules','## Approved Overlay Patterns','## Rejected Overlay Patterns'],
    'components/data-visualization.md': ['# Data Visualization','## Chart Selection Rules','## Chart Panel','## Line Chart','## Bar Chart','## Legend','## Chart Tooltip','## Threshold Band','## Chart States','## Status and Severity in Charts','## Accessibility Rules','## Approved Chart Patterns','## Rejected Chart Patterns'],
    'layouts-and-recipes/application-shell.md': ['# Application Shell','## LAY-SHELL-001 — Standard engineering app shell','## Persistent Regions','## Page Header Rules','## Navigation Region Rules','## Main Content Region Rules','## Command and Status Regions','## Density Rules','## Responsive Behavior','## Accessibility Notes','## Approved Shell Pattern','## Rejected Shell Patterns'],
    'layouts-and-recipes/dashboard-layouts.md': ['# Dashboard Layouts','## RCP-DASH-001 — Engineering dashboard','## Metric Card Use','## Status Summary Use','## Chart Panel Use','## Table Summary Use','## Empty/Loading/Error States','## Density and Responsiveness','## Accessibility Notes','## Approved Dashboard Pattern','## Rejected Dashboard Patterns'],
    'layouts-and-recipes/detail-pages.md': ['# Detail Pages','## RCP-DETAIL-001 — Entity detail page','## Header and Metadata Region','## Primary Detail Region','## Supporting Evidence Region','## Related Items Region','## Actions','## State Handling','## Accessibility Notes','## Approved Detail Pattern','## Rejected Detail Patterns'],
    'layouts-and-recipes/workflow-pages.md': ['# Workflow Pages','## RCP-WORKFLOW-001 — Multi-step engineering workflow','## Step Indicator Use','## Current Step Region','## Preview and Review Region','## Command/Action Region','## Status and Evidence Region','## Error and Blocked States','## Accessibility Notes','## Approved Workflow Pattern','## Rejected Workflow Patterns'],
    'layouts-and-recipes/split-panel-layouts.md': ['# Split Panel Layouts','## RCP-SPLIT-001 — List/detail split panel','## RCP-SPLIT-002 — Compare/review split panel','## Panel Roles','## Resize Rules','## Selection State','## Empty and Error States','## Accessibility Notes','## Approved Split Panel Pattern','## Rejected Split Panel Patterns'],
    'layouts-and-recipes/empty-loading-error-states.md': ['# Empty, Loading, and Error States','## Empty State Pattern','## Loading State Pattern','## Skeleton Pattern','## Error State Pattern','## Partial Data Pattern','## Offline/Stale Data Pattern','## Blocked State Pattern','## Accessibility Notes','## Approved State Patterns','## Rejected State Patterns'],
    'examples/approved-patterns.md': ['# Approved Patterns','## EX-APPROVED-001 — Dark engineering app shell','## EX-APPROVED-007 — Empty state with next action','## Traceability'],
    'examples/rejected-patterns.md': ['# Rejected Patterns','## EX-REJECTED-001 — Generic SaaS dashboard drift','## EX-REJECTED-007 — Unstructured dense technical page','## Traceability'],
    'validation/ui-compliance-rubric.md': ['# UI Compliance Rubric','## Rating Model','## Blocking Failures','## VAL-UI-001 — Source alignment','## VAL-UI-010 — AI handoff suitability','## Review Procedure','## Result Template'],
    'validation/accessibility-checklist.md': ['# Accessibility Checklist','## Keyboard','## Focus','## Semantics','## Forms','## Tables and Data Grids','## Overlays','## Status and Feedback','## Charts','## Motion','## Content','## Result Classification'],
    'validation/visual-drift-checklist.md': ['# Visual Drift Checklist','## Dark-First Drift','## Generic Dashboard Drift','## Token Drift','## Mockup Traceability Drift','## Result Classification'],
    'validation/component-completeness-checklist.md': ['# Component Completeness Checklist','## Manifest Coverage','## Component Spec Coverage','## Token Reference Coverage','## State Coverage','## Accessibility Coverage','## Example Coverage','## Reserved Component Honesty','## Result Classification'],
    'validation/implementation-readiness-checklist.md': ['# Implementation Readiness Checklist','## Standards Readiness','## Contract Readiness','## Minimum Trial Contract','## Validation Readiness','## Known Deferrals Before the Trial','## Readiness Decision'],
    'validation/phase-3-core-standards-validation-checklist.md': ['# Phase 3 Core Standards Validation Checklist','## Gate A — Baseline integrity','## Gate N — Evidence-first trial readiness','## Result Summary'],
    'validation/phase-3-validation-result-template.md': ['# Phase 3 Validation Result','## Package Reviewed','## Validation Date','## Validator','## Summary Verdict','## Gate Results','## Blockers','## Warnings','## Notes','## Corrective Actions','## Evidence-First Trial Readiness Recommendation'],
}

STALE_PHRASES = [
    'This Phase 1 file is a scaffold',
    'Phase 1 scaffold',
    'Phase 2 placeholder',
    'Open Placeholders',
    'TODO',
    'TBD',
]

errors: list[str] = []
warnings: list[str] = []

def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')

# Required files and substantive length.
for rel in REQUIRED_FILES:
    path = ROOT / rel
    if not path.exists():
        errors.append(f'missing required file: {rel}')
        continue
    text = path.read_text(encoding='utf-8')
    if rel.endswith('.md') and len(text.strip()) < 500:
        errors.append(f'file appears too short to be authored: {rel}')

# JSON parseability and metadata.
for rel in ['package-metadata.json', 'tokens.json', 'component-manifest.json', 'schemas/tokens.schema.json', 'schemas/component-manifest.schema.json']:
    try:
        json.loads(read(rel))
    except Exception as exc:
        errors.append(f'invalid JSON {rel}: {exc}')

try:
    metadata = json.loads(read('package-metadata.json'))
    if metadata.get('packageVersion') != '0.4.0':
        errors.append('package-metadata.json packageVersion is not 0.4.0')
    if metadata.get('phase') != 'Phase 4 — Operational Revision After Evidence-First Trial':
        errors.append('package-metadata.json phase is not Phase 4 — Operational Revision After Evidence-First Trial')
    if metadata.get('status') != 'operational-handoff-package-v0.1':
        errors.append('package-metadata.json status is not operational-handoff-package-v0.1')
    if metadata.get('themePosture') != 'dark-first':
        errors.append('themePosture is not dark-first')
except Exception:
    pass

# Required headings.
for rel, headings in {**REQUIRED_HEADINGS, **TRIAL_CRITICAL_HEADINGS}.items():
    if not (ROOT / rel).exists():
        continue
    text = read(rel)
    for heading in headings:
        if heading not in text:
            errors.append(f'missing heading in {rel}: {heading}')

# Trial-critical rule ID and marker patterns.
for rel, pat in TRIAL_CRITICAL_PATTERNS.items():
    if not (ROOT / rel).exists():
        continue
    if not re.search(pat, read(rel)):
        errors.append(f'missing trial-critical pattern {pat} in {rel}')

# Three-file variants must remain consistent.
three_file_docs = [
    'copilot-handoff/three-file-upload-strategy.md',
    'copilot-handoff/handoff-model.md',
    'copilot-handoff/contracts/README.md',
]
for rel in three_file_docs:
    text = read(rel)
    for required in [
        'repo-flatfile.txt',
        'task-packet.md',
        'standards-pack.md',
        'task-and-standard-pack.md',
        'visual-reference-pack.pdf',
        'ui-overlay.zip',
    ]:
        if required not in text:
            errors.append(f'missing three-file artifact name in {rel}: {required}')

# Stale scaffold phrases in Phase 3 authored files.
for rel in REQUIRED_FILES:
    if not rel.endswith('.md') or not (ROOT / rel).exists():
        continue
    text = read(rel)
    for phrase in STALE_PHRASES:
        if phrase in text:
            errors.append(f'stale scaffold phrase in {rel}: {phrase}')

# Component coverage.
manifest = json.loads(read('component-manifest.json'))
component_ids = [c['id'] for c in manifest.get('components', [])]
component_doc_text = '\n'.join(read(rel) for rel in [
    'components/manifest.md', 'components/component-specs.md', 'components/forms.md',
    'components/tables.md', 'components/navigation.md', 'components/feedback-and-status.md',
    'components/overlays-and-dialogs.md', 'components/data-visualization.md',
])
for cid in component_ids:
    if cid not in component_doc_text:
        errors.append(f'manifest component ID missing from authored docs: {cid}')

for c in manifest.get('components', []):
    if 'reserved-for-future-validation' in c.get('coverage', []):
        marker = f'## {c["id"]} — {c["name"]}'
        idx = component_doc_text.find(marker)
        if idx < 0:
            errors.append(f'reserved component spec missing: {c["id"]}')
        else:
            section = component_doc_text[idx: idx + 3500]
            if 'reserved' not in section.lower() or 'not implement' not in section.lower():
                errors.append(f'reserved component lacks explicit deferral: {c["id"]}')

# Rule ID prefixes.
prefix_checks = {
    'foundation/principles.md': r'FND-PRI-\d{3}',
    'foundation/visual-language.md': r'FND-VIS-\d{3}',
    'foundation/tokens.md': r'FND-TOK-\d{3}',
    'foundation/accessibility.md': r'FND-A11Y-\d{3}',
    'foundation/content-and-language.md': r'FND-CONTENT-\d{3}',
    'foundation/interaction-model.md': r'FND-INT-\d{3}',
    'layouts-and-recipes/application-shell.md': r'LAY-SHELL-\d{3}',
    'layouts-and-recipes/dashboard-layouts.md': r'RCP-DASH-\d{3}',
    'layouts-and-recipes/detail-pages.md': r'RCP-DETAIL-\d{3}',
    'layouts-and-recipes/workflow-pages.md': r'RCP-WORKFLOW-\d{3}',
    'layouts-and-recipes/split-panel-layouts.md': r'RCP-SPLIT-\d{3}',
    'examples/approved-patterns.md': r'EX-APPROVED-\d{3}',
    'examples/rejected-patterns.md': r'EX-REJECTED-\d{3}',
    'validation/ui-compliance-rubric.md': r'VAL-UI-\d{3}',
}
for rel, pat in prefix_checks.items():
    if not re.search(pat, read(rel)):
        errors.append(f'missing rule ID pattern {pat} in {rel}')

# Obvious raw color values in authored component docs.
hex_pat = re.compile(r'#[0-9a-fA-F]{3,8}\b')
for rel in ['components/component-specs.md','components/forms.md','components/tables.md','components/navigation.md','components/feedback-and-status.md','components/overlays-and-dialogs.md','components/data-visualization.md']:
    if hex_pat.search(read(rel)):
        errors.append(f'raw hex color found in authored component doc: {rel}')

if warnings:
    for w in warnings:
        print(f'WARNING: {w}')

if errors:
    for e in errors:
        print(f'ERROR: {e}')
    print(f'FAIL errors={len(errors)} warnings={len(warnings)}')
    sys.exit(1)

print(f'PASS files={len(REQUIRED_FILES)} components={len(component_ids)} warnings={len(warnings)}')
