/**
 * Task templates: prefilled section sets for the repeatable Copilot handoff
 * jobs. Selecting one fills every packet section in one click; users tweak
 * rather than author. `Settings.preferredTemplate` selects the default
 * (PRD §28.8 — this is the consumer of that setting).
 */

export type TaskTemplate = {
  id: string
  title: string
  summary: string
  /** `{project}` is replaced with the project name at apply time. */
  taskTitle: string
  goal: string
  scope: string
  constraints: string
  acceptanceCriteria: string
  references: string
  /**
   * When set, choosing this template seeds the project's launch config (if it
   * has none) so the finished app runs from the workbench with no manual
   * setup. Only methods that produce a self-serving app (the monolith) declare
   * this — the port here must match the port the template tells Copilot to use.
   */
  launchDefaults?: { url: string; command: string }
}

/** The port the monolithic-web-app method standardizes on (template ⇄ launch default). */
export const MONOLITH_PORT = 4180

const SHARED_CONSTRAINTS = [
  'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.',
  'No new dependencies; no router or state library additions unless the task explicitly allows them.',
  'Dark-first only; semantic tokens as CSS custom properties; no raw colors outside the token entry point.',
]

const SHARED_ACCEPTANCE = [
  'npm run typecheck and npm run build pass after overlay application.',
  'Dark-first shell with semantic surface hierarchy; no light-mode surfaces.',
  'Complete keyboard operation with visible focus; status and validation carry text, not color alone.',
]

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'standards-refresh',
    title: 'Visual refresh',
    summary: 'Restyle an existing screen or app visually while preserving all behavior.',
    taskTitle: 'Visual refresh for {project}',
    goal: 'Refresh the existing UI of {project} visually while preserving all existing domain behavior, data flow, and interactions.',
    scope: [
      'Presentation, layout, and styling only: stylesheets, the semantic token entry point, and view markup where presentation requires.',
      'Existing component structure may be reorganized only where necessary for the presentation change.',
      'Start with the primary screen; leave secondary screens untouched unless listed here.',
    ].join('\n'),
    constraints: [
      'Preserve all existing behavior: state handling, validation, serialization, exports, dialogs, and focus management.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      ...SHARED_ACCEPTANCE,
      'All pre-existing interactions still work exactly as before (edit/save/cancel, dialogs, exports where present).',
      'Presentation consumes semantic tokens through CSS custom properties; single token entry stylesheet.',
    ].join('\n'),
    references: [
      'standard-pack.md (attached): applicable rule IDs, component IDs, and the semantic token table.',
      'Approved dark hi-fi mockups where supplied as visual calibration, not pixel contracts.',
    ].join('\n'),
  },
  {
    id: 'new-ui-from-requirements',
    title: 'From spec',
    summary: 'New screen or small app from a written spec, using sample data only.',
    taskTitle: 'Build {project} from spec',
    goal: 'Implement a new dark-first UI for {project} from the spec below, using local sample data only — no backend, network, or filesystem access.',
    scope: [
      'REPLACE: one-paragraph description of the screen(s) to build and the user problem they solve.',
      'New view components, a single token entry stylesheet, and sample data modules.',
      'Local React state only; loading/empty/error states rendered from sample data variants.',
    ].join('\n'),
    constraints: [
      'No network requests, persistence, or filesystem access; sample data lives in a dedicated module.',
      'Keep domain/sample data separate from presentation (no data rules inside CSS or markup).',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      ...SHARED_ACCEPTANCE,
      'Every listed requirement is visibly implemented with sample data.',
      'Loading, empty, and error states are reachable and readable.',
    ].join('\n'),
    references: [
      'REPLACE: paste or link the requirements/description this UI must satisfy.',
      'standard-pack.md (attached): rule IDs, component IDs, token table.',
    ].join('\n'),
  },
  {
    id: 'new-ui-existing-api',
    title: 'Build a new UI on an existing backend/API',
    summary: 'New screens wired to an existing API through a thin typed client; the API itself must not change.',
    taskTitle: 'Build UI for {project} against the existing API',
    goal: 'Implement a new dark-first UI for {project} that consumes the existing backend/API exactly as documented below, without modifying the API, its contracts, or server code.',
    scope: [
      'REPLACE: list the screens to build and the API endpoints/types each consumes.',
      'A thin typed API client module (fetch-based), view components, and a single token entry stylesheet.',
      'Loading, empty, error, and offline states for every remote data region.',
    ].join('\n'),
    constraints: [
      'Do not modify server code, API routes, schemas, or contracts; consume them exactly as documented.',
      'All requests go through the single typed client module; no fetch calls scattered in views.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      ...SHARED_ACCEPTANCE,
      'Each screen renders real data from the documented endpoints, with explicit loading/empty/error/offline states.',
      'API failures surface as readable status text with a retry affordance, never blank screens.',
    ].join('\n'),
    references: [
      'REPLACE: API documentation, endpoint list, or OpenAPI/type definitions.',
      'standard-pack.md (attached): rule IDs, component IDs, token table.',
    ].join('\n'),
  },
  {
    id: 'requirements-from-brief',
    title: 'Write the requirements (from a short brief)',
    summary: 'Turn a few sentences of product intent into a complete REQUIREMENTS.md — run this handoff first, then build from the document it returns.',
    taskTitle: 'Write REQUIREMENTS.md for {project}',
    goal: 'Produce a complete, buildable requirements document for {project} from the short brief below. The next handoff will build the app from that document alone, so it must be self-sufficient.',
    scope: [
      'REPLACE: 3–6 sentences of product intent — who uses it, the question it answers, the 2–4 screens you imagine, and the data it manages.',
      'Return exactly one file: REQUIREMENTS.md at the repository root (as the zip overlay).',
      'Document structure: a one-paragraph context; numbered requirements (one per capability, each concrete enough to verify); exact input tables with types, ranges, and validation wherever forms exist; outputs and status rules with thresholds; persistence and seed-data expectations; a one-deployable run contract (npm run build, npm start, one port); an installable-PWA/offline section when offline matters; a quality bar; explicit non-goals.',
    ].join('\n'),
    constraints: [
      'No implementation and no code — the requirements document only.',
      'Invent nothing beyond the brief silently: collect anything you had to assume in an "Assumptions" section for review.',
      'The document must stand alone: the build handoff will see only REQUIREMENTS.md plus the standard pack.',
      'The quality-bar section shall reference the dark-first Engineering UI Kit standards (tables not card stacks, engineering charts, compact controls, text-backed status).',
    ].join('\n'),
    acceptanceCriteria: [
      'Every capability in the brief appears as a numbered requirement with verifiable detail.',
      'Input tables carry types, ranges, and validation rules; outputs carry status rules with thresholds.',
      'Seed data, the run contract (npm run typecheck / npm run build / npm start on one port), and non-goals are specified.',
      'Assumptions beyond the brief are listed in their own section.',
    ].join('\n'),
    references: [
      'standard-pack.md (attached): the quality bar the requirements should reference.',
      'REPLACE: any existing notes, sketches, or domain constraints worth honoring (or delete this line).',
    ].join('\n'),
  },
  {
    id: 'monolithic-web-app',
    title: 'Self-contained app',
    summary: 'Single deployable: React/Vite frontend plus a minimal local server in one repo.',
    taskTitle: 'Create self-contained app: {project}',
    goal: 'Scaffold and implement a self-contained web application for {project}: a React + Vite + TypeScript frontend and a minimal local Node server in one repository, one deployable.',
    scope: [
      'REPLACE: describe the app, its 2–4 core screens, and the data it manages.',
      'Frontend: app shell (top bar, primary navigation, page header), the core screens, semantic token entry stylesheet.',
      'Backend: minimal Node server with a typed JSON API and simple file-based persistence.',
      'Shared TypeScript types between client and server in one module.',
      'One-command run: an `npm start` script that runs the Node server, which serves the built frontend from `dist/` and the JSON API on one port — `process.env.PORT` or 4180 (reachable at http://localhost:4180). Add the `start` script to package.json (a script addition, not a dependency change).',
    ].join('\n'),
    constraints: [
      'Minimal dependencies: React, Vite, TypeScript, and the Node standard library; justify anything beyond that in response text.',
      'Frontend/backend boundary through the typed JSON API only; no server imports in the renderer.',
      'Dark-first only; semantic tokens as CSS custom properties; no raw colors outside the token entry point.',
      'No auth, telemetry, or deployment tooling in this pass.',
      'Keep the tsconfig include limited to source directories — leave vite.config.ts out of the typecheck project (repos hosted inside a workspace/monorepo hit duplicate-vite type-identity errors otherwise).',
    ].join('\n'),
    acceptanceCriteria: [
      'npm run typecheck and npm run build pass; `npm run build` then `npm start` serves the built frontend and API at http://localhost:4180 (PORT overridable via process.env.PORT).',
      'Core screens perform their create/read/update flows end to end against the local API.',
      'Dark-first shell with semantic surface hierarchy; complete keyboard operation with visible focus.',
      'Loading, empty, and error states exist for every remote data region.',
    ].join('\n'),
    references: [
      'REPLACE: requirements or a short product description for the app.',
      'standard-pack.md (attached): rule IDs, component IDs, token table.',
    ].join('\n'),
    launchDefaults: { url: `http://127.0.0.1:${MONOLITH_PORT}`, command: 'npm run build && npm start' },
  },
  {
    id: 'add-screen',
    title: 'Add a screen to an existing app',
    summary: 'One new view wired into existing navigation, matching the app’s established patterns.',
    taskTitle: 'Add screen to {project}',
    goal: 'Add one new screen to {project}, wired into the existing navigation and consistent with the app’s established structure, state patterns, and Engineering UI Kit standards.',
    scope: [
      'REPLACE: name the new screen, its purpose, and where it appears in navigation.',
      'One new view component plus minimal navigation wiring; styling through the existing token entry point.',
      'No changes to existing screens beyond the navigation entry.',
    ].join('\n'),
    constraints: [
      'Follow the existing app conventions for state, file placement, and naming; do not restructure existing code.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      ...SHARED_ACCEPTANCE,
      'The new screen is reachable from navigation with a visible active state, and no existing screen regressed.',
    ].join('\n'),
    references: [
      'REPLACE: requirements for the new screen (fields, data, actions).',
      'standard-pack.md (attached): rule IDs, component IDs, token table.',
    ].join('\n'),
  },
  {
    id: 'iterate-on-feedback',
    title: 'Iterate on the previous design (feedback-driven)',
    summary: 'Follow-up pass on an already-applied overlay: address the reviewer feedback, change nothing else.',
    taskTitle: 'Iterate on {project}: address review feedback',
    goal: 'Refine the UI previously delivered for {project}: address every reviewer feedback point listed in Scope while preserving the delivered design, behavior, and file layout everywhere else.',
    scope: [
      'REPLACE: the reviewer feedback points to address (auto-filled from Verify & Review feedback when present).',
    ].join('\n'),
    constraints: [
      'Address only the feedback points in Scope; no redesigns, rescaffolds, or unrelated refactors.',
      'Preserve the previously delivered structure: routes, API contracts, data shapes, file layout, and naming.',
      'Return only changed or new files — files absent from the zip remain untouched.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      'Every feedback point in Scope is visibly addressed.',
      'Screens and behaviors not named in the feedback are unchanged.',
      'npm run typecheck and npm run build still pass after overlay application.',
    ].join('\n'),
    references: [
      'The previous task packet for this run — its requirements and constraints still apply.',
      'standard-pack.md (attached): rule IDs, component IDs, token table.',
    ].join('\n'),
  },
  {
    id: 'a11y-remediation',
    title: 'UI/UX issue finder',
    summary: 'Find and fix UI/UX issues: clarity, keyboard, focus, labels, status text, contrast.',
    taskTitle: 'UI/UX issue pass for {project}',
    goal: 'Find and fix UI/UX issues in {project} without changing domain behavior: clarity problems, complete keyboard operation, visible focus, accessible names, text-backed status, dialog semantics, and reduced-motion support.',
    scope: [
      'REPLACE: name the screen(s) in scope.',
      'Markup semantics (landmarks, headings, labels, roles), focus management, and styling for focus/contrast only.',
      'No layout redesign beyond what accessibility requires.',
    ].join('\n'),
    constraints: [
      'Behavior, data flow, and visual identity remain unchanged apart from accessibility corrections.',
      'Use the semantic focus tokens for focus rings; do not invent new colors.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      'Every interactive control is reachable and operable by keyboard with a visible focus indicator.',
      'All controls, inputs, dialogs, and status regions expose accessible names; validation errors are text, linked to fields.',
      'Dialogs trap focus, support Escape, and restore focus to the invoking control.',
      'prefers-reduced-motion is respected.',
      'npm run typecheck and npm run build pass after overlay application.',
    ].join('\n'),
    references: [
      'standard-pack.md (attached): FND-A11Y rule excerpts and focus tokens.',
      'WCAG 2.2 AA success criteria for keyboard, focus, labels, and contrast.',
    ].join('\n'),
  },
  {
    id: 'data-viz-screen',
    title: 'Data visualization screen from a dataset',
    summary: 'Chart-centric screen (XY plot, series, stats) rendered from a supplied dataset — SVG, no chart library.',
    taskTitle: 'Data visualization screen for {project}',
    goal: 'Implement a dark-first data visualization screen for {project} that renders the supplied dataset as an accessible SVG chart with axis ticks, series legend, and summary statistics.',
    scope: [
      'REPLACE: describe the dataset (fields, units) and the chart type (XY scatter/line, bar, etc.).',
      'One visualization view: chart region (inset technical surface), dataset selector, summary stats, and a data table fallback.',
      'Hand-rolled SVG rendering; a dedicated data module supplies the dataset.',
    ].join('\n'),
    constraints: [
      'No chart libraries; SVG primitives only, colors via semantic tokens (status/accent scale).',
      'The chart must not be the only representation — provide a data table or text summary for accessibility.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      ...SHARED_ACCEPTANCE,
      'Chart renders all series from the dataset with labeled axes and readable ticks.',
      'A text alternative (table or stats summary) conveys the same information.',
    ].join('\n'),
    references: [
      'REPLACE: attach or describe the dataset.',
      'standard-pack.md (attached): data-visualization component IDs and token table.',
    ].join('\n'),
  },
  {
    id: 'form-crud-screen',
    title: 'Form-heavy CRUD screen',
    summary: 'Create/edit forms with validation, list view, and non-destructive delete flows over local state.',
    taskTitle: 'CRUD screen for {project}',
    goal: 'Implement a dark-first create/read/update/delete screen for {project} with labeled validated forms, a records list, and confirmation before destructive actions — over local state or the documented API.',
    scope: [
      'REPLACE: name the record type and its fields (types, required/optional, validation rules).',
      'List view with status badges, create/edit form (field wrapper, labels, errors, helper text), delete with confirmation dialog.',
    ].join('\n'),
    constraints: [
      'Validation errors are per-field text plus a summary; never color-only.',
      'Destructive actions require an explicit confirmation dialog.',
      ...SHARED_CONSTRAINTS,
    ].join('\n'),
    acceptanceCriteria: [
      ...SHARED_ACCEPTANCE,
      'Create, edit, and delete flows work end to end with validation and confirmation.',
      'Empty and error states are readable and recoverable.',
    ].join('\n'),
    references: [
      'REPLACE: record schema or API documentation.',
      'standard-pack.md (attached): CMP-FORM-* component IDs and token table.',
    ].join('\n'),
  },
]

