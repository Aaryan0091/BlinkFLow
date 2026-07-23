import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  BellRing,
  Check,
  Eye,
  Laptop,
  Pause,
  Play,
  Repeat2,
  ShieldCheck,
  Square,
  TimerReset,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import './App.css'

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

const defaultState: TimerState = {
  phase: 'idle',
  isRunning: false,
  isPaused: false,
  focusDurationMs: 20 * 60 * 1000,
  breakDurationMs: 20 * 1000,
  remainingMs: 20 * 60 * 1000,
  elapsedFocusMs: 0,
  completedFocusSessions: 0,
  startedAt: null,
  breakStartedAt: null,
  autoMode: false,
}

const browserFallback = {
  async getState() {
    return defaultState
  },
  async start() {
    return defaultState
  },
  async pause() {
    return defaultState
  },
  async resume() {
    return defaultState
  },
  async stop() {
    return defaultState
  },
  async setRemaining() {
    return defaultState
  },
  async setBreakDuration(durationMs: number) {
    return { ...defaultState, breakDurationMs: durationMs }
  },
  async setAutoMode(enabled: boolean) {
    return { ...defaultState, autoMode: enabled }
  },
  async onStateChange() {
    return () => undefined
  },
}

const phaseCopy: Record<TimerPhase, { eyebrow: string; title: string; description: string }> = {
  idle: {
    eyebrow: 'Ready to begin',
    title: 'Your next eye break',
    description: 'Start whenever you settle into work or a game. We will keep the clock.',
  },
  focus: {
    eyebrow: 'Focus in progress',
    title: 'Until your eye break',
    description: 'Stay in flow. Eye Break is quietly running above everything else.',
  },
  break: {
    eyebrow: 'Break in progress',
    title: 'Keep looking away',
    description: 'Relax your focus on something distant until the countdown finishes.',
  },
  paused: {
    eyebrow: 'Cycle paused',
    title: 'Your time is held',
    description: 'Resume when you are ready. Nothing will count down while paused.',
  },
}

