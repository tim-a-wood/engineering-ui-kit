# CAP-PKT-011–032 Implementation Briefs (working extract)

Source: `docs/CAPABILITIES-IMPLEMENTATION-SPEC.md`. Decisions recorded in Section 61.1 (2026-07-12).

## Shared

- Storage: `<userData>/workspace/projects/<projectId>/capabilities/`
- Module root: `capabilities/modules/` under `Project.repoPath`
- Transport: desktop bridge only
- Credentials: Electron `safeStorage`
- MATLAB: `matlab.engine` via Python from desktop; R2021b+; macOS/Windows/Linux
- Azure: read-only; no pipeline invocation
- Run kinds: `interview` | `implementation` | `delta` | `connection` | `verification`
- Freshness: never `ready` without exact successful verification provenance
- Capability overlay: path outside persisted `allowedPaths` = hard blocker

## Packets

See agent extract in session; implement in numerical order after CAP-PKT-001–010.

| Packet | Tests |
|---|---|
| 011 Module interviews | CAP-TEST-010 |
| 012 Implementation packets | CAP-TEST-014 |
| 013 Overlay scope | CAP-TEST-015 |
| 014 Verification | CAP-TEST-016 |
| 015 Freshness | CAP-TEST-017 |
| 016 Impact/delta | CAP-TEST-018,019,020 |
| 017 Registry/runtime | CAP-TEST-023,024 |
| 018 Jobs/artifacts | CAP-TEST-027 |
| 019 Filesystem | CAP-TEST-025 |
| 020 MATLAB session | CAP-TEST-026 |
| 021 MATLAB execution | CAP-TEST-027 |
| 022 MATLAB snapshots | CAP-TEST-028 |
| 023 Preview selection | CAP-TEST-029 |
| 024 Binding packet | CAP-TEST-030 |
| 025 Binding modes | CAP-TEST-031,032 |
| 026 Azure credentials | CAP-TEST-033,036 |
| 027 Azure import | CAP-TEST-034 |
| 028 Azure pipelines/tests | CAP-TEST-035 |
| 029 Migration | CAP-TEST-039 |
| 030 Trust boundary | CAP-TEST-036,037 |
| 031 A11y/perf | CAP-TEST-038,041 |
| 032 E2E | CAP-TEST-040 |
