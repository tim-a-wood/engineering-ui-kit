import { describe, expect, it } from 'vitest'
import { installMockBridge } from '../src/mockBridge'

/**
 * CAP-TEST-037 — bridge hostile-argument handling.
 *
 * Privileged capability operations that mutate state or reach the filesystem,
 * secrets, MATLAB, Azure, or connected runtime must require an explicit user
 * action (`explicit: true`) and must never silently succeed on a non-explicit
 * or malformed call. This is the renderer-observable half of the boundary; the
 * desktop handlers enforce the same invariants (see desktop cap ipc tests).
 */
describe('CAP-TEST-037 capability bridge rejects hostile arguments', () => {
  it('refuses privileged operations without an explicit user gesture', async () => {
    const bridge = installMockBridge()
    await expect(
      bridge.capabilitiesFilesystemWrite({ projectId: 'p', relativePath: 'a.txt', text: 'x', explicit: false }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesSecretPut({ opaqueId: 's1', label: 'PAT', secret: 'shh', explicit: false }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesMatlabInvoke({ projectId: 'p', operation: 'eval', explicit: false }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesAzureDiscover({ projectId: 'p', opaqueSecretId: 's1', explicit: false }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesAzureImportWorkItem({
        projectId: 'p',
        externalId: 'wi-1',
        revision: '1',
        content: {},
        explicit: false,
      }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesInvokeOperation({ projectId: 'p', operationId: 'op.save', dataMode: 'connected', explicit: false }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesApplyOverlay({
        projectId: 'p',
        runId: 'r1',
        zipPath: '/tmp/overlay.zip',
        acceptWarnings: false,
        explicit: false,
      }),
    ).rejects.toThrow(/explicit/i)
    await expect(
      bridge.capabilitiesVerifyApprovedModule({ projectId: 'p', moduleId: 'mod.domain', explicit: false }),
    ).rejects.toThrow(/explicit/i)
  })

  it('never leaks the raw secret value back through the bridge result', async () => {
    const bridge = installMockBridge()
    const result = (await bridge.capabilitiesSecretPut({
      opaqueId: 's1',
      label: 'PAT',
      secret: 'super-secret-token',
      explicit: true,
    })) as { value?: Record<string, unknown> }
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('super-secret-token')
    expect(result.value?.opaqueId).toBe('s1')
  })
})
