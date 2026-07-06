# Engineering UI Kit

A dark-first engineering UI standard plus a local desktop workbench for preparing,
applying, and verifying **Microsoft 365 Copilot UI handoffs** — built evidence-first:
every phase gated on a real, measured trial rather than documentation alone.

**The workflow in one line:** package a repo and task into a strict three-file
Copilot upload → receive a `ui-overlay.zip` of changed files → inspect it against
deterministic safety rules → apply it non-destructively → verify with your own
build commands → approve or iterate.

## What's in the box

| Piece | What it is |
|---|---|
| `standards/` | The standards package (v0.4.0): dark-first visual language, 84 semantic token leaves, 68-component manifest, reference architecture, Copilot handoff contracts, prompts, and validation checklists |
| `packages/core` | GUI-independent workflow library + CLI: repo flatfile builder with deterministic exclusions, packet builders, zip-overlay inspector (hard blockers AI-HANDOFF-030…039), non-destructive applier, verification runner, persistence — 44 tests |
| `apps/desktop` | Electron main + sandboxed preload exposing a narrow typed IPC bridge (no generic filesystem access) |
| `apps/gui` | React renderer: five-step handoff workflow, task templates, recipes, component reference, projects, settings |
| `trials/` | The evidence-first vertical-slice trial records (13/13 blocking acceptance criteria) |

Front-end completeness is documented element-by-element in
[`apps/gui/AUDIT-MANIFEST.md`](apps/gui/AUDIT-MANIFEST.md); end-to-end evidence
(screenshots + machine-readable check results) lives in
`apps/desktop/validation-evidence/` and `apps/gui/validation-evidence/`.

## Installation

### Prerequisites

- **Node.js 20+** and npm 10+ (`node --version`)
- **Git**
- macOS, Windows, or Linux. (Python 3.10+ is only needed if you want to run the
  standards validators.)

### 1. Clone and install

```bash
git clone https://github.com/tim-a-wood/engineering-ui-kit.git
cd engineering-ui-kit
npm install
```

`npm install` downloads the Electron binary via its postinstall step. If your npm
configuration blocks lifecycle scripts, run it explicitly afterwards:

```bash
node node_modules/electron/install.js
```

### 2. Build

```bash
npm run build --workspaces
```

This compiles the core library (`packages/core/dist`), the Electron main/preload
(`apps/desktop/dist`), and the renderer bundle (`apps/gui/dist`).

### 3. Launch the workbench

```bash
npx electron apps/desktop
```

First run opens the Copilot Handoff Hub. Click **+ New Project**, point it at a
React/Vite/TypeScript repo, and the handoff starts immediately:

1. **Prepare Context** — builds `repo-flatfile.txt` + `repo-inventory.json` with
   deterministic exclusions (git metadata, dependencies, build output, binaries,
   env/secret files never leave your machine). Review the context summary and
   warnings before continuing.
2. **Create Task Packet** — pick a task template (standards refresh, new UI from
   requirements, new UI on an existing API, monolithic web app, add a screen) or a
   screen recipe, tweak the sections, preview the rendered packet, export.
3. **Run in Copilot** — Show Files in Folder, open Microsoft 365 Copilot, upload
   the three files (strict budget), paste the recommended prompt, download
   `ui-overlay.zip`.
4. **Apply Zip Overlay** — the inspector blocks unsafe archives outright (absolute
   paths, traversal, `.git`, dependencies, secrets, repo dumps); warnings require
   your explicit acceptance; nothing is ever deleted.
5. **Verify & Review** — run your project's typecheck/build, launch the app,
   capture feedback, generate a Copilot review packet, approve or iterate.

All run artifacts persist under the app's user-data workspace in typed JSON shapes.

### Development mode

```bash
npm run dev --workspace @engineering-ui-kit/gui   # renderer at http://localhost:5300 with an in-memory mock bridge
npm test  --workspace @engineering-ui-kit/core    # 44 unit/fixture tests (hostile-zip fixtures included)
node packages/core/scripts/reproduce-trial.mjs    # replays the vertical-slice trial via library calls
```

To run Electron against the dev server: `EUIK_DEV_SERVER_URL=http://localhost:5300 npx electron apps/desktop`.

### Standards validation (optional)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python standards/validation/validate-phase-2-contracts.py
.venv/bin/python standards/validation/validate-phase-3-standards.py
```

### Packaging (Windows-first)

`apps/desktop/electron-builder.yml` defines NSIS + zip targets. On Windows:

```powershell
npm install; npm run build --workspaces
npx electron-builder --config apps/desktop/electron-builder.yml --win
```

## Safety posture

- **Strict three-file upload budget** — enforced when packets are built, with a
  SHA-256 manifest per upload set.
- **Deterministic context exclusions** — dependencies, VCS metadata, build output,
  binaries, and env/secret files never enter a flatfile; secret-like content
  patterns surface as review warnings, and the UI reminds you that company policy
  governs what may be uploaded.
- **Overlay inspection before extraction** — nine hard-blocker classes refuse
  unsafe archives before a single byte is written; overwrites demand explicit
  acceptance; file absence never means deletion.
- **Narrow IPC boundary** — the renderer is sandboxed with `contextIsolation`; every
  privileged operation is a specific typed method.

## Evidence

The project gates on measured trials, not claims:

- Vertical-slice trial: 13/13 blocking acceptance criteria, zero manual corrections
  ([`trials/vertical-slice-01/phase-3/phase-3-trial-report.md`](trials/vertical-slice-01/phase-3/phase-3-trial-report.md))
- Core library reproduces the trial GUI-free (6/6 steps)
- Real-app end-to-end walkthroughs: first-run 23/23, audit pass 18/18, template
  flow 10/10 (JSON results beside the screenshots in `validation-evidence/`)

## Repository notes

Internal planning sources (PRD, research, phase specifications, decision log, and
the approved hi-fi mockups) are intentionally kept outside this repository; the
standards package in `standards/` is the public contract derived from them. The
Phase 2 visual-reference pack artifacts are withheld for the same reason (their
hashes remain recorded in the trial evidence).

No license has been granted yet — all rights reserved until a license file is added.
