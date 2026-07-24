import type { IpcMain } from 'electron'
import type { TimerState } from './timer-engine.js'

export const TIMER_IPC_CHANNELS = {
  stateChanged: 'timer:state',
  getState: 'timer:get-state',
  start: 'timer:start',
  pause: 'timer:pause',
  resume: 'timer:resume',
  stop: 'timer:stop',
  setRemaining: 'timer:set-remaining',
  setBreakDuration: 'timer:set-break-duration',
  setAutoMode: 'timer:set-auto-mode',
} as const

export type TimerIpcActions = {
  getState: () => TimerState
  start: () => TimerState
  pause: () => TimerState
  resume: () => TimerState
  stop: () => TimerState
  setRemaining: (remainingMs: number) => TimerState
  setBreakDuration: (durationMs: number) => TimerState
  setAutoMode: (enabled: boolean) => TimerState
}

export function registerTimerIpcHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  actions: TimerIpcActions,
) {
  ipc.handle(TIMER_IPC_CHANNELS.getState, () => actions.getState())
  ipc.handle(TIMER_IPC_CHANNELS.start, () => actions.start())
  ipc.handle(TIMER_IPC_CHANNELS.pause, () => actions.pause())
  ipc.handle(TIMER_IPC_CHANNELS.resume, () => actions.resume())
  ipc.handle(TIMER_IPC_CHANNELS.stop, () => actions.stop())
  ipc.handle(
    TIMER_IPC_CHANNELS.setRemaining,
    (_event, remainingMs: number) => actions.setRemaining(remainingMs),
  )
  ipc.handle(
    TIMER_IPC_CHANNELS.setBreakDuration,
    (_event, durationMs: number) => actions.setBreakDuration(durationMs),
  )
  ipc.handle(
    TIMER_IPC_CHANNELS.setAutoMode,
    (_event, enabled: boolean) => actions.setAutoMode(enabled),
  )
}
