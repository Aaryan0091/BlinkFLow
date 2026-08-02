import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  Eye,
  GalleryHorizontal,
  Minus,
  Monitor,
  MonitorOff,
  Moon,
  Pause,
  Play,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  RestAppearanceMode,
  RestOverlayMode,
  TimerState,
} from '../../shared/timer-contract'
import { browserFallback, DEFAULT_TIMER_STATE } from '../browser-fallback'
import {
  loadRestVolumePreference,
  playRestCue,
  saveRestVolumePreference,
  unlockRestAudio,
} from '../rest-audio'
import { IrisTimer } from './IrisTimer'
import './aperture.css'

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
  const [timer, setTimer] = useState<TimerState>(DEFAULT_TIMER_STATE)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const [restOverlayModeSaving, setRestOverlayModeSaving] = useState(false)
  const [restAppearanceModeSaving, setRestAppearanceModeSaving] = useState(false)
  const [restVolume, setRestVolume] = useState(loadRestVolumePreference)
  const wasInBreak = useRef(false)

  useEffect(() => {
    const subscription = eyeBreak.onStateChange((state) => setTimer(state))
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
  const focusMinutes = Math.round(timer.focusDurationMs / 60_000)
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
        ? `${focusMinutes} min of focus, then ${Math.round(timer.breakDurationMs / 1000)} s of distance`
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
              <strong>BlinkFlow</strong>
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
              rate. BlinkFlow breaks that loop on your chosen rhythm — briefly,
              calmly, and impossible to overlook.
            </p>

            <div className="aperture-facts">
              <Fact label="Next rest" value={nextRest} />
              <Fact
                label="Rests this session"
                value={String(timer.completedFocusSessions)}
              />
              <Fact
                label="Rhythm"
                value={`${focusMinutes}m · ${Math.round(timer.breakDurationMs / 1000)}s`}
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
            onFocusDuration={(minutes) => {
              void eyeBreak.setFocusDuration(minutes * 60_000).then(setTimer)
            }}
            onRestDuration={(seconds) => {
              window.localStorage.setItem('eye-break-rest-seconds', String(seconds))
              void eyeBreak.setBreakDuration(seconds * 1000).then(setTimer)
            }}
            onAutoMode={(enabled) => void eyeBreak.setAutoMode(enabled).then(setTimer)}
            restVolume={restVolume}
            onRestVolume={(volume) =>
              setRestVolume(saveRestVolumePreference(volume))
            }
            restOverlayModeSaving={restOverlayModeSaving}
            onRestOverlayMode={(mode) => {
              const previousMode = timer.restOverlayMode
              setTimer((current) => ({
                ...current,
                restOverlayMode: mode,
              }))
              setRestOverlayModeSaving(true)
              void eyeBreak
                .setRestOverlayMode(mode)
                .then(setTimer)
                .catch(() =>
                  setTimer((current) => ({
                    ...current,
                    restOverlayMode: previousMode,
                  })),
                )
                .finally(() => setRestOverlayModeSaving(false))
            }}
            restAppearanceModeSaving={restAppearanceModeSaving}
            onRestAppearanceMode={(mode) => {
              const previousMode = timer.restAppearanceMode
              setTimer((current) => ({
                ...current,
                restAppearanceMode: mode,
              }))
              setRestAppearanceModeSaving(true)
              void eyeBreak
                .setRestAppearanceMode(mode)
                .then(setTimer)
                .catch(() =>
                  setTimer((current) => ({
                    ...current,
                    restAppearanceMode: previousMode,
                  })),
                )
                .finally(() => setRestAppearanceModeSaving(false))
            }}
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
  const milestones = [1, 2, 3, 4, 5, 6, 7]
  return (
    <section className="aperture-stats">
      <span>Session progress</span>
      <p>
        <strong>{count}</strong> rests completed
      </p>
      <div
        className="aperture-bars"
        aria-label={`${count} rests completed this session`}
      >
        {milestones.map((milestone) => {
          const completed = count >= milestone
          return (
            <div key={milestone}>
              <i
                className={completed ? 'completed' : undefined}
                style={{ height: completed ? `${30 + milestone * 10}%` : '4%' }}
              />
              <span>{milestone}</span>
            </div>
          )
        })}
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
  onFocusDuration,
  onRestDuration,
  onAutoMode,
  restVolume,
  onRestVolume,
  restOverlayModeSaving,
  onRestOverlayMode,
  restAppearanceModeSaving,
  onRestAppearanceMode,
  onLaunchAtLogin,
}: {
  timer: TimerState
  launchAtLogin: boolean
  onClose: () => void
  onFocusDuration: (minutes: number) => void
  onRestDuration: (seconds: number) => void
  onAutoMode: (enabled: boolean) => void
  restVolume: number
  onRestVolume: (volume: number) => void
  restOverlayModeSaving: boolean
  onRestOverlayMode: (mode: RestOverlayMode) => void
  restAppearanceModeSaving: boolean
  onRestAppearanceMode: (mode: RestAppearanceMode) => void
  onLaunchAtLogin: (enabled: boolean) => void
}) {
  const focusMinutes = Math.round(timer.focusDurationMs / 60_000)
  const restSeconds = Math.round(timer.breakDurationMs / 1000)
  const [focusMinutesDraft, setFocusMinutesDraft] = useState(
    String(focusMinutes),
  )
  const replaceFocusValueOnType = useRef(true)

  useEffect(() => {
    setFocusMinutesDraft(String(focusMinutes))
  }, [focusMinutes])

  const commitFocusDuration = () => {
    const parsedMinutes = Number(focusMinutesDraft)
    const nextMinutes = Number.isFinite(parsedMinutes)
      ? Math.min(120, Math.max(1, Math.round(parsedMinutes)))
      : focusMinutes

    setFocusMinutesDraft(String(nextMinutes))
    if (nextMinutes !== focusMinutes) onFocusDuration(nextMinutes)
  }

  const adjustFocusDuration = (change: number) => {
    const parsedMinutes = Number(focusMinutesDraft)
    const currentMinutes =
      focusMinutesDraft.trim() && Number.isFinite(parsedMinutes)
        ? Math.round(parsedMinutes)
        : focusMinutes
    const nextMinutes = Math.min(120, Math.max(1, currentMinutes + change))

    replaceFocusValueOnType.current = false
    setFocusMinutesDraft(String(nextMinutes))
    if (nextMinutes !== focusMinutes) onFocusDuration(nextMinutes)
  }

  const displayedFocusMinutes = Number(focusMinutesDraft)
  const canDecreaseFocus =
    focusMinutesDraft.trim() !== '' && displayedFocusMinutes > 1
  const canIncreaseFocus =
    focusMinutesDraft.trim() !== '' && displayedFocusMinutes < 120

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
          <div className="aperture-duration-field">
            <label htmlFor="focus-duration-minutes">
              <span>Focus interval</span>
              <small id="focus-duration-help">
                The break begins after this much focused screen time.
              </small>
            </label>
            <div className="aperture-duration-stepper">
              <button
                type="button"
                className="aperture-duration-stepper-button"
                aria-label="Decrease focus interval by one minute"
                disabled={!canDecreaseFocus}
                onClick={() => adjustFocusDuration(-1)}
              >
                <Minus size={16} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <div className="aperture-duration-input">
                <input
                  id="focus-duration-minutes"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="120"
                  step="1"
                  value={focusMinutesDraft}
                  aria-describedby="focus-duration-help"
                  onFocus={(event) => {
                    replaceFocusValueOnType.current = true
                    event.currentTarget.select()
                  }}
                  onMouseDown={() => {
                    replaceFocusValueOnType.current = true
                  }}
                  onChange={(event) =>
                    setFocusMinutesDraft(event.currentTarget.value)
                  }
                  onBlur={commitFocusDuration}
                  onKeyDown={(event) => {
                    if (
                      /^\d$/.test(event.key) &&
                      replaceFocusValueOnType.current &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.altKey
                    ) {
                      event.preventDefault()
                      replaceFocusValueOnType.current = false
                      setFocusMinutesDraft(event.key)
                      return
                    }

                    if (
                      (event.key === 'Backspace' || event.key === 'Delete') &&
                      replaceFocusValueOnType.current
                    ) {
                      event.preventDefault()
                      replaceFocusValueOnType.current = false
                      setFocusMinutesDraft('')
                      return
                    }

                    replaceFocusValueOnType.current = false
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                />
                <span>min</span>
              </div>
              <button
                type="button"
                className="aperture-duration-stepper-button"
                aria-label="Increase focus interval by one minute"
                disabled={!canIncreaseFocus}
                onClick={() => adjustFocusDuration(1)}
              >
                <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </div>
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
              <small>20 s rest</small>
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
              <small>60 s rest</small>
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

          <h3>Sound</h3>
          <label className="aperture-slider aperture-volume-slider">
            <span>
              <span className="aperture-volume-label">
                {restVolume === 0 ? (
                  <VolumeX size={16} aria-hidden="true" />
                ) : (
                  <Volume2 size={16} aria-hidden="true" />
                )}
                Rest sounds
              </span>
              <b>{restVolume === 0 ? 'Muted' : `${restVolume}%`}</b>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={restVolume}
              aria-label="Rest sound volume"
              aria-valuetext={
                restVolume === 0 ? 'Muted' : `${restVolume} percent`
              }
              style={{
                background: `linear-gradient(90deg, #14b892 0%, #a8f5e9 ${restVolume}%, rgba(255,255,255,0.09) ${restVolume}%, rgba(255,255,255,0.09) 100%)`,
              }}
              onChange={(event) => onRestVolume(Number(event.target.value))}
            />
            <small>Controls BlinkFlow’s own rest and return chimes only.</small>
          </label>

          <h3>The desktop app</h3>
          <Toggle
            label="Launch at login"
            hint="Keep BlinkFlow ready whenever the laptop starts."
            checked={launchAtLogin}
            onChange={onLaunchAtLogin}
          />

          <h3>Rest screen style</h3>
          <div
            className="aperture-overlay-options"
            role="radiogroup"
            aria-label="Rest screen appearance"
            aria-busy={restAppearanceModeSaving}
          >
            <RestAppearanceOption
              mode="ambient"
              icon={<Sparkles size={18} aria-hidden="true" />}
              title="Ambient"
              description="The current calming scene, guidance, timer, and controls"
              selected={timer.restAppearanceMode === 'ambient'}
              disabled={restAppearanceModeSaving}
              onSelect={onRestAppearanceMode}
            />
            <RestAppearanceOption
              mode="black"
              icon={<Moon size={18} aria-hidden="true" />}
              title="Pitch black"
              description="A completely black rest screen with no visible content"
              selected={timer.restAppearanceMode === 'black'}
              disabled={restAppearanceModeSaving}
              onSelect={onRestAppearanceMode}
            />
            <RestAppearanceOption
              mode="black-timer"
              icon={<Timer size={18} aria-hidden="true" />}
              title="Black + timer"
              description="Pitch black with the circular countdown and soft ripples"
              selected={timer.restAppearanceMode === 'black-timer'}
              disabled={restAppearanceModeSaving}
              onSelect={onRestAppearanceMode}
            />
          </div>

          <h3>Immersive rest</h3>
          <div
            className="aperture-overlay-options"
            role="radiogroup"
            aria-label="Rest display behavior"
            aria-busy={restOverlayModeSaving}
          >
            <RestOverlayOption
              mode="none"
              icon={<MonitorOff size={18} aria-hidden="true" />}
              title="No screens"
              description="Sound and countdown continue without covering a display"
              selected={timer.restOverlayMode === 'none'}
              disabled={restOverlayModeSaving}
              onSelect={onRestOverlayMode}
            />
            <RestOverlayOption
              mode="primary-display"
              icon={<Monitor size={18} aria-hidden="true" />}
              title="Main display"
              description="Rest screen on the main display; other screens stay usable"
              selected={timer.restOverlayMode === 'primary-display'}
              disabled={restOverlayModeSaving}
              onSelect={onRestOverlayMode}
            />
            <RestOverlayOption
              mode="all-displays"
              icon={<GalleryHorizontal size={18} aria-hidden="true" />}
              title="All displays"
              description="Rest screen appears across every connected display"
              selected={timer.restOverlayMode === 'all-displays'}
              disabled={restOverlayModeSaving}
              onSelect={onRestOverlayMode}
            />
          </div>

          <p className="aperture-privacy">
            <ShieldCheck size={15} />
            Nothing leaves this device. Timer progress and preferences stay local.
          </p>
        </div>
      </motion.aside>
    </>
  )
}

function RestAppearanceOption({
  mode,
  icon,
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  mode: RestAppearanceMode
  icon: ReactNode
  title: string
  description: string
  selected: boolean
  disabled: boolean
  onSelect: (mode: RestAppearanceMode) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={selected ? 'active' : undefined}
      disabled={disabled}
      onClick={() => onSelect(mode)}
    >
      <span className="aperture-overlay-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="aperture-overlay-check" aria-hidden="true">
        {selected && <Check size={13} />}
      </span>
    </button>
  )
}

function RestOverlayOption({
  mode,
  icon,
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  mode: RestOverlayMode
  icon: ReactNode
  title: string
  description: string
  selected: boolean
  disabled: boolean
  onSelect: (mode: RestOverlayMode) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={selected ? 'active' : undefined}
      disabled={disabled}
      onClick={() => onSelect(mode)}
    >
      <span className="aperture-overlay-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="aperture-overlay-check" aria-hidden="true">
        {selected && <Check size={13} />}
      </span>
    </button>
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
