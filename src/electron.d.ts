export {}

type TimerPhase = 'idle' | 'focus' | 'break' | 'paused'
type RestOverlayMode = 'none' | 'primary-display' | 'all-displays'

type TimerState = {
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
}

type Unsubscribe = () => void

type LaunchAtLoginState = {
  supported: boolean
  enabled: boolean
  status:
    | 'enabled'
    | 'disabled'
    | 'requires-approval'
    | 'available-after-install'
    | 'unsupported'
}

declare global {
  interface Window {
    eyeBreak: {
      getState: () => Promise<TimerState>
      start: () => Promise<TimerState>
      pause: () => Promise<TimerState>
      resume: () => Promise<TimerState>
      stop: () => Promise<TimerState>
      restNow: () => Promise<TimerState>
      endBreak: () => Promise<TimerState>
      setRemaining: (remainingMs: number) => Promise<TimerState>
      setBreakDuration: (durationMs: number) => Promise<TimerState>
      setAutoMode: (enabled: boolean) => Promise<TimerState>
      setRestOverlayMode: (mode: RestOverlayMode) => Promise<TimerState>
      getLaunchAtLogin: () => Promise<LaunchAtLoginState>
      setLaunchAtLogin: (enabled: boolean) => Promise<LaunchAtLoginState>
      onStateChange: (callback: (state: TimerState) => void) => Promise<Unsubscribe>
    }
  }
}