function formatClock(totalMs: number) {
  const totalSeconds = Math.ceil(Math.max(0, totalMs) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function App() {
  const eyeBreak = window.eyeBreak ?? browserFallback
  const isBreakWindow = new URLSearchParams(window.location.search).get('mode') === 'break'
  const [timer, setTimer] = useState<TimerState>(defaultState)
  const [now, setNow] = useState(Date.now())
  const prefersReducedMotion = useReducedMotion()
  const [introStage, setIntroStage] = useState<'visible' | 'leaving' | 'done'>(
    isBreakWindow ? 'done' : 'visible',
  )

  useEffect(() => {
    const unsubscribePromise = eyeBreak.onStateChange((state) => {
      setTimer(state)
      setNow(Date.now())
    })

    eyeBreak.getState().then((state) => {
      setTimer(state)
      setNow(Date.now())
    })

    return () => {
      void unsubscribePromise.then((unsubscribe) => unsubscribe())
    }
  }, [eyeBreak])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const savedRestSeconds = Number(window.localStorage.getItem('eye-break-rest-seconds'))
    if (Number.isFinite(savedRestSeconds) && savedRestSeconds >= 5 && savedRestSeconds <= 120) {
      void eyeBreak.setBreakDuration(savedRestSeconds * 1000).then(setTimer)
    }
  }, [eyeBreak])

  useEffect(() => {
    if (introStage !== 'leaving') return

    const revealTimer = window.setTimeout(
      () => setIntroStage('done'),
      prefersReducedMotion ? 80 : 1400,
    )
    return () => window.clearTimeout(revealTimer)
  }, [introStage, prefersReducedMotion])

  if (isBreakWindow) {
    return (
      <BreakOverlay
        timer={timer}
        now={now}
        onPause={() => eyeBreak.pause()}
        onResume={() => eyeBreak.resume()}
        onStop={() => eyeBreak.stop()}
      />
    )
  }

  const isPaused = timer.isPaused || timer.phase === 'paused'
  const activePhase = isPaused ? 'paused' : timer.phase
  const totalMs = timer.phase === 'break' ? timer.breakDurationMs : timer.focusDurationMs
  const progress = Math.min(Math.max(1 - timer.remainingMs / totalMs, 0), 1)
  const elapsedMs = totalMs - timer.remainingMs
  const progressPercent = Math.round(progress * 100)
  const eyeProgressOffset = 100 - progress * 100
  const isRecovering = timer.phase === 'break'
  const eyeState = isRecovering
    ? 'recovering'
    : progress < 0.12
      ? 'fresh'
      : progress < 0.68
        ? 'focused'
        : 'strained'
  const eyeOpenness = isRecovering ? 1 : 1 - progress * 0.24
  const strainVisibility = isRecovering ? 0 : Math.max(0, (progress - 0.32) / 0.68)
  const eyeStatus = isRecovering
    ? 'Recovering · let your gaze soften'
    : !timer.isRunning
      ? 'Fresh · ready when you are'
      : progress < 0.08
        ? 'Fresh · focus just started'
        : progress < 0.68
          ? 'Focused · remember to blink'
          : 'Strained · a break is getting close'
  const restSeconds = Math.round(timer.breakDurationMs / 1000)
  const nextBreak = !timer.isRunning
    ? 'After you start'
    : isPaused
      ? 'Waiting for resume'
      : timer.phase === 'break'
        ? 'Right now'
        : new Date((timer.startedAt ?? now) + timer.focusDurationMs).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })

  return (
    <>
      <AnimatePresence>
        {introStage !== 'done' && (
          <motion.button
            type="button"
            className="eye-intro"
            aria-label="Continue to Eye Break"
            autoFocus
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={() => {
              if (introStage === 'visible') setIntroStage('leaving')
            }}
          >
            <span className="intro-orbit intro-orbit-one" aria-hidden="true" />
            <span className="intro-orbit intro-orbit-two" aria-hidden="true" />

            <motion.span
              className="floating-eye-wrap"
              initial={{ opacity: 0, scale: 0.72, y: 26 }}
              animate={
                introStage === 'leaving'
                  ? {
                      opacity: 0.08,
                      scale: 0.2,
                      x: 'calc(-50vw + 50px)',
                      y: 'calc(-50vh + 48px)',
                      rotate: -8,
                    }
                  : { opacity: 1, scale: 1, x: 0, y: [0, -9, 0], rotate: 0 }
              }
              transition={
                introStage === 'leaving'
                  ? { duration: 1.32, ease: [0.22, 1, 0.36, 1] }
                  : {
                      opacity: { duration: 0.35 },
                      scale: { duration: 0.55 },
                      y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                    }
              }
              aria-hidden="true"
            >
              <span className="floating-eye-halo" />
              <span className="floating-eye">
                <span className="floating-eye-glyph">
                  <Eye size={88} strokeWidth={1.6} />
                </span>
              </span>
            </motion.span>

            <motion.span
              className="intro-copy"
              initial={{ opacity: 0 }}
              animate={{ opacity: introStage === 'leaving' ? 0 : 1 }}
              transition={{ duration: 0.32, delay: introStage === 'leaving' ? 0 : 0.32 }}
            >
              <small>A gentler way to focus</small>
              <strong>Give your eyes a moment.</strong>
              <span>Click anywhere to continue</span>
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      <motion.main
        className="app-shell"
        initial={false}
        animate={{
          opacity: introStage === 'done' ? 1 : 0,
          scale: introStage === 'done' ? 1 : 0.988,
        }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={introStage !== 'done'}
      >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise-layer" />

      <motion.header
        className="topbar"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
      >
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><Eye size={21} /></span>
          <div>
            <strong>Eye Break</strong>
            <span>20 · 20 · 20 ritual</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={`auto-mode-toggle ${timer.autoMode ? 'active' : ''}`}
            role="switch"
            aria-checked={timer.autoMode}
            onClick={() => void eyeBreak.setAutoMode(!timer.autoMode).then(setTimer)}
          >
            <Repeat2 size={16} aria-hidden="true" />
            <span>Auto mode</span>
            <i aria-hidden="true"><b /></i>
          </button>

          <div className="topbar-status">
            <span className={`live-dot ${activePhase}`} aria-hidden="true" />
            <span>{timer.isRunning ? (isPaused ? 'Paused' : 'Running in the tray') : 'Ready in the tray'}</span>
            <ShieldCheck size={16} aria-hidden="true" />
          </div>
        </div>
      </motion.header>

      <section className="app-grid">
        <motion.article
          className="glass-card timer-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.04, ease: 'easeOut' }}
        >
          <div className="shine" aria-hidden="true" />
          <div className="card-heading">
            <div>
              <p className="kicker">{phaseCopy[activePhase].eyebrow}</p>
              <h1>{phaseCopy[activePhase].title}</h1>
            </div>
            <span className="cycle-chip">Cycle {timer.completedFocusSessions + 1}</span>
          </div>

          <div
            className="timer-stage"
            role="progressbar"
            aria-label={`${phaseCopy[activePhase].title}: ${formatClock(timer.remainingMs)} remaining`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <svg
              viewBox="0 0 640 320"
              className={`eye-timer-visual ${eyeState}`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="eyeProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a8f5e9" />
                  <stop offset="55%" stopColor="#4fe1ca" />
                  <stop offset="100%" stopColor={eyeState === 'strained' ? '#f0a07f' : '#14a38f'} />
                </linearGradient>
                <radialGradient id="irisGradient" cx="38%" cy="32%" r="68%">
                  <stop offset="0%" stopColor="#d9fff8" />
                  <stop offset="38%" stopColor="#73dcc9" />
                  <stop offset="100%" stopColor="#176f61" />
                </radialGradient>
                <filter id="eyeGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              <g
                className="eye-shape"
                style={{ transform: `scaleY(${eyeOpenness})` }}
              >
                <path
                  className="eye-surface"
                  d="M 82 160 Q 320 32 558 160 Q 320 288 82 160 Z"
                />
                <path
                  className="eye-outline-track"
                  d="M 82 160 Q 320 32 558 160 Q 320 288 82 160 Z"
                />
                <path
                  className="eye-progress-line"
                  pathLength="100"
                  d="M 82 160 Q 320 32 558 160"
                  style={{ strokeDashoffset: eyeProgressOffset }}
                />
                <path
                  className="eye-progress-line"
                  pathLength="100"
                  d="M 82 160 Q 320 288 558 160"
                  style={{ strokeDashoffset: eyeProgressOffset }}
                />

                <g className="eye-veins" style={{ opacity: strainVisibility }}>
                  <path d="M 108 145 Q 165 132 220 153" />
                  <path d="M 113 172 Q 170 187 226 164" />
                  <path d="M 532 144 Q 475 132 420 153" />
                  <path d="M 527 174 Q 470 188 414 164" />
                  <path d="M 171 91 Q 208 118 241 131" />
                  <path d="M 469 91 Q 430 119 399 131" />
                </g>

                <ellipse className="eye-iris-halo" cx="320" cy="160" rx="86" ry="86" />
                <ellipse className="eye-iris" cx="320" cy="160" rx="66" ry="66" />
                <circle className="eye-pupil" cx="320" cy="160" r="31" />
                <circle className="eye-catchlight" cx="302" cy="141" r="9" />
              </g>

              <g className="strain-marks" style={{ opacity: strainVisibility }}>
                <path d="M 194 46 L 176 22" />
                <path d="M 239 32 L 232 8" />
                <path d="M 446 46 L 464 22" />
                <path d="M 401 32 L 408 8" />
              </g>
            </svg>

            <div className="eye-time-marker spent" aria-hidden="true">
              <small>Spent</small>
              <strong>{formatClock(elapsedMs)}</strong>
            </div>
            <div className="eye-time-marker remaining" aria-hidden="true">
              <small>Left</small>
              <strong>{formatClock(timer.remainingMs)}</strong>
            </div>

            <div className="timer-face eye-timer-face" aria-live="polite" aria-atomic="true">
              <span>{timer.phase === 'break' ? 'Break' : isPaused ? 'Paused' : 'Focus'}</span>
              <strong>{formatClock(timer.remainingMs)}</strong>
              <small>{eyeStatus}</small>
            </div>
          </div>

          <p className="timer-description">{phaseCopy[activePhase].description}</p>

          <div className="time-scrubber">
            <div className="scrubber-heading">
              <label htmlFor="time-elapsed">Adjust the countdown</label>
              <span>Drag to choose how much time is left</span>
            </div>
            <input
              id="time-elapsed"
              type="range"
              min={0}
              max={totalMs}
              step={1000}
              value={elapsedMs}
              aria-valuetext={`${formatClock(elapsedMs)} passed, ${formatClock(timer.remainingMs)} left`}
              style={{
                background: `linear-gradient(90deg, #a8f5e9 0%, #4fe1ca ${progressPercent}%, rgba(168, 245, 233, 0.1) ${progressPercent}%, rgba(168, 245, 233, 0.1) 100%)`,
              }}
              onChange={(event) => {
                const chosenElapsedMs = Number(event.currentTarget.value)
                void eyeBreak.setRemaining(totalMs - chosenElapsedMs)
              }}
            />
            <div className="scrubber-values" aria-hidden="true">
              <span><small>Passed</small>{formatClock(elapsedMs)}</span>
              <span><small>Time left</small>{formatClock(timer.remainingMs)}</span>
            </div>
          </div>

          <div className="timer-footer">
            <div className="primary-controls">
              {isPaused ? (
                <button type="button" className="control-button primary" onClick={() => eyeBreak.resume()}>
                  <Play size={19} aria-hidden="true" /> Resume cycle
                </button>
              ) : timer.isRunning ? (
                <button type="button" className="control-button primary" onClick={() => eyeBreak.pause()}>
                  <Pause size={19} aria-hidden="true" /> Pause cycle
                </button>
              ) : (
                <button type="button" className="control-button primary" onClick={() => eyeBreak.start()}>
                  <Play size={19} aria-hidden="true" /> Start focusing
                </button>
              )}

              <button
                type="button"
                className="control-button quiet"
                onClick={() => eyeBreak.stop()}
                disabled={!timer.isRunning && timer.phase === 'idle'}
              >
                <Square size={18} aria-hidden="true" /> Stop
              </button>
            </div>

            <div className="session-stats" aria-label="Cycle settings and progress">
              <div><span>Focus</span><strong>20m</strong></div>
              <div><span>Rest</span><strong>{restSeconds}s</strong></div>
              <div><span>Done</span><strong>{timer.completedFocusSessions}</strong></div>
            </div>
          </div>
        </motion.article>

        <aside className="side-stack">
          <motion.article
            className="glass-card next-card"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          >
            <div className="section-title-row">
              <div>
                <p className="kicker">Today’s rhythm</p>
                <h2>Next break</h2>
              </div>
              <BellRing size={20} aria-hidden="true" />
            </div>
            <strong className="next-time">{nextBreak}</strong>
            <p className="muted-copy">You will get a native notification and a calm screen overlay.</p>

            <div className="ritual-timeline">
              <RitualStep icon={Laptop} title="Focus" meta="20 minutes" state={timer.phase === 'focus' ? 'active' : timer.completedFocusSessions > 0 ? 'done' : 'upcoming'} />
              <RitualStep icon={Eye} title="Look far away" meta={`${restSeconds} seconds`} state={timer.phase === 'break' ? 'active' : 'upcoming'} />
              <RitualStep
                icon={TimerReset}
                title="Begin again"
                meta={timer.autoMode ? 'Automatic' : 'Stops after rest'}
                state="upcoming"
                isLast
              />
            </div>
          </motion.article>

          <motion.article
            className="glass-card distance-card"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: 'easeOut' }}
          >
            <div className="distance-icon" aria-hidden="true">
              <span /><Eye size={32} />
            </div>
            <div>
              <p className="kicker">The reset cue</p>
              <h2>Find something 20 feet away.</h2>
              <p className="muted-copy">Soften your gaze, blink naturally, and let the screen disappear for a moment.</p>
            </div>
            <div className="rest-setting">
              <div className="rest-setting-heading">
                <div>
                  <label htmlFor="rest-duration">Rest time</label>
                  <span>Choose between 5 and 120 seconds</span>
                </div>
                <output htmlFor="rest-duration">{restSeconds}s</output>
              </div>
              <input
                id="rest-duration"
                type="range"
                min={5}
                max={120}
                step={5}
                value={restSeconds}
                aria-valuetext={`${restSeconds} seconds of rest`}
                style={{
                  background: `linear-gradient(90deg, #a8f5e9 0%, #4fe1ca ${((restSeconds - 5) / 115) * 100}%, rgba(168, 245, 233, 0.1) ${((restSeconds - 5) / 115) * 100}%, rgba(168, 245, 233, 0.1) 100%)`,
                }}
                onChange={(event) => {
                  const seconds = Number(event.currentTarget.value)
                  window.localStorage.setItem('eye-break-rest-seconds', String(seconds))
                  void eyeBreak.setBreakDuration(seconds * 1000).then(setTimer)
                }}
              />
              <div className="rest-range-values" aria-hidden="true">
                <span>5s</span>
                <span>120s</span>
              </div>
            </div>
          </motion.article>
        </aside>
      </section>
      </motion.main>
    </>
  )
}

function RitualStep({
  icon: Icon,
  title,
  meta,
  state,
  isLast = false,
}: {
  icon: typeof Eye
  title: string
  meta: string
  state: 'active' | 'done' | 'upcoming'
  isLast?: boolean
}) {
  return (
    <div className={`ritual-step ${state}`}>
      <div className="step-rail">
        <span className="step-icon">{state === 'done' ? <Check size={16} /> : <Icon size={17} />}</span>
        {!isLast && <span className="rail-line" />}
      </div>
      <div><strong>{title}</strong><span>{meta}</span></div>
      {state === 'active' && <span className="active-label">Now</span>}
    </div>
  )
}

function BreakOverlay({
  now,
  onPause,
  onResume,
  onStop,
  timer,
}: {
  now: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
  timer: TimerState
}) {
  const elapsedBreak = timer.breakStartedAt ? now - timer.breakStartedAt : 0
  const fill = Math.min(elapsedBreak / timer.breakDurationMs, 1)

  return (
    <main className="break-shell">
      <div className="break-aurora" aria-hidden="true" />
      <motion.div
        className="break-card"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="gaze-mark" aria-hidden="true"><span /><Eye size={42} /></div>
        <AnimatePresence mode="wait">
          <motion.div
            key={timer.isPaused ? 'paused' : 'active'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24 }}
          >
            <p className="overlay-kicker">{timer.isPaused ? 'Break paused' : '20 minutes completed'}</p>
            <h1>{timer.isPaused ? 'Resume when you are ready.' : 'Let your eyes rest somewhere far away.'}</h1>
            <p className="overlay-copy">Look at something about 20 feet away. Relax your focus and blink naturally.</p>
          </motion.div>
        </AnimatePresence>

        <div className="break-clock" role="timer" aria-live="polite">{formatClock(timer.remainingMs)}</div>
        <div className="break-progress" aria-hidden="true">
          <div className="break-progress-fill" style={{ transform: `scaleX(${fill})` }} />
        </div>

        <div className="break-controls">
          {timer.isPaused ? (
            <button type="button" className="control-button primary" onClick={onResume}><Play size={18} /> Resume break</button>
          ) : (
            <button type="button" className="control-button light" onClick={onPause}><Pause size={18} /> Pause break</button>
          )}
          <button type="button" className="control-button ghost" onClick={onStop}><Square size={18} /> Stop cycle</button>
        </div>
      </motion.div>
    </main>
  )
}

export default App
