# Daybook v2 interactive mockup

This folder contains the v2 interactive mockup of Daybook. The mockup shows
the intended desktop product with the PRD Section 7 reference fixture: the
Rowan & Foxes Reception class, the week of 12 to 16 October 2026, and five
different lesson types. It is a visual representation of the final product.
It does not implement the full product.

## Open the mockup

Open `index.html` in a desktop browser. No build step and no dependencies
are necessary. The top bar has Fit view, zoom out, and zoom in controls for
inspection on a narrow screen.

## What the mockup contains

- The five workspaces on the bottle-green rail: Week Book, Plans, Classroom,
  Resources, and Reflections.
- The Week Book planning sheet with flexible phases, the classroom-setup tab,
  and the resources tab for each of the five reference lessons.
- The half-term map with week focus, curriculum threads, and the plan library.
- A selectable room plan with area invitations, readiness, adult deployment,
  and linked plans.
- Resource packs with physical checklists, printable provenance labels, and a
  working print queue count.
- Three completed reflections with child voice, Keep, Change, and Try Next
  decisions, a team response, and attached carry-forward decisions.
- Teaching View with a working phase timer: start, pause, add two minutes,
  phase change resets to the planned duration, and quick notes with a
  phase-relative time stamp.

## What is real and what is simulated

- The timer, the phase navigation, the quick notes, the readiness toggles,
  the print-queue counts, and the planned-duration totals are computed by the
  running page.
- Persistence, sharing, printing, autosave, and collaboration are simulated.
  The simulation defines the intended interaction shape, not the
  implementation.
- All names in the fixture are pseudonyms from the PRD reference week.

## Limits

- Controls marked with a tooltip are not functional.
- The mockup follows the repository writing profile based on ASD-STE100 for
  interface text, with American spellings. The PRD change record holds the
  open decision on British spellings for the England market.