export function applyTemplate(template: TaskTemplate, projectName: string): {
  taskTitle: string
  goal: string
  scope: string
  constraints: string
  acceptanceCriteria: string
  references: string
} {
  const fill = (text: string) => text.replaceAll('{project}', projectName)
  return {
    taskTitle: fill(template.taskTitle),
    goal: fill(template.goal),
    scope: fill(template.scope),
    constraints: fill(template.constraints),
    acceptanceCriteria: fill(template.acceptanceCriteria),
    references: fill(template.references),
  }
}

/**
 * Parse `user-review-notes.md` (append-only, `## <ISO timestamp>` headers —
 * see the saveFeedback IPC handler) into timestamped feedback entries.
 */
export function parseFeedbackEntries(notes: string): { at: string; text: string }[] {
  const entries: { at: string; text: string }[] = []
  for (const block of notes.split(/^## /m)) {
    const [first, ...rest] = block.split('\n')
    const at = first?.trim() ?? ''
    const text = rest.join('\n').trim()
    if (!Number.isNaN(Date.parse(at)) && text) entries.push({ at, text })
  }
  return entries
}

export function defaultTemplateId(preferredTemplate: string): string {
  const match = TASK_TEMPLATES.find(
    (t) => t.title.toLowerCase() === preferredTemplate.toLowerCase() || t.id === preferredTemplate,
  )
  return match?.id ?? 'standards-refresh'
}
