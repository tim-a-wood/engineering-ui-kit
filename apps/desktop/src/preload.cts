/**
 * Preload bridge: exposes the narrow typed workflow API as `window.euik`.
 * Every method forwards to a named IPC channel; nothing else crosses the
 * boundary (PRD §9.4, ARCH-STATE-006).
 */

import { contextBridge, ipcRenderer } from 'electron'

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
  prepareContext: 'workflow:prepare-context',
  buildPacket: 'workflow:build-packet',
  getArtifactText: 'workflow:get-artifact-text',
  inspectOverlay: 'overlay:inspect',
  applyOverlay: 'overlay:apply',
  runVerification: 'verify:run',
  saveFeedback: 'review:save-feedback',
  buildReviewPacket: 'review:build-packet',
  openExternal: 'shell:open-external',
  showInFolder: 'shell:show-in-folder',
} as const

const bridge = Object.fromEntries(
  Object.entries(CHANNELS).map(([method, channel]) => [
    method,
    (...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  ]),
)

contextBridge.exposeInMainWorld('euik', bridge)
