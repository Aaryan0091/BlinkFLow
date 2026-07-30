import type {
  LaunchAtLoginState,
  RestAppearanceMode,
  RestOverlayMode,
  TimerState,
} from '../shared/timer-contract'

const SECOND_MS = 1_000
const FOCUS_DURATION_MS = 20 * 60 * SECOND_MS
const BREAK_DURATION_MS = 20 * SECOND_MS

export const DEFAULT_TIMER_STATE: TimerState = {
  phase: 'idle',
  isRunning: false,
  isPaused: false,
  focusDurationMs: FOCUS_DURATION_MS,
  breakDurationMs: BREAK_DURATION_MS,
  remainingMs: FOCUS_DURATION_MS,
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

const launchAtLoginUnavailable: LaunchAtLoginState = {
  supported: false,
  enabled: false,
  status: 'available-after-install',
}

type StateListener = (state: TimerState) => void

let state = { ...DEFAULT_TIMER_STATE }
let lastTickAt = Date.now()
let ticker: ReturnType<typeof setInterval> | undefined
const listeners = new Set<StateListener>()

function snapshot() {
  return { ...state }
}

function publish(nextState: TimerState) {
  state = nextState
  const current = snapshot()
  listeners.forEach((listener) => listener(current))
  return current
}

function startTicker() {
  lastTickAt = Date.now()
  ticker ??= setInterval(() => {
    if (!state.isRunning || state.isPaused) {
      lastTickAt = Date.now()
      return
    }

    const now = Date.now()
    const elapsedMs = now - lastTickAt
    lastTickAt = now
    const remainingMs = Math.max(0, state.remainingMs - elapsedMs)
    const inBreak = state.phase === 'break'

    publish({
      ...state,
      remainingMs,
      elapsedFocusMs: inBreak ? state.elapsedFocusMs : state.elapsedFocusMs + elapsedMs,
      totalScreenTimeMs: inBreak
        ? state.totalScreenTimeMs
        : state.totalScreenTimeMs + elapsedMs,
      totalEyeRestTimeMs: inBreak
        ? state.totalEyeRestTimeMs + elapsedMs
        : state.totalEyeRestTimeMs,
    })
  }, 250)
}

function stopTicker() {
  if (ticker !== undefined) clearInterval(ticker)
  ticker = undefined
}

export const browserFallback = {
  async getState() {
    return snapshot()
  },
  async start() {
    startTicker()
    return publish({
      ...state,
      phase: 'focus',
      isRunning: true,
      isPaused: false,
      remainingMs:
        state.phase === 'idle' ? state.focusDurationMs : state.remainingMs,
      startedAt: Date.now(),
      breakStartedAt: null,
    })
  },
  async pause() {
    return publish({
      ...state,
      phase: 'paused',
      isPaused: true,
    })
  },
  async resume() {
    startTicker()
    return publish({
      ...state,
      phase: state.breakStartedAt === null ? 'focus' : 'break',
      isRunning: true,
      isPaused: false,
    })
  },
  async stop() {
    stopTicker()
    return publish({
      ...state,
      phase: 'idle',
      isRunning: false,
      isPaused: false,
      remainingMs: state.focusDurationMs,
      elapsedFocusMs: 0,
      startedAt: null,
      breakStartedAt: null,
    })
  },
  async restNow() {
    startTicker()
    return publish({
      ...state,
      phase: 'break',
      isRunning: true,
      isPaused: false,
      remainingMs: state.breakDurationMs,
      breakStartedAt: Date.now(),
    })
  },
  async endBreak() {
    if (state.autoMode) {
      startTicker()
      return publish({
        ...state,
        phase: 'focus',
        isRunning: true,
        isPaused: false,
        remainingMs: state.focusDurationMs,
        startedAt: Date.now(),
        breakStartedAt: null,
      })
    }

    stopTicker()
    return publish({
      ...state,
      phase: 'idle',
      isRunning: false,
      isPaused: false,
      remainingMs: state.focusDurationMs,
      startedAt: null,
      breakStartedAt: null,
    })
  },
  async setRemaining(remainingMs: number) {
    const durationMs =
      state.phase === 'break' ? state.breakDurationMs : state.focusDurationMs
    return publish({
      ...state,
      remainingMs: Math.min(durationMs, Math.max(SECOND_MS, remainingMs)),
    })
  },
  async setBreakDuration(durationMs: number) {
    return publish({
      ...state,
      breakDurationMs: durationMs,
      remainingMs: state.phase === 'break' ? durationMs : state.remainingMs,
    })
  },
  async setAutoMode(enabled: boolean) {
    return publish({ ...state, autoMode: enabled })
  },
  async setRestOverlayMode(mode: RestOverlayMode) {
    return publish({ ...state, restOverlayMode: mode })
  },
  async setRestAppearanceMode(mode: RestAppearanceMode) {
    return publish({ ...state, restAppearanceMode: mode })
  },
  async getLaunchAtLogin() {
    return { ...launchAtLoginUnavailable }
  },
  async setLaunchAtLogin() {
    return { ...launchAtLoginUnavailable }
  },
  async onStateChange(listener: StateListener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

if (import.meta.hot) {
  import.meta.hot.dispose(stopTicker)
}
