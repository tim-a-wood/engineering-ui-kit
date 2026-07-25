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
 * Fallback actor when the app has no signed-in user identity. There is
 * currently no user-identity concept anywhere in the GUI (`apps/gui/src`
 * has no login, profile, or OS-identity lookup — see `bridge.ts`,
 * `App.tsx`); every actor string the service accepts must match
 * `user:<id>` | `agent:<id>` | `service:<id>` (packages/core
 * `capabilities/design/operations.ts` `ACTOR_FORMAT`), so the GUI always
 * acts as this one `user:` actor until real identity is wired up.
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
   * One §17.2 change operation. `input` is the operation's single input
   * object; `actor` and a fresh `idempotencyKey` are always attached unless
   * the caller already supplied one (§17.3 "require an idempotency key",
   * "validate authorization").
   */
  async change<T>(operation: string, input: BridgeChangeInput): Promise<T> {
    const withDefaults: BridgeChangeInput = {
      actor: this.actor,
      idempotencyKey: freshIdempotencyKey(operation),
      ...input,
    }
    return (await this.caller({ operation, args: [withDefaults] })) as T
  }
}
