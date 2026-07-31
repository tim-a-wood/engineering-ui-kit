# Page Generation Prompt Skeleton

## Intent

Guide generation or refinement of Engineering UI Kit page layouts.

## Required Inputs

- Repo or implementation context.
- Relevant task packet.
- Relevant Engineering UI Kit standards excerpt or compiled standards pack.
- Approved high-fidelity references when visual fidelity is part of the task.

## Hard Constraints

- Apply the Engineering UI Kit writing profile based on ASD-STE100 Issue 9 to all human-facing output.
- Use American English, active voice, simple verb forms, and one action per sentence.
- Limit instructions to 20 words and descriptions to 25 words per sentence.
- Write names and diagram labels as `VERB + OBJECT` with no more than four words.
- Use one technical term for one concept. Do not use contractions, semicolons, or em dashes.
- Implement light and dark modes. Add a labeled mode button.
- Apply the selected palette, font, density, and view layout.
- Use Lucide icons only. Add accessible tooltips and contextual help.
- Do not use accent-strip tiles, ornamental sparkles, card walls, glass effects, or vague promotional copy.
- Follow the source-of-truth hierarchy.
- Use semantic tokens once token contracts are available.
- Do not invent visual features or product scope beyond the task packet.
- Do not drift into generic white-card dashboard styling.
- Preserve the strict three-file upload model when this prompt is used in constrained Copilot workflows.

## Expected Output

Page implementation or page specification updates aligned to layout recipes, component standards, and visual references.

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
