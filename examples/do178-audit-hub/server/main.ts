import { join, resolve } from 'node:path'
import { createCompositionRoot } from './composition-root.js'
import { createAuditHubHttpApi } from './http-api.js'
import { createStaticHost } from './static-host.js'

const projectRoot = resolve(process.cwd())
const appPort = Number(process.env.PORT ?? process.env.DO178_AUDIT_HUB_PORT ?? 4182)
const apiPort = Number(process.env.DO178_AUDIT_HUB_API_PORT ?? appPort + 1)
const root = createCompositionRoot({ projectRoot })
const api = createAuditHubHttpApi(root)
const staticHost = createStaticHost({
  distDirectory: resolve(projectRoot, 'dist'),
  apiPort,
  packageDirectory: join(root.dataDirectory, 'packages'),
})

await root.service.ensureSample()
await api.start(apiPort, '127.0.0.1')
await new Promise<void>((resolveStart, reject) => {
  staticHost.once('error', reject)
  staticHost.listen(appPort, '127.0.0.1', () => {
    staticHost.removeListener('error', reject)
    resolveStart()
  })
})

process.stdout.write(`DO-178C Audit Hub UI: http://127.0.0.1:${appPort}\n`)
process.stdout.write(`DO-178C Audit Hub API: http://127.0.0.1:${apiPort}/api/ready\n`)

let stopping = false
async function stop(signal: string): Promise<void> {
  if (stopping) return
  stopping = true
  process.stdout.write(`Stopping after ${signal}…\n`)
  await new Promise<void>((resolveStop) => staticHost.close(() => resolveStop()))
  await api.stop()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void stop(signal).finally(() => process.exit(0))
  })
}
