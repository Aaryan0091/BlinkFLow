import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Plus } from 'lucide-react'
import { useMemo } from 'react'

const RING_RADIUS = 148
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const REST_CUES = [
  'Find something at least 20 feet — about 6 metres — away.',
  'Let your shoulders drop. Unclench your jaw.',
  'Soften the gaze. Nothing to focus on, nothing to read.',
  'Blink slowly. Let your eyes re-wet themselves.',
]

type BreakOverlayProps = {
  remainingMs: number
  totalMs: number
  cycle: number
  paused: boolean
  onExtend: () => void
  onSkip: () => void
}

export function BreakOverlay({
  remainingMs,
  totalMs,
  cycle,
  paused,
  onExtend,
  onSkip,
}: BreakOverlayProps) {
  const prefersReducedMotion = useReducedMotion()
  const seconds = Math.ceil(Math.max(remainingMs, 0) / 1000)
  const progress =
    totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 0
  const cueIndex = Math.min(
    REST_CUES.length - 1,
    Math.floor((progress * REST_CUES.length) % REST_CUES.length),
  )

  const rippleIndices = useMemo(() => [0, 1, 2], [])

  return (
    <main
      className="rest-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Eye rest in progress"
    >
      <motion.div
        className="rest-overlay-field"
        aria-hidden="true"
        initial={
          prefersReducedMotion
            ? { opacity: 1 }
            : { scale: 1.18, opacity: 0 }
        }
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className="rest-overlay-corner-glow" aria-hidden="true" />

      {!prefersReducedMotion &&
        rippleIndices.map((index) => (
          <motion.div
            key={index}
            className="rest-overlay-ripple"
            aria-hidden="true"
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: [0.55, 2.6], opacity: [0, 0.5, 0] }}
            transition={{
              duration: 9,
              delay: index * 3,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        ))}

      <div className="rest-overlay-content">
        <motion.div
          className="rest-overlay-kicker"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span aria-hidden="true" />
          Rest {Math.max(1, cycle)} · 20·20·20
        </motion.div>

        <motion.h1
          initial={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, y: 18, filter: 'blur(8px)' }
          }
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {paused ? 'Your eye rest is paused' : 'Look away from the screen'}
        </motion.h1>

        <motion.div
          className="rest-overlay-countdown"
          initial={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, scale: 0.92 }
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {!prefersReducedMotion && (
            <motion.div
              className="rest-overlay-bloom"
              aria-hidden="true"
              animate={{ scale: [1, 1.07, 1], opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <svg
            viewBox="0 0 320 320"
            className="rest-overlay-ring"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="restArc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#14b892" />
                <stop offset="100%" stopColor="#b6f5e2" />
              </linearGradient>
            </defs>
            <circle
              cx="160"
              cy="160"
              r={RING_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.07"
              strokeWidth="2"
            />
            <circle
              cx="160"
              cy="160"
              r={RING_RADIUS}
              fill="none"
              stroke="url(#restArc)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * progress}
              className="rest-overlay-progress"
            />
          </svg>
          <div className="rest-overlay-time">
            <strong aria-live="polite" aria-atomic="true">
              {seconds}
            </strong>
            <span>seconds</span>
          </div>
        </motion.div>

        <div className="rest-overlay-guidance">
          <AnimatePresence mode="wait">
            <motion.p
              key={cueIndex}
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 8, filter: 'blur(4px)' }
              }
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.5 }}
            >
              {REST_CUES[cueIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <BlinkGuide reducedMotion={Boolean(prefersReducedMotion)} />

        <div className="rest-overlay-controls">
          <button
            type="button"
            className="rest-overlay-extend"
            onClick={onExtend}
            disabled={totalMs >= 120_000}
          >
            <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
            20 seconds
          </button>
          <button
            type="button"
            className="rest-overlay-skip"
            onClick={onSkip}
          >
            Skip rest
          </button>
        </div>
      </div>
    </main>
  )
}

function BlinkGuide({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="rest-blink-guide"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.8 }}
    >
      <svg viewBox="0 0 32 20" aria-hidden="true">
        <path
          d="M1.5 10C1.5 10 7 3 16 3s14.5 7 14.5 7-5.5 7-14.5 7S1.5 10 1.5 10Z"
          fill="none"
          stroke="#b6f5e2"
          strokeOpacity="0.8"
          strokeWidth="1.4"
        />
        <circle cx="16" cy="10" r="3.6" fill="#34d9b0" />
        {!reducedMotion && (
          <motion.rect
            x="0"
            y="0"
            width="32"
            height="20"
            fill="#04060b"
            animate={{ scaleY: [0, 0, 1, 0] }}
            transition={{
              duration: 0.6,
              times: [0, 0.55, 0.78, 1],
              repeat: Infinity,
              repeatDelay: 3.4,
            }}
            style={{ transformOrigin: 'center top', transformBox: 'fill-box' }}
          />
        )}
      </svg>
      <motion.span
        animate={reducedMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        Blink slowly
      </motion.span>
    </motion.div>
  )
}
