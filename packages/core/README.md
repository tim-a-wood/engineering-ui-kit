# @engineering-ui-kit/core

GUI-independent core library for the Engineering UI Kit Copilot-handoff workflow
(delivery plan Phase 5). Implements the PRD §28 persisted-artifact contracts and the
overlay-safety standard.

## Modules

| Module | Responsibility |
|---|---|
| `types` | PRD §28 contracts: `Project`, `HandoffRun`, `RepoInventory`, `OverlayInspectionSummary`, `VerificationResult`, `AppliedFiles`, `CompletionSummary`, `Settings` |
| `exclusions` | Deterministic context-exclusion engine + secret-pattern warnings |
| `contextBuilder` / `flatfile` | Repo inventory and contract-conformant repo flatfile build/parse |
| `packetBuilder` | `task-and-standard-pack.md` builder with contract section-order verification |
| `visualPack` | One-page landscape visual-reference PDF builder (Playwright optional) |
| `overlay` | Zip-overlay inspector (AI-HANDOFF-030…047) and non-destructive applier |
| `commandRunner` | Verification commands with timeouts + dev-server lifecycle with explicit port probing |
| `persistence` | App-managed workspace: settings, projects, handoff runs, run artifacts |
| `budget` | Strict three-file upload budget and sha256 packet manifest |

## Commands

```bash
npm run build      # tsc → dist/
npm test           # vitest: 44 tests incl. hostile-zip fixtures
node scripts/reproduce-trial.mjs   # reproduces the Phase 3 trial via library calls
node dist/cli.js   # euik <inventory|flatfile|inspect|apply|verify|manifest>
```

## Safety posture

- Blocked overlays are refused before any extraction; appliers never delete.
- Warned overlays require explicit `acceptWarnings`.
- Hostile zips (absolute paths, traversal, `.git`, `node_modules`, env/keys, repo
  dumps, control characters) are covered by raw-zip fixtures in
  `test/overlay.test.ts` — AdmZip sanitizes names it *writes*, so fixtures are
  crafted with a raw ZIP writer to exercise real attack shapes.
- Flatfile building never reads excluded content; secret-pattern hits surface as
  context warnings and the header keeps the "not secret detection" guarantee.
