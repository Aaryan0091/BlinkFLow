import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  Eye,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { playRestCue, unlockRestAudio } from '../rest-audio'
import { IrisTimer } from './IrisTimer'
import './aperture.css'

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
  totalScreenTimeMs: number
  totalEyeRestTimeMs: number
  startedAt: number | null
  breakStartedAt: number | null
  autoMode: boolean
}

const DEFAULT_STATE: TimerState = {
  phase: 'idle',
  isRunning: false,
  isPaused: false,
  focusDurationMs: 20 * 60 * 1000,
  breakDurationMs: 20 * 1000,
  remainingMs: 20 * 60 * 1000,
  elapsedFocusMs: 0,
  completedFocusSessions: 0,
  totalScreenTimeMs: 0,
  totalEyeRestTimeMs: 0,
  startedAt: null,
  breakStartedAt: null,
  autoMode: false,
}

const browserFallback = {
  getState: async () => DEFAULT_STATE,
  start: async () => DEFAULT_STATE,
  pause: async () => DEFAULT_STATE,
  resume: async () => DEFAULT_STATE,
  stop: async () => DEFAULT_STATE,
  restNow: async () => DEFAULT_STATE,
  setRemaining: async () => DEFAULT_STATE,
  setBreakDuration: async (durationMs: number) => ({
    ...DEFAULT_STATE,
    breakDurationMs: durationMs,
  }),
  setAutoMode: async (enabled: boolean) => ({
    ...DEFAULT_STATE,
    autoMode: enabled,
  }),
  getLaunchAtLogin: async () => ({
    supported: false,
    enabled: false,
    status: 'available-after-install' as const,
  }),
  setLaunchAtLogin: async () => ({
    supported: false,
    enabled: false,
    status: 'available-after-install' as const,
  }),
  onStateChange: async () => () => undefined,
}

