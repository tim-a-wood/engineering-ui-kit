/**
 * Browser configuration boundary (§7.1, §15.1). Browser code has no
 * `process.env`; configuration is injected explicitly (e.g. from a
 * server-rendered `<script>` payload or a build-time-generated object), and
 * this reader never reaches into a host global implicitly.
 */

import type { ConfigurationReader } from '../configuration.js'

/**
 * A {@link ConfigurationReader} backed by a plain object supplied by the
 * embedding page. Read-only: browser code never mutates configuration.
 */
export class BrowserConfigurationReader implements ConfigurationReader {
  private readonly values: ReadonlyMap<string, string>

  constructor(source: Readonly<Record<string, string>> = {}) {
    this.values = new Map(Object.entries(source))
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

/**
 * Reads a configuration payload previously placed on `globalThis` under
 * `globalKey` (e.g. by a server-rendered `<script>window.__APP_CONFIG__={...}</script>`
 * tag). Returns an empty reader — never throws — if the global is absent or
 * malformed, since a missing global usually means "not configured yet"
 * rather than a caller defect.
 */
export function readBrowserConfigurationFromGlobal(globalKey: string): BrowserConfigurationReader {
  const globalValue = (globalThis as Record<string, unknown>)[globalKey]
  if (globalValue === undefined || globalValue === null || typeof globalValue !== 'object') {
    return new BrowserConfigurationReader()
  }
  const entries: Record<string, string> = {}
  for (const [key, value] of Object.entries(globalValue as Record<string, unknown>)) {
    if (typeof value === 'string') {
      entries[key] = value
    }
  }
  return new BrowserConfigurationReader(entries)
}
