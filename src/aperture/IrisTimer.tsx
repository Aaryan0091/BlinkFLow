import { motion } from 'motion/react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

const SIZE = 400
const CENTER = SIZE / 2
const TRACK_RADIUS = 186
const CIRCUMFERENCE = 2 * Math.PI * TRACK_RADIUS
const TICK_COUNT = 72

type VisualPhase = 'idle' | 'focus' | 'rest'

const ACTIVE_PALETTE = {
  core: '#6d5cf6',
  glow: '#4a37c9',
  bright: '#a8f5e9',
  halo: 'rgba(109,92,246,0.34)',
}

const PALETTES = {
  idle: ACTIVE_PALETTE,
  focus: ACTIVE_PALETTE,
  rest: {
    core: '#14b892',
    glow: '#0c7f66',
    bright: '#b6f5e2',
    halo: 'rgba(52,217,176,0.36)',
  },
} satisfies Record<
  VisualPhase,
  { core: string; glow: string; bright: string; halo: string }
>

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function clock(totalMs: number) {
  const seconds = Math.ceil(Math.max(0, totalMs) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`
}

export function IrisTimer({
  phase,
  running,
  remaining,
  progress,
  total,
  label,
  sublabel,
  onProgressChange,
}: {
  phase: VisualPhase
  running: boolean
  remaining: number
  progress: number
  total: number
  label: string
  sublabel: string
  onProgressChange: (progress: number) => Promise<void> | void
}) {
  const palette = PALETTES[phase]
  const svgRef = useRef<SVGSVGElement>(null)
  const dragFrameRef = useRef<number | null>(null)
  const pendingDragProgressRef = useRef<number | null>(null)
  const [dragProgress, setDragProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const displayedProgress = dragProgress ?? progress
  const displayedRemaining =
    dragProgress === null ? remaining : total * (1 - displayedProgress)

  const fibers = useMemo(
    () =>
      Array.from({ length: 128 }, (_, index) => {
        const angle = (index / 128) * Math.PI * 2
        const innerRadius = 44 + seeded(index) * 8
        const outerRadius = 96 + seeded(index + 99) * 22
        return {
          x1: CENTER + Math.cos(angle) * innerRadius,
          y1: CENTER + Math.sin(angle) * innerRadius,
          x2: CENTER + Math.cos(angle) * outerRadius,
          y2: CENTER + Math.sin(angle) * outerRadius,
          width: 0.6 + seeded(index + 7) * 1.7,
          opacity: 0.12 + seeded(index + 21) * 0.5,
        }
      }),
    [],
  )

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const angle = (index / TICK_COUNT) * Math.PI * 2 - Math.PI / 2
        const major = index % 6 === 0
        const inner = major ? 162 : 167
        return {
          x1: CENTER + Math.cos(angle) * inner,
          y1: CENTER + Math.sin(angle) * inner,
          x2: CENTER + Math.cos(angle) * 174,
          y2: CENTER + Math.sin(angle) * 174,
          major,
          position: index / TICK_COUNT,
        }
      }),
    [],
  )

  const headAngle = displayedProgress * Math.PI * 2 - Math.PI / 2
  const headX = CENTER + Math.cos(headAngle) * TRACK_RADIUS
  const headY = CENTER + Math.sin(headAngle) * TRACK_RADIUS
  const resting = phase === 'rest'
  const pupilRadius = resting ? 50 : 34

  const progressFromPointer = (event: PointerEvent<SVGCircleElement>) => {
    const svg = svgRef.current
    if (!svg) return displayedProgress

    const bounds = svg.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * SIZE - CENTER
    const y = ((event.clientY - bounds.top) / bounds.height) * SIZE - CENTER
    const angle = Math.atan2(y, x) + Math.PI / 2
    return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2)
  }

  const flushPendingDrag = () => {
    if (pendingDragProgressRef.current !== null) {
      setDragProgress(pendingDragProgressRef.current)
    }
    pendingDragProgressRef.current = null
    dragFrameRef.current = null
  }

  const queueDragProgress = (nextProgress: number) => {
    pendingDragProgressRef.current = nextProgress
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(flushPendingDrag)
    }
  }

  const clearPendingDrag = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current)
    }
    dragFrameRef.current = null
    pendingDragProgressRef.current = null
  }

  useEffect(() => clearPendingDrag, [])

  const beginDrag = (event: PointerEvent<SVGCircleElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    clearPendingDrag()
    setDragging(true)
    setDragProgress(progressFromPointer(event))
  }

  const moveDrag = (event: PointerEvent<SVGCircleElement>) => {
    if (!dragging) return
    queueDragProgress(progressFromPointer(event))
  }

  const commitProgress = (nextProgress: number) => {
    const boundedProgress = Math.min(1, Math.max(0, nextProgress))
    setDragProgress(boundedProgress)
    setDragging(false)
    void Promise.resolve(onProgressChange(boundedProgress)).finally(() => {
      setDragProgress(null)
    })
  }

  const endDrag = (event: PointerEvent<SVGCircleElement>) => {
    if (!dragging) return
    const nextProgress = progressFromPointer(event)
    clearPendingDrag()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    commitProgress(nextProgress)
  }

  const cancelDrag = () => {
    clearPendingDrag()
    setDragging(false)
    setDragProgress(null)
  }

  const adjustWithKeyboard = (event: KeyboardEvent<SVGCircleElement>) => {
    let nextProgress: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextProgress = displayedProgress + 0.01
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextProgress = displayedProgress - 0.01
    } else if (event.key === 'Home') {
      nextProgress = 0
    } else if (event.key === 'End') {
      nextProgress = 1
    }

    if (nextProgress === null) return
    event.preventDefault()
    commitProgress(nextProgress)
  }

  return (
    <div className="aperture-iris">
      <motion.div
        className="aperture-iris-bloom"
        aria-hidden="true"
        animate={{
          background: `radial-gradient(circle at 50% 50%, ${palette.halo} 0%, transparent 62%)`,
          scale: resting ? 1.06 : 1,
        }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <radialGradient id="apertureIrisFill" cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.05" />
            <stop offset="55%" stopColor={palette.core} stopOpacity="0.34" />
            <stop offset="88%" stopColor={palette.core} stopOpacity="0.6" />
            <stop offset="100%" stopColor="#04060b" stopOpacity="0.9" />
          </radialGradient>
          <radialGradient id="apertureScleraFill" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#0b1019" stopOpacity="0" />
            <stop offset="100%" stopColor={palette.core} stopOpacity="0.07" />
          </radialGradient>
          <radialGradient id="aperturePupilFill" cx="42%" cy="36%" r="72%">
            <stop offset="0%" stopColor="#1b2333" />
            <stop offset="70%" stopColor="#04060b" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <linearGradient id="apertureArcStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.core} />
            <stop offset="100%" stopColor={palette.bright} />
          </linearGradient>
          <filter id="apertureSoftGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="apertureLidClip">
            <circle cx={CENTER} cy={CENTER} r="124" />
          </clipPath>
        </defs>

        {ticks.map((tick, index) => {
          const lit = tick.position <= displayedProgress + 0.0001
          return (
            <line
              key={index}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={lit ? palette.bright : '#fff'}
              strokeWidth={tick.major ? 1.6 : 1}
              strokeLinecap="round"
              opacity={lit ? (tick.major ? 0.85 : 0.5) : tick.major ? 0.16 : 0.07}
            />
          )
        })}

        <circle
          cx={CENTER}
          cy={CENTER}
          r={TRACK_RADIUS}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.06"
          strokeWidth="1.5"
        />
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={TRACK_RADIUS}
            fill="none"
            stroke="url(#apertureArcStroke)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - displayedProgress)}
            filter="url(#apertureSoftGlow)"
            className={`aperture-progress-arc ${dragging ? 'dragging' : ''}`}
          />
        </g>
        <circle
          cx={CENTER}
          cy={CENTER}
          r="150"
          fill="url(#apertureScleraFill)"
        />
        <g clipPath="url(#apertureLidClip)">
          <circle
            cx={CENTER}
            cy={CENTER}
            r="120"
            fill="url(#apertureIrisFill)"
          />
          <motion.g
            animate={{ rotate: 360 }}
            transition={{
              duration: resting ? 260 : 150,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ transformOrigin: '200px 200px', transformBox: 'view-box' }}
          >
            {fibers.map((fiber, index) => (
              <line
                key={index}
                x1={fiber.x1}
                y1={fiber.y1}
                x2={fiber.x2}
                y2={fiber.y2}
                stroke={palette.bright}
                strokeWidth={fiber.width}
                strokeLinecap="round"
                opacity={fiber.opacity}
              />
            ))}
          </motion.g>
          <circle
            cx={CENTER}
            cy={CENTER}
            r="119"
            fill="none"
            stroke="#04060b"
            strokeOpacity="0.55"
            strokeWidth="7"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r="116"
            fill="none"
            stroke={palette.core}
            strokeOpacity="0.5"
            strokeWidth="1.2"
          />
          <motion.circle
            cx={CENTER}
            cy={CENTER}
            fill="url(#aperturePupilFill)"
            animate={{
              r: resting
                ? [pupilRadius, pupilRadius + 12, pupilRadius]
                : running
                  ? [pupilRadius, pupilRadius + 2.5, pupilRadius]
                  : pupilRadius,
            }}
            transition={{
              duration: resting ? 8 : 5.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <ellipse
            cx={CENTER - 34}
            cy={CENTER - 40}
            rx="16"
            ry="11"
            fill="#fff"
            opacity="0.1"
            transform={`rotate(-24 ${CENTER - 34} ${CENTER - 40})`}
          />
          {!resting && (
            <>
              <motion.rect
                x="60"
                y="70"
                width="280"
                height="132"
                fill="#04060b"
                animate={{ scaleY: [0, 0, 1, 0] }}
                transition={{
                  duration: 0.42,
                  times: [0, 0.1, 0.5, 1],
                  repeat: Infinity,
                  repeatDelay: 7.5,
                }}
                style={{ transformOrigin: 'center top', transformBox: 'fill-box' }}
              />
              <motion.rect
                x="60"
                y="198"
                width="280"
                height="132"
                fill="#04060b"
                animate={{ scaleY: [0, 0, 1, 0] }}
                transition={{
                  duration: 0.42,
                  times: [0, 0.1, 0.5, 1],
                  repeat: Infinity,
                  repeatDelay: 7.5,
                }}
                style={{ transformOrigin: 'center bottom', transformBox: 'fill-box' }}
              />
            </>
          )}
        </g>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={TRACK_RADIUS}
          fill="none"
          stroke="transparent"
          strokeWidth="26"
          className={`aperture-scrubber-hit ${dragging ? 'dragging' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label="Adjust elapsed time"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayedProgress * 100)}
          aria-valuetext={`${clock(total * displayedProgress)} passed, ${clock(displayedRemaining)} left`}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onKeyDown={adjustWithKeyboard}
        />
        <circle
          cx={headX}
          cy={headY}
          r={dragging ? 14 : 11}
          fill={palette.bright}
          opacity={dragging ? 0.16 : 0.1}
          className="aperture-scrubber-halo"
          pointerEvents="none"
        />
        <circle
          cx={headX}
          cy={headY}
          r={dragging ? 6.5 : 5}
          fill={palette.bright}
          filter="url(#apertureSoftGlow)"
          className="aperture-scrubber-handle"
          pointerEvents="none"
        />
      </svg>

      <div className="aperture-iris-readout">
        <motion.span key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {label}
        </motion.span>
        <strong>
          {phase === 'rest'
            ? Math.ceil(displayedRemaining / 1000)
            : clock(displayedRemaining)}
        </strong>
        <motion.p key={sublabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {sublabel}
        </motion.p>
      </div>
    </div>
  )
}
