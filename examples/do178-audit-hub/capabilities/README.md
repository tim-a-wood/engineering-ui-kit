# Consolidated Capabilities source

This directory keeps the approved Engineering UI Kit Capabilities definition
beside the Audit Hub implementation. It replaces the earlier split state in
which:

- the approved application, architecture, foundation, modules, operations,
  ports, and deployables lived under the separate **DO-178C Lifecycle Data
  Hub** project; and
- the implemented user experience lived under
  `examples/do178-audit-hub`.

`approved/` is a verbatim snapshot of the approved Capabilities records.
Generated operation and schema contracts are preserved in
`src/capabilities/generated/`.

## Actor-specific adapter refinement

The approved `mod.external-adapters` specification is retained for
traceability, but is only a design-time grouping and is too broad to be one
implementation unit. The implemented architecture treats each independently
failing external actor or integration responsibility as its own adapter module:

1. filesystem discovery and hashing;
2. Git revision resolution;
3. MATLAB/Simulink extraction;
4. spreadsheet extraction;
5. C/H source indexing;
6. review-evidence extraction;
7. coverage-result import; and
8. program-owned objective-profile import;
9. deterministic normalized sample snapshots;
10. immutable JSON snapshot/overlay persistence; and
11. deterministic ZIP audit-package generation.

The application/domain modules own and depend on ports, never on these concrete
technologies. One adapter may implement several cohesive ports when one
external system supplies them: the MATLAB/Simulink adapter implements the
requirements, trace, design, and verification source ports. It does not absorb
filesystem discovery, Git, spreadsheets, source parsing, or persistence.

`implementation-architecture.json` exposes the individual driving and driven
adapter modules, actor mappings, owned paths, and composition rule.
`adapter-catalog.json` remains the compact port-to-adapter inventory.

## Product boundary

The built product has two deployable surfaces with one composition model:

- **browser** — the existing React Audit Experience, acting as a driving
  adapter through capability HTTP contracts;
- **http-api** — the application/domain operations and outbound adapters,
  hosted with the Engineering UI Kit Capabilities runtime.

Authoritative engineering artifacts remain read-only. Only Audit Hub
configuration, immutable normalized snapshots, append-only assurance
overlays, and generated packages are written.
