import type {
  RestAppearanceMode,
  TimerState,
} from '../shared/timer-contract'

const MIN_BREAK_DURATION_MS = 5_000
const MAX_BREAK_DURATION_MS = 120_000
const DEFAULT_BREAK_DURATION_MS = 20_000

export type RestOverlayViewState = {
  appearance: RestAppearanceMode
  remainingMs: number
  totalMs: number
  cycle: number
  paused: boolean
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function getRestOverlayViewState(
  timer: TimerState,
  hasInitialState: boolean,
  now: number,
): RestOverlayViewState | null {
  if (!hasInitialState || !timer.isRunning) return null

  const pausedBreak =
    timer.phase === 'paused' &&
    timer.isPaused &&
    timer.breakStartedAt !== null
  const activeBreak = timer.phase === 'break' && !timer.isPaused

  if (!activeBreak && !pausedBreak) return null

  const requestedDurationMs = Number.isFinite(timer.breakDurationMs)
    ? timer.breakDurationMs
    : DEFAULT_BREAK_DURATION_MS
  const totalMs = clamp(
    requestedDurationMs,
    MIN_BREAK_DURATION_MS,
    MAX_BREAK_DURATION_MS,
  )

  const remainingMs =
    activeBreak && timer.breakStartedAt !== null
      ? totalMs - Math.max(now - timer.breakStartedAt, 0)
      : timer.remainingMs

  return {
    appearance: timer.restAppearanceMode,
    remainingMs: clamp(remainingMs, 0, totalMs),
    totalMs,
    cycle: timer.completedFocusSessions,
    paused: pausedBreak,
  }
}
