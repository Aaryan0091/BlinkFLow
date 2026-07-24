import { describe, expect, it } from 'vitest'
import {
  createDefaultTimerState,
  restoreTimerSnapshot,
  TimerEngine,
  type TimerSnapshot,
  type TimerState,
} from '../electron/timer-engine.js'

function snapshotWith(
  stateOverrides: Partial<TimerState>,
  snapshotOverrides: Partial<TimerSnapshot> = {},
): TimerSnapshot {
  return {
    version: 1,
    savedAt: 0,
    state: {
      ...createDefaultTimerState(),
      ...stateOverrides,
    },
    phaseStartedAt: 0,
    pausedRemainingMs: 1000,
    pausedPhase: 'focus',
    ...snapshotOverrides,
  }
}

describe('TimerEngine', () => {
  it('starts with a fresh 20-minute focus period', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })

    const state = engine.start()

    expect(state.phase).toBe('focus')
    expect(state.isRunning).toBe(true)
    expect(state.remainingMs).toBe(20 * 60 * 1000)
    expect(state.startedAt).toBe(now)
  })

  it('moves from focus to break and increments completed sessions', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setRemaining(2000)
    engine.start()

    now += 2000
    const transition = engine.tick()

    expect(transition).toBe('focus-ended')
    expect(engine.getState().phase).toBe('break')
    expect(engine.getState().remainingMs).toBe(20 * 1000)
    expect(engine.getState().completedFocusSessions).toBe(1)
  })

  it('stops after the break when Auto Mode is off', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setRemaining(1000)
    engine.start()

    now += 1000
    engine.tick()
    now += 20 * 1000

    expect(engine.tick()).toBe('break-ended')
    expect(engine.getState().phase).toBe('idle')
    expect(engine.getState().isRunning).toBe(false)
  })

  it('starts another focus period when Auto Mode is on', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setAutoMode(true)
    engine.setRemaining(1000)
    engine.start()

    now += 1000
    engine.tick()
    now += 20 * 1000

    expect(engine.tick()).toBe('break-ended')
    expect(engine.getState().phase).toBe('focus')
    expect(engine.getState().isRunning).toBe(true)
    expect(engine.getState().autoMode).toBe(true)
  })

  it('does not consume time while paused', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setRemaining(10 * 1000)
    engine.start()

    now += 4000
    engine.pause()
    const pausedRemainingMs = engine.getState().remainingMs
    now += 60 * 60 * 1000
    engine.resume()

    expect(pausedRemainingMs).toBe(6000)
    expect(engine.getState().remainingMs).toBe(6000)

    now += 5000
    expect(engine.tick()).toBeNull()
    expect(engine.getState().remainingMs).toBe(1000)
  })

  it('clamps rest duration to supported five-second steps', () => {
    const engine = new TimerEngine()

    expect(engine.setBreakDuration(32_400).breakDurationMs).toBe(30_000)
    expect(engine.setBreakDuration(1000).breakDurationMs).toBe(5000)
    expect(engine.setBreakDuration(999_000).breakDurationMs).toBe(120_000)
  })

  it('resets to ready after wake when Auto Mode is off', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setRemaining(5000)
    engine.start()
    now += 3000
    engine.tick()

    const state = engine.resetAfterWake()

    expect(state.phase).toBe('idle')
    expect(state.isRunning).toBe(false)
    expect(state.remainingMs).toBe(state.focusDurationMs)
    expect(state.elapsedFocusMs).toBe(0)
  })

  it('starts a fresh focus cycle after wake when Auto Mode is on', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setAutoMode(true)
    engine.start()
    now += 10 * 60 * 1000
    engine.tick()

    const state = engine.resetAfterWake()

    expect(state.phase).toBe('focus')
    expect(state.isRunning).toBe(true)
    expect(state.isPaused).toBe(false)
    expect(state.remainingMs).toBe(state.focusDurationMs)
    expect(state.startedAt).toBe(now)
  })

  it('preserves completed session count when resetting after wake', () => {
    let now = 1000
    const engine = new TimerEngine({ now: () => now })
    engine.setAutoMode(true)
    engine.setRemaining(1000)
    engine.start()
    now += 1000
    engine.tick()

    expect(engine.resetAfterWake().completedFocusSessions).toBe(1)
  })
})

describe('timer snapshot restoration', () => {
  it('restores an active focus period using the original timestamp', () => {
    const snapshot = snapshotWith({
      phase: 'focus',
      isRunning: true,
      focusDurationMs: 1000,
      breakDurationMs: 500,
      remainingMs: 1000,
      startedAt: 0,
    })

    const restored = restoreTimerSnapshot(snapshot, 400)

    expect(restored.state.phase).toBe('focus')
    expect(restored.state.remainingMs).toBe(600)
    expect(restored.state.elapsedFocusMs).toBe(400)
  })

  it('restores into the break when focus ended while the app was closed', () => {
    const snapshot = snapshotWith({
      phase: 'focus',
      isRunning: true,
      focusDurationMs: 1000,
      breakDurationMs: 500,
      remainingMs: 1000,
      startedAt: 0,
    })

    const restored = restoreTimerSnapshot(snapshot, 1200)

    expect(restored.state.phase).toBe('break')
    expect(restored.state.remainingMs).toBe(300)
    expect(restored.state.completedFocusSessions).toBe(1)
    expect(restored.shouldShowBreak).toBe(true)
  })

  it('returns to idle when a non-automatic cycle expired while closed', () => {
    const snapshot = snapshotWith({
      phase: 'focus',
      isRunning: true,
      focusDurationMs: 1000,
      breakDurationMs: 500,
      remainingMs: 1000,
      startedAt: 0,
      autoMode: false,
    })

    const restored = restoreTimerSnapshot(snapshot, 1600)

    expect(restored.state.phase).toBe('idle')
    expect(restored.state.isRunning).toBe(false)
    expect(restored.state.completedFocusSessions).toBe(1)
  })

  it('advances through multiple Auto Mode cycles while closed', () => {
    const snapshot = snapshotWith({
      phase: 'focus',
      isRunning: true,
      focusDurationMs: 1000,
      breakDurationMs: 500,
      remainingMs: 1000,
      startedAt: 0,
      autoMode: true,
    })

    const restored = restoreTimerSnapshot(snapshot, 3650)

    expect(restored.state.phase).toBe('focus')
    expect(restored.state.remainingMs).toBe(350)
    expect(restored.state.completedFocusSessions).toBe(2)
    expect(restored.state.autoMode).toBe(true)
  })

  it('keeps paused time unchanged across restarts', () => {
    const snapshot = snapshotWith(
      {
        phase: 'paused',
        isRunning: true,
        isPaused: true,
        focusDurationMs: 1000,
        remainingMs: 400,
      },
      {
        phaseStartedAt: null,
        pausedRemainingMs: 400,
        pausedPhase: 'focus',
      },
    )

    const restored = restoreTimerSnapshot(snapshot, 100_000)

    expect(restored.state.phase).toBe('paused')
    expect(restored.state.remainingMs).toBe(400)
    expect(restored.state.isPaused).toBe(true)
  })
})
