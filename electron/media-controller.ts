import { execFile } from 'node:child_process'

export type MediaCommandRunner = (
  executable: string,
  arguments_: string[],
) => Promise<void>

function runCommand(executable: string, arguments_: string[]) {
  return new Promise<void>((resolve) => {
    execFile(executable, arguments_, () => resolve())
  })
}

const macPlayerScripts = [
  'if application "Music" is running then tell application "Music" to if player state is playing then pause',
  'if application "Spotify" is running then tell application "Spotify" to if player state is playing then pause',
]

export async function pauseBackgroundMedia(
  platform: NodeJS.Platform = process.platform,
  commandRunner: MediaCommandRunner = runCommand,
) {
  if (platform === 'darwin') {
    await Promise.all(
      macPlayerScripts.map((script) =>
        commandRunner('osascript', ['-e', script]).catch(() => undefined),
      ),
    )
    return
  }

  if (platform === 'linux') {
    await commandRunner('playerctl', ['--all-players', 'pause']).catch(
      () => undefined,
    )
  }
}
