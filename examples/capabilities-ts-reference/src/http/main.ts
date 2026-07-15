/**
 * Standalone runnable entry point: `npm run start:http` (see package.json).
 * Starts the real HTTP host on `PORT` (default 3000) and logs the bound
 * port. Not used by the automated tests, which start their own host on an
 * ephemeral port instead (see test/http-e2e.test.ts).
 */
import { createHttpApp } from './app.js'

async function main(): Promise<void> {
  const { host } = createHttpApp()
  const requestedPort = process.env.PORT ? Number(process.env.PORT) : 3000
  const { port } = await host.start(requestedPort)
  // eslint-disable-next-line no-console
  console.log(`capabilities-ts-reference HTTP slice listening on http://127.0.0.1:${port}`)
}

void main()
