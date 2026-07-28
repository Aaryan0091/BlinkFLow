import type { RestOverlayMode } from './timer-engine.js'

export function selectRestOverlayDisplays<T extends { id: number }>(
  mode: RestOverlayMode,
  displays: readonly T[],
  primaryDisplay: T,
) {
  if (mode === 'none') return []
  if (mode === 'primary-display') return [primaryDisplay]
  return [...displays]
}
