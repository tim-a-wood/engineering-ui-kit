/**
 * Capture coordinate-free UML stress fixtures through the production React,
 * JointJS, worker, ELK, and CSS rendering path.
 *
 * The script starts an isolated Vite server and a pinned Chromium instance.
 */
import { chromium } from 'playwright-core'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const guiRoot = path.join(repoRoot, 'apps/gui')
const evidenceDir = path.join(
  repoRoot,
  'docs/use-case-led-workflow/screenshots/uml-stress-2026-07-30',
)
const port = Number(process.env.EUIK_UML_STRESS_PORT ?? 4187)
const baseUrl = `http://127.0.0.1:${port}`
const executablePath = chromium.executablePath()
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-uml-stress-'))
const cases = [
  'identity-brokerage',
  'analytics-processing',
  'emergency-response',
  'device-connectivity',
  'incident-coordination',
  'hospital-access',
]

if (!fs.existsSync(executablePath)) {
  throw new Error(`Chromium is not available at ${executablePath}.`)
}
fs.mkdirSync(evidenceDir, { recursive: true })

await build({
  root: guiRoot,
  configFile: false,
  appType: 'mpa',
  base: './',
  plugins: [react()],
  build: {
    outDir: buildDir,
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(guiRoot, 'uml-stress.html'),
    },
  },
})
const mime = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0])
  const relativePath = requestPath === '/' ? 'uml-stress.html' : requestPath.replace(/^\/+/, '')
  const file = path.join(buildDir, relativePath)
  if (!file.startsWith(buildDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404)
    response.end('Not found')
    return
  }
  response.writeHead(200, {
    'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
  })
  fs.createReadStream(file).pipe(response)
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(port, '127.0.0.1', resolve)
})
const browser = await chromium.launch({ executablePath, headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1080 },
    deviceScaleFactor: 1,
  })
  page.setDefaultTimeout(30_000)
  for (const caseId of cases) {
    await page.goto(`${baseUrl}/uml-stress.html?case=${caseId}`, {
      waitUntil: 'networkidle',
    })
    await page.locator('.uml-joint-paper svg').waitFor({ state: 'visible' })
    await page.getByText('Layout verified', { exact: true }).waitFor({ state: 'visible' })
    await page.locator('.uml-stress-shell').screenshot({
      path: path.join(evidenceDir, `${caseId}.png`),
      animations: 'disabled',
    })
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(buildDir, { recursive: true, force: true })
}

process.stdout.write(`${evidenceDir}\n`)
