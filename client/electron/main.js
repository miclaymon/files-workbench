const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV !== 'production'
const DEV_URL = 'http://localhost:3000'
const isMac = process.platform === 'darwin'

// We render our own title bar + application menu in the renderer
// (client/components/workbench/shell/TitleBar.vue + MenuBar.vue), so suppress
// Electron's native application menu entirely.
Menu.setApplicationMenu(null)

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
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
    win.webContents.openDevTools()
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
  e.sender.toggleDevTools()
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
