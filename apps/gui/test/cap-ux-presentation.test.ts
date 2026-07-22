/**
 * CAP-UX presentation helpers (capabilityPresentation).
 * Humanization, guided-diagnostic sanitization, and stage↔area/guide mappings.
 */

import { describe, expect, it } from 'vitest'
import {
  humanizeIdentifier,
  moduleTypeLabel,
  behaviorLabel,
  BEHAVIOR_FIELDS,
  freshnessLabel,
  impactClassificationLabel,
  humanizeFieldPath,
  presentDiagnosticsForGuided,
  firstRemediation,
  fileNameOf,
  formatBytes,
  stageToDesignSection,
  designSectionToStage,
  normalizeDesignSection,
  stageToGuideTopic,
  DESIGN_SECTIONS,
} from '../src/views/capabilities/capabilityPresentation'

describe('humanizeIdentifier', () => {
  it('drops known namespace and title-cases', () => {
    expect(humanizeIdentifier('mod.order-history')).toBe('Order History')
    expect(humanizeIdentifier('binding.draft')).toBe('Draft')
    expect(humanizeIdentifier('op.placeOrder')).toBe('Place Order')
    expect(humanizeIdentifier('mod.domain_orders')).toBe('Domain Orders')
  })
  it('keeps a bare identifier readable', () => {
    expect(humanizeIdentifier('checkout')).toBe('Checkout')
  })
})

describe('label maps', () => {
  it('module types use friendly labels but never rename enums', () => {
    expect(moduleTypeLabel('experience')).toBe('User experience')
    expect(moduleTypeLabel('domain')).toBe('Domain logic')
    expect(moduleTypeLabel('connection')).toBe('Connection')
  })
  it('behavior fields map to plain language', () => {
    expect(behaviorLabel('loadingBehavior')).toBe('While it runs')
    expect(behaviorLabel('technicalFailureBehavior')).toBe('Something goes wrong')
    expect(BEHAVIOR_FIELDS).toHaveLength(6)
  })
  it('freshness and impact classification are humanized', () => {
    expect(freshnessLabel('connection-outdated')).toBe('Connection outdated')
    expect(impactClassificationLabel('breaking')).toBe('Breaking change')
    expect(impactClassificationLabel('required-additive')).toBe('Required addition')
  })
})

describe('humanizeFieldPath', () => {
  it('turns schema paths into readable labels', () => {
    expect(humanizeFieldPath('outcomes[0].name')).toBe('Outcomes 1 · Name')
    expect(humanizeFieldPath('userRoles')).toBe('User Roles')
  })
})

describe('presentDiagnosticsForGuided', () => {
  it('strips CAP codes and keeps plain messages', () => {
    const issues = presentDiagnosticsForGuided([
      { code: 'CAP-GATE-001', message: 'Add at least one outcome.', severity: 'error' },
      { code: 'CAP-GATE-002', message: 'Name every user role.' },
    ])
    expect(issues).toEqual([
      { message: 'Add at least one outcome.', severity: 'error' },
      { message: 'Name every user role.', severity: 'error' },
    ])
    const joined = JSON.stringify(issues)
    expect(joined).not.toContain('CAP-GATE')
  })
  it('never silently drops a code-only diagnostic', () => {
    const issues = presentDiagnosticsForGuided([{ code: 'CAP-GATE-009' }])
    expect(issues[0]!.message).toBe('Cap Gate 009')
    expect(issues[0]!.message).not.toContain('CAP-GATE')
  })
  it('firstRemediation returns the first message', () => {
    expect(firstRemediation([{ message: 'Fix this first.' }, { message: 'then this' }])).toBe('Fix this first.')
    expect(firstRemediation([])).toBeUndefined()
  })
})

describe('paths and sizes', () => {
  it('fileNameOf shows only the basename', () => {
    expect(fileNameOf('/Users/tim/app/capabilities/generated/packet.json')).toBe('packet.json')
    expect(fileNameOf('C:\\work\\overlay.zip')).toBe('overlay.zip')
  })
  it('formatBytes is compact', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1024 * 1024 * 3)).toBe('3 MB')
  })
})

describe('stage mappings', () => {
  it('maps guided stages to design sections and back', () => {
    expect(stageToDesignSection('define')).toBe('application')
    expect(stageToDesignSection('build')).toBe('modules')
    expect(designSectionToStage('modules')).toBe('build')
    expect(designSectionToStage('verification')).toBe('verify')
    expect(normalizeDesignSection('connections')).toBe('modules')
  })
  it('maps stages to their guide topics', () => {
    expect(stageToGuideTopic('define')).toBe('capabilities-define')
    expect(stageToGuideTopic('verify')).toBe('capabilities-verify')
  })
  it('exposes the five canonical design areas in order', () => {
    expect(DESIGN_SECTIONS.map((s) => s.id)).toEqual([
      'application',
      'architecture',
      'attention',
      'modules',
      'verification',
    ])
  })
})
