const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')

const isDev = process.env.NODE_ENV !== 'production'
const openDevTools = isDev
const DEV_URL = 'http://localhost:3000'
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

// Bundled Go server. In dev it's run separately (`npm run dev:server`); in a
// packaged build we launch the binary shipped in app resources and point it at the
// bundled read-only config + a writable user-data dir via FW_* env vars.
const DATA_PORT = '8001'      // must match VITE_API_BASE baked into the client
const CONTROL_PORT = '8002'   // must match CONTROL_BASE in lib/api-config.js
let serverProc = null

function startServer() {
  if (isDev) return   // dev: the Go server is started by `npm run dev:server`
  const bin = path.join(process.resourcesPath, isWin ? 'server.exe' : 'server')
  const userData = app.getPath('userData')
  serverProc = spawn(bin, [], {
    env: {
      ...process.env,
      PORT: DATA_PORT,
      CONTROL_PORT,
      FW_CONFIG_DIR: path.join(process.resourcesPath, 'config'),
      FW_DATA_DIR: userData,
      FW_LOGS_DIR: path.join(userData, 'logs'),
      FW_BLACKLIST: path.join(process.resourcesPath, 'blacklist.yaml'),
    },
    stdio: 'ignore',
  })
  serverProc.on('exit', (code) => { if (code) console.error(`[server] exited with code ${code}`) })
}

function stopServer() {
  if (serverProc) { serverProc.kill(); serverProc = null }
}

// Poll the data server's /health until it answers (or we give up), so the window
// doesn't load and fire requests before the backend is listening.
function waitForServer(timeoutMs = 15000) {
  const url = `http://127.0.0.1:${DATA_PORT}/health`
  const start = Date.now()
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(true) })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return resolve(false)
        setTimeout(attempt, 250)
      })
    }
    attempt()
  })
}

// We render our own title bar + application menu in the renderer
// (client/components/workbench/shell/TitleBar.vue + MenuBar.vue), so suppress
// Electron's native application menu entirely.
Menu.setApplicationMenu(null)

function createWindow() {
  const win = new BrowserWindow({
    width: openDevTools ? 1920 + 300 : 1920,
    height: 1080,
    // Frameless: the custom TitleBar is the only window chrome. On macOS,
    // titleBarStyle:'hidden' keeps the native traffic-light buttons (top-left)
    // overlaid on our bar; Windows/Linux are fully frameless and use the custom
    // minimize/maximize/close controls in TitleBar.vue (wired via IPC below).
    ...(isMac ? { titleBarStyle: 'hidden' } : { frame: false }),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Keep the renderer's maximize/restore icon in sync with the actual state.
  const emitMaximized = () => win.webContents.send('window:maximize-changed', win.isMaximized())
  win.on('maximize', emitMaximized)
  win.on('unmaximize', emitMaximized)

  if (isDev) {
    win.loadURL(DEV_URL)
    if (openDevTools) win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../.output/public/index.html'))
  }
}

// Window controls — invoked from the custom title bar via the preload bridge.
ipcMain.handle('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize()
})
ipcMain.handle('window:toggleMaximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  return win.isMaximized()
})
ipcMain.handle('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close()
})
ipcMain.handle('window:isMaximized', (e) => {
  return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
})
ipcMain.handle('window:toggleDevTools', (e) => {
  if (openDevTools) e.sender.toggleDevTools()
})

app.whenReady().then(async () => {
  startServer()
  if (!isDev) await waitForServer()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Ensure the spawned server is torn down with the app (covers quit and the
// non-macOS window-all-closed quit below).
app.on('will-quit', stopServer)

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
