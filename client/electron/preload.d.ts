// Type declarations for the contextBridge API exposed by electron/preload.js.
// Extends the global Window so window.electron is typed throughout the client.
export {}

declare global {
  interface Window {
    electron?: {
      platform: 'darwin' | 'win32' | 'linux'
      isDev: boolean
      window: {
        minimize: () => Promise<void>
        toggleMaximize: () => Promise<boolean>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        toggleDevTools: () => Promise<void>
        onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void
      }
    }
  }
}
