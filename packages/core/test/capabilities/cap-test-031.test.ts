/**
 * CAP-TEST-031 — Binding execution and simulation modes (no mock server).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  bindingModeLabel,
  simulateBindingMode,
  type AdapterCallSpy,
  type ApprovedBindingExample,
} from '../../src/capabilities/binding.js'
import type { BindingDataMode, FrontendBinding } from '../../src/capabilities/types.js'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

function loadValidBinding(): FrontendBinding {
  return JSON.parse(readFileSync(path.join(fixtures, 'frontend-binding-valid.json'), 'utf8'))
}

const example: ApprovedBindingExample = {
  id: 'ex.1',
  version: '1.0.0',
  operationContractVersion: '1.0.0',
  input: { text: 'hello' },
  expectedResult: { status: 'ok' },
  matchingRule: 'exact',
  source: 'acceptance',
}

describe('CAP-TEST-031 binding modes', () => {
  it('labels every data mode', () => {
    const modes: BindingDataMode[] = [
      'connected',
      'approved-example',
      'invalid-input',
      'dependency-unavailable',
      'timeout',
    ]
    for (const mode of modes) {
      expect(bindingModeLabel(mode).length).toBeGreaterThan(0)
      expect(bindingModeLabel(mode).toLowerCase()).toContain(
        mode === 'connected' ? 'connected' : 'simul',
      )
    }
  })

  it('runs connected path only with explicit:true and returns a desktop invoke plan', () => {
    const binding = loadValidBinding()
    const denied = simulateBindingMode({ binding, mode: 'connected', explicit: false })
    expect(denied.qualifiesForConnectedVerification).toBe(false)
    expect(denied.connectedInvokePlan).toBeUndefined()
    expect(denied.envelope.outcome).toBe('technical-failure')
    expect(denied.diagnostics.some((d) => d.code === 'CAP-SEC-002')).toBe(true)

    const allowed = simulateBindingMode({
      binding,
      mode: 'connected',
      explicit: true,
      args: { text: 'go' },
    })
    expect(allowed.modeLabel).toMatch(/connected/i)
    expect(allowed.qualifiesForConnectedVerification).toBe(true)
    expect(allowed.adapterCalled).toBe(false)
    expect(allowed.connectedInvokePlan).toEqual({
      projectId: binding.projectId,
      operationId: binding.operationId,
      operationVersion: binding.operationVersion,
      bindingId: binding.bindingId,
      bindingVersion: binding.version,
      args: { text: 'go' },
      dataMode: 'connected',
      explicit: true,
    })
    expect(allowed.presentation.loading).toBe(binding.loadingBehavior)
  })

  it('simulates example/invalid/unavailable/timeout without calling adapters or earning connected verification', () => {
    const binding = loadValidBinding()
    const adapter: AdapterCallSpy = { calls: [] }

    const modes: BindingDataMode[] = [
      'approved-example',
      'invalid-input',
      'dependency-unavailable',
      'timeout',
    ]
    for (const mode of modes) {
      const result = simulateBindingMode({
        binding,
        mode,
        example,
        adapter,
        explicit: true,
      })
      expect(result.modeLabel.toLowerCase()).toContain('simul')
      expect(result.adapterCalled).toBe(false)
      expect(result.qualifiesForConnectedVerification).toBe(false)
      expect(result.connectedInvokePlan).toBeUndefined()
      expect(result.presentation.outcome).toBe(result.envelope.outcome)
      expect(result.presentation.validation).toBe(binding.validationBehavior)
      expect(result.presentation.domainRejection).toBe(binding.domainRejectionBehavior)
      expect(result.presentation.technicalFailure).toBe(binding.technicalFailureBehavior)
    }

    expect(adapter.calls).toEqual([])

    const exampleResult = simulateBindingMode({
      binding,
      mode: 'approved-example',
      example,
      adapter,
    })
    expect(exampleResult.envelope.outcome).toBe('success')
    expect((exampleResult.envelope.value as { exampleId: string }).exampleId).toBe('ex.1')

    const invalid = simulateBindingMode({ binding, mode: 'invalid-input', adapter })
    expect(invalid.envelope.outcome).toBe('domain-rejection')

    const unavailable = simulateBindingMode({ binding, mode: 'dependency-unavailable', adapter })
    expect(unavailable.envelope.outcome).toBe('technical-failure')
    expect(unavailable.envelope.error?.category).toBe('dependency')

    const timeout = simulateBindingMode({ binding, mode: 'timeout', adapter })
    expect(timeout.envelope.outcome).toBe('technical-failure')
    expect(timeout.envelope.error?.category).toBe('timeout')
  })
})
