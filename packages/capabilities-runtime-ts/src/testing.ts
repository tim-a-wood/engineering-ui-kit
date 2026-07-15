/**
 * @engineering-ui-kit/capabilities-runtime/testing — in-memory adapters,
 * fake clock, test secret resolver, an adapter-contract harness, and a
 * trigger harness that drives an {@link Operation} through {@link dispatch}.
 *
 * Nothing here stores or logs a real secret value: {@link TestSecretResolver}
 * only ever returns caller-registered fake values, and every fixture in
 * this repository's tests must use an obvious canary string, never
 * anything that could be mistaken for a live credential.
 */

import type { CancellationToken } from './cancellation.js'
import { NEVER_CANCELLED } from './cancellation.js'
import type { Clock } from './clock.js'
import type { ConfigurationReader } from './configuration.js'
import { MapConfigurationReader } from './configuration.js'
import type { AuthorizationHook, Context, Principal } from './context.js'
import { dispatch, type ValidationRejection } from './dispatch.js'
import type { Operation } from './operation.js'
import type { Outcome } from './outcome.js'
import type { ResolvedSecret, SecretReference, SecretResolver } from './secrets.js'
import { ResolvedSecret as ResolvedSecretValue } from './secrets.js'
import type { Logger, Tracer } from './telemetry.js'
import { NOOP_LOGGER, NOOP_TRACER } from './telemetry.js'

// ---------------------------------------------------------------------------
// Fake clock
// ---------------------------------------------------------------------------

/** Deterministic, manually advanced {@link Clock} for tests. */
export class FakeClock implements Clock {
  private currentMs: number

  constructor(initialMs = 0) {
    this.currentMs = initialMs
  }

  now(): number {
    return this.currentMs
  }

  set(ms: number): void {
    this.currentMs = ms
  }

  advance(ms: number): void {
    this.currentMs += ms
  }
}

// ---------------------------------------------------------------------------
// In-memory persistence adapter
// ---------------------------------------------------------------------------

/** Minimal, framework-neutral persistence port used by adapter-contract tests. */
export interface PersistenceAdapter<T> {
  get(id: string): Promise<T | undefined>
  put(id: string, value: T): Promise<void>
  delete(id: string): Promise<void>
  list(): Promise<ReadonlyArray<T>>
}

export class InMemoryPersistenceAdapter<T> implements PersistenceAdapter<T> {
  private readonly store = new Map<string, T>()

  async get(id: string): Promise<T | undefined> {
    return this.store.get(id)
  }

