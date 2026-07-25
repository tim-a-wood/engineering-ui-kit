/**
 * GUI-side detector + thin envelope caller for the desktop design bridge
 * (`window.euik.designOperation`, one channel, `{ operation, args }` in →
 * exactly what `DesignOperationsService` returns out — see
 * `apps/desktop/src/capabilities/designBridge.ts` `DESIGN_CHANNEL` and
 * `apps/desktop/src/bridgeApi.ts`). This file mirrors that wire contract
 * locally, the same way `apps/gui/src/bridge.ts` mirrors `bridgeApi.ts`: the
 * renderer never imports Electron-typed modules, and this module never talks
 * to `DesignOperationsService` (fs-backed, Node-only) directly.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §17 ("The
 * interface and machine API shall call the same application operations"),
 * §17.3 (idempotency key, expected base revision, structured diagnostics).
 */

/** Wire request — identical shape to `apps/desktop/src/capabilities/designBridge.ts` `DesignBridgeRequest`. */
export type DesignBridgeRequest = {
  operation: string
  args: unknown[]
}

/** The bridge function's shape: `window.euik.designOperation`. */
export type DesignBridgeCaller = (request: DesignBridgeRequest) => Promise<unknown>

/**
 * Local-only placeholder identity used solely to synthesize the
 * synchronous, pre-load `project`-mode state (`emptyProjectState` /
 * `emptyPolicy` in `designState.ts`) before the first bridge round trip
 * resolves. It is NEVER sent over the wire and NEVER rendered as an
 * approver, actor, or "approved by" value anywhere in the UI — see the
 * `change()` doc below for why, and `ProjectSetupPanel` for the real
 * session identity (`adapter:getPrincipal`).
 *
 * Second-review P1 fix: the desktop IPC (`apps/desktop/src/capabilities/
 * designIpc.ts`, `stampPrincipalOnArgs`) now derives the real OS-process
 * identity itself and stamps/overrides it onto every request's `actor`
 * field — a request's own claimed `actor` is decorative on the Electron
 * path (it is never trusted, and mismatches are only logged, never
 * blocking). This GUI no longer invents a `user:local` identity and claims
 * it as the actor of any bridge call.
 */
export const LOCAL_USER_ACTOR = 'user:local'

/**
 * Detects the desktop design bridge the same way other GUI views detect the
 * desktop bridge (`window.euikMode === 'electron'` — see `App.tsx`,
 * `views/workflow.tsx`, `views/capabilities/CapabilityPreview.tsx`), plus a
 * runtime check that `designOperation` is actually present on `window.euik`.
 * Returns `undefined` in plain-browser dev, qualitative-UI validation (the
 * in-memory mock bridge), and any environment where the channel is not
 * wired up — callers fall back to sample mode in that case (§22.1).
 */
export function detectDesignBridgeCaller(win: (Window & typeof globalThis) | undefined = typeof window === 'undefined' ? undefined : window): DesignBridgeCaller | undefined {
  if (!win) return undefined
  if (win.euikMode !== 'electron') return undefined
  const euik = (win as unknown as { euik?: { designOperation?: unknown } }).euik
  const candidate = euik?.designOperation
  if (typeof candidate !== 'function') return undefined
  return candidate.bind(euik) as DesignBridgeCaller
}

let idempotencyCounter = 0

/**
 * A fresh idempotency key per action (§17.3 "require an idempotency key") —
 * never reused across calls, even for the same operation on the same
 * record, so a retried click never replays the first click's result.
 */
