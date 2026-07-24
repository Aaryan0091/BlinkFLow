import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  registerTimerIpcHandlers,
  TIMER_IPC_CHANNELS,
  type TimerIpcActions,
} from '../electron/ipc-handlers.js'
import { createDefaultTimerState } from '../electron/timer-engine.js'

type RegisteredHandler = (event: unknown, ...args: unknown[]) => unknown

describe('timer IPC handlers', () => {
  it('registers every request channel and forwards values to timer actions', () => {
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

    registerTimerIpcHandlers(ipc, actions)

    expect(handlers.size).toBe(8)
    expect(handlers.get(TIMER_IPC_CHANNELS.getState)?.({})).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.start)?.({})).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.pause)?.({})).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.resume)?.({})).toBe(state)
    expect(handlers.get(TIMER_IPC_CHANNELS.stop)?.({})).toBe(state)

    handlers.get(TIMER_IPC_CHANNELS.setRemaining)?.({}, 42_000)
    handlers.get(TIMER_IPC_CHANNELS.setBreakDuration)?.({}, 35_000)
    handlers.get(TIMER_IPC_CHANNELS.setAutoMode)?.({}, true)

    expect(actions.setRemaining).toHaveBeenCalledWith(42_000)
    expect(actions.setBreakDuration).toHaveBeenCalledWith(35_000)
    expect(actions.setAutoMode).toHaveBeenCalledWith(true)
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
