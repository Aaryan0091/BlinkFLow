import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type {
  RestAppearanceMode,
  RestOverlayMode,
  TimerState,
} from './timer-engine.js'
import {
  FOCUS_DURATION_STEP_MS,
  MAX_FOCUS_DURATION_MS,
  MIN_FOCUS_DURATION_MS,
} from '../shared/timer-contract.js'

export const TIMER_IPC_CHANNELS = {
  stateChanged: 'timer:state',
  getState: 'timer:get-state',
  start: 'timer:start',
  pause: 'timer:pause',
  resume: 'timer:resume',
  stop: 'timer:stop',
  restNow: 'timer:rest-now',
  endBreak: 'timer:end-break',
  setRemaining: 'timer:set-remaining',
  setFocusDuration: 'timer:set-focus-duration',
  setBreakDuration: 'timer:set-break-duration',
  setAutoMode: 'timer:set-auto-mode',
  setRestOverlayMode: 'timer:set-rest-overlay-mode',
  setRestAppearanceMode: 'timer:set-rest-appearance-mode',
} as const

export const APP_IPC_CHANNELS = {
  getLaunchAtLogin: 'app:get-launch-at-login',
  setLaunchAtLogin: 'app:set-launch-at-login',
} as const

export type LaunchAtLoginState = {
  supported: boolean
  enabled: boolean
  status:
    | 'enabled'
    | 'disabled'
    | 'requires-approval'
    | 'available-after-install'
    | 'unsupported'
}

export type TimerIpcActions = {
  getState: () => TimerState
  start: () => TimerState
  pause: () => TimerState
  resume: () => TimerState
  stop: () => TimerState
  restNow: () => TimerState
  endBreak: () => TimerState
  setRemaining: (remainingMs: number) => TimerState
  setFocusDuration: (durationMs: number) => TimerState
  setBreakDuration: (durationMs: number) => TimerState
  setAutoMode: (enabled: boolean) => TimerState
  setRestOverlayMode: (mode: RestOverlayMode) => TimerState
  setRestAppearanceMode: (mode: RestAppearanceMode) => TimerState
}

export type AppIpcActions = {
  getLaunchAtLogin: () => LaunchAtLoginState
  setLaunchAtLogin: (enabled: boolean) => LaunchAtLoginState
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
  if (remainingMs < 0 || remainingMs > MAX_FOCUS_DURATION_MS) {
    throw new RangeError('remainingMs must be between 0 and 120 minutes')
  }
  return remainingMs
}

function validateFocusDurationMs(value: unknown) {
  const durationMs = requireFiniteNumber(value, 'durationMs')
  if (
    durationMs < MIN_FOCUS_DURATION_MS ||
    durationMs > MAX_FOCUS_DURATION_MS ||
    durationMs % FOCUS_DURATION_STEP_MS !== 0
  ) {
    throw new RangeError(
      'durationMs must be a whole-minute increment between 1 and 120 minutes',
    )
  }
  return durationMs
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

function validateRestOverlayMode(value: unknown): RestOverlayMode {
  if (
    value !== 'none' &&
    value !== 'primary-display' &&
    value !== 'all-displays'
  ) {
    throw new TypeError(
      'mode must be none, primary-display, or all-displays',
    )
  }
  return value
}

function validateRestAppearanceMode(value: unknown): RestAppearanceMode {
  if (
    value !== 'ambient' &&
    value !== 'black' &&
    value !== 'black-timer'
  ) {
    throw new TypeError('mode must be ambient, black, or black-timer')
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
  ipc.handle(TIMER_IPC_CHANNELS.restNow, (event) => {
    assertTrustedSender(event, security)
    return actions.restNow()
  })
  ipc.handle(TIMER_IPC_CHANNELS.endBreak, (event) => {
    assertTrustedSender(event, security)
    return actions.endBreak()
  })
  ipc.handle(
    TIMER_IPC_CHANNELS.setRemaining,
    (event, remainingMs: unknown) => {
      assertTrustedSender(event, security)
      return actions.setRemaining(validateRemainingMs(remainingMs))
    },
  )
  ipc.handle(
    TIMER_IPC_CHANNELS.setFocusDuration,
    (event, durationMs: unknown) => {
      assertTrustedSender(event, security)
      return actions.setFocusDuration(validateFocusDurationMs(durationMs))
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
  ipc.handle(
    TIMER_IPC_CHANNELS.setRestOverlayMode,
    (event, mode: unknown) => {
      assertTrustedSender(event, security)
      return actions.setRestOverlayMode(validateRestOverlayMode(mode))
    },
  )
  ipc.handle(
    TIMER_IPC_CHANNELS.setRestAppearanceMode,
    (event, mode: unknown) => {
      assertTrustedSender(event, security)
      return actions.setRestAppearanceMode(validateRestAppearanceMode(mode))
    },
  )
}

export function registerAppIpcHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  actions: AppIpcActions,
  security: TimerIpcSecurity,
) {
  ipc.handle(APP_IPC_CHANNELS.getLaunchAtLogin, (event) => {
    assertTrustedSender(event, security)
    return actions.getLaunchAtLogin()
  })
  ipc.handle(
    APP_IPC_CHANNELS.setLaunchAtLogin,
    (event, enabled: unknown) => {
      assertTrustedSender(event, security)
      return actions.setLaunchAtLogin(validateBoolean(enabled, 'enabled'))
    },
  )
}
