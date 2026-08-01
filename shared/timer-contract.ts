export type TimerPhase = 'idle' | 'focus' | 'break' | 'paused'
export type RestOverlayMode = 'none' | 'primary-display' | 'all-displays'
export type RestAppearanceMode = 'ambient' | 'black' | 'black-timer'

export const MIN_FOCUS_DURATION_MS = 60_000
export const MAX_FOCUS_DURATION_MS = 120 * 60_000
export const FOCUS_DURATION_STEP_MS = 60_000

export type LaunchAtLoginState = {
  supported: boolean
  enabled: boolean
  status:
    | 'enabled'
    | 'disabled'
    | 'requires-approval'
    | 'available-after-install'
    | 'unsupported'
}

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
