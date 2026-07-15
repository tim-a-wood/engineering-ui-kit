/**
 * Secret-reference protocol (§15.1). Contracts and configuration store
 * references such as an environment-variable name or a project-defined
 * secret-provider key — never the secret value itself. Resolution happens
 * at the latest practical point via a `SecretResolver`, and resolved
 * secrets are redaction-aware: `toString()`/JSON serialization never
 * exposes the raw value, only an explicit `.reveal()` does.
 */

export interface SecretReference {
  readonly kind: 'secret-reference'
  /** Provider-defined lookup key, e.g. an environment-variable name. */
  readonly ref: string
  /** Optional named provider; defaults to the resolver's own default provider. */
  readonly provider?: string
}

export function secretReference(ref: string, provider?: string): SecretReference {
  return provider === undefined ? { kind: 'secret-reference', ref } : { kind: 'secret-reference', ref, provider }
}

export function isSecretReference(value: unknown): value is SecretReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'secret-reference' &&
    typeof (value as { ref?: unknown }).ref === 'string'
  )
}

const REDACTED = '[REDACTED]'

/**
 * A resolved secret. Never store the raw value on a plain field: the raw
 * value is only reachable via `.reveal()`, and every other access path
 * (`toString`, `toJSON`, default `util.inspect`/console formatting via
 * `[Symbol.for('nodejs.util.inspect.custom')]`) is redacted.
 */
export class ResolvedSecret {
  readonly reference: SecretReference
  private readonly rawValue: string

  constructor(reference: SecretReference, rawValue: string) {
    this.reference = reference
    this.rawValue = rawValue
  }

  /** Deliberately reveals the raw secret value. Callers must not log or serialize the result. */
  reveal(): string {
    return this.rawValue
  }

  toString(): string {
    return REDACTED
  }

  toJSON(): string {
    return REDACTED
  }
}

export interface SecretResolver {
  resolve(reference: SecretReference): ResolvedSecret | Promise<ResolvedSecret>
}
