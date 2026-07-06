/**
 * Electron main process. Security posture per PRD §9.4:
 * nodeIntegration off, contextIsolation on, sandboxed renderer, narrow
 * preload API, no generic filesystem bridge.
 */

import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc.js'

const here = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#07111f',
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  const devServerUrl = process.env['EUIK_DEV_SERVER_URL']
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else if (app.isPackaged) {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'gui', 'dist', 'index.html'))
  } else {
    void mainWindow.loadFile(path.join(here, '..', '..', 'gui', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers(() => mainWindow, process.env['EUIK_DATA_DIR'])
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || process.env['EUIK_TEST_MODE']) app.quit()
})
