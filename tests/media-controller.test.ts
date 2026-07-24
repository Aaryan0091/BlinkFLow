import { describe, expect, it, vi } from 'vitest'
import {
  pauseBackgroundMedia,
  type MediaCommandRunner,
} from '../electron/media-controller.js'

describe('background media control', () => {
  it('asks supported macOS players to pause without toggling playback', async () => {
    const runCommand = vi.fn<MediaCommandRunner>(() => Promise.resolve())

    await pauseBackgroundMedia('darwin', runCommand)

    expect(runCommand).toHaveBeenCalledTimes(2)
    expect(runCommand).toHaveBeenCalledWith(
      'osascript',
      expect.arrayContaining([
        '-e',
        expect.stringContaining('application "Music"'),
      ]),
    )
    expect(runCommand).toHaveBeenCalledWith(
      'osascript',
      expect.arrayContaining([
        '-e',
        expect.stringContaining('application "Spotify"'),
      ]),
    )
    for (const [, arguments_] of runCommand.mock.calls) {
      expect(arguments_.join(' ')).toContain('pause')
      expect(arguments_.join(' ').toLowerCase()).not.toContain('playpause')
    }
  })

  it('uses the MPRIS pause command on Linux', async () => {
    const runCommand = vi.fn<MediaCommandRunner>(() => Promise.resolve())

    await pauseBackgroundMedia('linux', runCommand)

    expect(runCommand).toHaveBeenCalledExactlyOnceWith('playerctl', [
      '--all-players',
      'pause',
    ])
  })

  it('does not fail the break flow when a player command is unavailable', async () => {
    const runCommand = vi.fn<MediaCommandRunner>(() =>
      Promise.reject(new Error('not installed')),
    )

    await expect(
      pauseBackgroundMedia('darwin', runCommand),
    ).resolves.toBeUndefined()
  })
})
