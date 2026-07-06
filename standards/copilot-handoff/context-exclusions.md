# Context Exclusions

## Purpose

Define deterministic exclusion rules used when preparing `repo-flatfile.txt` so that
repository context uploaded to Copilot is reviewable, minimal, and lower risk.

## Scope

This document provides default excluded names and glob-like patterns, rationale,
review instructions, binary and large-file rules, explicit exceptions, and a concise
review-summary format.

It does not implement an executable glob engine. Exclusions reduce risk but are not
secret detection.

## Controlling Decisions

- The user remains responsible for reviewing exported context before upload.
- Exclusions are deterministic and listed explicitly.
- Explicit include exceptions must be rare and recorded.

## Default Excluded Names and Patterns

### AI-HANDOFF-020 — Exact default excluded names

Exclude these names wherever they appear as path segments or filenames:

```text
.git
.git/
node_modules
node_modules/
dist
dist/
build
build/
coverage
coverage/
.turbo
.turbo/
.cache
.cache/
.vite
.vite/
.DS_Store
Thumbs.db
package-lock.json
pnpm-lock.yaml
yarn.lock
.env
.env.local
.env.development
.env.production
.env.test
*.pem
*.key
*.p12
*.pfx
*.crt
*.cer
id_rsa
id_dsa
id_ecdsa
id_ed25519
```

### AI-HANDOFF-021 — Default excluded glob-like patterns

```text
**/.git/**
**/node_modules/**
**/dist/**
**/build/**
**/coverage/**
**/.turbo/**
**/.cache/**
**/.vite/**
**/*.log
**/*.map
**/*.min.js
**/*.min.css
**/*.zip
**/*.tar
**/*.tar.gz
**/*.tgz
**/*.7z
**/*.rar
**/*.png
**/*.jpg
**/*.jpeg
**/*.gif
**/*.webp
**/*.ico
**/*.pdf
**/*.mp4
**/*.mov
**/*.wav
**/*.mp3
**/*.psd
**/*.ai
**/*.sketch
**/secrets/**
**/credentials/**
**/*secret*
**/*credential*
**/*password*
**/*.exe
**/*.dll
**/*.so
**/*.dylib
```

For Vertical Slice 01, also exclude:

```text
trials/vertical-slice-01/target-app/dist/**
trials/vertical-slice-01/target-app/node_modules/**
project-sources/archives/**
```

Include only the target-app source and essential config needed for the task unless the
task packet explicitly expands scope.

## Rationale by Category

| Category | Examples | Rationale |
|---|---|---|
| VCS metadata | `.git/` | Not needed for implementation and may contain sensitive history. |
| Dependencies | `node_modules/`, lockfiles by default | Huge, regenerable, and not useful as source context. |
| Build output | `dist/`, `build/`, coverage, caches | Generated and noisy. |
| Environment and secrets | `.env*`, keys, certificates | High risk of credential leakage. |
| Archives | zip/tar family | Opaque and often oversized. |
| Binaries and media | images, audio, video, executables | Not text-useful in the flatfile; visual refs use the PDF pack. |
| Unrelated assets | historical archives, extra screenshots | Out of task scope. |
| App-managed kit artifacts | generated packet exports | Avoid confusing source with outputs. |

## Exclusions Are Not Secret Detection

### AI-HANDOFF-022 — No secret-detection guarantee

These exclusions reduce accidental inclusion of common secret and bulk paths. They do
not guarantee that all secrets are removed. The user must review the exported
flatfile before upload.

## User Review Before Upload

### AI-HANDOFF-023 — Review steps

1. Generate or assemble `repo-flatfile.txt` using the exclusions above.
2. Search the flatfile for tokens such as `API_KEY`, `TOKEN`, `PASSWORD`, `SECRET`,
   private URLs, and personal data.
3. Confirm every included file is necessary for the task.
4. Record a short review summary before upload.

## Binary Omission

### AI-HANDOFF-024 — Binary rules

Binary files are omitted from `repo-flatfile.txt` by default. Visual references are
delivered through `visual-reference-pack.pdf`, not through the flatfile.

## Unusually Large Text Files

### AI-HANDOFF-025 — Large text handling

If a text file exceeds 200 KB or is mostly generated content, exclude it by default
and note the omission in the review summary. Include it only when the task packet
explicitly requires that file.

## Explicit Include Exceptions

### AI-HANDOFF-026 — Exception behavior

An excluded path may be included only when:

1. the task packet names the path;
2. the user reviews the content;
3. the review summary records the exception and rationale.

Exceptions never override secret or credential files.

## Review-Summary Format

```markdown
# Context Export Review Summary
- Target: trials/vertical-slice-01/target-app
- Generated at: <ISO-8601 timestamp>
- Included files: <count>
- Excluded categories: git, dependencies, build output, binaries, archives, env/secrets
- Explicit exceptions: none | <path> — <reason>
- Secret review: completed by <name>
- Ready for upload: yes | no
```

## Trial Application

For Vertical Slice 01, the flatfile should include target-app source and config such
as:

- `package.json`
- `index.html`
- `tsconfig*.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/styles.css`
- `src/taskPacket.ts`
- `src/vite-env.d.ts`

Exclude `node_modules/`, `dist/`, lockfile unless explicitly required, and all
repository areas outside the task scope.

## Validation Checks

- Default exclusions cover git, dependencies, build output, env/secrets, binaries,
  and archives.
- Document states exclusions are not secret detection.
- Review-summary format is present.

## Traceability

- `contracts/repo-flatfile-contract.md`
- `handoff-model.md`
- `overlay-safety.md`
