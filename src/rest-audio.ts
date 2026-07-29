/**
 * A dependency-free Web Audio voice for calm timer signals.
 * Bell-like partials with a long decay stay audible without feeling abrupt.
 */

type AudioContextConstructor = typeof AudioContext

export const DEFAULT_REST_VOLUME = 60
export const REST_VOLUME_STORAGE_KEY = 'eye-break-rest-volume'

let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null
let restVolume = DEFAULT_REST_VOLUME / 100

export function normalizeRestVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_REST_VOLUME
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function setRestVolume(value: number) {
  const normalized = normalizeRestVolume(value)
  restVolume = normalized / 100

  if (audioContext && masterGain) {
    masterGain.gain.cancelScheduledValues(audioContext.currentTime)
    masterGain.gain.setTargetAtTime(
      restVolume,
      audioContext.currentTime,
      0.015,
    )
  }

  return normalized
}

export function loadRestVolumePreference() {
  if (typeof window === 'undefined') return DEFAULT_REST_VOLUME

  try {
    return setRestVolume(
      Number(window.localStorage.getItem(REST_VOLUME_STORAGE_KEY) ?? DEFAULT_REST_VOLUME),
    )
  } catch {
    return setRestVolume(DEFAULT_REST_VOLUME)
  }
}

export function saveRestVolumePreference(value: number) {
  const normalized = setRestVolume(value)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(REST_VOLUME_STORAGE_KEY, String(normalized))
    } catch {
      // Audio still updates when storage is unavailable.
    }
  }

  return normalized
}

function ensureAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContextClass: AudioContextConstructor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext

  if (!AudioContextClass) return null

  if (!audioContext) {
    audioContext = new AudioContextClass()
    masterGain = audioContext.createGain()
    masterGain.gain.value = restVolume
    masterGain.connect(audioContext.destination)
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }

  return audioContext
}

export function unlockRestAudio() {
  const context = ensureAudioContext()
  if (context?.state === 'suspended') {
    void context.resume()
  }
}

function partial(
  context: AudioContext,
  frequency: number,
  at: number,
  duration: number,
  peak: number,
  type: OscillatorType = 'sine',
) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()

  filter.type = 'lowpass'
  filter.frequency.value = 4200
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, at)

  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, peak),
    at + 0.035,
  )
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)

  oscillator.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain!)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.05)
}

function bell(root: number, at: number, level = 0.22, duration = 2.6) {
  const context = ensureAudioContext()
  if (!context) return

  partial(context, root, at, duration, level)
  partial(context, root * 2, at, duration * 0.6, level * 0.36)
  partial(context, root * 2.997, at, duration * 0.38, level * 0.14)
  partial(
    context,
    root * 0.5,
    at,
    duration * 0.9,
    level * 0.18,
    'triangle',
  )
}

export function playRestCue(cue: 'rest' | 'back') {
  const context = ensureAudioContext()
  if (!context) return

  const at = context.currentTime + 0.02

  if (cue === 'rest') {
    bell(660, at, 0.26)
    bell(495, at + 0.28, 0.24)
    bell(330, at + 0.62, 0.2, 3.4)
    return
  }

  bell(392, at, 0.2)
  bell(587.33, at + 0.16, 0.22)
  bell(783.99, at + 0.32, 0.18, 2.2)
}