function atTime(remainingMs: number) {
  return new Date(Date.now() + remainingMs).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTotalTime(totalMs: number) {
  const totalMinutes = Math.floor(Math.max(totalMs, 0) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (totalMinutes > 0) return `${totalMinutes}m`
  return `${Math.floor(Math.max(totalMs, 0) / 1000)}s`
}

export default function ApertureApp() {
  const eyeBreak = window.eyeBreak ?? browserFallback
  const [timer, setTimer] = useState<TimerState>(DEFAULT_STATE)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const wasInBreak = useRef(false)

  useEffect(() => {
    const subscription = eyeBreak.onStateChange(setTimer)
    void eyeBreak.getState().then(setTimer)
    void eyeBreak.getLaunchAtLogin().then((state) => setLaunchAtLogin(state.enabled))
    return () => {
      void subscription.then((unsubscribe) => unsubscribe())
    }
  }, [eyeBreak])

  useEffect(() => {
    const inBreak =
      timer.phase === 'break' ||
      (timer.phase === 'paused' && timer.breakStartedAt !== null)
    if (!wasInBreak.current && inBreak) playRestCue('rest')
    if (wasInBreak.current && !inBreak) playRestCue('back')
    wasInBreak.current = inBreak
  }, [timer.breakStartedAt, timer.phase])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.code === 'Space') {
        event.preventDefault()
        unlockRestAudio()
        if (!timer.isRunning) void eyeBreak.start()
        else if (timer.isPaused || timer.phase === 'paused') void eyeBreak.resume()
        else void eyeBreak.pause()
      } else if (event.key.toLowerCase() === 's' && timer.isRunning) {
        void eyeBreak.stop()
      } else if (
        (event.code === 'KeyR' || event.key.toLowerCase() === 'r') &&
        timer.isRunning &&
        (timer.phase === 'focus' ||
          (timer.phase === 'paused' && timer.breakStartedAt === null))
      ) {
        event.preventDefault()
        void eyeBreak.restNow()
      } else if (
        event.key === ',' ||
        event.key === '.' ||
        event.code === 'Comma' ||
        event.code === 'Period'
      ) {
        event.preventDefault()
        setSettingsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    eyeBreak,
    timer.breakStartedAt,
    timer.isPaused,
    timer.isRunning,
    timer.phase,
  ])

  const paused = timer.isPaused || timer.phase === 'paused'
  const visualPhase =
    timer.phase === 'break' || (paused && timer.breakStartedAt !== null)
      ? 'rest'
      : timer.phase === 'idle'
        ? 'idle'
        : 'focus'
  const totalMs =
    visualPhase === 'rest' ? timer.breakDurationMs : timer.focusDurationMs
  const progress = Math.min(1, Math.max(0, 1 - timer.remainingMs / totalMs))
  const running = timer.isRunning && !paused
  const label =
    visualPhase === 'rest'
      ? 'Look away'
      : visualPhase === 'idle'
        ? 'Focus block'
        : paused
          ? 'Paused'
          : 'Until rest'
  const sublabel =
    visualPhase === 'rest'
      ? 'Eyes on the horizon'
      : visualPhase === 'idle'
        ? `20 min of focus, then ${Math.round(timer.breakDurationMs / 1000)} s of distance`
        : paused
          ? 'Held. Pick it back up whenever you are ready.'
          : `Next rest at ${atTime(timer.remainingMs)}`
  const status =
    visualPhase === 'rest' ? 'Resting' : visualPhase === 'idle' ? 'Ready' : paused ? 'Paused' : 'Focusing'
  const nextRest =
    visualPhase === 'rest' ? 'Now' : running ? atTime(timer.remainingMs) : '—'

  const startOrToggle = () => {
    unlockRestAudio()
    if (!timer.isRunning) void eyeBreak.start()
    else if (paused) void eyeBreak.resume()
    else void eyeBreak.pause()
  }

  return (
    <div className={`aperture-app phase-${visualPhase}`}>
      <div className="aperture-aurora aperture-aurora-one" aria-hidden="true" />
      <div className="aperture-aurora aperture-aurora-two" aria-hidden="true" />
      <div className="aperture-grain" aria-hidden="true" />

      <div className="aperture-shell">
        <motion.header
          className="aperture-header"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="aperture-brand">
            <span className="aperture-mark" aria-hidden="true">
              <Eye size={19} />
            </span>
            <span>
              <strong>Aperture</strong>
              <small>Eye care timer</small>
            </span>
          </div>

          <div className="aperture-header-actions">
            <span className={`aperture-status ${visualPhase}`}>
              <i aria-hidden="true" />
              {status}
            </span>
            <button
              type="button"
              className="aperture-icon-button"
              aria-label="Open preferences"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </motion.header>

        <main className="aperture-main">
          <motion.section
            className="aperture-narrative"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="aperture-rule">
              <b>20 · 20 · 20</b>
              the optometrist&apos;s rule
            </span>
            <h1>
              Give your eyes
              <br />
              <em>twenty seconds</em> of distance.
            </h1>
            <p className="aperture-intro">
              Screens lock your focus at a single depth and quietly halve your blink
              rate. Aperture breaks that loop every 20 minutes — briefly, calmly,
              and impossible to overlook.
            </p>

            <div className="aperture-facts">
              <Fact label="Next rest" value={nextRest} />
              <Fact
                label="Rests this session"
                value={String(timer.completedFocusSessions)}
              />
              <Fact
                label="Rhythm"
                value={`20m · ${Math.round(timer.breakDurationMs / 1000)}s`}
              />
            </div>

            <StatsCard
              count={timer.completedFocusSessions}
              totalScreenTimeMs={timer.totalScreenTimeMs}
              totalEyeRestTimeMs={timer.totalEyeRestTimeMs}
            />

            <div className="aperture-shortcuts">
              <kbd>Space</kbd> start / pause <kbd>R</kbd> rest now <kbd>S</kbd> stop{' '}
              <kbd>.</kbd> preferences
            </div>
          </motion.section>

          <motion.section
            className="aperture-timer-column"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <IrisTimer
              phase={visualPhase}
              running={running}
              remaining={timer.remainingMs}
              progress={progress}
              total={totalMs}
              label={label}
              sublabel={sublabel}
              onProgressChange={(nextProgress) =>
                eyeBreak
                  .setRemaining(
                    Math.round((totalMs * (1 - nextProgress)) / 1000) * 1000,
                  )
                  .then(setTimer)
                  .then(() => undefined)
              }
            />

            <div className="aperture-controls">
              {timer.isRunning && (
                <button
                  type="button"
                  className="aperture-round-button"
                  aria-label="Stop session"
                  onClick={() => void eyeBreak.stop()}
                >
                  <Square size={14} fill="currentColor" />
                </button>
              )}
              <button
                type="button"
                className="aperture-primary-button"
                onClick={startOrToggle}
              >
                {running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {!timer.isRunning ? 'Begin session' : paused ? 'Resume' : 'Pause'}
              </button>
              {visualPhase === 'focus' && timer.isRunning && (
                <button
                  type="button"
                  className="aperture-round-button"
                  aria-label="Rest now"
                  onClick={() => void eyeBreak.restNow()}
                >
                  <Eye size={17} />
                </button>
              )}
            </div>
            <p className="aperture-cycle-trail">
              {timer.completedFocusSessions > 0
                ? `${timer.completedFocusSessions} rest${timer.completedFocusSessions === 1 ? '' : 's'} completed`
                : timer.isRunning
                  ? 'First rest is queued'
                  : 'Drag the outer marker to adjust elapsed time'}
            </p>
          </motion.section>
        </main>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <Preferences
            timer={timer}
            launchAtLogin={launchAtLogin}
            onClose={() => setSettingsOpen(false)}
            onRestDuration={(seconds) => {
              window.localStorage.setItem('eye-break-rest-seconds', String(seconds))
              void eyeBreak.setBreakDuration(seconds * 1000).then(setTimer)
            }}
            onAutoMode={(enabled) => void eyeBreak.setAutoMode(enabled).then(setTimer)}
            onLaunchAtLogin={(enabled) =>
              void eyeBreak.setLaunchAtLogin(enabled).then((state) => {
                setLaunchAtLogin(state.enabled)
              })
            }
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatsCard({
  count,
  totalScreenTimeMs,
  totalEyeRestTimeMs,
}: {
  count: number
  totalScreenTimeMs: number
  totalEyeRestTimeMs: number
}) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <section className="aperture-stats">
      <span>This week</span>
      <p>
        <strong>{count}</strong> rests today
      </p>
      <div className="aperture-bars" aria-label={`${count} rests completed today`}>
        {days.map((day, index) => (
          <div key={`${day}-${index}`}>
            <i className={index === 6 ? 'today' : ''} style={{ height: index === 6 && count ? '100%' : '4%' }} />
            <span>{day}</span>
          </div>
        ))}
      </div>
      <div className="aperture-total-metrics">
        <div>
          <span>Total screen time</span>
          <strong>{formatTotalTime(totalScreenTimeMs)}</strong>
        </div>
        <div className="eye-saved">
          <span>Total eye saved time</span>
          <strong>{formatTotalTime(totalEyeRestTimeMs)}</strong>
        </div>
      </div>
    </section>
  )
}

function Preferences({
  timer,
  launchAtLogin,
  onClose,
  onRestDuration,
  onAutoMode,
  onLaunchAtLogin,
}: {
  timer: TimerState
  launchAtLogin: boolean
  onClose: () => void
  onRestDuration: (seconds: number) => void
  onAutoMode: (enabled: boolean) => void
  onLaunchAtLogin: (enabled: boolean) => void
}) {
  const restSeconds = Math.round(timer.breakDurationMs / 1000)

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <>
      <motion.button
        type="button"
        className="aperture-scrim"
        aria-label="Close preferences"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        className="aperture-preferences"
        role="dialog"
        aria-modal="true"
        aria-label="Preferences"
        initial={{ x: '100%', opacity: 0.4 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.3 }}
        transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      >
        <header>
          <div>
            <h2>Preferences</h2>
            <p>Tune the rhythm and the nudge.</p>
          </div>
          <button type="button" aria-label="Close settings" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="aperture-preference-body">
          <h3>Rhythm</h3>
          <div className="aperture-presets">
            <button
              type="button"
              className={restSeconds === 20 ? 'active' : undefined}
              aria-pressed={restSeconds === 20}
              onClick={() => onRestDuration(20)}
            >
              <span>
                Classic
                {restSeconds === 20 && <Check size={14} aria-hidden="true" />}
              </span>
              <small>20 min · 20 s</small>
            </button>
            <button
              type="button"
              className={restSeconds === 60 ? 'active' : undefined}
              aria-pressed={restSeconds === 60}
              onClick={() => onRestDuration(60)}
            >
              <span>
                Deep work
                {restSeconds === 60 && <Check size={14} aria-hidden="true" />}
              </span>
              <small>20 min · 60 s</small>
            </button>
          </div>
          <label className="aperture-slider">
            <span>Rest length <b>{restSeconds} s</b></span>
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={restSeconds}
              onChange={(event) => onRestDuration(Number(event.target.value))}
            />
          </label>
          <Toggle
            label="Repeat automatically"
            hint="Chain focus and rest until you stop."
            checked={timer.autoMode}
            onChange={onAutoMode}
          />

          <h3>The desktop app</h3>
          <Toggle
            label="Launch at login"
            hint="Keep Aperture ready whenever the laptop starts."
            checked={launchAtLogin}
            onChange={onLaunchAtLogin}
          />
          <Toggle
            label="Immersive rest"
            hint="Takes over every connected display when it is time to look away."
            checked
            disabled
            onChange={() => undefined}
          />

          <p className="aperture-privacy">
            <ShieldCheck size={15} />
            Nothing leaves this device. Timer progress and preferences stay local.
          </p>
        </div>
      </motion.aside>
    </>
  )
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <button
      type="button"
      className="aperture-toggle"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <i className={checked ? 'active' : ''}>
        <b />
      </i>
    </button>
  )
}
