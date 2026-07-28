# Simplified Technical English

## Status

`EUIT-STE-001` is the required writing policy for Engineering UI Kit.

The profile is based on ASD-STE100 Issue 9, dated 2025-01-15. It applies to:

- application, architecture, use-case, module, binding, and design records.
- diagram names, nodes, messages, ports, connectors, and descriptions.
- design documents, implementation briefs, exports, and handoff packets.
- user-interface labels, instructions, messages, and help text.
- AI instructions and human-facing AI output.

Source code, identifiers, file paths, commands, schema keys, hashes, quoted
evidence, and official proper names are exempt. Give an exempt identifier a
separate human-readable label when users must reason about it.

## Product scope and claims

This profile does not claim ASD certification or complete ASD-STE100
compliance. ASD does not certify or approve this tool.

The Engineering UI Kit profile is a product rule. It is not a capability,
module, or feature in a sample application. The app applies the profile to its
own interface and every built-in AI prompt.

The product does not redistribute the ASD dictionary. Use the official standard
and a licensed checker when formal vocabulary validation is necessary.

A project can supply approved technical terms and preferred aliases as optional
prompt data. These terms extend the product profile. They cannot replace or
weaken it. The base profile applies when a project supplies no terminology.

Use the current official sources:

- <https://www.asd-ste100.org/about_STE.html>
- <https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf>
- <https://www.asd-ste100.org/STEsoftware.html>

## Required deterministic checks

The product must block approval, AI handoff export, and generated output when
human-facing text has an objective error:

- Do not use contractions.
- Do not use semicolons.
- Use American English spelling.
- Use no more than 20 words in each instruction sentence.
- Use no more than 25 words in each description sentence.
- Use no more than six sentences in each descriptive paragraph.
- Use a project-preferred term instead of a prohibited alias.
- Use configured project terms when the project supplies them.

Authoring views can show a writing-review item when a rule needs linguistic
judgment. Examples include meaning, passive voice, complex verb forms,
ambiguous pronouns, and an `-ing` word.

Do not change approved or signed text automatically. Keep the record as a
reviewable draft. Show an exact field path and a clear correction.

## Compact label profile

The compact label profile is an Engineering UI Kit usability rule. It supports
the clarity objectives of ASD-STE100.

| Text class | Form | Maximum |
|---|---|---:|
| Actor, module, component, state | Technical noun | 3 words |
| Use-case name | `VERB + OBJECT` | 4 words |
| Activity action | `VERB + OBJECT` | 4 words |
| Sequence message | `VERB + OBJECT` | 4 words |
| Port or operation label | Verb plus object, or technical noun | 4 words |
| Button | Imperative verb plus object | 4 words |
| Heading or tab | Technical noun | 3 words |
| Diagram description or tooltip | Description sentence | 25 words |

Put one action in each action label. Do not join actions with `and`, `&`, `/`,
or a comma. Put conditions, rationale, results, and implementation details in
the description or inspector.

The canonical record must contain the concise display label. A renderer must
not truncate or silently paraphrase an approved label.

## AI output contract

Every AI prompt must include the versioned `EUIT-STE-001` rule. The prompt must
require the model to:

- apply the product profile to all human-facing output.
- use an approved project glossary when one is supplied.
- use American English and simple verb forms.
- use active voice when the agent is known.
- follow the sentence and label limits in this profile.
- keep additional details in descriptions.
- use each necessary unapproved term consistently for review.
- check its output before it returns the result.

The app must encode project terms as data. It must reject control characters
and policy markers in those values. A project term must not create a prompt
instruction.

A prompt is not a validator. The same deterministic checker must inspect AI
output before the product saves, approves, exports, or projects the output.

## Verification

Tests must cover all of these paths:

- direct editing and approval.
- product, architecture, and module interview imports.
- frontend-binding and inbound-binding approvals.
- design and implementation document generation.
- component, activity, state, sequence, and use-case projections.
- task, correction, review, implementation-wave, and delta prompts.
- sample projects used in screenshots and workflow evidence.