  async put(id: string, value: T): Promise<void> {
    this.store.set(id, value)
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async list(): Promise<ReadonlyArray<T>> {
    return Array.from(this.store.values())
  }

  /** Test-only helpers, not part of the port. */
  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

// ---------------------------------------------------------------------------
// Test secret resolver
// ---------------------------------------------------------------------------

/**
 * A {@link SecretResolver} for tests: resolves a {@link SecretReference} to a
 * caller-registered fake value. Unregistered references throw rather than
 * silently returning a guessable default, so tests cannot accidentally rely
 * on an un-registered "empty" secret.
 */
export class TestSecretResolver implements SecretResolver {
  private readonly fakeValues = new Map<string, string>()

  /** Registers a fake value for a reference. Use an obvious canary, e.g. `'fake-secret-canary'`. */
  register(ref: string, fakeValue: string, provider?: string): void {
    this.fakeValues.set(this.key(ref, provider), fakeValue)
  }

  resolve(reference: SecretReference): ResolvedSecret {
    const key = this.key(reference.ref, reference.provider)
    const fakeValue = this.fakeValues.get(key)
    if (fakeValue === undefined) {
      throw new Error(
        `TestSecretResolver: no fake value registered for reference "${reference.ref}"` +
          (reference.provider ? ` (provider "${reference.provider}")` : '') +
          '. Call register() first.',
      )
    }
    return new ResolvedSecretValue(reference, fakeValue)
  }

  private key(ref: string, provider?: string): string {
    return provider ? `${provider}:${ref}` : ref
  }
}

// ---------------------------------------------------------------------------
// Adapter-contract harness
// ---------------------------------------------------------------------------

export interface AdapterContractCase<TAdapter> {
  readonly name: string
  run(adapter: TAdapter): void | Promise<void>
}

export interface AdapterContractFailure {
  readonly name: string
  readonly message: string
}

export interface AdapterContractResult {
  readonly passed: boolean
  readonly failures: ReadonlyArray<AdapterContractFailure>
}

/** Runs every {@link AdapterContractCase} against `adapter`, collecting failures instead of throwing on the first one. */
export async function runAdapterContract<TAdapter>(
  adapter: TAdapter,
  cases: ReadonlyArray<AdapterContractCase<TAdapter>>,
): Promise<AdapterContractResult> {
  const failures: AdapterContractFailure[] = []
  for (const testCase of cases) {
    try {
      await testCase.run(adapter)
    } catch (error) {
      failures.push({ name: testCase.name, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { passed: failures.length === 0, failures }
}

/** Standard contract cases any {@link PersistenceAdapter} implementation (in-memory or host-backed) must satisfy. */
export function persistenceAdapterContract<T>(
  sampleValue: T,
  updatedValue: T,
): ReadonlyArray<AdapterContractCase<PersistenceAdapter<T>>> {
  return [
    {
      name: 'put then get returns the stored value',
      async run(adapter) {
        await adapter.put('contract-a', sampleValue)
        const stored = await adapter.get('contract-a')
        if (stored !== sampleValue) throw new Error('expected get() to return the value passed to put()')
      },
    },
    {
      name: 'get on an unknown id returns undefined',
      async run(adapter) {
        const stored = await adapter.get('contract-unknown')
        if (stored !== undefined) throw new Error('expected get() on an unknown id to return undefined')
      },
    },
    {
      name: 'put overwrites an existing id',
      async run(adapter) {
        await adapter.put('contract-b', sampleValue)
        await adapter.put('contract-b', updatedValue)
        const stored = await adapter.get('contract-b')
        if (stored !== updatedValue) throw new Error('expected the second put() to overwrite the first')
      },
    },
    {
      name: 'delete removes the id',
      async run(adapter) {
        await adapter.put('contract-c', sampleValue)
        await adapter.delete('contract-c')
        const stored = await adapter.get('contract-c')
        if (stored !== undefined) throw new Error('expected get() after delete() to return undefined')
      },
    },
    {
      name: 'list includes every stored value',
      async run(adapter) {
        await adapter.put('contract-d', sampleValue)
        const all = await adapter.list()
        if (!all.includes(sampleValue)) throw new Error('expected list() to include a stored value')
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Trigger harness
// ---------------------------------------------------------------------------

export interface TriggerHarnessOptions {
  readonly correlationId?: string
  readonly cancellation?: CancellationToken
  readonly deadline?: number
  readonly clock?: Clock
  readonly configuration?: ConfigurationReader
  readonly secretResolver?: SecretResolver
  readonly logger?: Logger
  readonly tracer?: Tracer
  readonly principal?: Principal
  readonly authorization?: AuthorizationHook
}

/** Builds a fully populated, deterministic {@link Context} for tests, overridable per field. */
export function createTestContext(options: TriggerHarnessOptions = {}): Context {
  return {
    correlationId: options.correlationId ?? 'test-correlation-id',
    cancellation: options.cancellation ?? NEVER_CANCELLED,
    deadline: options.deadline,
    principal: options.principal,
    authorization: options.authorization,
    configuration: options.configuration ?? new MapConfigurationReader(),
    secretResolver: options.secretResolver ?? new TestSecretResolver(),
    logger: options.logger ?? NOOP_LOGGER,
    tracer: options.tracer ?? NOOP_TRACER,
    clock: options.clock,
  }
}

/**
 * Trigger harness: builds a test {@link Context} (or uses one supplied via
 * `options`) and drives `operation` through the real {@link dispatch}
 * boundary — the same path a generated inbound adapter would use — so
 * trigger tests exercise validation, cancellation, and deadline behavior
 * identically to production.
 */
export async function trigger<Input, Success, DomainRejection, TechnicalFailure>(
  operation: Operation<Input, Success, DomainRejection, TechnicalFailure>,
  input: Input,
  options: TriggerHarnessOptions = {},
): Promise<Outcome<Success, DomainRejection | ValidationRejection, TechnicalFailure>> {
  const context = createTestContext(options)
  return dispatch(operation, input, context)
}
