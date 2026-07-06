#!/usr/bin/env node
/**
 * Minimal CLI over the core workflow so the Phase 3 trial is reproducible
 * without the GUI (delivery plan Phase 5 exit criterion).
 *
 * Commands:
 *   euik inventory <repoPath> --project <id> --packet <id> [--out dir]
 *   euik flatfile  <repoPath> --project <id> --packet <id> --out file
 *   euik inspect   <zipPath> --target <repoRoot> [--expect a,b,c] [--out file]
 *   euik apply     <zipPath> --target <repoRoot> [--accept-warnings] [--out file]
 *   euik verify    <repoRoot> [--commands typecheck,build] [--out dir]
 *   euik manifest  <file...>       (enforces the three-file budget)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { buildContext } from './contextBuilder.js'
import { inspectOverlay, applyOverlay } from './overlay.js'
import { runCommand } from './commandRunner.js'
import { buildPacketManifest } from './budget.js'

type Flags = Record<string, string | boolean>

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = []
  const flags: Flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

function writeOrPrint(value: unknown, outPath?: string): void {
  const text = JSON.stringify(value, null, 2)
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
    fs.writeFileSync(outPath, text + '\n')
    console.log(`wrote ${outPath}`)
  } else {
    console.log(text)
  }
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, flags } = parseArgs(rest)

  switch (command) {
    case 'inventory': {
      const repo = positional[0]
      if (!repo) throw new Error('usage: euik inventory <repoPath> --project <id> --packet <id> [--out file]')
      const result = buildContext(repo, {
        projectId: String(flags['project'] ?? 'unknown-project'),
        packetId: String(flags['packet'] ?? 'unknown-packet'),
        sourceRepo: path.basename(path.resolve(repo)),
      })
      writeOrPrint(result.inventory, typeof flags['out'] === 'string' ? flags['out'] : undefined)
      return 0
    }
    case 'flatfile': {
      const repo = positional[0]
      const out = flags['out']
      if (!repo || typeof out !== 'string') throw new Error('usage: euik flatfile <repoPath> --project <id> --packet <id> --out <file>')
      const result = buildContext(repo, {
        projectId: String(flags['project'] ?? 'unknown-project'),
        packetId: String(flags['packet'] ?? 'unknown-packet'),
        sourceRepo: path.basename(path.resolve(repo)),
      })
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
      fs.writeFileSync(out, result.flatfileText)
      console.log(`wrote ${out} (${result.inventory.includedFileCount} files, ${result.inventory.excludedFileCount} excluded, ${result.inventory.contextWarnings.length} warnings)`)
      return 0
    }
    case 'inspect': {
      const zip = positional[0]
      const target = flags['target']
      if (!zip || typeof target !== 'string') throw new Error('usage: euik inspect <zipPath> --target <repoRoot> [--expect a,b,c] [--out file]')
      const expected = typeof flags['expect'] === 'string' ? String(flags['expect']).split(',') : undefined
      const summary = inspectOverlay(zip, {
        runId: String(flags['run'] ?? 'cli-run'),
        targetRoot: target,
        ...(expected ? { expectedFiles: expected } : {}),
      })
      writeOrPrint(summary, typeof flags['out'] === 'string' ? flags['out'] : undefined)
      console.error(`verdict: ${summary.canApply ? (summary.warnings.length ? 'warning' : 'pass') : 'blocked'} (${summary.hardBlockers.length} blockers, ${summary.warnings.length} warnings)`)
      return summary.canApply ? 0 : 2
    }
    case 'apply': {
      const zip = positional[0]
      const target = flags['target']
      if (!zip || typeof target !== 'string') throw new Error('usage: euik apply <zipPath> --target <repoRoot> [--expect a,b,c] [--accept-warnings] [--out file]')
      const expected = typeof flags['expect'] === 'string' ? String(flags['expect']).split(',') : undefined
      const summary = inspectOverlay(zip, {
        runId: String(flags['run'] ?? 'cli-run'),
        targetRoot: target,
        ...(expected ? { expectedFiles: expected } : {}),
      })
      const applied = applyOverlay(zip, summary, {
        runId: String(flags['run'] ?? 'cli-run'),
        targetRoot: target,
        acceptWarnings: flags['accept-warnings'] === true,
      })
      writeOrPrint(applied, typeof flags['out'] === 'string' ? flags['out'] : undefined)
      return 0
    }
    case 'verify': {
      const repo = positional[0]
      if (!repo) throw new Error('usage: euik verify <repoRoot> [--commands typecheck,build] [--out dir]')
      const labels = typeof flags['commands'] === 'string' ? String(flags['commands']).split(',') : ['typecheck', 'build']
      let failures = 0
      for (const label of labels) {
        const result = await runCommand({
          runId: String(flags['run'] ?? 'cli-run'),
          commandLabel: label,
          commandText: `npm run ${label}`,
          workingDirectory: repo,
          ...(typeof flags['out'] === 'string' ? { outputDir: String(flags['out']) } : {}),
        })
        console.log(`${result.status.toUpperCase()}  ${label}  exit=${result.exitCode}`)
        if (result.status !== 'passed') failures++
      }
      return failures === 0 ? 0 : 1
    }
    case 'manifest': {
      if (positional.length === 0) throw new Error('usage: euik manifest <file...>')
      writeOrPrint({ files: buildPacketManifest(positional) }, typeof flags['out'] === 'string' ? flags['out'] : undefined)
      return 0
    }
    default:
      console.error('usage: euik <inventory|flatfile|inspect|apply|verify|manifest> ...')
      return 64
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
