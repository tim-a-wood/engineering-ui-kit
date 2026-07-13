# Redesign task: Build workspace as the primary working surface

## Problem

The consolidated Build page is functionally complete but visually reads like a narrow side rail stretched to full width. The workspace lacks a strong task-focused composition, leaves large areas of unused horizontal space, and gives Handoff/Copilot/Overlay equal tab treatment even though they form a progressive sequence.

Before evidence: `apps/gui/validation-evidence/two-step-build/build-workspace-before.png`.

## Goal

Redesign only the Build page so the Build workspace is a polished, primary desktop working surface. Keep Task Packet and Project Context as modal overlays launched from compact controls. Keep Test unchanged.

## Required capabilities

- Preserve every current Handoff, Copilot, and Overlay action and state.
- Preserve task packet and project context modal contents and state.
- Preserve artifact gating, stale-state behavior, inspection safety, and Test reachability.
- Preserve keyboard-accessible workspace navigation.

## Design requirements

1. Replace the “stretched rail” feeling with a deliberately composed workspace canvas.
2. Treat Handoff → Copilot → Overlay as a clear progressive sequence while allowing backward navigation.
3. Give the active phase a useful page-level layout, not a single column spanning the viewport.
4. Constrain reading-width content and use secondary columns for supporting context/actions.
5. Reduce redundant headings, borders, and large empty bands.
6. Integrate Task Packet and Project Context launchers into the workspace header/toolbar rather than presenting them as two competing full-width cards.
7. Make the primary next action visually obvious in every phase.
8. Keep measured data, file lists, prompts, warnings, and inspection details dense and scannable.
9. Match the existing Engineering UI Kit visual language and semantic tokens.
10. Work at desktop and narrow widths without hiding capability.

## Phase-specific intent

### Handoff

Show readiness as a compact preparation checklist with one dominant next action. Put regeneration, copy, download, and folder actions in a clearly secondary action area.

### Copilot

Use a two-region layout: upload set and transfer actions as the main region; recommended prompt and concise instructions as the supporting region. Avoid a very wide file box. Keep “Open Copilot” dominant and “I have the overlay” as the completion action.

### Overlay

Before selection, center the file-selection task with safety guidance nearby. After inspection, use the main region for verdict/table and a supporting region for file tree/actions. Keep Apply disabled until the existing gate passes.

## Acceptance criteria

- The Build workspace no longer resembles a 350 px rail expanded to page width.
- At 1440–1600 px, content uses space intentionally with no large unexplained blank bands.
- Task Packet and Project Context open as complete modal overlays from compact toolbar controls.
- The active phase and next action are understandable within five seconds.
- All existing Build controls remain reachable.
- Test has no structural or behavioral changes.
- GUI typecheck, tests, and production build pass.
- Capture new desktop evidence beside the before image.
