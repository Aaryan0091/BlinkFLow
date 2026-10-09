import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { FuseV1Options } = require('@electron/fuses')
const {
  createFuseConfig,
  getElectronBinaryPath,
} = require('../build/after-pack.cjs')

describe('packaged Electron fuses', () => {
  it('uses the standard Electron V8 snapshot', () => {
    const config = createFuseConfig({ electronPlatformName: 'darwin' })

    expect(
      config[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot],
    ).toBe(false)
  })

  it('keeps the privileges required by the packaged file renderer', () => {
    const config = createFuseConfig({ electronPlatformName: 'darwin' })

    expect(config[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(true)
  })

  it('uses Electron Builder\'s lowercase Linux executable name', () => {
    const binaryPath = getElectronBinaryPath({
      appOutDir: '/tmp/blinkflow-package',
      electronPlatformName: 'linux',
      packager: {
        appInfo: { productFilename: 'BlinkFlow' },
        executableName: 'blinkflow',
      },
    })

    expect(binaryPath).toBe(
      path.join('/tmp/blinkflow-package', 'blinkflow'),
    )
  })
})
