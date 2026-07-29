import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_REST_VOLUME,
  loadRestVolumePreference,
  normalizeRestVolume,
  REST_VOLUME_STORAGE_KEY,
  saveRestVolumePreference,
} from '../src/rest-audio.js'

describe('rest sound volume', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('clamps volume to a whole percentage between zero and one hundred', () => {
    expect(normalizeRestVolume(-12)).toBe(0)
    expect(normalizeRestVolume(42.6)).toBe(43)
    expect(normalizeRestVolume(140)).toBe(100)
  })

  it('uses the default volume for invalid values', () => {
    expect(normalizeRestVolume(Number.NaN)).toBe(DEFAULT_REST_VOLUME)
    expect(normalizeRestVolume(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_REST_VOLUME,
    )
  })

  it('persists and restores the selected volume locally', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })

    expect(saveRestVolumePreference(35)).toBe(35)
    expect(values.get(REST_VOLUME_STORAGE_KEY)).toBe('35')
    expect(loadRestVolumePreference()).toBe(35)
  })
})
