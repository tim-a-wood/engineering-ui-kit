/**
 * Configuration protocol (§15.1). Contracts and generated code reference
 * configuration by key, never by embedding values; this package defines
 * the reader protocol plus a trivial in-memory implementation. Real
 * process-environment binding is a host-package concern.
 */

export interface ConfigurationReader {
  /** Returns the configured value for `key`, or `undefined` if absent. */
  get(key: string): string | undefined
  /** Returns the configured value for `key`, throwing if absent. */
  require(key: string): string
}

export class MapConfigurationReader implements ConfigurationReader {
  private readonly values: ReadonlyMap<string, string>

  constructor(values: Readonly<Record<string, string>> | ReadonlyMap<string, string> = {}) {
    this.values = values instanceof Map ? values : new Map(Object.entries(values))
  }

  get(key: string): string | undefined {
    return this.values.get(key)
  }

  require(key: string): string {
    const value = this.values.get(key)
    if (value === undefined) {
      throw new Error(`Missing required configuration key: "${key}"`)
    }
    return value
  }
}
