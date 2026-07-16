/**
 * Electron main process. Security posture per PRD §9.4:
 * nodeIntegration off, contextIsolation on, sandboxed renderer, narrow
 * preload API, no generic filesystem bridge.
 */

import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc.js'

const here = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function previewPreloadPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'previewGuestPreload.cjs')
    : path.join(app.getAppPath(), 'dist', 'preload', 'previewGuestPreload.cjs')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#07111f',
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Embedded app preview on Verify & Review: the renderer hosts a
      // <webview> guest pointed only at the project's local launch URL.
      webviewTag: true,
    },
  })

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    let target: URL
    try {
      if (!params.src) throw new Error('missing WebView source')
      target = new URL(params.src)
    } catch {
      event.preventDefault()
      return
    }
    const preload = previewPreloadPath()
    if (
      !['http:', 'https:'].includes(target.protocol)
      || !['127.0.0.1', 'localhost', '::1'].includes(target.hostname)
      || !fs.existsSync(preload)
    ) {
      event.preventDefault()
      return
    }
    webPreferences.preload = preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    console.log(`[target-preview attach] ${preload}`)
  })
  mainWindow.webContents.on('did-attach-webview', (_event, guest) => {
    guest.setWindowOpenHandler(() => ({ action: 'deny' }))
    guest.on('console-message', (details) => {
      if (details.message.startsWith('[euik-preview-preload]')) console.log(details.message)
    })
    guest.on('preload-error', (_preloadEvent, preloadPath, error) => {
      console.error(`[target-preview preload] ${preloadPath}: ${error.message}`)
    })
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
