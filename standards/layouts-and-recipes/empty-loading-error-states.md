# Empty, Loading, and Error States

## Purpose

This file defines reusable state patterns for empty, loading, error, partial, stale, and blocked UI regions.

## Scope

State patterns apply to pages, panels, tables, charts, fields, overlays, workflows, and generated outputs.

## Empty State Pattern

An empty state shall say what is missing, why the region is empty where known, and the next action if one exists. It shall not imply success.

## Loading State Pattern

Loading state shall identify the affected region and operation. Long operations shall include job status, progress where truthful, or a persistent activity log.

## Skeleton Pattern

Skeletons may preserve layout during short loading. They shall not replace progress or status for long-running engineering operations.

## Error State Pattern

Errors shall identify what failed, affected artifact/source, likely cause where known, and next action where known.

## Partial Data Pattern

Partial data state shall clearly identify what is shown and what failed or remains unavailable.

## Offline/Stale Data Pattern

Stale data shall be labeled as stale or out of date and shall identify the source/change that caused staleness where known.

## Blocked State Pattern

Blocked state shall list the prerequisite that prevents progress and link to the location where the issue can be fixed.

## Accessibility Notes

State changes that affect task progress should be announced or reachable. Spinner-only state is insufficient for long operations.

## Approved State Patterns

- Empty panel with next action.
- Table error row with affected source and retry action.
- Stale preview banner with regeneration action.
- Blocked workflow state with validation summary.

## Rejected State Patterns

- Blank panels.
- Spinner-only long operation.
- `Something went wrong` without cause or next action.
- Color-only failed state.
