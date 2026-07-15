import { describe, expect, it } from 'vitest'
import { createToken, LifecycleContainer, type ServiceToken } from '../src/lifecycle.js'

interface Counter {
  readonly id: number
}

describe('LifecycleContainer scopes', () => {
  it('reuses a singleton across child scopes', () => {
    const container = new LifecycleContainer()
    const token: ServiceToken<Counter> = createToken('counter')
    let created = 0
    container.register({
      token,
      lifecycle: 'singleton',
      factory: () => {
        created += 1
        return { id: created }
      },
    })

    const root = container.createRootScope()
    const child1 = root.createChildScope('job-1')
    const child2 = root.createChildScope('job-2')

    const first = root.resolve(token)
    const second = child1.resolve(token)
    const third = child2.resolve(token)

    expect(created).toBe(1)
    expect(first).toBe(second)
    expect(second).toBe(third)
  })

  it('creates a fresh instance for every resolution of a transient registration', () => {
    const container = new LifecycleContainer()
    const token: ServiceToken<Counter> = createToken('transient-counter')
    let created = 0
    container.register({
      token,
      lifecycle: 'transient',
      factory: () => {
        created += 1
        return { id: created }
      },
    })

    const scope = container.createRootScope()
    const first = scope.resolve(token)
    const second = scope.resolve(token)

    expect(created).toBe(2)
    expect(first).not.toBe(second)
  })

  it('resolves one request-job instance per scope, and a new one per child scope', () => {
    const container = new LifecycleContainer()
    const token: ServiceToken<Counter> = createToken('request-job-counter')
    let created = 0
    container.register({
      token,
      lifecycle: 'request-job',
      factory: () => {
        created += 1
        return { id: created }
      },
    })

    const root = container.createRootScope()
    const jobScopeA = root.createChildScope('job-a')
    const jobScopeB = root.createChildScope('job-b')

    const first = jobScopeA.resolve(token)
    const second = jobScopeA.resolve(token)
    const third = jobScopeB.resolve(token)

    expect(first).toBe(second)
    expect(first).not.toBe(third)
    expect(created).toBe(2)
  })

  it('disposes request-job instances within a scope in reverse creation order', async () => {
    const container = new LifecycleContainer()
    const tokenA: ServiceToken<Counter> = createToken('dispose-a')
    const tokenB: ServiceToken<Counter> = createToken('dispose-b')
    const disposedOrder: string[] = []

    container.register({
      token: tokenA,
      lifecycle: 'request-job',
      factory: () => ({ id: 1 }),
      dispose: () => {
        disposedOrder.push('a')
      },
    })
    container.register({
      token: tokenB,
      lifecycle: 'request-job',
      factory: () => ({ id: 2 }),
      dispose: () => {
        disposedOrder.push('b')
      },
    })

    const scope = container.createRootScope().createChildScope('job')
    scope.resolve(tokenA)
    scope.resolve(tokenB)

    await scope.dispose()

    expect(disposedOrder).toEqual(['b', 'a'])
    expect(scope.disposed).toBe(true)
    expect(() => scope.resolve(tokenA)).toThrow()
  })

  it('lists registrations for static inspection', () => {
    const container = new LifecycleContainer()
    const token: ServiceToken<Counter> = createToken('inspectable')
    container.register({ token, lifecycle: 'singleton', factory: () => ({ id: 1 }) })

    const registrations = container.listRegistrations()
    expect(registrations).toHaveLength(1)
    expect(registrations[0]?.token).toBe(token)
    expect(registrations[0]?.lifecycle).toBe('singleton')
    expect(container.isRegistered(token)).toBe(true)
  })

  it('rejects a duplicate registration for the same token', () => {
    const container = new LifecycleContainer()
    const token: ServiceToken<Counter> = createToken('dup')
    container.register({ token, lifecycle: 'singleton', factory: () => ({ id: 1 }) })

    expect(() => container.register({ token, lifecycle: 'transient', factory: () => ({ id: 2 }) })).toThrow()
  })
})
