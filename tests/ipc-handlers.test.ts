import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  registerTimerIpcHandlers,
  TIMER_IPC_CHANNELS,
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
    setRemaining: vi.fn(() => state),
    setBreakDuration: vi.fn(() => state),
    setAutoMode: vi.fn(() => state),
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

    expect(handlers.size).toBe(8)
    expect(handlers.get(TIMER_IPC_CHANNELS.getState)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.start)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.pause)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.resume)?.(trustedEvent)).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.stop)?.(trustedEvent)).toBe(state)

    handlers.get(TIMER_IPC_CHANNELS.setRemaining)?.(trustedEvent, 42_000)
    handlers
      .get(TIMER_IPC_CHANNELS.setBreakDuration)
      ?.(trustedEvent, 35_000)
    handlers.get(TIMER_IPC_CHANNELS.setAutoMode)?.(trustedEvent, true)

    expect(actions.setRemaining).toHaveBeenCalledWith(42_000)
    expect(actions.setBreakDuration).toHaveBeenCalledWith(35_000)
    expect(actions.setAutoMode).toHaveBeenCalledWith(true)
    expect(security.isTrustedSender).toHaveBeenCalledTimes(8)
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

    expect(actions.setRemaining).not.toHaveBeenCalled()
    expect(actions.setBreakDuration).not.toHaveBeenCalled()
    expect(actions.setAutoMode).not.toHaveBeenCalled()
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
