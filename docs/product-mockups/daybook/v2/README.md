# Daybook v2 interactive mockup

Daybook v2 is the v1 interactive mockup, taken forward. It keeps the v1
source, design language, content, and workspaces without change, and adds a
small set of behaviors from the PRD requirement tables. It is a visual
representation of the intended product. It does not implement the full
product.

## What v2 adds to v1

- **Finish & reflect completes the loop.** The final teaching phase now
  closes Teaching View and opens the reflection for that lesson (TEA-008,
  REF-001).
- **Quick notes are captured, not simulated.** A note field in Teaching View
  saves timestamped notes against the current phase (TEA-009). The captured
  notes appear in a "Notes from teaching" panel beside that lesson's
  reflection.
- **The phase timer gains Add 2 minutes at any time**, and timer expiry
  reads "Time · a prompt, not a rule" (TEA-006, TEA-013).
- **Room display is real.** The Room display action opens a full-screen
  child-facing projection that shows only the approved current-phase prompt,
  with an explicit exit (TEA-011).
- **Carry-forward decisions are visible on the term map.** Week 1 of the
  half-term map marks where the two reflection carry-forwards land (REF-008).

Everything else is v1 as approved.

## Open the mockup

The built copy is in `dist/`. Serve it from any static server:

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://127.0.0.1:8000/`.

To rebuild from source:

```bash
npm install
npx vite build --config vite.pages.config.ts
```

## What is real and what is simulated

The timer, phase navigation, quick notes, readiness toggles, and the
finish-to-reflection flow run in the page. Persistence, sharing, printing,
autosave, and collaboration are simulated, and the simulation defines the
intended interaction shape, not the implementation. All names are pseudonyms
from the PRD reference week.
