/**
 * CAP-TEST-013 — Capability run persistence preserves legacy handoff independence.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import { CapabilityRunStore } from '../../src/capabilities/runs.js'
import { Workspace } from '../../src/persistence.js'
import type { CapabilityRunScope } from '../../src/capabilities/types.js'

describe('CAP-TEST-013 capability run and evidence persistence', () => {
  it('persists capability runs independently of legacy HandoffRun records', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-run-'))
    const legacy = new Workspace(dir)
    const project = legacy.createProject({ name: 'P', repoPath: dir, status: 'active' })
    const handoff = legacy.createRun({ projectId: project.id, currentStep: 'prepare-context' })

    const caps = new CapabilityWorkspace(dir)
    const runs = new CapabilityRunStore(caps)
    const now = new Date().toISOString()
    const run: CapabilityRunScope = {
      schemaVersion: '1.0',
      runId: 'cap-run-1',
      kind: 'implementation',
      projectId: project.id,
      targetOwnerId: 'mod.domain',
      lifecycleState: 'draft',
      inputRevisions: {},
      inputHashes: {},
      allowedPaths: ['capabilities/modules/mod.domain/'],
      expectedPaths: [],
      protectedPaths: [],
      packetRefs: [],
      artifactRefs: [],
      transitionHistory: [],
      createdAt: now,
      updatedAt: now,
    }
    runs.createRun(run)
    runs.appendTransition(
      project.id,
      'cap-run-1',
      { at: now, actor: 'user', fromState: 'draft', toState: 'packet-exported' },
      'packet-exported',
    )
    const artifactRef = runs.saveRunArtifact(project.id, 'cap-run-1', 'overlay-inspection.json', {
      archiveSha256: 'abc',
    })
    runs.updateRun(project.id, 'cap-run-1', {
      inspectionRef: artifactRef,
      verificationRef: undefined,
    })

    expect(legacy.getRun(handoff.id)?.currentStep).toBe('prepare-context')
    expect(runs.getRun(project.id, 'cap-run-1')?.lifecycleState).toBe('packet-exported')
    expect(runs.getRun(project.id, 'cap-run-1')?.transitionHistory).toHaveLength(1)
    expect(runs.getRun(project.id, 'cap-run-1')?.inspectionRef).toBe(artifactRef)
    expect(runs.getRunArtifact(project.id, artifactRef)).toEqual({ archiveSha256: 'abc' })
    expect(() => runs.getRunArtifact(project.id, '../outside.json')).toThrow(/escaped/)
    expect(path.resolve(caps.root(project.id))).not.toBe(path.resolve(legacy.runDir(handoff.id)))
  })
})
