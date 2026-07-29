export type TimerPhase = 'idle' | 'focus' | 'break' | 'paused'
export type ResumableTimerPhase = Exclude<TimerPhase, 'paused'>
export type TimerTransition = 'focus-ended' | 'break-ended'
export type RestOverlayMode = 'none' | 'primary-display' | 'all-displays'
export type RestAppearanceMode = 'ambient' | 'black' | 'black-timer'

export type TimerState = {
  phase: TimerPhase
  isRunning: boolean
  isPaused: boolean
  focusDurationMs: number
  breakDurationMs: number
  remainingMs: number
  elapsedFocusMs: number
  completedFocusSessions: number
  totalScreenTimeMs: number
  totalEyeRestTimeMs: number
  startedAt: number | null
  breakStartedAt: number | null
  autoMode: boolean
  restOverlayMode: RestOverlayMode
  restAppearanceMode: RestAppearanceMode
}

export type TimerSnapshot = {
  version: 1
  savedAt: number
  state: TimerState
  phaseStartedAt: number | null
  pausedRemainingMs: number
  pausedPhase: ResumableTimerPhase
}

type RestoredTimer = {
  state: TimerState
  phaseStartedAt: number | null
  pausedRemainingMs: number
  pausedPhase: ResumableTimerPhase
  shouldShowBreak: boolean
}

type TimerEngineOptions = {
  now?: () => number
  snapshot?: TimerSnapshot | null
}

const DEFAULT_FOCUS_DURATION_MS = 20 * 60 * 1000
const DEFAULT_BREAK_DURATION_MS = 20 * 1000

