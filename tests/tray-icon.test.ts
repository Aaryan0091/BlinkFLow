import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRAY_ICON_FILENAME,
  getTrayIconFilename,
  MACOS_TRAY_ICON_FILENAME,
} from '../electron/tray-icon'

const projectRoot = path.resolve(import.meta.dirname, '..')

function readPngDimensions(filename: string) {
  const png = readFileSync(path.join(projectRoot, 'public', filename))
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  }
}

describe('tray icon assets', () => {
  it('selects the template icon on macOS', () => {
    expect(getTrayIconFilename('darwin')).toBe(MACOS_TRAY_ICON_FILENAME)
  })

  it('selects the standard icon on Windows and Linux', () => {
    expect(getTrayIconFilename('win32')).toBe(DEFAULT_TRAY_ICON_FILENAME)
    expect(getTrayIconFilename('linux')).toBe(DEFAULT_TRAY_ICON_FILENAME)
  })

  it('ships correctly sized macOS template images', () => {
    expect(readPngDimensions('tray-iconTemplate.png')).toEqual({
      width: 18,
      height: 18,
    })
    expect(readPngDimensions('tray-iconTemplate@2x.png')).toEqual({
      width: 36,
      height: 36,
    })
  })
})
