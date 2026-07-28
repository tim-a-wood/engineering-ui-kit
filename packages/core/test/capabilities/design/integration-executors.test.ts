/**
 * Integration pass — real default executors for the machine API
 * (`buildDefaultExecutors`) and the synchronous command runner
 * (`repositoryAdapter.runConfiguredCommandSync`).
 *
 * §12.3 "configured commands", §19 "Verification command timeout", §20.2
 * configured allowlist.
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runConfiguredCommandSync } from '../../../src/capabilities/design/repositoryAdapter.js'
import { buildDefaultExecutors } from '../../../src/designMachineApi.js'
import { buildSampleAuditHub } from '../../../src/capabilities/design/sampleAuditHub.js'

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-exec-'))
}

describe('runConfiguredCommandSync', () => {
  it('runs an allowlisted command and captures the exit code', () => {
    const cwd = tempDir()
    const result = runConfiguredCommandSync({
      command: process.execPath,
      args: ['-e', 'process.exit(0)'],
      cwd,
      root: cwd,
      timeoutMs: 30_000,
      allowedCommands: [process.execPath],
    })
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('rejects a command outside the allowlist before spawning', () => {
    const cwd = tempDir()
    expect(() =>
      runConfiguredCommandSync({
        command: process.execPath,
        cwd,
        root: cwd,
        timeoutMs: 30_000,
        allowedCommands: ['/usr/bin/true'],
      }),
    ).toThrow(/allowlist/)
  })

  it('stops a command at the timeout and records timedOut', () => {
    const cwd = tempDir()
    const result = runConfiguredCommandSync({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 60000)'],
      cwd,
      root: cwd,
      timeoutMs: 500,
      allowedCommands: [process.execPath],
    })
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).not.toBe(0)
  })
})

describe('buildDefaultExecutors.verifyModule', () => {
  const sample = buildSampleAuditHub()
  const approvedDesign = sample.moduleDesigns.find((design) => design.status === 'approved')!

  it('fails honestly when the design has no configured commands', () => {
    const root = tempDir()
    const executors = buildDefaultExecutors(root)
    const design = {
      ...approvedDesign,
      verification: { ...approvedDesign.verification, configuredCommands: [] },
    }
    const outcome = executors.verifyModule!({ design, plan: { moduleId: design.module.moduleId, cases: [] } as never }, {})
    expect(outcome.passed).toBe(false)
    expect(outcome.diagnostics?.[0]?.code).toBe('EUC16-VERIFY-NO-COMMANDS')
  })

  it('passes when every configured command exits zero', () => {
    const root = tempDir()
    const executors = buildDefaultExecutors(root)
    const design = {
      ...approvedDesign,
      verification: {
        ...approvedDesign.verification,
        configuredCommands: [`${process.execPath} -e process.exit(0)`],
      },
    }
    const outcome = executors.verifyModule!({ design, plan: { moduleId: design.module.moduleId, cases: [] } as never }, {})
    expect(outcome.passed).toBe(true)
    expect(outcome.evidenceRefs?.length).toBe(1)
  })

  it('fails with a blocker diagnostic when a command exits nonzero', () => {
    const root = tempDir()
    const executors = buildDefaultExecutors(root)
    const design = {
      ...approvedDesign,
      verification: {
        ...approvedDesign.verification,
        configuredCommands: [`${process.execPath} -e process.exit(3)`],
      },
    }
    const outcome = executors.verifyModule!({ design, plan: { moduleId: design.module.moduleId, cases: [] } as never }, {})
    expect(outcome.passed).toBe(false)
    expect(outcome.diagnostics?.[0]?.code).toBe('EUC16-VERIFY-FAILED')
  })
})
