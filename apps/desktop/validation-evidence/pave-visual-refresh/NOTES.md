# PAVE Visual refresh — Desktop/pave (latest)

## Mistake corrected

Earlier work targeted `/Users/timwood/Desktop/projects/PWA/PAVE/source/frontend/pwa` (older checkout). Those edits were **reverted**. Do not use that tree for this experiment.

## Correct target

| Item | Value |
|---|---|
| Repo | `/Users/timwood/Desktop/pave` |
| Branch | `remediation/0` @ `909c143` |
| Frontend | `web-client/` (not `web-app/`) |
| UI Kit project | **PAVE Frontend** → `/Users/timwood/Desktop/pave/web-client` |
| Run | `19380b8a-cc5e-4ec2-9c4a-c550126aeff6` |
| Live | http://127.0.0.1:8765/ |

## Workflow

| Step | Status | Notes |
|---|---|---|
| Register / retarget project | Done | Points at Desktop/pave `web-client` |
| Generate context + packet | Done | 71 files included |
| Transform | Done by agent | Agent stand-in for Copilot (not ChatGPT) |
| Inspect overlay | Pass | `canApply: true`; overwrite + dirty-tree warnings |
| Apply overlay | Done | `tokens.css`, `ApplicationStyles.css`, `ApplicationShell.html`, `index.html` |
| Verify runtime | Done | Live tokens + computed styles + screenshot |

## What changed (on `web-client`)

- Added `tokens.css` — Engineering UI Kit semantic token entry (pack v0.5.0)
- Remapped PAVE dark aliases (`--pave-*`, etc.) onto `--semantic-*`
- Linked tokens from shell HTML; cache-bust `euik-desktop-pave-1`
- No controller / backend / behavior changes

## Runtime proof

```json
{
  "canvas": "#07111f",
  "paveBg": "#07111f",
  "bodyBg": "rgb(7, 17, 31)",
  "bodyColor": "rgb(248, 250, 252)"
}
```

Artifacts: `ui-overlay.zip`, `inspection.json`, `applied-files.json`, `seed-summary.json`, `after-visual-refresh.png`, `verify-runtime.json`

Re-run: `node apps/desktop/validation-evidence/pave-visual-refresh/run-desktop-pave-iteration.mjs`

## Remaining gaps

- Some legacy hardcoded colors may remain deeper in the large stylesheet
- Fonts referenced but not bundled; browser falls back to system stacks
- Agent stand-in for Copilot — standards transfer check, not ChatGPT Copilot fidelity
