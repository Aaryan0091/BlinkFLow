import type { IpcMain, IpcMainInvokeEvent } from 'electron'
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

export type TimerIpcSecurity = {
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean
}

function assertTrustedSender(
  event: IpcMainInvokeEvent,
  security: TimerIpcSecurity,
) {
  if (!security.isTrustedSender(event)) {
    throw new Error('Blocked timer request from an untrusted renderer')
  }
}

function requireFiniteNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
  return value
}

function validateRemainingMs(value: unknown) {
  const remainingMs = requireFiniteNumber(value, 'remainingMs')
  if (remainingMs < 0 || remainingMs > 20 * 60 * 1_000) {
    throw new RangeError('remainingMs must be between 0 and 20 minutes')
  }
  return remainingMs
}

function validateBreakDurationMs(value: unknown) {
  const durationMs = requireFiniteNumber(value, 'durationMs')
  if (
    durationMs < 5_000 ||
    durationMs > 120_000 ||
    durationMs % 5_000 !== 0
  ) {
    throw new RangeError(
      'durationMs must be a 5-second increment between 5 and 120 seconds',
    )
  }
  return durationMs
}

function validateBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`)
  }
  return value
}

export function registerTimerIpcHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  actions: TimerIpcActions,
  security: TimerIpcSecurity,
) {
  ipc.handle(TIMER_IPC_CHANNELS.getState, (event) => {
    assertTrustedSender(event, security)
    return actions.getState()
  })
  ipc.handle(TIMER_IPC_CHANNELS.start, (event) => {
    assertTrustedSender(event, security)
    return actions.start()
  })
  ipc.handle(TIMER_IPC_CHANNELS.pause, (event) => {
    assertTrustedSender(event, security)
    return actions.pause()
  })
  ipc.handle(TIMER_IPC_CHANNELS.resume, (event) => {
    assertTrustedSender(event, security)
    return actions.resume()
  })
  ipc.handle(TIMER_IPC_CHANNELS.stop, (event) => {
    assertTrustedSender(event, security)
    return actions.stop()
  })
  ipc.handle(
    TIMER_IPC_CHANNELS.setRemaining,
    (event, remainingMs: unknown) => {
      assertTrustedSender(event, security)
      return actions.setRemaining(validateRemainingMs(remainingMs))
    },
  )
  ipc.handle(
    TIMER_IPC_CHANNELS.setBreakDuration,
    (event, durationMs: unknown) => {
      assertTrustedSender(event, security)
      return actions.setBreakDuration(validateBreakDurationMs(durationMs))
    },
  )
  ipc.handle(
    TIMER_IPC_CHANNELS.setAutoMode,
    (event, enabled: unknown) => {
      assertTrustedSender(event, security)
      return actions.setAutoMode(validateBoolean(enabled, 'enabled'))
    },
  )
}
