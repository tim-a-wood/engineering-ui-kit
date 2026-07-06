# Component Examples

## Purpose

These examples are concise sketches of compliant component composition. They are not implementation code.

## Action Examples

```text
CommandActionBar
  Primary: Validate package
  Secondary: Preview handoff
  Quiet: Copy path
  Destructive: Delete generated packet... -> confirmation dialog
```

Compliant because action consequence and hierarchy are visible.

## Surface Examples

```text
Panel: Component coverage
  Header: Component coverage
  Body: compact table
  Footer/status: 68 components documented, 3 reserved
```

Compliant because the panel groups related evidence and uses a clear status line.

## Form Examples

```text
Field: Output folder
  Label: Output folder
  Hint: Generated handoff files are written here.
  Control: text input + Browse
  Error: Select a writable folder before export.
```

Compliant because label, hint, control, and error are distinct.

## Table Examples

```text
DataTable: Validation gates
  Columns: Gate, Status, Evidence, Last checked, Actions
  Status: text badge + icon
  Row action: Open evidence
```

Compliant because status and evidence are inspectable.

## Status Examples

```text
JobStatusIndicator
  Label: Running validation
  Detail: Gate F — Component manifest integrity
  Link: Open log
```

Compliant because progress is specific and persistent.

## Overlay Examples

```text
ConfirmationDialog
  Title: Delete generated packet?
  Body: Removes local generated files only. Standards sources are unchanged.
  Actions: Cancel / Delete packet
```

Compliant because consequence and scope are explicit.

## Chart Examples

```text
ChartPanel
  Title: Validation results by gate
  Summary: 12 passed, 1 warning, 0 blockers
  Chart: bar chart with labeled series
  Fallback: data table link
```

Compliant because chart meaning is available without color or tooltip only.

## Engineering Artifact Examples

```text
EvidenceCard
  Title: Phase 3 validation result
  Status: Passed
  Source: validation/phase-3-validation-result-template.md
  Actions: Open, Copy path
```

Compliant because artifact identity, status, source, and actions are explicit.
