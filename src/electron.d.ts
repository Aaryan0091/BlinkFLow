export {}

type TimerPhase = 'idle' | 'focus' | 'break' | 'paused'

type TimerState = {
  phase: TimerPhase
  isRunning: boolean
  isPaused: boolean
  focusDurationMs: number
  breakDurationMs: number
  remainingMs: number
  elapsedFocusMs: number
  completedFocusSessions: number
  startedAt: number | null
  breakStartedAt: number | null
  autoMode: boolean
}

type Unsubscribe = () => void

declare global {
  interface Window {
    eyeBreak: {
      getState: () => Promise<TimerState>
      start: () => Promise<TimerState>
      pause: () => Promise<TimerState>
      resume: () => Promise<TimerState>
      stop: () => Promise<TimerState>
      setRemaining: (remainingMs: number) => Promise<TimerState>
      setBreakDuration: (durationMs: number) => Promise<TimerState>
      setAutoMode: (enabled: boolean) => Promise<TimerState>
      onStateChange: (callback: (state: TimerState) => void) => Promise<Unsubscribe>
    }
  }
}
