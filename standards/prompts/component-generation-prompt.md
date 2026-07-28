# Component Generation Prompt Skeleton

## Intent

Guide generation or refinement of reusable Engineering UI Kit components.

## Required Inputs

- Repo or implementation context.
- Relevant task packet.
- Relevant Engineering UI Kit standards excerpt or compiled standards pack.
- Approved dark high-fidelity mockup references when visual fidelity is part of the task.

## Hard Constraints

- Apply the Engineering UI Kit writing profile based on ASD-STE100 Issue 9 to all human-facing output.
- Use American English, active voice, simple verb forms, and one action per sentence.
- Limit instructions to 20 words and descriptions to 25 words per sentence.
- Write names and diagram labels as `VERB + OBJECT` with no more than four words.
- Use one technical term for one concept. Do not use contractions or semicolons.
- Engineering UI Kit v0.1 is dark-first. Light mode is not part of the v0.1 implementation contract unless explicitly added later.
- Follow the source-of-truth hierarchy.
- Use semantic tokens once token contracts are available.
- Do not invent visual features or product scope beyond the task packet.
- Do not drift into generic white-card dashboard styling.
- Preserve the strict three-file upload model when this prompt is used in constrained Copilot workflows.

## Expected Output

Component implementation or specification updates aligned to the component manifest, semantic tokens, accessibility rules, and visual language.

## Review Criteria

- Output uses approved hi-fi mockup visual calibration references without treating them as exhaustive component standards.
- Output uses the documented component and layout standards available at the time.
- Output is traceable to task inputs and standards references.
- Output avoids unresolved visual drift and unsupported scope expansion.

## Open Placeholders

- Insert task-specific source file list.
- Insert relevant standards IDs.
- Insert mockup IDs or visual-reference pack name.
- Insert expected file changes or overlay format.
