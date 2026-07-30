import type { RestOverlayMode } from './timer-engine.js'

type DisplayBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type RestOverlayDisplay = {
  id: number
  bounds: DisplayBounds
}

export type NativeRestOverlayWindow = {
  destroy: () => void
  getBounds: () => DisplayBounds
  isSimpleFullScreen: () => boolean
  setSimpleFullScreen: (enabled: boolean) => void
  isFullScreen: () => boolean
  setFullScreen: (enabled: boolean) => void
  setBounds: (bounds: DisplayBounds, animate: boolean) => void
  setAlwaysOnTop: (
    enabled: boolean,
    level: 'screen-saver',
    relativeLevel: number,
  ) => void
  setVisibleOnAllWorkspaces: (
    visible: boolean,
    options: { visibleOnFullScreen: boolean },
  ) => void
}

export function selectRestOverlayDisplays<T extends { id: number }>(
  mode: RestOverlayMode,
  displays: readonly T[],
  primaryDisplay: T,
) {
  if (mode === 'none') return []
  if (mode === 'primary-display') return [primaryDisplay]
  return [...displays]
}

export function createRestOverlayWindowOptions(
  display: RestOverlayDisplay,
  preloadPath: string,
) {
  return {
    ...display.bounds,
    frame: false,
    transparent: false,
    backgroundColor: '#04060b',
    alwaysOnTop: true,
    focusable: true,
    fullscreenable: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
}

export function configureRestOverlayWindow(
  window: NativeRestOverlayWindow,
  display: RestOverlayDisplay,
  platform: NodeJS.Platform,
  getDisplayMatching: (bounds: DisplayBounds) => RestOverlayDisplay,
) {
  if (platform === 'darwin' && window.isSimpleFullScreen()) {
    const currentDisplay = getDisplayMatching(window.getBounds())
    if (currentDisplay.id !== display.id) {
      window.setSimpleFullScreen(false)
    }
  }

  if (platform !== 'darwin' || !window.isSimpleFullScreen()) {
    window.setBounds(display.bounds, false)
  }

  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (platform === 'darwin') {
    if (!window.isSimpleFullScreen()) window.setSimpleFullScreen(true)
  } else if (!window.isFullScreen()) {
    window.setFullScreen(true)
  }
}

export function synchronizeRestOverlayWindows<
  TDisplay extends RestOverlayDisplay,
  TWindow extends NativeRestOverlayWindow,
>({
  mode,
  displays,
  primaryDisplay,
  windows,
  getDisplayMatching,
  createWindow,
  configureWindow,
}: {
  mode: RestOverlayMode
  displays: readonly TDisplay[]
  primaryDisplay: TDisplay
  windows: Map<number, TWindow>
  getDisplayMatching: (bounds: DisplayBounds) => TDisplay
  createWindow: (display: TDisplay) => TWindow
  configureWindow: (window: TWindow, display: TDisplay) => void
}) {
  const targetDisplays = selectRestOverlayDisplays(
    mode,
    displays,
    primaryDisplay,
  )
  const targetDisplayIds = new Set(
    targetDisplays.map((display) => display.id),
  )

  for (const [displayId, window] of windows) {
    if (!targetDisplayIds.has(displayId)) {
      window.destroy()
      windows.delete(displayId)
    }
  }

  for (const display of targetDisplays) {
    let window = windows.get(display.id)
    if (
      window &&
      getDisplayMatching(window.getBounds()).id !== display.id
    ) {
      window.destroy()
      windows.delete(display.id)
      window = undefined
    }
    if (!window) {
      window = createWindow(display)
      windows.set(display.id, window)
    }
    configureWindow(window, display)
  }

  return windows
}
