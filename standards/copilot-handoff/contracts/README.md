# Artifact Contracts

## Purpose

Define the minimum executable contracts needed to handcraft one three-file Copilot
packet and inspect the returned `ui-overlay.zip`.

## Scope

These contracts cover the handoff inputs and the overlay output for Vertical Slice
01. They are not a general serialization framework.

## Contracts

| File | Artifact |
|---|---|
| `repo-flatfile-contract.md` | `repo-flatfile.txt` |
| `task-packet-contract.md` | `task-packet.md` |
| `standards-pack-contract.md` | `standards-pack.md` |
| `task-and-standard-pack-contract.md` | `task-and-standard-pack.md` |
| `visual-reference-pack-contract.md` | `visual-reference-pack.pdf` |
| `ui-overlay-contract.md` | `ui-overlay.zip` |

## Three-File Variants

Text-only:

1. `repo-flatfile.txt`
2. `task-packet.md`
3. `standards-pack.md`

Visual/mockup (Vertical Slice 01):

1. `repo-flatfile.txt`
2. `task-and-standard-pack.md`
3. `visual-reference-pack.pdf`

## Shared Rules

- Each contract defines purpose, producer, consumer, structure, metadata, constraints,
  validation, prohibited content, and valid/invalid examples.
- Paths are repository-relative unless a contract explicitly says otherwise.
- Human review remains authoritative.

## Traceability

- `../handoff-model.md`
- `../three-file-upload-strategy.md`
- `../context-exclusions.md`
- `../overlay-safety.md`
