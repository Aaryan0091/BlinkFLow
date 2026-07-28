import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  APP_IPC_CHANNELS,
  registerAppIpcHandlers,
  registerTimerIpcHandlers,
  TIMER_IPC_CHANNELS,
  type AppIpcActions,
  type TimerIpcActions,
  type TimerIpcSecurity,
} from '../electron/ipc-handlers.js'
import { createDefaultTimerState } from '../electron/timer-engine.js'

type RegisteredHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => unknown

const trustedEvent = {} as IpcMainInvokeEvent

function createHarness(isTrusted = true) {
  const handlers = new Map<string, RegisteredHandler>()
  const ipc = {
    handle: vi.fn((channel: string, handler: RegisteredHandler) => {
      handlers.set(channel, handler)
    }),
  } as unknown as Pick<IpcMain, 'handle'>

  const state = createDefaultTimerState()
  const actions: TimerIpcActions = {
    getState: vi.fn(() => state),
    start: vi.fn(() => state),
    pause: vi.fn(() => state),
    resume: vi.fn(() => state),
    stop: vi.fn(() => state),
    restNow: vi.fn(() => state),
    setRemaining: vi.fn(() => state),
    setBreakDuration: vi.fn(() => state),
    setAutoMode: vi.fn(() => state),
    setRestOverlayMode: vi.fn(() => state),
  }
  const security: TimerIpcSecurity = {
    isTrustedSender: vi.fn(() => isTrusted),
  }

  registerTimerIpcHandlers(ipc, actions, security)
  return { handlers, actions, security, state }
}

describe('timer IPC handlers', () => {
  it('registers every request channel and forwards values to timer actions', () => {
    const { handlers, actions, security, state } = createHarness()

    expect(handlers.size).toBe(10)
    expect(handlers.get(TIMER_IPC_CHANNELS.getState)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.start)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.pause)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.resume)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.stop)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.restNow)?.(trustedEvent)).toBe(state)

    handlers.get(TIMER_IPC_CHANNELS.setRemaining)?.(trustedEvent, 42_000)
    handlers
      .get(TIMER_IPC_CHANNELS.setBreakDuration)
      ?.(trustedEvent, 35_000)
    handlers.get(TIMER_IPC_CHANNELS.setAutoMode)?.(trustedEvent, true)
    handlers
      .get(TIMER_IPC_CHANNELS.setRestOverlayMode)
      ?.(trustedEvent, 'primary-display')

    expect(actions.setRemaining).toHaveBeenCalledWith(42_000)
    expect(actions.setBreakDuration).toHaveBeenCalledWith(35_000)
    expect(actions.setAutoMode).toHaveBeenCalledWith(true)
    expect(actions.setRestOverlayMode).toHaveBeenCalledWith(
      'primary-display',
    )
    expect(actions.restNow).toHaveBeenCalledOnce()
    expect(security.isTrustedSender).toHaveBeenCalledTimes(10)
  })

  it('blocks every request from an untrusted renderer', () => {
    const { handlers, actions } = createHarness(false)

    expect(() =>
      handlers.get(TIMER_IPC_CHANNELS.start)?.(trustedEvent),
    ).toThrow('untrusted renderer')
    expect(actions.start).not.toHaveBeenCalled()
  })

  it('rejects invalid values at IPC boundaries', () => {
    const { handlers, actions } = createHarness()

    expect(() =>
      handlers
        .get(TIMER_IPC_CHANNELS.setRemaining)
        ?.(trustedEvent, Number.NaN),
    ).toThrow('finite number')
    expect(() =>
      handlers
        .get(TIMER_IPC_CHANNELS.setRemaining)
        ?.(trustedEvent, 20 * 60 * 1_000 + 1),
    ).toThrow('between 0 and 20 minutes')
    expect(() =>
      handlers
        .get(TIMER_IPC_CHANNELS.setBreakDuration)
        ?.(trustedEvent, 7_000),
    ).toThrow('5-second increment')
    expect(() =>
      handlers
        .get(TIMER_IPC_CHANNELS.setAutoMode)
        ?.(trustedEvent, 'true'),
    ).toThrow('boolean')
    expect(() =>
      handlers
        .get(TIMER_IPC_CHANNELS.setRestOverlayMode)
        ?.(trustedEvent, 'secondary-display'),
    ).toThrow('none, primary-display, or all-displays')

    expect(actions.setRemaining).not.toHaveBeenCalled()
    expect(actions.setBreakDuration).not.toHaveBeenCalled()
    expect(actions.setAutoMode).not.toHaveBeenCalled()
    expect(actions.setRestOverlayMode).not.toHaveBeenCalled()
  })

  it('keeps the pushed state event on a separate shared channel', () => {
    expect(TIMER_IPC_CHANNELS.stateChanged).toBe('timer:state')
    expect(
      Object.values(TIMER_IPC_CHANNELS).filter(
        (channel) => channel === TIMER_IPC_CHANNELS.stateChanged,
      ),
    ).toHaveLength(1)
  })
})

describe('application preference IPC handlers', () => {
  function createAppHarness(isTrusted = true) {
    const handlers = new Map<string, RegisteredHandler>()
    const ipc = {
      handle: vi.fn((channel: string, handler: RegisteredHandler) => {
        handlers.set(channel, handler)
      }),
    } as unknown as Pick<IpcMain, 'handle'>
    const launchState = {
      supported: true,
      enabled: false,
      status: 'disabled' as const,
    }
    const actions: AppIpcActions = {
      getLaunchAtLogin: vi.fn(() => launchState),
      setLaunchAtLogin: vi.fn(() => ({
        ...launchState,
        enabled: true,
        status: 'enabled' as const,
      })),
    }
    const security: TimerIpcSecurity = {
      isTrustedSender: vi.fn(() => isTrusted),
    }

    registerAppIpcHandlers(ipc, actions, security)
    return { handlers, actions, security, launchState }
  }

  it('reads and updates launch-at-login through explicit channels', () => {
    const { handlers, actions, launchState } = createAppHarness()

    expect(handlers.size).toBe(2)
    expect(
      handlers.get(APP_IPC_CHANNELS.getLaunchAtLogin)?.(trustedEvent),
    ).toBe(launchState)
    handlers
      .get(APP_IPC_CHANNELS.setLaunchAtLogin)
      ?.(trustedEvent, true)
    expect(actions.setLaunchAtLogin).toHaveBeenCalledWith(true)
  })

  it('validates the sender and launch-at-login value', () => {
    const untrusted = createAppHarness(false)
    expect(() =>
      untrusted.handlers
        .get(APP_IPC_CHANNELS.getLaunchAtLogin)
        ?.(trustedEvent),
    ).toThrow('untrusted renderer')
    expect(untrusted.actions.getLaunchAtLogin).not.toHaveBeenCalled()

    const trusted = createAppHarness()
    expect(() =>
      trusted.handlers
        .get(APP_IPC_CHANNELS.setLaunchAtLogin)
        ?.(trustedEvent, 'true'),
    ).toThrow('boolean')
    expect(trusted.actions.setLaunchAtLogin).not.toHaveBeenCalled()
  })
})
