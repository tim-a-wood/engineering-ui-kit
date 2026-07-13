# Capability implementation packet contract

## Target

Exactly one module **or** one connection per packet.

## Required content

- Packet identity and version
- Input record revisions and hashes
- Architecture and contract versions
- `allowedPaths`, `expectedPaths`, `protectedPaths`, `excludedPaths`
- Required tests and acceptance cases
- Explicit unchanged behavior
- Required output: `ui-overlay.zip` (changed/new files only; no deletion)

## Scope enforcement

Any returned path outside persisted `allowedPaths` is a **hard blocker** for capability runs (CAP-HANDOFF-004). Scope cannot be widened by overlay zip metadata.

## Upload budget

At most three upload files (existing budget).
