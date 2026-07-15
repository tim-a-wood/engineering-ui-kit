/**
 * Persistence port foundation (§7.1). Defines the production-composition
 * persistence protocol plus a trivial in-memory adapter for local
 * development and smoke testing; real production adapters (SQL, document
 * store, ...) are project-owned and satisfy the same port so composition
 * roots can swap implementations without touching operation code.
 */

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
}
