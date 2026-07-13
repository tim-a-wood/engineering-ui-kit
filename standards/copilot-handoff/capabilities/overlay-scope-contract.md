# Capability overlay scope contract

## Capability runs

When inspecting an overlay for a capability run:

1. Load persisted `allowedPaths`, `expectedPaths`, `protectedPaths` from the capability run scope (CAP-CONTRACT-021).
2. Any zip entry whose normalized repository-relative path is outside `allowedPaths` is a **hard blocker** (`CAP-OVERLAY-SCOPE-001`).
3. Traversal, absolute paths, secrets, and other existing AI-HANDOFF hard blockers remain in force.
4. Scope cannot be widened by metadata inside the zip.
5. After apply, capability verification for the target is invalidated.

## Legacy Build & Test runs

Expected-file mismatches remain warning-based. Do not change legacy semantics.
