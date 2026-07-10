# Workflow E2E harness

Drives the **real** Electron workbench with Playwright — real preload bridge,
real IPC, real filesystem effects — through the full five-step Copilot
handoff against a target repo under `examples/`. The only simulation is
`EUIK_TEST_MODE`, which answers the two native file pickers from the
environment (`EUIK_TEST_PICK_DIR`, `EUIK_TEST_PICK_ZIP`); every other action
is a genuine click or keystroke on the UI, and every step is screenshotted
into `apps/desktop/validation-evidence/<experiment>/pass-<N>/`.

The Copilot step itself is played by the operator (or an agent): read the
exported upload set from the run directory, author `ui-overlay.zip`, place it
at the path printed by `config.mjs`, then continue.

## A pass

```bash
node apps/desktop/e2e/reset-target.mjs        # target repo → start point
node apps/desktop/e2e/phase-prepare.mjs       # steps 1–3, exports the packet
# … author ui-overlay.zip from the run dir's packet (the Copilot role) …
node apps/desktop/e2e/phase-apply.mjs         # steps 4–5, apply + verify
```

Environment knobs (see `config.mjs`): `PASS` (pass number), `TARGET`
(examples/<dir>), `EXPERIMENT` (evidence directory name), `PROJECT_NAME`,
`PACKET_SCOPE`, `PACKET_REFERENCES`.

The app workspace for a pass lives under the OS temp dir
(`euik-e2e/<experiment>/pass-<N>/workspace`), so experiment runs never touch
the real user-data workspace. Prerequisites: workspaces built
(`npm run build --workspaces`) and Playwright Chromium installed
(`npx playwright install chromium`).
