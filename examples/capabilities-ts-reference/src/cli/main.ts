/**
 * Standalone runnable entry point: `npm run start:cli -- <name>` (see
 * package.json). Real process argv, real `process.stdout`/`process.stderr`,
 * real `process.exitCode`. Not used by the automated tests, which inject
 * capturing writables instead (see test/cli-e2e.test.ts).
 */
import { runReferenceCli } from './app.js'

async function main(): Promise<void> {
  const exitCode = await runReferenceCli(process.argv.slice(2))
  process.exitCode = exitCode
}

void main()
