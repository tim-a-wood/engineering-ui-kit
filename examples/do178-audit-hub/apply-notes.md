# Apply notes — ui-overlay.zip (iteration: reviewer feedback)

## Feedback addressed

**"Workbench preview cannot start the applied app because the package manifest
has no npm start command."**

`package.json` now includes `"start": "vite"` as the first script. The Vite
dev server configuration delivered previously (`vite.config.ts`) already pins
`host: '127.0.0.1'`, `port: 4182`, `strictPort: true`, so `npm start` serves
the app at exactly `http://127.0.0.1:4182`.

## Change set

- `package.json` — one line added (the `start` script). No dependency,
  version, or other script changes; the existing `dev`, `build`, `typecheck`,
  `test`, and `preview` scripts are untouched.
- `apply-notes.md` — this file.

All other previously delivered files are intentionally absent from this
archive and remain untouched. No application code, styling, routes, data
shapes, or behavior changed.

Local verification after application remains required:
`npm run typecheck`, `npm run build`, then `npm start` (port 4182).
