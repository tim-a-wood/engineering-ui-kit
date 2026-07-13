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
} as const

const bridge: Record<string, (...args: any[]) => any> = Object.fromEntries( // eslint-disable-line @typescript-eslint/no-explicit-any
  Object.entries(CHANNELS).map(([method, channel]) => [
    method,
    (...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  ]),
)

bridge.getDroppedFilePath = (file: File) => webUtils.getPathForFile(file)

contextBridge.exposeInMainWorld('euik', bridge)
