/**
 * Small, statically inspectable composition container (§10.2). Generated
 * composition roots register services with an explicit lifecycle and
 * resolve them through request-job/transient scopes; this is intentionally
 * lightweight rather than a full DI framework.
 */

export type Lifecycle = 'singleton' | 'request-job' | 'transient'

/** A branded string identifying a registration. Branding is compile-time only. */
export type ServiceToken<T = unknown> = string & { readonly __serviceTokenType?: T }

export function createToken<T>(name: string): ServiceToken<T> {
  return name as ServiceToken<T>
}

export interface ResolutionContext {
  resolve<T>(token: ServiceToken<T>): T
}

export interface ServiceRegistration<T = unknown> {
  readonly token: ServiceToken<T>
  readonly lifecycle: Lifecycle
  readonly factory: (container: ResolutionContext) => T
  /** Invoked when the owning scope disposes, in reverse creation order. */
  readonly dispose?: (instance: T) => void | Promise<void>
}

export interface Scope extends ResolutionContext {
  readonly id: string
  createChildScope(id?: string): Scope
  dispose(): Promise<void>
  readonly disposed: boolean
}

interface DisposableEntry {
  readonly token: ServiceToken
  readonly instance: unknown
}

class ContainerScope implements Scope {
  private readonly singletons: Map<ServiceToken, unknown>
  private readonly requestJobInstances = new Map<ServiceToken, unknown>()
  private readonly disposables: DisposableEntry[] = []
  private isDisposed = false

  constructor(
    private readonly registrations: ReadonlyMap<ServiceToken, ServiceRegistration>,
    private readonly parent: ContainerScope | undefined,
    readonly id: string,
  ) {
    this.singletons = parent ? parent.singletons : new Map()
  }

  get disposed(): boolean {
    return this.isDisposed
  }

  resolve<T>(token: ServiceToken<T>): T {
    if (this.isDisposed) {
      throw new Error(`Cannot resolve "${String(token)}": scope "${this.id}" has been disposed.`)
    }
    const registration = this.registrations.get(token) as ServiceRegistration<T> | undefined
    if (!registration) {
      throw new Error(`No registration for token "${String(token)}".`)
    }

    if (registration.lifecycle === 'singleton') {
      if (this.singletons.has(token)) {
        return this.singletons.get(token) as T
      }
      const instance = registration.factory(this)
      this.singletons.set(token, instance)
      this.root().trackDisposable(registration, token, instance)
      return instance
    }

    if (registration.lifecycle === 'transient') {
      const instance = registration.factory(this)
      this.trackDisposable(registration, token, instance)
      return instance
    }

    // request-job: one instance per scope instance
    if (this.requestJobInstances.has(token)) {
      return this.requestJobInstances.get(token) as T
    }
    const instance = registration.factory(this)
    this.requestJobInstances.set(token, instance)
    this.trackDisposable(registration, token, instance)
    return instance
  }

  private trackDisposable<T>(registration: ServiceRegistration<T>, token: ServiceToken<T>, instance: T): void {
    if (registration.dispose) {
      this.disposables.push({ token, instance })
    }
  }

  private root(): ContainerScope {
    let current: ContainerScope = this
    while (current.parent) current = current.parent
    return current
  }

  createChildScope(id?: string): Scope {
    if (this.isDisposed) {
      throw new Error(`Cannot create a child scope: scope "${this.id}" has been disposed.`)
    }
    return new ContainerScope(this.registrations, this, id ?? `${this.id}/child`)
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return
    this.isDisposed = true
    for (let i = this.disposables.length - 1; i >= 0; i -= 1) {
      const entry = this.disposables[i] as DisposableEntry
      const registration = this.registrations.get(entry.token)
      if (registration?.dispose) {
        await registration.dispose(entry.instance)
      }
    }
    this.disposables.length = 0
    this.requestJobInstances.clear()
  }
}

export class LifecycleContainer {
  private readonly registrations = new Map<ServiceToken, ServiceRegistration>()

  register<T>(registration: ServiceRegistration<T>): void {
    if (this.registrations.has(registration.token)) {
      throw new Error(`Duplicate registration for token "${String(registration.token)}".`)
    }
    this.registrations.set(registration.token, registration as ServiceRegistration)
  }

  /** Statically inspectable list of all registrations (for startup validation/composition audits). */
  listRegistrations(): ReadonlyArray<ServiceRegistration> {
    return Array.from(this.registrations.values())
  }

  isRegistered(token: ServiceToken): boolean {
    return this.registrations.has(token)
  }

  createRootScope(id = 'root'): Scope {
    return new ContainerScope(this.registrations, undefined, id)
  }
}
