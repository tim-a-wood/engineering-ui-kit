# capabilities-react-reference

React-web + Electron reference slices proving the Capabilities TS runtime's
`./react` hook and `./electron` IPC adapters work end-to-end, through a real
composition root — no operation is ever called directly by app or test code.

## Slices

### `react-web/` — single-deployable React UI trigger -> operation (CAP-TEST-059)

`src/GreetForm.tsx` drives the `greet` domain operation (`src/domain/greet.ts`)
entirely through the runtime's `useOperation` hook
(`@engineering-ui-kit/capabilities-runtime/react`, frozen):

```
GreetForm -> useOperation -> OperationClient (runtime ./browser, frozen)
  -> InProcessBrowserTransport (src/browser-transport.ts, this slice)
  -> dispatch (runtime core, frozen) -> greetOperation
```

`InProcessBrowserTransport` is a real `Transport` implementation — it
implements the exact protocol a fetch/WebSocket transport would — that
dispatches directly to an operation resolved from the composition root
(`src/composition-root.ts`) instead of crossing a network boundary. It is the
single-deployable-web-app analogue of the Node HTTP host
(`packages/capabilities-runtime-ts/src/node/http.ts`) mapping an inbound
request to `dispatch`.

`react-web/test/greet-form.test.tsx` renders the ACTUAL component with
`@testing-library/react`, drives it with a REAL user interaction
(`@testing-library/user-event` — typing a name, clicking Greet), and asserts
the loading -> success and loading -> domain-rejection (blank name) states
the component renders, plus a synchronous loading-state assertion via
`fireEvent`.

### `electron/` — renderer -> main IPC round-trip (CAP-TEST-060/061)

- `src/renderer/client.ts` — browser-safe (no `node:*`/`electron` import):
  builds an `OperationClient` over the runtime's frozen
  `ElectronRendererTransport`, which forwards every call to whatever
  `CapabilitiesIpcBridge` it is given.
- `src/preload/bridge.ts` — the real preload script: exposes exactly the
  typed `capabilitiesIpc` surface via `contextBridge`, using the runtime's
  frozen `exposeCapabilitiesIpcBridge`. Never a raw `ipcRenderer` or other
  Node capability.
- `src/main/host.ts` — the real main-process wiring: registers the
  composition root's `create-task` operation (`src/domain/create-task.ts`)
  against the real `ipcMain` via the runtime's frozen
  `registerCapabilitiesIpcHost`.

`src/main/host.ts` and `src/preload/bridge.ts` touch the real `electron`
module and so cannot run outside a live Electron process — a real-Electron
process E2E is **deferred to WP8**, mirroring the runtime's own
`packages/capabilities-runtime-ts/src/electron/main.ts` / `./preload.ts`
doc comments. They are exercised here only by `tsc --noEmit`.

`electron/test/ipc-e2e.test.ts` proves the pure invoke/cancel -> dispatch ->
operation logic those two files wire up to the real Electron globals,
mirroring exactly how the runtime's own
`packages/capabilities-runtime-ts/test/electron-ipc.test.ts` tests this same
logic without a live Electron process. It builds:

- the SAME composition root `src/main/host.ts` uses;
- the runtime's pure, Electron-free `createCapabilitiesIpcMainHandler` and
  `createCapabilitiesIpcBridge` — imported directly from
  `packages/capabilities-runtime-ts/src/electron/{main-handler,preload-bridge}.ts`
  because that pure logic has no public
  `@engineering-ui-kit/capabilities-runtime` subpath of its own (only
  `./electron/main` and `./electron/preload`, which import the real
  `electron` module);
- a fake IPC "wire" that round-trips every payload through
  `JSON.stringify`/`JSON.parse` on the exact typed channel names
  (`CAPABILITIES_IPC_INVOKE_CHANNEL`/`CAPABILITIES_IPC_CANCEL_CHANNEL`) the
  real preload script and `ipcMain` listeners use — the same serialization
  boundary a real IPC structured-clone hop imposes;
- this slice's own `createElectronRendererClient`, driving every call
  through the real, frozen `ElectronRendererTransport` + `OperationClient`.

