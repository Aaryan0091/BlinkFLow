import { describe, expect, it } from 'vitest'
import type { TimerState } from '../shared/timer-contract'
import { getRestOverlayViewState } from '../src/rest-overlay-state'

const DEFAULT_STATE: TimerState = {
  phase: 'idle',
  isRunning: false,
  isPaused: false,
  focusDurationMs: 1_200_000,
  breakDurationMs: 20_000,
  remainingMs: 1_200_000,
  elapsedFocusMs: 0,
  completedFocusSessions: 0,
  totalScreenTimeMs: 0,
  totalEyeRestTimeMs: 0,
  startedAt: null,
  breakStartedAt: null,
  autoMode: false,
  restOverlayMode: 'all-displays',
  restAppearanceMode: 'ambient',
}

describe('rest overlay renderer state', () => {
  it('renders nothing before the first native timer state arrives', () => {
    expect(getRestOverlayViewState(DEFAULT_STATE, false, 10_000)).toBeNull()
  })

  it('rejects focus state after hydration or reconnection', () => {
    const focusState: TimerState = {
      ...DEFAULT_STATE,
      phase: 'focus',
      isRunning: true,
      startedAt: 10_000,
    }

    expect(getRestOverlayViewState(focusState, true, 10_000)).toBeNull()
  })

  it('clamps stale 20-minute remaining time to the configured break', () => {
    const breakState: TimerState = {
      ...DEFAULT_STATE,
      phase: 'break',
      isRunning: true,
      remainingMs: DEFAULT_STATE.focusDurationMs,
      completedFocusSessions: 1,
      breakStartedAt: 10_000,
    }

    const viewState = getRestOverlayViewState(breakState, true, 10_000)

    expect(viewState?.remainingMs).toBe(20_000)
    expect(Math.ceil((viewState?.remainingMs ?? 0) / 1_000)).toBe(20)
  })

  it('keeps counting between native state pushes', () => {
    const breakState: TimerState = {
      ...DEFAULT_STATE,
      phase: 'break',
      isRunning: true,
      remainingMs: 20_000,
      completedFocusSessions: 1,
      breakStartedAt: 10_000,
    }

    expect(
      getRestOverlayViewState(breakState, true, 11_000)?.remainingMs,
    ).toBe(19_000)
    expect(
      getRestOverlayViewState(breakState, true, 15_000)?.remainingMs,
    ).toBe(15_000)
  })

  it('holds the remaining time while a break is paused', () => {
    const pausedBreak: TimerState = {
      ...DEFAULT_STATE,
      phase: 'paused',
      isRunning: true,
      isPaused: true,
      remainingMs: 12_000,
      completedFocusSessions: 1,
      breakStartedAt: 10_000,
    }

    expect(
      getRestOverlayViewState(pausedBreak, true, 60_000)?.remainingMs,
    ).toBe(12_000)
  })
})
