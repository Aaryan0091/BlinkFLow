import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TimerEngine } from '../electron/timer-engine.js'
import {
  readTimerSnapshot,
  writeTimerSnapshot,
} from '../electron/timer-persistence.js'

const temporaryDirectories: string[] = []

function createTemporaryFile() {
  const directory = mkdtempSync(path.join(tmpdir(), 'eye-break-test-'))
  temporaryDirectories.push(directory)
  return path.join(directory, 'nested', 'timer-state.json')
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('timer persistence', () => {
  it('atomically saves and reloads a timer snapshot', () => {
    let now = 5000
    const engine = new TimerEngine({ now: () => now })
    engine.setAutoMode(true)
    engine.setRestOverlayMode('primary-display')
    engine.setRestAppearanceMode('black-timer')
    engine.setRemaining(5 * 60 * 1000)
    engine.start()
    now += 60 * 1000

    const filePath = createTemporaryFile()
    writeTimerSnapshot(filePath, engine.getSnapshot())
    const loaded = readTimerSnapshot(filePath)

    expect(loaded).not.toBeNull()
    expect(loaded?.state.phase).toBe('focus')
    expect(loaded?.state.autoMode).toBe(true)
    expect(loaded?.state.restOverlayMode).toBe('primary-display')
    expect(loaded?.state.restAppearanceMode).toBe('black-timer')
    expect(loaded?.state.totalScreenTimeMs).toBe(60 * 1000)
    expect(loaded?.state.totalEyeRestTimeMs).toBe(0)
    expect(loaded?.phaseStartedAt).toBe(-895_000)

    const restoredEngine = new TimerEngine({ now: () => now, snapshot: loaded })
    expect(restoredEngine.getState().totalScreenTimeMs).toBe(60 * 1000)
  })

  it('returns null for a corrupted snapshot instead of crashing', () => {
    const filePath = createTemporaryFile()
    writeFileSync(filePath.replace('/nested/timer-state.json', '/broken.json'), '{')

    expect(
      readTimerSnapshot(filePath.replace('/nested/timer-state.json', '/broken.json')),
    ).toBeNull()
  })
})
