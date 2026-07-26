import { afterEach } from 'vitest'

/**
 * Node 26 exposes an experimental `globalThis.localStorage` accessor which
 * returns `undefined` unless the process is started with
 * `--localstorage-file`. jsdom sees that inherited accessor and, depending on
 * worker startup order, may not install its own Storage object. Install a
 * deterministic per-worker implementation before test modules load so the
 * normal `npm test` command does not depend on an undocumented NODE_OPTIONS
 * flag.
 */
class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(String(key)) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.values.set(String(key), String(value))
  }
}

function installStorage(target: typeof globalThis, name: 'localStorage' | 'sessionStorage'): void {
  Object.defineProperty(target, name, {
    configurable: true,
    enumerable: true,
    writable: false,
    value: new MemoryStorage(),
  })
}

if (typeof window !== 'undefined') {
  installStorage(window, 'localStorage')
  installStorage(window, 'sessionStorage')
}

afterEach(() => {
  if (typeof window === 'undefined') return
  window.localStorage.clear()
  window.sessionStorage.clear()
})