export function freshIdempotencyKey(operation: string): string {
  idempotencyCounter += 1
  const hasRandomUUID = typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
  const random = hasRandomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`
  return `${operation}.${random}.${idempotencyCounter}`
}

/**
 * Local mirror of `DesignOperationResult<T>`
 * (`packages/core/src/capabilities/design/records.ts`). The real type is
 * already re-exported by `@engineering-ui-kit/core/design-browser`, so
 * `designState.ts` imports that one directly for typing bridge responses;
 * this alias exists only so this file's own signatures stay self-contained.
 */
export type BridgeChangeInput = Record<string, unknown>

/**
 * Thin client over one `DesignBridgeCaller`. Every method sends exactly one
 * envelope call and returns exactly what the service returned for it — no
 * local reshaping, no local approval/validation logic (review finding #1).
 */
export class DesignBridgeClient {
  constructor(
    private readonly caller: DesignBridgeCaller,
    readonly projectId: string,
    readonly actor: string,
  ) {}

  /** One §17.1 read operation — `args` positional, exactly as the service expects. */
  async read<T>(operation: string, args: unknown[]): Promise<T> {
    return (await this.caller({ operation, args })) as T
  }

  /**
   * One §17.2 change operation, OR one adapter-owned change operation
   * (`adapter:configureProjectRepository`, `adapter:configureProjectRoles`
   * — see `ADAPTER_OPERATIONS` in `apps/desktop/src/capabilities/
   * designBridge.ts`; both take the same one-input-object shape a §17.2
   * change does). `input` is the operation's single input object; a fresh
   * `idempotencyKey` is always attached (§17.3 "require an idempotency
   * key").
   *
   * `actor` is deliberately sent as `undefined` (present as a key, never a
   * value) rather than omitted or defaulted to a locally-invented identity
   * (second-review P1 fix, `LOCAL_USER_ACTOR` doc above): the desktop IPC's
   * `stampPrincipalOnArgs` recognizes a request as a change-operation input
   * to stamp by checking `'actor' in args[0]` — regardless of that key's
   * value — then overwrites it with the real, OS-derived principal before
   * the request ever reaches the service or the adapter-owned repository/
   * roles configuration. Sending no `actor` key at all would make
   * `stampPrincipalOnArgs` treat the request as a bare read and leave the
   * field completely absent, which every actual change operation would
   * then reject as `actor must match "user:<id>" | "agent:<id>" |
   * "service:<id>"`. Sending an explicit value (e.g. `'user:local'`) would
   * assert an identity this GUI has no way to authenticate. `undefined`
   * satisfies the wire-format check while asserting nothing.
   */
  async change<T>(operation: string, input: BridgeChangeInput): Promise<T> {
    const withDefaults: BridgeChangeInput = {
      idempotencyKey: freshIdempotencyKey(operation),
      ...input,
      actor: undefined,
    }
    return (await this.caller({ operation, args: [withDefaults] })) as T
  }
}

// ---------------------------------------------------------------------------
// Adapter operation wire-shape mirrors (§4, §17.3, §20.2, §25.3 — second-
// review P1 finding: "nothing configures the repository adapter or project
// roles"). All four adapter operations
// (`configureProjectRepository`/`getProjectRepository`/
// `configureProjectRoles`/`getPrincipal`) are shipped server-side
// (`apps/desktop/src/capabilities/designIpc.ts`, `designBridge.ts`
// `ADAPTER_OPERATIONS`) as of this packet. Every call site in this GUI still
// handles an `EUC16-UNKNOWN-OPERATION` response gracefully (see
// `isUnknownOperationResponse` below) as a defensive fallback against an
// older desktop build running this same GUI bundle.
// ---------------------------------------------------------------------------

/** One structured diagnostic, as every adapter operation response returns it (never a throw). */
export type AdapterDiagnostic = { id: string; code: string; severity: 'blocker' | 'warning' | 'info'; message: string; target?: string }

/** Local mirror of `designBridge.ts` `AdapterConfigurationResponse` — the shipped shape both `adapter:configureProjectRepository` and `adapter:getProjectRepository` return. */
export type AdapterConfigurationResponse =
  | { ok: true; projectId: string; repositoryRoot: string; auditEventId?: string; idempotentReplay?: boolean }
  | { ok: false; diagnostics: AdapterDiagnostic[] }

/**
 * `adapter:getPrincipal` — takes NO args (`args: []`; the principal is the
 * dispatcher's own OS-derived identity, not scoped to a project) and
 * returns `{ ok, principal }` on success — the same real, OS-derived
 * principal `stampPrincipalOnArgs` already stamps onto every change
 * request, so the UI can display it without inventing one.
 */
export type AdapterPrincipalResponse = { ok: true; principal: string } | { ok: false; diagnostics: AdapterDiagnostic[] }

/**
 * `adapter:configureProjectRoles` — `{ projectId, actor, idempotencyKey,
 * grantee?, authorities? }`; omitting `authorities` grants the stamped
 * principal every §4 authority by default. This GUI always sends both
 * explicitly ("Grant design authorities to this session user" — the full
 * §4 list, for the just-read principal) rather than relying on the
 * server-side default, so the action's effect matches its label exactly.
 * Returns `{ ok, auditEventId }` on success — no echo of what was granted,
 * so the UI displays what it requested, not a server echo.
 */
export type ConfigureProjectRolesInput = { projectId: string; actor?: string; idempotencyKey: string; grantee?: string; authorities?: string[] }
export type AdapterRolesResponse = { ok: true; auditEventId?: string } | { ok: false; diagnostics: AdapterDiagnostic[] }

/**
 * True when a bridge response is the adapter's `EUC16-UNKNOWN-OPERATION`
 * rejection (`designIpc.ts` `unknownOperationResult`) — the graceful
 * "not available yet" signal for `adapter:configureProjectRoles` /
 * `adapter:getPrincipal` until the coordinator implements them.
 */
export function isUnknownOperationResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false
  const candidate = response as { ok?: unknown; diagnostics?: unknown }
  if (candidate.ok !== false || !Array.isArray(candidate.diagnostics)) return false
  return candidate.diagnostics.some((d) => d && typeof d === 'object' && (d as { code?: unknown }).code === 'EUC16-UNKNOWN-OPERATION')
}