export function createDefaultTimerState(): TimerState {
  return {
    phase: 'idle',
    isRunning: false,
    isPaused: false,
    focusDurationMs: DEFAULT_FOCUS_DURATION_MS,
    breakDurationMs: DEFAULT_BREAK_DURATION_MS,
    remainingMs: DEFAULT_FOCUS_DURATION_MS,
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
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTimerPhase(value: unknown): value is TimerPhase {
  return value === 'idle' || value === 'focus' || value === 'break' || value === 'paused'
}

function isResumablePhase(value: unknown): value is ResumableTimerPhase {
  return value === 'idle' || value === 'focus' || value === 'break'
}

function isRestOverlayMode(value: unknown): value is RestOverlayMode {
  return (
    value === 'none' ||
    value === 'primary-display' ||
    value === 'all-displays'
  )
}

function isRestAppearanceMode(value: unknown): value is RestAppearanceMode {
  return (
    value === 'ambient' ||
    value === 'black' ||
    value === 'black-timer'
  )
}

export function isTimerSnapshot(value: unknown): value is TimerSnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<TimerSnapshot>
  const state = snapshot.state as Partial<TimerState> | undefined

  return (
    snapshot.version === 1 &&
    isFiniteNumber(snapshot.savedAt) &&
    (snapshot.phaseStartedAt === null || isFiniteNumber(snapshot.phaseStartedAt)) &&
    isFiniteNumber(snapshot.pausedRemainingMs) &&
    isResumablePhase(snapshot.pausedPhase) &&
    Boolean(state) &&
    isTimerPhase(state?.phase) &&
    typeof state?.isRunning === 'boolean' &&
    typeof state?.isPaused === 'boolean' &&
    isFiniteNumber(state?.focusDurationMs) &&
    state.focusDurationMs > 0 &&
    isFiniteNumber(state?.breakDurationMs) &&
    state.breakDurationMs > 0 &&
    isFiniteNumber(state?.remainingMs) &&
    isFiniteNumber(state?.elapsedFocusMs) &&
    isFiniteNumber(state?.completedFocusSessions) &&
    (state?.totalScreenTimeMs === undefined ||
      (isFiniteNumber(state.totalScreenTimeMs) &&
        state.totalScreenTimeMs >= 0)) &&
    (state?.totalEyeRestTimeMs === undefined ||
      (isFiniteNumber(state.totalEyeRestTimeMs) &&
        state.totalEyeRestTimeMs >= 0)) &&
    (state?.startedAt === null || isFiniteNumber(state?.startedAt)) &&
    (state?.breakStartedAt === null || isFiniteNumber(state?.breakStartedAt)) &&
    typeof state?.autoMode === 'boolean' &&
    (state.restOverlayMode === undefined ||
      isRestOverlayMode(state.restOverlayMode)) &&
    (state.restAppearanceMode === undefined ||
      isRestAppearanceMode(state.restAppearanceMode))
  )
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function idleTimer(state: TimerState): RestoredTimer {
  const remainingMs = clamp(state.remainingMs, 1000, state.focusDurationMs)
  return {
    state: {
      ...state,
      phase: 'idle',
      isRunning: false,
      isPaused: false,
      remainingMs,
      elapsedFocusMs: state.focusDurationMs - remainingMs,
      startedAt: null,
      breakStartedAt: null,
    },
    phaseStartedAt: null,
    pausedRemainingMs: remainingMs,
    pausedPhase: 'idle',
    shouldShowBreak: false,
  }
}

function activeFocus(
  state: TimerState,
  phaseStartedAt: number,
  elapsedMs: number,
  completedFocusSessions: number,
): RestoredTimer {
  const boundedElapsedMs = clamp(elapsedMs, 0, state.focusDurationMs)
  return {
    state: {
      ...state,
      phase: 'focus',
      isRunning: true,
      isPaused: false,
      remainingMs: state.focusDurationMs - boundedElapsedMs,
      elapsedFocusMs: boundedElapsedMs,
      completedFocusSessions,
      startedAt: phaseStartedAt,
      breakStartedAt: null,
    },
    phaseStartedAt,
    pausedRemainingMs: state.focusDurationMs - boundedElapsedMs,
    pausedPhase: 'focus',
    shouldShowBreak: false,
  }
}

function activeBreak(
  state: TimerState,
  phaseStartedAt: number,
  elapsedMs: number,
  completedFocusSessions: number,
): RestoredTimer {
  const boundedElapsedMs = clamp(elapsedMs, 0, state.breakDurationMs)
  return {
    state: {
      ...state,
      phase: 'break',
      isRunning: true,
      isPaused: false,
      remainingMs: state.breakDurationMs - boundedElapsedMs,
      elapsedFocusMs: state.focusDurationMs,
      completedFocusSessions,
      startedAt: phaseStartedAt - state.focusDurationMs,
      breakStartedAt: phaseStartedAt,
    },
    phaseStartedAt,
    pausedRemainingMs: state.breakDurationMs - boundedElapsedMs,
    pausedPhase: 'break',
    shouldShowBreak: true,
  }
}

function restoreFromFocus(
  state: TimerState,
  focusStartedAt: number,
  elapsedMs: number,
): RestoredTimer {
  if (!state.autoMode) {
    if (elapsedMs < state.focusDurationMs) {
      return activeFocus(
        state,
        focusStartedAt,
        elapsedMs,
        state.completedFocusSessions,
      )
    }

    const breakElapsedMs = elapsedMs - state.focusDurationMs
    if (breakElapsedMs < state.breakDurationMs) {
      return activeBreak(
        state,
        focusStartedAt + state.focusDurationMs,
        breakElapsedMs,
        state.completedFocusSessions + 1,
      )
    }

    return idleTimer({
      ...state,
      remainingMs: state.focusDurationMs,
      completedFocusSessions: state.completedFocusSessions + 1,
    })
  }

  const cycleDurationMs = state.focusDurationMs + state.breakDurationMs
  const completedCycles = Math.floor(elapsedMs / cycleDurationMs)
  const positionInCycleMs = elapsedMs % cycleDurationMs
  const cycleStartedAt = focusStartedAt + completedCycles * cycleDurationMs
  const completedBeforeCurrentPhase =
    state.completedFocusSessions + completedCycles

  if (positionInCycleMs < state.focusDurationMs) {
    return activeFocus(
      state,
      cycleStartedAt,
      positionInCycleMs,
      completedBeforeCurrentPhase,
    )
  }

  return activeBreak(
    state,
    cycleStartedAt + state.focusDurationMs,
    positionInCycleMs - state.focusDurationMs,
    completedBeforeCurrentPhase + 1,
  )
}

export function restoreTimerSnapshot(
  snapshot: TimerSnapshot,
  now: number,
): RestoredTimer {
  const state = {
    ...createDefaultTimerState(),
    ...snapshot.state,
  }

  if (!state.isRunning || state.phase === 'idle') {
    return idleTimer(state)
  }

  if (state.isPaused || state.phase === 'paused') {
    const pausedPhase = snapshot.pausedPhase === 'idle' ? 'focus' : snapshot.pausedPhase
    const durationMs =
      pausedPhase === 'break' ? state.breakDurationMs : state.focusDurationMs
    const remainingMs = clamp(snapshot.pausedRemainingMs, 1, durationMs)

    return {
      state: {
        ...state,
        phase: 'paused',
        isRunning: true,
        isPaused: true,
        remainingMs,
        elapsedFocusMs:
          pausedPhase === 'focus'
            ? state.focusDurationMs - remainingMs
            : state.focusDurationMs,
      },
      phaseStartedAt: null,
      pausedRemainingMs: remainingMs,
      pausedPhase,
      shouldShowBreak: pausedPhase === 'break',
    }
  }

  const activePhase = state.phase === 'break' ? 'break' : 'focus'
  const durationMs =
    activePhase === 'break' ? state.breakDurationMs : state.focusDurationMs
  const derivedPhaseStartedAt =
    snapshot.savedAt - (durationMs - clamp(state.remainingMs, 0, durationMs))
  const phaseStartedAt = snapshot.phaseStartedAt ?? derivedPhaseStartedAt
  const elapsedMs = Math.max(now - phaseStartedAt, 0)

  if (activePhase === 'focus') {
    return restoreFromFocus(state, phaseStartedAt, elapsedMs)
  }

  if (elapsedMs < state.breakDurationMs) {
    return activeBreak(
      state,
      phaseStartedAt,
      elapsedMs,
      state.completedFocusSessions,
    )
  }

  if (!state.autoMode) {
    return idleTimer({ ...state, remainingMs: state.focusDurationMs })
  }

  const nextFocusStartedAt = phaseStartedAt + state.breakDurationMs
  return restoreFromFocus(
    state,
    nextFocusStartedAt,
    elapsedMs - state.breakDurationMs,
  )
}

export class TimerEngine {
  private state: TimerState
  private phaseStartedAt: number | null = null
  private pausedRemainingMs = DEFAULT_FOCUS_DURATION_MS
  private pausedPhase: ResumableTimerPhase = 'idle'
  private lastAccountedAt: number
  private readonly now: () => number

  constructor(options: TimerEngineOptions = {}) {
    this.now = options.now ?? Date.now
    this.lastAccountedAt = this.now()
    this.state = createDefaultTimerState()

    if (options.snapshot && isTimerSnapshot(options.snapshot)) {
      const restored = restoreTimerSnapshot(options.snapshot, this.now())
      this.state = restored.state
      this.phaseStartedAt = restored.phaseStartedAt
      this.pausedRemainingMs = restored.pausedRemainingMs
      this.pausedPhase = restored.pausedPhase
    }
  }

  getState() {
    return this.state
  }

  shouldShowBreak() {
    return (
      this.state.phase === 'break' ||
      (this.state.phase === 'paused' && this.pausedPhase === 'break')
    )
  }

  getSnapshot(savedAt = this.now()): TimerSnapshot {
    this.accountActiveTime(savedAt)
    return {
      version: 1,
      savedAt,
      state: { ...this.state },
      phaseStartedAt: this.phaseStartedAt,
      pausedRemainingMs: this.pausedRemainingMs,
      pausedPhase: this.pausedPhase,
    }
  }

  private accountActiveTime(now = this.now()) {
    const elapsedSinceLastSample = Math.max(now - this.lastAccountedAt, 0)
    this.lastAccountedAt = now

    if (
      elapsedSinceLastSample === 0 ||
      !this.state.isRunning ||
      this.state.isPaused
    ) {
      return
    }

    const activeTimeMs = Math.min(
      elapsedSinceLastSample,
      Math.max(this.state.remainingMs, 0),
    )

    if (this.state.phase === 'focus') {
      this.state.totalScreenTimeMs += activeTimeMs
    } else if (this.state.phase === 'break') {
      this.state.totalEyeRestTimeMs += activeTimeMs
    }
  }

  private syncFocusMetrics(now = this.now()) {
    if (this.phaseStartedAt === null) return
    const elapsedMs = now - this.phaseStartedAt
    this.state.remainingMs = Math.max(
      this.state.focusDurationMs - elapsedMs,
      0,
    )
    this.state.elapsedFocusMs = Math.min(
      elapsedMs,
      this.state.focusDurationMs,
    )
  }

  private syncBreakMetrics(now = this.now()) {
    if (this.phaseStartedAt === null) return
    const elapsedMs = now - this.phaseStartedAt
    this.state.remainingMs = Math.max(
      this.state.breakDurationMs - elapsedMs,
      0,
    )
  }

  private enterFocusPhase(
    freshCycle: boolean,
    requestedRemainingMs = this.state.focusDurationMs,
    now = this.now(),
  ) {
    this.lastAccountedAt = now
    const remainingMs = clamp(
      requestedRemainingMs,
      1,
      this.state.focusDurationMs,
    )
    const elapsedMs = this.state.focusDurationMs - remainingMs

    this.state.phase = 'focus'
    this.state.isRunning = true
    this.state.isPaused = false
    this.state.breakStartedAt = null
    this.state.remainingMs = remainingMs
    this.state.elapsedFocusMs = elapsedMs
    this.phaseStartedAt = now - elapsedMs
    this.state.startedAt = freshCycle
      ? this.phaseStartedAt
      : this.state.startedAt ?? this.phaseStartedAt
    this.pausedRemainingMs = remainingMs
    this.pausedPhase = 'focus'
  }

  private enterBreakPhase(now = this.now()) {
    this.lastAccountedAt = now
    this.state.phase = 'break'
    this.state.isRunning = true
    this.state.isPaused = false
    this.state.remainingMs = this.state.breakDurationMs
    this.state.elapsedFocusMs = this.state.focusDurationMs
    this.phaseStartedAt = now
    this.state.breakStartedAt = now
    this.pausedRemainingMs = this.state.breakDurationMs
    this.pausedPhase = 'break'
  }

  start() {
    this.accountActiveTime()
    const requestedRemainingMs = this.state.remainingMs
    this.state.completedFocusSessions = 0
    this.enterFocusPhase(true, requestedRemainingMs)
    return this.state
  }

  restNow() {
    const effectivePhase =
      this.state.phase === 'paused' ? this.pausedPhase : this.state.phase

    if (!this.state.isRunning || effectivePhase !== 'focus') {
      return this.state
    }

    this.accountActiveTime()
    if (!this.state.isPaused) this.syncFocusMetrics()
    this.state.completedFocusSessions += 1
    this.enterBreakPhase()
    return this.state
  }

  endBreak() {
    const effectivePhase =
      this.state.phase === 'paused' ? this.pausedPhase : this.state.phase

    if (!this.state.isRunning || effectivePhase !== 'break') {
      return this.state
    }

    this.accountActiveTime()
    if (!this.state.isPaused) this.syncBreakMetrics()

    if (this.state.autoMode) {
      this.enterFocusPhase(true)
    } else {
      this.stop()
    }

    return this.state
  }

  tick(): TimerTransition | null {
    if (!this.state.isRunning || this.state.isPaused) return null

    this.accountActiveTime()

    if (this.state.phase === 'focus') {
      this.syncFocusMetrics()
      if (this.state.remainingMs <= 0) {
        this.state.completedFocusSessions += 1
        this.enterBreakPhase()
        return 'focus-ended'
      }
      return null
    }

    if (this.state.phase === 'break') {
      this.syncBreakMetrics()
      if (this.state.remainingMs <= 0) {
        if (this.state.autoMode) {
          this.enterFocusPhase(true)
        } else {
          this.stop()
        }
        return 'break-ended'
      }
    }

    return null
  }

  pause() {
    if (!this.state.isRunning || this.state.isPaused) return this.state

    this.accountActiveTime()
    if (this.state.phase === 'focus') this.syncFocusMetrics()
    if (this.state.phase === 'break') this.syncBreakMetrics()

    this.pausedRemainingMs = this.state.remainingMs
    this.pausedPhase =
      this.state.phase === 'paused' ? this.pausedPhase : this.state.phase
    this.state.phase = 'paused'
    this.state.isPaused = true
    this.phaseStartedAt = null
    return this.state
  }

  resume() {
    if (!this.state.isRunning && this.state.phase === 'idle') {
      return this.start()
    }
    if (!this.state.isPaused) return this.state

    this.state.isPaused = false
    if (this.pausedPhase === 'focus') {
      this.enterFocusPhase(false, this.pausedRemainingMs)
      return this.state
    }

    const elapsedBeforePause =
      this.state.breakDurationMs - this.pausedRemainingMs
    const now = this.now()
    this.lastAccountedAt = now
    this.state.phase = 'break'
    this.state.remainingMs = this.pausedRemainingMs
    this.phaseStartedAt = now - elapsedBeforePause
    this.state.breakStartedAt = this.phaseStartedAt
    return this.state
  }

  stop() {
    this.accountActiveTime()
    this.phaseStartedAt = null
    this.pausedPhase = 'idle'
    this.pausedRemainingMs = this.state.focusDurationMs
    this.state.phase = 'idle'
    this.state.isRunning = false
    this.state.isPaused = false
    this.state.remainingMs = this.state.focusDurationMs
    this.state.elapsedFocusMs = 0
    this.state.startedAt = null
    this.state.breakStartedAt = null
    return this.state
  }

  setRemaining(requestedRemainingMs: number) {
    if (!Number.isFinite(requestedRemainingMs)) return this.state

    this.accountActiveTime()
    const effectivePhase =
      this.state.phase === 'paused' ? this.pausedPhase : this.state.phase
    const isBreak = effectivePhase === 'break'
    const durationMs = isBreak
      ? this.state.breakDurationMs
      : this.state.focusDurationMs
    const remainingMs = clamp(
      Math.round(requestedRemainingMs / 1000) * 1000,
      0,
      durationMs,
    )
    const elapsedMs = durationMs - remainingMs

    this.state.remainingMs = remainingMs
    this.pausedRemainingMs = remainingMs

    if (isBreak) {
      if (!this.state.isPaused) {
        this.phaseStartedAt = this.now() - elapsedMs
        this.state.breakStartedAt = this.phaseStartedAt
      }
    } else {
      this.state.elapsedFocusMs = elapsedMs
      if (this.state.phase === 'idle') {
        this.phaseStartedAt = null
        this.state.startedAt = null
      } else if (!this.state.isPaused) {
        this.phaseStartedAt = this.now() - elapsedMs
        this.state.startedAt = this.phaseStartedAt
      }
    }

    return this.state
  }

  setBreakDuration(requestedDurationMs: number) {
    if (!Number.isFinite(requestedDurationMs)) return this.state

    this.accountActiveTime()
    const previousDurationMs = this.state.breakDurationMs
    const durationMs = clamp(
      Math.round(requestedDurationMs / 5000) * 5000,
      5000,
      120000,
    )
    const effectivePhase =
      this.state.phase === 'paused' ? this.pausedPhase : this.state.phase

    if (effectivePhase === 'break') {
      if (!this.state.isPaused) this.syncBreakMetrics()

      const elapsedMs = Math.max(
        previousDurationMs - this.state.remainingMs,
        0,
      )
      const adjustedElapsedMs = Math.min(elapsedMs, durationMs - 1000)
      const remainingMs = durationMs - adjustedElapsedMs

      this.state.remainingMs = remainingMs
      this.pausedRemainingMs = remainingMs

      if (!this.state.isPaused) {
        this.phaseStartedAt = this.now() - adjustedElapsedMs
        this.state.breakStartedAt = this.phaseStartedAt
      }
    }

    this.state.breakDurationMs = durationMs
    return this.state
  }

  setAutoMode(enabled: boolean) {
    this.state.autoMode = Boolean(enabled)
    return this.state
  }

  setRestOverlayMode(mode: RestOverlayMode) {
    this.state.restOverlayMode = mode
    return this.state
  }

  setRestAppearanceMode(mode: RestAppearanceMode) {
    this.state.restAppearanceMode = mode
    return this.state
  }

  resetAfterWake() {
    const completedFocusSessions = this.state.completedFocusSessions

    // Sleep time is not active screen time. Reset the accounting clock before
    // stopping so the suspended interval is never added to either total.
    this.lastAccountedAt = this.now()
    this.stop()
    this.state.completedFocusSessions = completedFocusSessions

    if (this.state.autoMode) {
      this.enterFocusPhase(true, this.state.focusDurationMs)
    }

    return this.state
  }
}
