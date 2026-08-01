import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserFallback } from '../src/browser-fallback'

describe('browser timer fallback', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await browserFallback.stop()
    await browserFallback.setAutoMode(false)
    await browserFallback.setFocusDuration(20 * 60_000)
    await browserFallback.setBreakDuration(20_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('supports the primary preview timer controls', async () => {
    const states: string[] = []
    const unsubscribe = await browserFallback.onStateChange((state) => {
      states.push(state.phase)
    })

    expect((await browserFallback.start()).phase).toBe('focus')
    vi.advanceTimersByTime(1_000)
    expect((await browserFallback.getState()).remainingMs).toBe(1_199_000)

    expect((await browserFallback.pause()).phase).toBe('paused')
    expect((await browserFallback.resume()).phase).toBe('focus')
    expect((await browserFallback.restNow()).phase).toBe('break')
    expect((await browserFallback.setRemaining(10_000)).remainingMs).toBe(10_000)
    expect((await browserFallback.stop()).phase).toBe('idle')
    expect(states).toContain('focus')
    expect(states).toContain('paused')
    expect(states).toContain('break')

    unsubscribe()
  })

  it('keeps preview preferences in the current state', async () => {
    await browserFallback.setAutoMode(true)
    await browserFallback.setRestOverlayMode('primary-display')
    await browserFallback.setRestAppearanceMode('black-timer')
    await browserFallback.setFocusDuration(45 * 60_000)
    await browserFallback.setBreakDuration(45_000)

    const state = await browserFallback.getState()
    expect(state.autoMode).toBe(true)
    expect(state.restOverlayMode).toBe('primary-display')
    expect(state.restAppearanceMode).toBe('black-timer')
    expect(state.focusDurationMs).toBe(45 * 60_000)
    expect(state.remainingMs).toBe(45 * 60_000)
    expect(state.breakDurationMs).toBe(45_000)
  })
})
