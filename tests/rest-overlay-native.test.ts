import { describe, expect, it, vi } from 'vitest'
import {
  configureRestOverlayWindow,
  createRestOverlayWindowOptions,
  synchronizeRestOverlayWindows,
  type NativeRestOverlayWindow,
  type RestOverlayDisplay,
} from '../electron/rest-overlay.js'

const displays: RestOverlayDisplay[] = [
  { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, bounds: { x: 1920, y: 0, width: 2560, height: 1440 } },
  { id: 3, bounds: { x: -1440, y: 0, width: 1440, height: 900 } },
]

function displayMatching(bounds: RestOverlayDisplay['bounds']) {
  return (
    displays.find(
      (display) =>
        display.bounds.x === bounds.x &&
        display.bounds.y === bounds.y,
    ) ?? displays[0]
  )
}

function createNativeWindow(
  initialDisplay: RestOverlayDisplay,
): NativeRestOverlayWindow & {
  destroyed: boolean
  bounds: RestOverlayDisplay['bounds']
  simpleFullScreen: boolean
  fullScreen: boolean
} {
  const window = {
    destroyed: false,
    bounds: initialDisplay.bounds,
    simpleFullScreen: false,
    fullScreen: false,
    destroy: vi.fn(() => {
      window.destroyed = true
    }),
    getBounds: vi.fn(() => window.bounds),
    isSimpleFullScreen: vi.fn(() => window.simpleFullScreen),
    setSimpleFullScreen: vi.fn((enabled: boolean) => {
      window.simpleFullScreen = enabled
    }),
    isFullScreen: vi.fn(() => window.fullScreen),
    setFullScreen: vi.fn((enabled: boolean) => {
      window.fullScreen = enabled
    }),
    setBounds: vi.fn((bounds: RestOverlayDisplay['bounds']) => {
      window.bounds = bounds
    }),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
  }
  return window
}

describe('native fullscreen multi-monitor overlays', () => {
  it('creates a secure borderless native window at the target display bounds', () => {
    expect(
      createRestOverlayWindowOptions(displays[1], '/app/preload.cjs'),
    ).toMatchObject({
      x: 1920,
      y: 0,
      width: 2560,
      height: 1440,
      frame: false,
      alwaysOnTop: true,
      fullscreenable: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      webPreferences: {
        preload: '/app/preload.cjs',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
  })

  it('uses macOS simple fullscreen with screen-saver priority on every display', () => {
    for (const display of displays) {
      const window = createNativeWindow(display)

      configureRestOverlayWindow(
        window,
        display,
        'darwin',
        displayMatching,
      )

      expect(window.bounds).toEqual(display.bounds)
      expect(window.setAlwaysOnTop).toHaveBeenCalledWith(
        true,
        'screen-saver',
        1,
      )
      expect(window.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
        visibleOnFullScreen: true,
      })
      expect(window.setSimpleFullScreen).toHaveBeenCalledWith(true)
      expect(window.simpleFullScreen).toBe(true)
    }
  })

  it('uses native fullscreen on Windows and Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const window = createNativeWindow(displays[1])

      configureRestOverlayWindow(
        window,
        displays[1],
        platform,
        displayMatching,
      )

      expect(window.setBounds).toHaveBeenCalledWith(
        displays[1].bounds,
        false,
      )
      expect(window.setFullScreen).toHaveBeenCalledWith(true)
      expect(window.fullScreen).toBe(true)
    }
  })

  it('creates exactly one fullscreen overlay per connected display', () => {
    const windows = new Map<
      number,
      ReturnType<typeof createNativeWindow>
    >()
    const createWindow = vi.fn((display: RestOverlayDisplay) =>
      createNativeWindow(display),
    )
    const configureWindow = vi.fn(
      (
        window: ReturnType<typeof createNativeWindow>,
        display: RestOverlayDisplay,
      ) =>
        configureRestOverlayWindow(
          window,
          display,
          'darwin',
          displayMatching,
        ),
    )

    synchronizeRestOverlayWindows({
      mode: 'all-displays',
      displays,
      primaryDisplay: displays[0],
      windows,
      getDisplayMatching: displayMatching,
      createWindow,
      configureWindow,
    })

    expect([...windows.keys()]).toEqual([1, 2, 3])
    expect(createWindow).toHaveBeenCalledTimes(3)
    expect(configureWindow).toHaveBeenCalledTimes(3)
    for (const window of windows.values()) {
      expect(window.simpleFullScreen).toBe(true)
    }
  })

  it('destroys secondary overlays when switching to the primary display', () => {
    const windows = new Map(
      displays.map((display) => [
        display.id,
        createNativeWindow(display),
      ]),
    )
    const secondaryWindows = [windows.get(2), windows.get(3)]

    synchronizeRestOverlayWindows({
      mode: 'primary-display',
      displays,
      primaryDisplay: displays[0],
      windows,
      getDisplayMatching: displayMatching,
      createWindow: createNativeWindow,
      configureWindow: () => undefined,
    })

    expect([...windows.keys()]).toEqual([1])
    expect(secondaryWindows[0]?.destroyed).toBe(true)
    expect(secondaryWindows[1]?.destroyed).toBe(true)
  })

  it('moves a stale overlay back to its assigned display before fullscreen', () => {
    const window = createNativeWindow(displays[0])
    window.simpleFullScreen = true

    configureRestOverlayWindow(
      window,
      displays[1],
      'darwin',
      displayMatching,
    )

    expect(window.setSimpleFullScreen).toHaveBeenNthCalledWith(1, false)
    expect(window.setBounds).toHaveBeenCalledWith(displays[1].bounds, false)
    expect(window.setSimpleFullScreen).toHaveBeenLastCalledWith(true)
    expect(window.bounds).toEqual(displays[1].bounds)
  })
})
