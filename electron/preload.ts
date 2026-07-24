import { contextBridge, ipcRenderer } from 'electron'
import { TIMER_IPC_CHANNELS } from './ipc-handlers.js'

const api = {
  getState: () => ipcRenderer.invoke(TIMER_IPC_CHANNELS.getState),
  start: () => ipcRenderer.invoke(TIMER_IPC_CHANNELS.start),
  pause: () => ipcRenderer.invoke(TIMER_IPC_CHANNELS.pause),
  resume: () => ipcRenderer.invoke(TIMER_IPC_CHANNELS.resume),
  stop: () => ipcRenderer.invoke(TIMER_IPC_CHANNELS.stop),
  setRemaining: (remainingMs: number) =>
    ipcRenderer.invoke(TIMER_IPC_CHANNELS.setRemaining, remainingMs),
  setBreakDuration: (durationMs: number) =>
    ipcRenderer.invoke(TIMER_IPC_CHANNELS.setBreakDuration, durationMs),
  setAutoMode: (enabled: boolean) =>
    ipcRenderer.invoke(TIMER_IPC_CHANNELS.setAutoMode, enabled),
  onStateChange: async (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) =>
      callback(state)
    ipcRenderer.on(TIMER_IPC_CHANNELS.stateChanged, listener)
    return () =>
      ipcRenderer.removeListener(TIMER_IPC_CHANNELS.stateChanged, listener)
  },
}

contextBridge.exposeInMainWorld('eyeBreak', api)
