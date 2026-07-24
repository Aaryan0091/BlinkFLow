import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import {
  isTimerSnapshot,
  type TimerSnapshot,
} from './timer-engine.js'

export function readTimerSnapshot(filePath: string): TimerSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    return isTimerSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeTimerSnapshot(
  filePath: string,
  snapshot: TimerSnapshot,
) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(snapshot, null, 2), 'utf8')
  renameSync(temporaryPath, filePath)
}
