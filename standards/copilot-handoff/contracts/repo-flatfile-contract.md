# Repo Flatfile Contract

## Purpose

Define `repo-flatfile.txt`, the filtered textual repository context uploaded as file 1
in every three-file Copilot handoff.

## Producer

A human author or later generator applying `context-exclusions.md`.

## Consumer

Microsoft 365 Copilot during the implementation pass, then human reviewers checking
what context was provided.

## Required Structure

```text
# Engineering UI Kit Repo Flatfile
# source_repo: <repo or trial app name>
# generated_at: <ISO-8601 timestamp>
# included_files: <count>
# excluded_summary: <short summary of exclusion categories>
# secrets_guarantee: none — exclusions reduce risk but are not secret detection

===== FILE: <repo-relative-path> =====
<file contents>

===== FILE: <repo-relative-path> =====
<file contents>
```

Rules:

- generated file header is required;
- source repo name is required;
- generation timestamp is required;
- included/excluded summary is required;
- files are clearly delimited with repo-relative paths;
- text files only;
- deterministic ordering by repo-relative path ascending;
- no secrets guarantee claim beyond the explicit non-guarantee note above.

## Required Metadata

- `source_repo`
- `generated_at`
- `included_files`
- `excluded_summary`
- `secrets_guarantee` set to the non-guarantee wording

## Size and Scope Constraints

- Include only files needed for the task.
- Default exclusions from `context-exclusions.md` apply.
- Prefer the target-app source tree for Vertical Slice 01.
- Individual text files over 200 KB are excluded unless explicitly excepted.

## Validation Rules

1. Header fields are present.
2. Every `FILE` delimiter path is repo-relative and contains no `..`.
3. Files appear in ascending path order.
4. No binary markers or unreadable content.
5. No `.env`, key, or certificate files.
6. Review summary exists before upload.

## Prohibited Content

- Absolute or traversal paths in headers or file delimiters. Legitimate path literals
  inside required source content must be reviewed and recorded rather than rewritten.
- Secrets or credentials
- `node_modules/`, `dist/`, `.git/`
- Archives and binaries
- Claims that the flatfile is guaranteed secret-free

## Minimal Valid Example

```text
# Engineering UI Kit Repo Flatfile
# source_repo: vertical-slice-01-target-app
# generated_at: 2026-07-03T18:00:00Z
# included_files: 2
# excluded_summary: git, dependencies, build output, binaries, env/secrets
# secrets_guarantee: none — exclusions reduce risk but are not secret detection

===== FILE: package.json =====
{
  "name": "vertical-slice-01-target-app"
}

===== FILE: src/taskPacket.ts =====
export type TaskSectionKey = "goal" | "scope";
```

## Invalid Example

```text
repo dump
C:\work\ui-overlay\src\App.tsx
API_KEY=super-secret
```

Missing header, absolute path, and secret content.

## Traceability

- `../context-exclusions.md`
- `../three-file-upload-strategy.md`
- `AI-HANDOFF-001`, `AI-HANDOFF-010`
