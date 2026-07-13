/**
 * CAP-TEST-030 — Binding draft, validate, approve, and export connection packet.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildConnectionPacket,
  connectionPacketNamesSingleOperation,
  evaluateBindingApprovalGate,
  validateFrontendBinding,
  type MappingAmbiguity,
} from '../../src/capabilities/binding.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

function loadValidBinding(): FrontendBinding {
  return JSON.parse(readFileSync(path.join(fixtures, 'frontend-binding-valid.json'), 'utf8'))
}

describe('CAP-TEST-030 binding mapping and connection packet', () => {
  it('requires all behavior fields and blocks incomplete drafts', () => {
    const incomplete: FrontendBinding = {
      ...loadValidBinding(),
      loadingBehavior: '',
      validationBehavior: '   ',
      domainRejectionBehavior: '',
    }
    const diagnostics = validateFrontendBinding(incomplete)
    expect(diagnostics.some((d) => d.code === 'CAP-BIND-002')).toBe(true)
    expect(evaluateBindingApprovalGate(incomplete).passed).toBe(false)
  })

  it('requires stable marker or explicit source-target confirmation', () => {
    const binding = loadValidBinding()
    binding.selectionEvidence = {
      ...binding.selectionEvidence,
      stableMarker: undefined,
      sourceTargetConfirmed: false,
    }
    const diagnostics = validateFrontendBinding(binding)
    expect(diagnostics.some((d) => d.code === 'CAP-BIND-001')).toBe(true)
  })

  it('blocks approval until mapping ambiguity is resolved by the user', () => {
    const binding = loadValidBinding()
    binding.inputMappings = [
      { from: 'form.value', to: 'input.a' },
      { from: 'form.value', to: 'input.b' },
    ]
    const ambiguities: MappingAmbiguity[] = [
      {
        side: 'input',
        from: 'form.value',
        candidates: ['input.a', 'input.b'],
      },
    ]
    expect(evaluateBindingApprovalGate(binding, { ambiguities }).passed).toBe(false)
    expect(
      validateFrontendBinding(binding, { ambiguities }).some((d) => d.code === 'CAP-BIND-AMB-001'),
    ).toBe(true)

    const resolved: MappingAmbiguity[] = [
      {
        side: 'input',
        from: 'form.value',
        candidates: ['input.a', 'input.b'],
        resolvedTo: 'input.a',
      },
    ]
    binding.inputMappings = [{ from: 'form.value', to: 'input.a' }]
    expect(evaluateBindingApprovalGate(binding, { ambiguities: resolved }).passed).toBe(true)
  })

  it('approves a complete clear binding and exports one-operation bounded connection packet', () => {
    const binding = loadValidBinding()
    binding.inputMappings = [{ from: 'ui.text', to: 'input.text' }]
    binding.outputMappings = [{ from: 'output.status', to: 'ui.status' }]
    const gate = evaluateBindingApprovalGate(binding)
    expect(gate.passed).toBe(true)

    const packet = buildConnectionPacket({
      packetId: 'pkt-conn-1',
      binding,
      architectureVersion: '1.0',
      architectureHash: 'arch-hash',
      ownedPaths: [`capabilities/modules/connections/${binding.bindingId}/`],
    })

    expect(packet.targetKind).toBe('connection')
    expect(packet.targetId).toBe(binding.bindingId)
    expect(connectionPacketNamesSingleOperation(packet, binding)).toBe(true)
    expect(packet.inputHashes.operation).toBe(`${binding.operationId}@${binding.operationVersion}`)
    expect(packet.allowedPaths.every((p) => p.startsWith('capabilities/modules/connections/'))).toBe(
      true,
    )
    expect(packet.allowedPaths.some((p) => p.includes('..'))).toBe(false)
    expect(packet.requiredOutput).toBe('ui-overlay.zip')
  })

  it('refuses to export a packet when the binding gate fails', () => {
    const binding = loadValidBinding()
    binding.cancellationBehavior = ''
    expect(() =>
      buildConnectionPacket({
        packetId: 'pkt-bad',
        binding,
        architectureVersion: '1.0',
        architectureHash: 'h',
      }),
    ).toThrow(/cannot export connection packet/)
  })
})
