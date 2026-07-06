# Phase 2 Contract Validation Checklist

## Gate A — Package structure

- [ ] Zip exists.
- [ ] Zip contains exactly one top-level `standards/` folder.
- [ ] Zip excludes planning docs, raw mockup images, nested zips, and temporary folders.
- [ ] Required Phase 1 files are retained unless intentionally superseded.
- [ ] Required Phase 2 additions are present.

## Gate B — JSON parseability

- [ ] `tokens.json` parses.
- [ ] `component-manifest.json` parses.
- [ ] `schemas/tokens.schema.json` parses.
- [ ] `schemas/component-manifest.schema.json` parses.
- [ ] `package-metadata.json` parses.

## Gate C — Schema validation

- [ ] Tokens validate against the token schema.
- [ ] Component manifest validates against the manifest schema.
- [ ] Schemas contain meaningful required fields, enums, and constraints.

## Gate D — Token contract completeness

- [ ] Required semantic groups are present.
- [ ] Mandatory token paths are present.
- [ ] Semantic and component-facing tokens include required metadata fields.
- [ ] Dark-first posture is declared.
- [ ] Semantic naming is role-based.
- [ ] No semantic token has an empty value, description, usage, or status.

## Gate E — Component manifest completeness

- [ ] At least 40 component entries exist.
- [ ] Component IDs match the required pattern.
- [ ] Component IDs are unique.
- [ ] Required categories are present.
- [ ] Every component includes required fields.
- [ ] Every component has coverage classification.
- [ ] Accessibility metadata is non-empty.
- [ ] Traceability object is present.
- [ ] Reserved or inferred components are honestly marked.

## Gate F — Token-reference integrity

- [ ] Every component token reference resolves to an existing semantic token path.
- [ ] No raw colors appear in component token references.
- [ ] Visible components reference relevant surface, text, border, focus, spacing, or radius tokens where applicable.

## Gate G — Source-framing correctness

- [ ] Mockups are described as app visual calibration, not exhaustive standards.
- [ ] No formal company-standard authority is claimed.
- [ ] Component breadth beyond mockups is explained.
- [ ] Public-reference posture is explained without implying branded copying.

## Gate H — Reference map coverage

- [ ] `research/component-reference-map.md` exists.
- [ ] Required component families are covered.
- [ ] Manifest IDs or prefixes are linked.
- [ ] Engineering-specific components are flagged where further validation is needed.

## Gate I — Handoff readiness

- [ ] Three-file strategy is preserved.
- [ ] Contracts are agent-consumable without the full planning archive.
- [ ] Validation artifacts are present.
- [ ] No contradictory Phase 1 source-framing wording remains in major docs.