The tests assert: a renderer request reaches `create-task` through the full
path and returns a serialized success/domain-rejection outcome; the
correlation id sent by the renderer propagates all the way into the
operation itself (`createTaskOperation` folds `context.correlationId` into
its success value); concurrent calls carry distinct correlation ids without
cross-talk; an aborted renderer call forwards over the real cancel channel
and resolves as `cancelled`; and the preload-exposed bridge surface exposes
**exactly** `invoke`/`cancel` — no `require`, `process`, raw `ipcRenderer`,
or other Node/Electron capability.

## Running

```sh
cd examples/capabilities-react-reference
npx vitest run
```

Or, from the worktree root:

```sh
npx tsc -p examples/capabilities-react-reference/tsconfig.json --noEmit
cd examples/capabilities-react-reference && npx vitest run
```

## Why the alias (dist isn't built)

`@engineering-ui-kit/capabilities-runtime`'s `package.json` `exports` map
points at an unbuilt `dist/` (gitignored build artifact); `packages/capabilities-runtime-ts`
is read-only for this packet, so rather than building it, both
`tsconfig.json` (`compilerOptions.paths`) and `vitest.config.ts`
(`resolve.alias`) alias the package specifier and its `/browser`, `/react`,
and `/electron/*` subpaths straight to the runtime's TS source, resolved via
a path relative to this example — exactly the pattern
`examples/capabilities-ts-reference` already established for `/node`. This
keeps everything real: the actual `useOperation`/`OperationController`,
`OperationClient`, and Electron IPC channel/renderer-transport/preload-bridge/
main-handler code, just resolved without a separate compile step.

The `/browser` subpath is included (in addition to the `/react` and
`/electron/*` ones the packet calls for) because the React-web slice's
"browser-local client" is literally the runtime's `OperationClient` from
that subpath — the realistic way to wire a `useOperation`-driven UI to an
in-process transport.

`electron/test/ipc-e2e.test.ts` additionally imports two runtime modules
that have **no public package subpath** (`electron/main-handler.ts` and
`electron/preload-bridge.ts`) via a relative path directly into
`packages/capabilities-runtime-ts/src/electron/`, exactly mirroring how the
runtime's own `test/electron-ipc.test.ts` tests this logic. This is a
test-only exception to "standalone: import only
`@engineering-ui-kit/capabilities-runtime` subpaths" — necessary because a
real Electron process (which would exercise `./electron/main`/`./electron/preload`
directly) is out of scope until WP8. See "Remaining risks" below.

## Standalone / no-install / renderer-Node-free confirmation

- No `npm install` was run; every dependency (`react`, `react-dom`,
  `@testing-library/*`, `jsdom`, `electron`, `vitest`, `typescript`) resolves
  through the shared `node_modules` symlink already present in this
  worktree.
- All application code (`react-web/src/**`, `electron/src/**`) imports only
  `@engineering-ui-kit/capabilities-runtime` (and its `/browser`, `/react`,
  `/electron/*` subpaths) plus `react` — never `core`/`desktop`/`gui`.
- `electron/src/renderer/client.ts` (the renderer-facing app code) and the
  runtime's `electron/renderer.ts`/`electron/channel.ts` it depends on
  contain no `node:*` or `electron` import (verified by grep across this
  example: only `vitest.config.ts`, a build-tooling file, imports
  `node:url`/`node:path`).
- The preload-exposed bridge (`CapabilitiesIpcBridge`) is asserted to expose
  **exactly** `invoke`/`cancel` — no `require`, `process`, or raw
  `ipcRenderer` capability.

## Remaining risks

- A real, running Electron process end-to-end verification (actually
  launching Electron, loading a preload script under `contextIsolation`,
  and driving `ipcRenderer`/`ipcMain` for real) is deferred to WP8, per the
  packet. `src/main/host.ts` and `src/preload/bridge.ts` are exercised only
  by `tsc --noEmit` here.
- `electron/test/ipc-e2e.test.ts` reaches into two non-exported runtime
  modules (`electron/main-handler.ts`, `electron/preload-bridge.ts`) via a
  relative path rather than a published package subpath. This mirrors the
  runtime's own test suite exactly, but if a future consumer wants to build
  a pure-logic Electron main-process test against the *published* package
  (rather than this worktree's source alias), the package's `exports` map
  would need a subpath for this pure logic — a candidate contract-change
  request for a future packet, not something this packet is authorized to
  make (`packages/**` is read-only here).
