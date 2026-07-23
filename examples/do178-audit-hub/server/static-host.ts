import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const content = Buffer.from(JSON.stringify(body))
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(content.length),
  })
  response.end(content)
}

function proxy(request: IncomingMessage, response: ServerResponse, apiPort: number): void {
  const upstream = httpRequest({
    host: '127.0.0.1',
    port: apiPort,
    method: request.method,
    path: request.url,
    headers: { ...request.headers, host: `127.0.0.1:${apiPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', () => writeJson(response, 502, {
    kind: 'failed',
    code: 'api-unavailable',
    safeMessage: 'The Audit Hub API is not available.',
    retryable: true,
  }))
  request.pipe(upstream)
}

function servePackage(
  request: IncomingMessage,
  response: ServerResponse,
  packageDirectory: string,
  pathname: string,
): boolean {
  const prefix = '/api/packages/download/'
  if (!pathname.startsWith(prefix)) return false
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    writeJson(response, 405, { kind: 'method-not-allowed' })
    return true
  }
  let fileName: string
  try {
    fileName = decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    writeJson(response, 400, { kind: 'bad-request' })
    return true
  }
  if (!/^PKG-[A-Z0-9-]+\.zip$/.test(fileName)) {
    writeJson(response, 400, { kind: 'bad-request', reason: 'invalid package identity' })
    return true
  }
  const root = resolve(packageDirectory)
  const filePath = resolve(join(root, fileName))
  if (!filePath.startsWith(`${root}${sep}`)) {
    writeJson(response, 400, { kind: 'bad-request', reason: 'path escaped the package root' })
    return true
  }
  void stat(filePath).then((details) => {
    if (!details.isFile()) {
      writeJson(response, 404, { kind: 'not-found' })
      return
    }
    response.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': String(details.size),
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(filePath).pipe(response)
  }).catch(() => writeJson(response, 404, { kind: 'not-found' }))
  return true
}

export function createStaticHost(options: {
  distDirectory: string
  apiPort: number
  packageDirectory: string
}): Server {
  const root = resolve(options.distDirectory)
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (servePackage(request, response, options.packageDirectory, url.pathname)) return
    if (url.pathname.startsWith('/api/')) {
      proxy(request, response, options.apiPort)
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      writeJson(response, 405, { kind: 'method-not-allowed' })
      return
    }
    const decoded = decodeURIComponent(url.pathname)
    const relative = decoded === '/' ? 'index.html' : normalize(decoded).replace(/^[/\\]+/, '')
    const candidate = resolve(join(root, relative))
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      writeJson(response, 400, { kind: 'bad-request', reason: 'path escaped the application root' })
      return
    }
    void stat(candidate).then((details) => {
      const filePath = details.isFile() ? candidate : join(root, 'index.html')
      response.writeHead(200, {
        'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      })
      if (request.method === 'HEAD') response.end()
      else createReadStream(filePath).pipe(response)
    }).catch(() => {
      const indexPath = join(root, 'index.html')
      response.writeHead(200, {
        'content-type': MIME['.html'],
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      })
      createReadStream(indexPath).on('error', () => {
        if (!response.headersSent) writeJson(response, 404, { kind: 'not-found' })
        else response.destroy()
      }).pipe(response)
    })
  })
}
