# DO-178C Audit Hub

A reusable ports-and-adapters application for exploring lifecycle evidence,
traceability, reviews, findings, configuration state, and reproducible audit
packages across DO-178C and DO-331 programs.

The product is read-only with respect to authoritative engineering artifacts.
It writes only:

- project connection configuration;
- immutable normalized evidence snapshots;
- append-only Audit Hub reviews, findings, activity, and package records; and
- deterministic ZIP audit packages.

When no real project has a valid published snapshot, the application opens the
bundled **AeroNav Flight Guidance Computer** sample automatically. The sample
contains 508 evidence records, 45 reviews, 12 findings, two baselines, and an
eight-record end-to-end trace chain. Every sample surface and export is marked
as synthetic and not certification evidence.

## Run

From this directory:

```sh
npm run build
npm start
```

The production UI listens on `127.0.0.1:4182` and the capability API on
`127.0.0.1:4183` by default.

Configuration:

- `PORT` or `DO178_AUDIT_HUB_PORT` — UI port.
- `DO178_AUDIT_HUB_API_PORT` — API port.
- `DO178_AUDIT_HUB_DATA_DIR` — local configuration, snapshot, overlay, and
  package directory. The default is `~/.do178-audit-hub`.

For frontend development, run the API with `npm start` and use `npm run dev`;
Vite proxies `/api` to port 4183.

## Supported sources

| Adapter | Authoritative input |
| --- | --- |
| Filesystem | Read-only discovery, path containment, timestamps, sizes, and SHA-256 hashes |
| Git | Commit, branch, revision, and dirty-state provenance |
| MATLAB/Simulink | `.slreqx`, `.slmx`, `.slx`, `.sldd`, `.sldatx`, and `.mldatx` |
| Spreadsheet | Controlled `.xlsx` and `.csv` lifecycle records and trace columns |
| C source | `.c` and `.h` files, functions, includes, LOC, and generated/handwritten classification |
| Review evidence | Review/checklist/approval/audit workbooks and CSV registers |
| Coverage | LCOV, normalized JSON, and Cobertura-style XML reports |
| Objective profile | Program-owned JSON, CSV, or XLSX objective identifiers, applicability, status, and evidence links |

MATLAB-owned sources are extracted through licensed MATLAB APIs when enabled.
For headless or unlicensed environments, a normalized sidecar may be supplied
as either:

- `<artifact>.<extension>.audit-hub.json`;
- `<artifact-without-extension>.audit-hub.json`; or
- `.audit-hub/<artifact-name>.json`.

Sidecars are derivative inputs attributed to the authoritative artifact and
are not published as separate evidence.

The objective-profile adapter intentionally stores no licensed standard text.
A minimal program-owned JSON profile looks like:

```json
{
  "objectives": [
    {
      "id": "PROGRAM-OBJ-001",
      "title": "Program verification objective",
      "phase": "certification",
      "applicable": true,
      "status": "satisfied",
      "evidenceIds": "VERIFICATION-RESULT-001"
    }
  ]
}
```

## Architecture

The approved Engineering UI Kit Capabilities definition is consolidated in
`capabilities/approved/`; generated operation contracts live in
`src/capabilities/generated/`.

The implementation follows explicit ports and adapters:

- `server/domain` — canonical evidence, workspace, diagnostic, and snapshot
  models;
- `server/application` — the 14 approved capability operations, refresh
  validation, trace materialization, assurance workflows, and publication;
- `server/ports` — technology-neutral outbound contracts;
- `server/adapters` — filesystem, Git, MATLAB/Simulink, spreadsheet, C/H,
  review, coverage, objective-profile, sample, persistence, and ZIP adapters;
- `server/composition-root.ts` — lifecycle container and dependency wiring;
- `server/http-api.ts` — the driving capability HTTP adapter; and
- `src` — the React audit experience and live API client.

`capabilities/adapter-catalog.json` preserves the approved
`mod.external-adapters` traceability boundary while refining it into
actor-specific technology adapters. `capabilities/implementation-architecture.json`
defines each driving and driven adapter module, its external actor, owned
path, and implemented application ports.

## Integrity behavior

- A candidate refresh is published only after all discovered artifacts are
  claimed by an enabled adapter and normalized evidence passes canonical
  validation.
- Duplicate identities, missing hashes or revisions, malformed evidence, an
  invalid configured objective profile, or unextracted artifacts reject the
  candidate.
- Rejection never replaces the last published snapshot.
- Snapshot files are immutable; publication changes only an atomic current
  pointer.
- Package identities and ZIP bytes are deterministic for the same snapshot,
  scope, and options.
- Package downloads accept only validated package identities and cannot escape
  the package directory.
- Sample reset removes generated sandbox packages as well as their records;
  authoritative sample evidence remains immutable.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The test suite covers sample integrity, every approved capability operation,
real-project publication, restart persistence, failed-refresh fallback,
review/finding overlays, deterministic ZIPs and downloads, CSV/XLSX, C/H,
coverage, normalized MATLAB sidecars, missing-MATLAB isolation, objective
profiles, and HTTP readiness/dispatch.

The evidence-backed completion matrix is in
`docs/completion-report.md`. Human workflow findings and prioritized
recommendations are in `docs/usability-report.md`; final browser captures are
under `docs/screenshots/`.
