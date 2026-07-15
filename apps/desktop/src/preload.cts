/**
 * Preload bridge: exposes the narrow typed workflow API as `window.euik`.
 * Every method forwards to a named IPC channel; nothing else crosses the
 * boundary (PRD §9.4, ARCH-STATE-006).
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'

const CHANNELS = {
  appVersion: 'app:version',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  listProjects: 'projects:list',
  createProject: 'projects:create',
  updateProject: 'projects:update',
  listRuns: 'runs:list',
  createRun: 'runs:create',
  getRun: 'runs:get',
  updateRun: 'runs:update',
  pickDirectory: 'dialog:pick-directory',
  pickZipFile: 'dialog:pick-zip',
  addReferenceFile: 'workflow:add-reference-file',
  prepareContext: 'workflow:prepare-context',
  buildPacket: 'workflow:build-packet',
  getArtifactText: 'workflow:get-artifact-text',
  inspectOverlay: 'overlay:inspect',
  applyOverlay: 'overlay:apply',
  runVerification: 'verify:run',
  installDependencies: 'project:install-dependencies',
  saveFeedback: 'review:save-feedback',
  buildReviewPacket: 'review:build-packet',
  captureEvidence: 'evidence:capture',
  getEvidence: 'evidence:get',
  captureProjectThumbnail: 'project:capture-thumbnail',
  startUploadDrag: 'dnd:start-upload-drag',
  copyUploadSet: 'clipboard:copy-upload-set',
  launchApp: 'app:launch-target',
  openExternal: 'shell:open-external',
  openPath: 'shell:open-path',
  showInFolder: 'shell:show-in-folder',
  capabilitiesEnsureInitialized: 'capabilities:ensure-initialized',
  capabilitiesGetApplication: 'capabilities:get-application',
  capabilitiesSaveApplicationDraft: 'capabilities:save-application-draft',
  capabilitiesApproveApplication: 'capabilities:approve-application',
  capabilitiesEvaluateProductGate: 'capabilities:evaluate-product-gate',
  capabilitiesBuildInterviewPacket: 'capabilities:build-interview-packet',
  capabilitiesExportInterviewPacket: 'capabilities:export-interview-packet',
  capabilitiesExportImplementationPacket: 'capabilities:export-implementation-packet',
  capabilitiesStartHandoffDrag: 'capabilities:start-handoff-drag',
  capabilitiesImportInterviewResponse: 'capabilities:import-interview-response',
  capabilitiesGetArchitecture: 'capabilities:get-architecture',
  capabilitiesSaveArchitectureDraft: 'capabilities:save-architecture-draft',
  capabilitiesApproveArchitecture: 'capabilities:approve-architecture',
  capabilitiesSaveModuleDraft: 'capabilities:save-module-draft',
  capabilitiesApproveModule: 'capabilities:approve-module',
  capabilitiesListModules: 'capabilities:list-modules',
  capabilitiesListBindings: 'capabilities:list-bindings',
  capabilitiesListRuns: 'capabilities:list-runs',
  capabilitiesCreateRun: 'capabilities:create-run',
  capabilitiesInspectOverlay: 'capabilities:inspect-overlay',
  capabilitiesApplyOverlay: 'capabilities:apply-overlay',
  capabilitiesCalculateFreshness: 'capabilities:calculate-freshness',
  capabilitiesFilesystemRead: 'capabilities:filesystem-read',
  capabilitiesFilesystemWrite: 'capabilities:filesystem-write',
  capabilitiesSecretPut: 'capabilities:secret-put',
  capabilitiesMatlabSessionStatus: 'capabilities:matlab-session-status',
  capabilitiesMatlabInvoke: 'capabilities:matlab-invoke',
  capabilitiesAzureDiscover: 'capabilities:azure-discover',
  capabilitiesAzureImportWorkItem: 'capabilities:azure-import-work-item',
  capabilitiesInvokeOperation: 'capabilities:invoke-operation',
  capabilitiesSaveBindingDraft: 'capabilities:save-binding-draft',
  capabilitiesApproveBinding: 'capabilities:approve-binding',
  capabilitiesListDeployables: 'capabilities:list-deployables',
  capabilitiesListInboundBindings: 'capabilities:list-inbound-bindings',
  capabilitiesSaveInboundBindingDraft: 'capabilities:save-inbound-binding-draft',
  capabilitiesApproveInboundBinding: 'capabilities:approve-inbound-binding',
  capabilitiesListNeedsAttention: 'capabilities:list-needs-attention',
  capabilitiesCalculateImpact: 'capabilities:calculate-impact',
  capabilitiesApproveImpact: 'capabilities:approve-impact',
  capabilitiesListImpacts: 'capabilities:list-impacts',
  capabilitiesDeltaQueueState: 'capabilities:delta-queue-state',
  capabilitiesExportDeltaPacket: 'capabilities:export-delta-packet',
  capabilitiesMarkDeltaTargetComplete: 'capabilities:mark-delta-target-complete',
  capabilitiesRunModuleVerification: 'capabilities:run-module-verification',
  capabilitiesVerifyApprovedModule: 'capabilities:verify-approved-module',
} as const

// Compile-time bridge parity guard: the preload channel surface must match the
// shared EuikBridge contract in both directions. Adding a method to one without
// the other turns _parity un-assignable and fails `npm run typecheck -w
// apps/desktop`. Keeps preload, bridgeApi, and the renderer contract in lockstep.
import type { EuikBridge } from './bridgeApi.js'
type _ChannelKeys = keyof typeof CHANNELS
type _BridgeKeys = keyof EuikBridge
// `getDroppedFilePath` is a synchronous preload method backed by webUtils
// (see below), not an IPC channel, so it is excluded from the channel side.
type _NonChannelBridgeKeys = 'getDroppedFilePath'
type _MissingFromChannels = Exclude<_BridgeKeys, _ChannelKeys | _NonChannelBridgeKeys>
type _MissingFromBridge = Exclude<_ChannelKeys, _BridgeKeys>
const _parity: [_MissingFromChannels] extends [never]
  ? [_MissingFromBridge] extends [never]
    ? true
    : never
  : never = true
void _parity

const bridge: Record<string, (...args: any[]) => any> = Object.fromEntries( // eslint-disable-line @typescript-eslint/no-explicit-any
  Object.entries(CHANNELS).map(([method, channel]) => [
    method,
    (...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  ]),
)

bridge.getDroppedFilePath = (file: File) => webUtils.getPathForFile(file)

contextBridge.exposeInMainWorld('euik', bridge)
