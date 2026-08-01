import type {
  LaunchAtLoginState,
  RestAppearanceMode,
  RestOverlayMode,
  TimerState,
} from '../shared/timer-contract'

export {}

type Unsubscribe = () => void

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
      setFocusDuration: (durationMs: number) => Promise<TimerState>
      setBreakDuration: (durationMs: number) => Promise<TimerState>
      setAutoMode: (enabled: boolean) => Promise<TimerState>
      setRestOverlayMode: (mode: RestOverlayMode) => Promise<TimerState>
      setRestAppearanceMode: (mode: RestAppearanceMode) => Promise<TimerState>
      getLaunchAtLogin: () => Promise<LaunchAtLoginState>
      setLaunchAtLogin: (enabled: boolean) => Promise<LaunchAtLoginState>
      onStateChange: (callback: (state: TimerState) => void) => Promise<Unsubscribe>
    }
  }
}
