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
 *   euik machine describe [--out file]
 *   euik machine execute <request.json> --data <workspaceDir> [--out file]
 *   euik migration audit --data <workspaceDir> [--out file]
 *   euik benchmark workflow --modules N --waves N [--experience N] [--bindings N]
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { buildContext } from './contextBuilder.js'
import { inspectOverlay, applyOverlay } from './overlay.js'
import { runCommand } from './commandRunner.js'
import { buildPacketManifest } from './budget.js'
import {
  describeMachineOperations,
  executeMachineOperation,
  type MachineOperationRequest,
} from './machine.js'
import { auditWorkspaceMigrations } from './migrationAudit.js'
import { benchmarkWorkflow } from './workflowBenchmark.js'

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
    case 'machine': {
      const subcommand = positional[0]
      if (subcommand === 'describe') {
        writeOrPrint(
          describeMachineOperations(),
          typeof flags['out'] === 'string' ? flags['out'] : undefined,
        )
        return 0
      }
      if (subcommand === 'execute') {
        const requestPath = positional[1]
        const dataDir = flags['data']
        if (!requestPath || typeof dataDir !== 'string') {
          throw new Error('usage: euik machine execute <request.json> --data <workspaceDir> [--out file]')
        }
        const request = JSON.parse(fs.readFileSync(requestPath, 'utf8')) as MachineOperationRequest
        const response = await executeMachineOperation(request, { dataDir })
        writeOrPrint(response, typeof flags['out'] === 'string' ? flags['out'] : undefined)
        return response.status === 'succeeded' ? 0 : response.status === 'blocked' ? 2 : 1
      }
      throw new Error('usage: euik machine <describe|execute> ...')
    }
    case 'migration': {
      if (positional[0] !== 'audit' || typeof flags['data'] !== 'string') {
        throw new Error('usage: euik migration audit --data <workspaceDir> [--out file]')
      }
      writeOrPrint(
        auditWorkspaceMigrations(flags['data']),
        typeof flags['out'] === 'string' ? flags['out'] : undefined,
      )
      return 0
    }
    case 'benchmark': {
      if (positional[0] !== 'workflow') {
        throw new Error('usage: euik benchmark workflow --modules N --waves N [--experience N] [--bindings N] [--name text]')
      }
      const asCount = (key: string, fallback?: number) => {
        const raw = flags[key]
        if (raw === undefined && fallback !== undefined) return fallback
        const value = Number(raw)
        if (!Number.isInteger(value) || value < 0) throw new Error(`--${key} must be a non-negative integer`)
        return value
      }
      writeOrPrint(benchmarkWorkflow({
        name: typeof flags['name'] === 'string' ? flags['name'] : 'workflow',
        moduleCount: asCount('modules'),
        implementationWaveCount: asCount('waves'),
        experienceModuleCount: asCount('experience', 0),
        bindingCount: asCount('bindings', 0),
      }), typeof flags['out'] === 'string' ? flags['out'] : undefined)
      return 0
    }
    default:
      console.error('usage: euik <inventory|flatfile|inspect|apply|verify|manifest|machine|migration|benchmark> ...')
      return 64
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
