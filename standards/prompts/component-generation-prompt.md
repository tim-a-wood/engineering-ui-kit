# Component Generation Prompt Skeleton

## Intent

Guide generation or refinement of reusable Engineering UI Kit components.

## Required Inputs

- Repo or implementation context.
- Relevant task packet.
- Relevant Engineering UI Kit standards excerpt or compiled standards pack.
- Approved high-fidelity references when visual fidelity is part of the task.

## Hard Constraints

- Apply the Engineering UI Kit writing profile based on ASD-STE100 Issue 9 to all human-facing output.
- Use American English, active voice, simple verb forms, and one action per sentence.
- Limit instructions to 20 words and descriptions to 25 words per sentence.
- Write use-case names, activity actions, sequence messages, and action labels as `VERB + OBJECT` with no more than four words.
- Write application names and page titles as short natural noun phrases or task labels. Do not start a page title with a count.
- Use one technical term for one concept. Do not use contractions, semicolons, or em dashes.
- Implement light and dark modes. Add a labeled mode button.
- Apply the selected palette, font, density, and view layout.
- Use white-dominant light surfaces and Gulfstream-blue-dominant dark surfaces for the default palette.
- Do not invent a metric or KPI. Add a measure only when it changes a task decision.
- Use Lucide icons only. Follow `FND-ICON-001`.
- Add accessible tooltips and contextual help. Follow `FND-HELP-001`.
- Reject common generated-interface tropes. Follow `FND-TROPE-001`.
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
