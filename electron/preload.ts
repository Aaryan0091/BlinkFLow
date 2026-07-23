import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getState: () => ipcRenderer.invoke('timer:get-state'),
  start: () => ipcRenderer.invoke('timer:start'),
  pause: () => ipcRenderer.invoke('timer:pause'),
  resume: () => ipcRenderer.invoke('timer:resume'),
  stop: () => ipcRenderer.invoke('timer:stop'),
  setRemaining: (remainingMs: number) =>
    ipcRenderer.invoke('timer:set-remaining', remainingMs),
  setBreakDuration: (durationMs: number) =>
    ipcRenderer.invoke('timer:set-break-duration', durationMs),
  setAutoMode: (enabled: boolean) =>
    ipcRenderer.invoke('timer:set-auto-mode', enabled),
  onStateChange: async (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) =>
      callback(state)
    ipcRenderer.on('timer:state', listener)
    return () => ipcRenderer.removeListener('timer:state', listener)
  },
}

contextBridge.exposeInMainWorld('eyeBreak', api)
