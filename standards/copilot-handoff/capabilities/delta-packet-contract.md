# Capability delta packet contract

Extends the implementation packet (CAP-CONTRACT-016).

## Additional required fields

- changeReason
- impactRecordId
- previousContractVersions / targetContractVersions
- preserveBehavior / addBehavior / changeBehavior
- newTests
- unchangedModuleIds

## Ordering

Provider modules precede workflow modules; experience/bindings last. Stable module ID tie-break.

## Exclusions

Never application-wide regeneration for a local capability change.
