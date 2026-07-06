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
}

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
    title: 'Apply UI Kit standards to an existing UI',
    summary: 'Restyle an existing screen or app to Engineering UI Kit dark-first standards while preserving all behavior.',
    taskTitle: 'Apply Engineering UI Kit standards to {project}',
    goal: 'Refresh the existing UI of {project} to Engineering UI Kit dark-first standards while preserving all existing domain behavior, data flow, and interactions.',
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
    title: 'Build a new UI from requirements (no backend)',
    summary: 'Green-field screen or small app from a written description, using sample data only.',
    taskTitle: 'Build new UI for {project} from requirements',
    goal: 'Implement a new dark-first UI for {project} from the requirements below, using local sample data only — no backend, network, or filesystem access.',
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
    id: 'monolithic-web-app',
    title: 'Create a monolithic web app',
    summary: 'Single deployable: React/Vite frontend plus a minimal local server in one repo.',
    taskTitle: 'Create monolithic web app: {project}',
    goal: 'Scaffold and implement a small monolithic web application for {project}: a React + Vite + TypeScript frontend and a minimal local Node server in one repository, one deployable.',
    scope: [
      'REPLACE: describe the app, its 2–4 core screens, and the data it manages.',
      'Frontend: app shell (top bar, primary navigation, page header), the core screens, semantic token entry stylesheet.',
      'Backend: minimal Node server with a typed JSON API and simple file-based persistence.',
      'Shared TypeScript types between client and server in one module.',
    ].join('\n'),
    constraints: [
      'Minimal dependencies: React, Vite, TypeScript, and the Node standard library; justify anything beyond that in response text.',
      'Frontend/backend boundary through the typed JSON API only; no server imports in the renderer.',
      'Dark-first only; semantic tokens as CSS custom properties; no raw colors outside the token entry point.',
      'No auth, telemetry, or deployment tooling in this pass.',
    ].join('\n'),
    acceptanceCriteria: [
      'npm run typecheck and npm run build pass; the server starts and serves the built frontend.',
      'Core screens perform their create/read/update flows end to end against the local API.',
      'Dark-first shell with semantic surface hierarchy; complete keyboard operation with visible focus.',
      'Loading, empty, and error states exist for every remote data region.',
    ].join('\n'),
    references: [
      'REPLACE: requirements or a short product description for the app.',
      'standard-pack.md (attached): rule IDs, component IDs, token table.',
    ].join('\n'),
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

export function defaultTemplateId(preferredTemplate: string): string {
  const match = TASK_TEMPLATES.find(
    (t) => t.title.toLowerCase() === preferredTemplate.toLowerCase() || t.id === preferredTemplate,
  )
  return match?.id ?? 'standards-refresh'
}
