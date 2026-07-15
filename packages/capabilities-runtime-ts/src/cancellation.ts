/**
 * Cancellation primitives. Browser-safe: no `node:*` imports.
 */

export class CancellationError extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(`Operation cancelled: ${reason}`)
    this.name = 'CancellationError'
    this.reason = reason
  }
}

export interface CancellationToken {
  readonly isCancelled: boolean
  readonly reason: string | undefined
  /** Throws {@link CancellationError} if this token has been cancelled. */
  throwIfCancelled(): void
  /**
   * Registers a listener invoked once when cancellation occurs (immediately,
   * synchronously, if already cancelled). Returns an unsubscribe function.
   */
  onCancel(listener: (reason: string) => void): () => void
}

/** A token that can never be cancelled — the default for unscoped work. */
export const NEVER_CANCELLED: CancellationToken = {
  isCancelled: false,
  reason: undefined,
  throwIfCancelled(): void {
    // never cancelled
  },
  onCancel(): () => void {
    return () => {
      // nothing to unsubscribe
    }
  },
}

/** A mutable cancellation source. Production and test callers create one per
 * request/job/transient scope and hand the read-only `CancellationToken`
 * view to operations via {@link Context}. */
export class CancellationController implements CancellationToken {
  private cancelledFlag = false
  private cancelReason: string | undefined
  private readonly listeners = new Set<(reason: string) => void>()

  get isCancelled(): boolean {
    return this.cancelledFlag
  }

  get reason(): string | undefined {
    return this.cancelReason
  }

  throwIfCancelled(): void {
    if (this.cancelledFlag) {
      throw new CancellationError(this.cancelReason ?? 'cancelled')
    }
  }

  onCancel(listener: (reason: string) => void): () => void {
    if (this.cancelledFlag) {
      listener(this.cancelReason ?? 'cancelled')
      return () => {
        // already fired; nothing to unsubscribe
      }
    }
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  cancel(reason = 'cancelled'): void {
    if (this.cancelledFlag) return
    this.cancelledFlag = true
    this.cancelReason = reason
    for (const listener of this.listeners) {
      listener(reason)
    }
    this.listeners.clear()
  }
}
