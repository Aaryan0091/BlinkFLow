import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  BellRing,
  Check,
  Eye,
  Laptop,
  Pause,
  Play,
  Power,
  Repeat2,
  ShieldCheck,
  Square,
  TimerReset,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type {
  LaunchAtLoginState,
  TimerPhase,
  TimerState,
} from '../shared/timer-contract'
import { browserFallback, DEFAULT_TIMER_STATE } from './browser-fallback'
import { BreakOverlay } from './BreakOverlay'
import {
  loadRestVolumePreference,
  playRestCue,
  saveRestVolumePreference,
  unlockRestAudio,
} from './rest-audio'
import { getRestOverlayViewState } from './rest-overlay-state'
import './App.css'

const phaseCopy: Record<TimerPhase, { eyebrow: string; title: string; description: string }> = {
  idle: {
    eyebrow: 'Standing by',
    title: 'Protect the next twenty.',
    description: 'Start when your screen session begins. The rest of the ritual stays out of your way.',
  },
  focus: {
    eyebrow: 'Focus window',
    title: 'Time until release.',
    description: 'Keep your attention where it belongs. Eye Break is running quietly in the tray.',
  },
  break: {
    eyebrow: 'Distance reset',
    title: 'Look beyond the screen.',
    description: 'Let your gaze settle on something far away until the reset is complete.',
  },
  paused: {
    eyebrow: 'Timer held',
    title: 'Your place is saved.',
    description: 'Resume when you return. No focus time is consumed while the timer is paused.',
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
  const [timer, setTimer] = useState<TimerState>(DEFAULT_TIMER_STATE)
  const [hasInitialTimerState, setHasInitialTimerState] = useState(false)
  const [launchAtLogin, setLaunchAtLogin] = useState<LaunchAtLoginState>({
    supported: false,
    enabled: false,
    status: 'available-after-install',
  })
  const [isUpdatingLaunchAtLogin, setIsUpdatingLaunchAtLogin] = useState(false)
  const [launchAtLoginError, setLaunchAtLoginError] = useState('')
  const [restVolume, setRestVolume] = useState(loadRestVolumePreference)
  const [now, setNow] = useState(Date.now())
  const wasInBreak = useRef(false)
  const prefersReducedMotion = useReducedMotion()
  const [introStage, setIntroStage] = useState<'visible' | 'leaving' | 'done'>(
    isBreakWindow ? 'done' : 'visible',
  )

  useEffect(() => {
    let isCurrentSubscription = true
    setHasInitialTimerState(false)

    const applyTimerState = (state: TimerState) => {
      if (!isCurrentSubscription) return
      setTimer(state)
      setNow(Date.now())
      setHasInitialTimerState(true)
    }

    const unsubscribePromise = eyeBreak.onStateChange(applyTimerState)
    void eyeBreak.getState().then(applyTimerState).catch(() => undefined)

    return () => {
      isCurrentSubscription = false
      void unsubscribePromise
        .then((unsubscribe) => unsubscribe())
        .catch(() => undefined)
    }
  }, [eyeBreak])

  useEffect(() => {
    if (isBreakWindow) return

    void eyeBreak
      .getLaunchAtLogin()
      .then(setLaunchAtLogin)
      .catch(() => {
        setLaunchAtLoginError('Startup preference is unavailable right now.')
      })
  }, [eyeBreak, isBreakWindow])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const restOverlayState = getRestOverlayViewState(
    timer,
    hasInitialTimerState,
    now,
  )

  useEffect(() => {
    if (isBreakWindow) return

    const isInBreak =
      timer.phase === 'break' ||
      (timer.phase === 'paused' && timer.breakStartedAt !== null)

    if (!wasInBreak.current && isInBreak) {
      playRestCue('rest')
    } else if (wasInBreak.current && !isInBreak) {
      playRestCue('back')
    }

    wasInBreak.current = isInBreak
  }, [isBreakWindow, timer.breakStartedAt, timer.phase])

  useEffect(() => {
    if (isBreakWindow) return

    const savedRestSeconds = Number(window.localStorage.getItem('eye-break-rest-seconds'))
    if (Number.isFinite(savedRestSeconds) && savedRestSeconds >= 5 && savedRestSeconds <= 120) {
      void eyeBreak.setBreakDuration(savedRestSeconds * 1000).then(setTimer)
    }
  }, [eyeBreak, isBreakWindow])

  useEffect(() => {
    if (introStage !== 'leaving') return

    const revealTimer = window.setTimeout(
      () => setIntroStage('done'),
      prefersReducedMotion ? 80 : 1400,
    )
    return () => window.clearTimeout(revealTimer)
  }, [introStage, prefersReducedMotion])

  if (isBreakWindow) {
    if (!restOverlayState) return null

    return (
      <BreakOverlay
        appearance={restOverlayState.appearance}
        remainingMs={restOverlayState.remainingMs}
        totalMs={restOverlayState.totalMs}
        cycle={restOverlayState.cycle}
        paused={restOverlayState.paused}
        onExtend={() =>
          void eyeBreak
            .setBreakDuration(
              Math.min(restOverlayState.totalMs + 20_000, 120_000),
            )
            .then(setTimer)
        }
        onSkip={() => void eyeBreak.endBreak().then(setTimer)}
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
  const launchAtLoginDescription = launchAtLoginError
    ? launchAtLoginError
    : launchAtLogin.status === 'requires-approval'
      ? 'Needs approval in System Settings'
      : launchAtLogin.status === 'available-after-install'
        ? 'Available in the installed desktop app'
        : launchAtLogin.status === 'unsupported'
          ? 'Not supported on this operating system'
          : launchAtLogin.enabled
            ? 'Eye Break starts when you sign in'
            : 'Keep Eye Break ready from startup'
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
            <span>Ocular reset protocol</span>
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
            <span className="cycle-chip">
              <small>Cycle</small>
              {String(timer.completedFocusSessions + 1).padStart(2, '0')}
            </span>
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
              viewBox="0 0 720 340"
              className={`eye-timer-visual ${eyeState}`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="eyeProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a8f5e9" />
                  <stop offset="62%" stopColor="#55d8c1" />
                  <stop offset="100%" stopColor={eyeState === 'strained' ? '#e79076' : '#1b9a84'} />
                </linearGradient>
                <linearGradient id="scleraGradient" x1="15%" y1="8%" x2="82%" y2="88%">
                  <stop offset="0%" stopColor="#effffb" stopOpacity="0.17" />
                  <stop offset="52%" stopColor="#b8ddd5" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#6faaa0" stopOpacity="0.06" />
                </linearGradient>
                <radialGradient id="irisGradient" cx="40%" cy="34%" r="64%">
                  <stop offset="0%" stopColor="#e5fff9" />
                  <stop offset="28%" stopColor="#9be9da" />
                  <stop offset="61%" stopColor="#379f8d" />
                  <stop offset="100%" stopColor="#0c4c41" />
                </radialGradient>
                <radialGradient id="pupilGradient" cx="42%" cy="38%" r="64%">
                  <stop offset="0%" stopColor="#123e35" />
                  <stop offset="100%" stopColor="#03110e" />
                </radialGradient>
                <filter id="eyeGlow" x="-30%" y="-50%" width="160%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="irisDepth" x="-45%" y="-45%" width="190%" height="190%">
                  <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#001b16" floodOpacity="0.55" />
                </filter>
                <clipPath id="eyeClip">
                  <path d="M 64 170 C 176 24 544 24 656 170 C 544 316 176 316 64 170 Z" />
                </clipPath>
              </defs>

              <g
                className="eye-shape"
                style={{ transform: `scaleY(${eyeOpenness})` }}
              >
                <path
                  className="eye-shadow"
                  d="M 64 170 C 176 24 544 24 656 170 C 544 316 176 316 64 170 Z"
                />
                <path
                  className="eye-surface"
                  d="M 64 170 C 176 24 544 24 656 170 C 544 316 176 316 64 170 Z"
                />
                <g clipPath="url(#eyeClip)">
                  <path
                    className="eye-surface-wash"
                    d="M 52 170 C 180 34 540 34 668 170 C 540 306 180 306 52 170 Z"
                  />
                  <path className="eye-upper-plane" d="M 55 168 C 185 43 535 43 665 168 C 532 105 188 105 55 168 Z" />
                  <path className="eye-lower-plane" d="M 55 172 C 185 297 535 297 665 172 C 528 229 192 229 55 172 Z" />

                  <g className="eye-veins" style={{ opacity: strainVisibility }}>
                    <path d="M 70 165 C 132 142 174 151 226 166" />
                    <path d="M 82 194 C 145 214 183 192 234 177" />
                    <path d="M 650 163 C 590 143 546 151 494 166" />
                    <path d="M 638 195 C 578 214 535 191 486 177" />
                    <path d="M 139 100 C 192 126 219 143 254 154" />
                    <path d="M 581 100 C 528 126 499 143 466 154" />
                    <path d="M 153 239 C 198 215 224 198 259 186" />
                    <path d="M 567 239 C 522 215 495 198 461 186" />
                  </g>
                </g>
                <path
                  className="eye-outline-track"
                  d="M 64 170 C 176 24 544 24 656 170 C 544 316 176 316 64 170 Z"
                />
                <path
                  className="eye-progress-line"
                  pathLength="100"
                  d="M 64 170 C 176 24 544 24 656 170"
                  style={{ strokeDashoffset: eyeProgressOffset }}
                />
                <path
                  className="eye-progress-line"
                  pathLength="100"
                  d="M 64 170 C 176 316 544 316 656 170"
                  style={{ strokeDashoffset: eyeProgressOffset }}
                />
                <path className="eyelid-detail upper" d="M 95 138 C 218 16 502 16 625 138" />
                <path className="eyelid-detail lower" d="M 101 205 C 224 309 496 309 619 205" />

                <g className="iris-assembly" filter="url(#irisDepth)">
                  <circle className="eye-iris-halo" cx="360" cy="170" r="98" />
                  <circle className="eye-iris" cx="360" cy="170" r="78" />
                  <g className="eye-iris-rays">
                    <path d="M 403 170 L 428 170" />
                    <path d="M 398 192 L 420 204" />
                    <path d="M 382 208 L 395 231" />
                    <path d="M 360 213 L 360 239" />
                    <path d="M 338 208 L 325 231" />
                    <path d="M 322 192 L 300 204" />
                    <path d="M 317 170 L 292 170" />
                    <path d="M 322 148 L 300 136" />
                    <path d="M 338 132 L 325 109" />
                    <path d="M 360 127 L 360 101" />
                    <path d="M 382 132 L 395 109" />
                    <path d="M 398 148 L 420 136" />
                  </g>
                  <circle className="eye-iris-ring" cx="360" cy="170" r="42" />
                  <circle className="eye-pupil" cx="360" cy="170" r="35" />
                  <ellipse className="eye-catchlight primary" cx="338" cy="145" rx="10" ry="13" />
                  <circle className="eye-catchlight secondary" cx="379" cy="188" r="4" />
                  <path className="eye-reflection" d="M 323 203 C 344 217 377 219 399 200" />
                </g>
              </g>

            </svg>

            <div className="eye-time-marker spent" aria-hidden="true">
              <small>Elapsed</small>
              <strong>{formatClock(elapsedMs)}</strong>
            </div>
            <div className="eye-time-marker remaining" aria-hidden="true">
              <small>Remaining</small>
              <strong>{formatClock(timer.remainingMs)}</strong>
            </div>

            <div className="timer-face eye-timer-face" aria-live="polite" aria-atomic="true">
              {(timer.phase === 'break' || isPaused) && (
                <span>{timer.phase === 'break' ? 'Break' : 'Paused'}</span>
              )}
              <strong>{formatClock(timer.remainingMs)}</strong>
            </div>
          </div>

          <div className="timer-description">
            <span className={`eye-condition ${eyeState}`}>
              <i aria-hidden="true" />
              {eyeStatus}
            </span>
            <p>{phaseCopy[activePhase].description}</p>
          </div>

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
                <button type="button" className="control-button primary" onClick={() => {
                  unlockRestAudio()
                  void eyeBreak.resume()
                }}>
                  <Play size={19} aria-hidden="true" /> Resume cycle
                </button>
              ) : timer.isRunning ? (
                <button type="button" className="control-button primary" onClick={() => eyeBreak.pause()}>
                  <Pause size={19} aria-hidden="true" /> Pause cycle
                </button>
              ) : (
                <button type="button" className="control-button primary" onClick={() => {
                  unlockRestAudio()
                  void eyeBreak.start()
                }}>
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
                <p className="kicker">Current protocol</p>
                <h2>Next break</h2>
              </div>
              <BellRing size={20} aria-hidden="true" />
            </div>
            <strong className="next-time">{nextBreak}</strong>
            <p className="muted-copy">
              A local chime and full-screen reset will meet you wherever you
              are working.
            </p>

            <div className="ritual-timeline">
              <RitualStep
                icon={Laptop}
                title="Focus"
                meta="20 minutes"
                state={
                  timer.phase === 'focus'
                    ? 'active'
                    : timer.completedFocusSessions > 0
                      ? 'done'
                      : 'upcoming'
                }
              />
              <RitualStep
                icon={Eye}
                title="Look far away"
                meta={`${restSeconds} seconds`}
                state={timer.phase === 'break' ? 'active' : 'upcoming'}
              />
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
              <p className="kicker">The distance cue</p>
              <h2>Find a point beyond the room.</h2>
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
            <div className="rest-setting volume-setting">
              <div className="rest-setting-heading">
                <div>
                  <label htmlFor="rest-volume">
                    {restVolume === 0 ? (
                      <VolumeX size={14} aria-hidden="true" />
                    ) : (
                      <Volume2 size={14} aria-hidden="true" />
                    )}
                    Rest sounds
                  </label>
                  <span>Eye Break’s own chimes only</span>
                </div>
                <output htmlFor="rest-volume">
                  {restVolume === 0 ? 'Muted' : `${restVolume}%`}
                </output>
              </div>
              <input
                id="rest-volume"
                type="range"
                min={0}
                max={100}
                step={5}
                value={restVolume}
                aria-valuetext={
                  restVolume === 0 ? 'Muted' : `${restVolume} percent`
                }
                style={{
                  background: `linear-gradient(90deg, #a8f5e9 0%, #4fe1ca ${restVolume}%, rgba(168, 245, 233, 0.1) ${restVolume}%, rgba(168, 245, 233, 0.1) 100%)`,
                }}
                onChange={(event) =>
                  setRestVolume(
                    saveRestVolumePreference(Number(event.currentTarget.value)),
                  )
                }
              />
              <div className="rest-range-values" aria-hidden="true">
                <span>Mute</span>
                <span>100%</span>
              </div>
            </div>
            <div className="startup-setting">
              <div className="startup-setting-copy">
                <span className="startup-setting-icon" aria-hidden="true">
                  <Power size={16} />
                </span>
                <div>
                  <strong>Launch at login</strong>
                  <span
                    id="launch-at-login-description"
                    className={launchAtLoginError ? 'setting-error' : ''}
                    aria-live="polite"
                  >
                    {launchAtLoginDescription}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`setting-switch ${launchAtLogin.enabled ? 'active' : ''}`}
                role="switch"
                aria-checked={launchAtLogin.enabled}
                aria-describedby="launch-at-login-description"
                aria-label="Launch Eye Break when I sign in"
                aria-busy={isUpdatingLaunchAtLogin}
                disabled={!launchAtLogin.supported || isUpdatingLaunchAtLogin}
                onClick={() => {
                  setIsUpdatingLaunchAtLogin(true)
                  setLaunchAtLoginError('')
                  void eyeBreak
                    .setLaunchAtLogin(!launchAtLogin.enabled)
                    .then(setLaunchAtLogin)
                    .catch(() => {
                      setLaunchAtLoginError(
                        'Could not update the startup preference.',
                      )
                    })
                    .finally(() => setIsUpdatingLaunchAtLogin(false))
                }}
              >
                <span aria-hidden="true" />
              </button>
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

export default App
