/**
 * Generic outbound HTTP adapter foundation (§15.3). Validates the target
 * URL against an allow-list of schemes/hosts, bounds redirects/timeout/
 * response body size, and redacts credential-shaped headers before the
 * request/response ever reaches a log or thrown error. Built on the
 * platform `fetch` (global since Node 18) — no extra dependency.
 */

const REDACTED = '[REDACTED]'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_REDIRECTS = 5
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024

const CREDENTIAL_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization'])

export interface HttpAdapterOptions {
  /** Allowed URL schemes, e.g. `['https:']`. Defaults to `['https:']`. */
  readonly allowedSchemes?: ReadonlyArray<string>
  /** Allowed hostnames. If omitted, any hostname is allowed (still subject to scheme validation). */
  readonly allowedHosts?: ReadonlyArray<string>
  readonly timeoutMs?: number
  readonly maxRedirects?: number
  readonly maxResponseBytes?: number
}

export interface OutboundHttpRequest {
  readonly url: string
  readonly method?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: string
  readonly signal?: AbortSignal
}

export interface OutboundHttpResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export class HttpAdapterError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-url' | 'too-many-redirects' | 'response-too-large' | 'timeout' | 'network-error',
  ) {
    super(message)
    this.name = 'HttpAdapterError'
  }
}

/** Redacts values of well-known credential-carrying header names for safe logging. */
export function redactHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const redacted: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    redacted[name] = CREDENTIAL_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED : value
  }
  return redacted
}

function validateUrl(rawUrl: string, options: HttpAdapterOptions): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new HttpAdapterError(`invalid URL: "${rawUrl}"`, 'invalid-url')
  }
  const allowedSchemes = options.allowedSchemes ?? ['https:']
  if (!allowedSchemes.includes(url.protocol)) {
    throw new HttpAdapterError(`URL scheme "${url.protocol}" is not allowed`, 'invalid-url')
  }
  if (options.allowedHosts && !options.allowedHosts.includes(url.hostname)) {
    throw new HttpAdapterError(`URL host "${url.hostname}" is not allowed`, 'invalid-url')
  }
  return url
}

/** A generic outbound HTTP adapter with URL/scheme/host allow-listing and bounded redirects/timeout/body. */
export class NodeHttpClientAdapter {
  constructor(private readonly options: HttpAdapterOptions = {}) {}

  async request(request: OutboundHttpRequest): Promise<OutboundHttpResponse> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxRedirects = this.options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
    const maxResponseBytes = this.options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES

    let currentUrl = validateUrl(request.url, this.options)
    let method = request.method ?? 'GET'
    let body = request.body
    let redirectsFollowed = 0

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const withUnref = timeoutId as unknown as { unref?: () => void }
    if (typeof withUnref.unref === 'function') withUnref.unref()
    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort())
    }

    try {
      for (;;) {
        let response: Response
        try {
          response = await fetch(currentUrl, {
            method,
            headers: request.headers,
            body,
            redirect: 'manual',
            signal: controller.signal,
          })
        } catch (error) {
          if (controller.signal.aborted) {
            throw new HttpAdapterError(`request to "${currentUrl.toString()}" timed out`, 'timeout')
          }
          throw new HttpAdapterError(
            `network error requesting "${currentUrl.toString()}": ${error instanceof Error ? error.message : String(error)}`,
            'network-error',
          )
        }

        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          redirectsFollowed += 1
          if (redirectsFollowed > maxRedirects) {
            throw new HttpAdapterError(`exceeded ${maxRedirects} redirects following "${request.url}"`, 'too-many-redirects')
          }
          const location = response.headers.get('location')
          if (!location) break
          currentUrl = validateUrl(new URL(location, currentUrl).toString(), this.options)
          method = 'GET'
          body = undefined
          continue
        }

        const text = await response.text()
        if (Buffer.byteLength(text, 'utf8') > maxResponseBytes) {
          throw new HttpAdapterError(`response body exceeded ${maxResponseBytes} bytes`, 'response-too-large')
        }
        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          headers[key] = value
        })
        return { status: response.status, headers, body: text }
      }
      throw new HttpAdapterError('redirect response missing a usable Location header', 'network-error')
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
