const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  isDev: process.env.NODE_ENV !== 'production',
  window: {
    minimize:       () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close:          () => ipcRenderer.invoke('window:close'),
    isMaximized:    () => ipcRenderer.invoke('window:isMaximized'),
    toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools'),
    // Subscribe to maximize/unmaximize; returns an unsubscribe function.
    onMaximizeChange: (cb) => {
      const handler = (_e, value) => cb(value)
      ipcRenderer.on('window:maximize-changed', handler)
      return () => ipcRenderer.removeListener('window:maximize-changed', handler)
    },
  },
})
