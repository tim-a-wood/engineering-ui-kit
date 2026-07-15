# capabilities-ts-reference

A minimal, runnable, **headless** TypeScript reference app proving the
Capabilities TS runtime (`@engineering-ui-kit/capabilities-runtime`) works
end-to-end: one domain operation (`greet`), one explicit composition root,
and two real inbound slices — an HTTP API and a CLI — both built entirely
from the framework-neutral core plus the `./node` host adapters.

React web and Electron slices are a **separate**, later coordinator-checkout
packet (they need extra dependencies not available here) and are
intentionally **not** included in this example.

## Layout

```
src/
  domain/greet.ts        # the only business logic: Operation<GreetInput, GreetSuccess, GreetRejection, never>
  composition-root.ts     # LifecycleContainer wiring: configuration, secret resolver, the greet operation
  http/app.ts              # createNodeHttpHost() wired to the composition root (real node:http host)
  http/main.ts              # standalone runnable entry point (npm run start:http)
  cli/app.ts                # runCli() commands wired to the SAME composition root (real CLI host)
  cli/main.ts                # standalone runnable entry point (npm run start:cli -- greet <name>)
test/
  http-e2e.test.ts        # starts the REAL server, sends a REAL fetch() request, asserts the outcome
  cli-e2e.test.ts          # drives the REAL runCli() argv handler with REAL argv arrays
```

## The domain operation

`greet` (in `src/domain/greet.ts`) succeeds with `{ greeting: "Hello, <name>!" }`
for any non-blank `name`, and returns a domain rejection (code `blank-name`)
when `name` is blank after trimming. It never throws for that case — a
domain rejection is always a returned `Outcome`, never an exception (per the
architecture handoff §10.1).

## The composition root

`src/composition-root.ts` registers three services into a real
`LifecycleContainer`: a `ConfigurationReader`, a `SecretResolver` (unused by
this app, but always wired — no host adapter runs without one), and the
`greetOperation` itself. Both the HTTP slice and the CLI slice resolve the
SAME `greetOperation` instance out of the SAME composition root shape; there
is no direct import of `greetOperation` by either host entry point.

## Running the tests (real end-to-end)

**Important — Vitest's config-root resolution:** this package ships its own
`vitest.config.ts` (needed to alias `@engineering-ui-kit/capabilities-runtime`
and its `/node` subpath, since the runtime package's `dist/` build output is
a gitignored artifact and this packet is read-only against
`packages/capabilities-runtime-ts/**` — see "Why an alias, not `dist/`"
below). Vitest only looks for a config file in its **root** directory
(default: the process's `cwd()`), not in subdirectories. So the exact
acceptance command must either run with this directory as `cwd`, or pass
`--root`/`--config` explicitly:

```bash
# From WORKTREE_ROOT, cd into this workspace first (this is what
# `npm run test --workspaces --if-present` does for every workspace member):
cd examples/capabilities-ts-reference && npx vitest run

# Equivalently, from WORKTREE_ROOT, without cd:
npx vitest run --root examples/capabilities-ts-reference --config examples/capabilities-ts-reference/vitest.config.ts

# A single test file, same way:
npx vitest run test/http-e2e.test.ts --root examples/capabilities-ts-reference --config examples/capabilities-ts-reference/vitest.config.ts
```

Typecheck (works from WORKTREE_ROOT as-is, since `-p` is an explicit path):

```bash
npx tsc -p examples/capabilities-ts-reference/tsconfig.json --noEmit
```

## Running the standalone entry points

```bash
# HTTP slice on PORT (default 3000):
PORT=3000 npx vite-node -c vitest.config.ts src/http/main.ts   # run from this directory

# CLI slice:
npx vite-node -c vitest.config.ts src/cli/main.ts -- greet Ada   # run from this directory
```

(`vite-node` ships with `vitest`/`vite`, already resolvable via the shared
`node_modules` symlink — no install needed. It reuses this package's own
`vitest.config.ts`, so the same alias resolves the runtime import.)

## Why an alias, not `dist/`

`@engineering-ui-kit/capabilities-runtime`'s `package.json` `"exports"`
field points at `./dist/*.js`, which is a gitignored build artifact this
package does not ship pre-built. Building it would mean writing into
`packages/capabilities-runtime-ts/`, which this packet holds strictly
read-only. Instead, `vitest.config.ts` (test/dev) and `tsconfig.json`
(`compilerOptions.paths`, typecheck) both alias the two import specifiers
straight to the runtime's own TypeScript source
(`packages/capabilities-runtime-ts/src/index.ts` and `.../src/node.ts`),
resolved via a path **relative to this worktree only** — never through the
shared top-level `node_modules` symlink, and never requiring `npm install`.
Every import in `src/**` still reads literally as
`from '@engineering-ui-kit/capabilities-runtime'` /
`from '@engineering-ui-kit/capabilities-runtime/node'`; only the resolution
mechanism differs from a published/built dependency.

## Standalone guarantee

`src/**` and `test/**` import only `@engineering-ui-kit/capabilities-runtime`
(+ its `/node` subpath) and Node built-ins — never `@engineering-ui-kit/core`,
the desktop package, or the GUI package.
