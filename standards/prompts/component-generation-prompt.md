# Component Generation Prompt Skeleton

## Intent

Guide generation or refinement of reusable Engineering UI Kit components.

## Required Inputs

- Repo or implementation context.
- Relevant task packet.
- Relevant Engineering UI Kit standards excerpt or compiled standards pack.
- Approved dark high-fidelity mockup references when visual fidelity is part of the task.

## Hard Constraints

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
