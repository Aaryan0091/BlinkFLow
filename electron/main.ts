import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  ipcMain,
  nativeImage,
  powerMonitor,
  screen,
  session,
  type Display,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  registerAppIpcHandlers,
  registerTimerIpcHandlers,
  TIMER_IPC_CHANNELS,
  type LaunchAtLoginState,
} from './ipc-handlers.js'
import { selectRestOverlayDisplays } from './rest-overlay.js'
import {
  buildContentSecurityPolicy,
  createRendererUrlValidator,
} from './security.js'
import { TimerEngine, type TimerTransition } from './timer-engine.js'
import {
  readTimerSnapshot,
  writeTimerSnapshot,
} from './timer-persistence.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

if (isDev) {
  app.setPath('userData', path.join(app.getPath('userData'), 'development'))
}

let mainWindow: BrowserWindow | null = null
const breakWindows = new Map<number, BrowserWindow>()
let tray: Tray | null = null
let tickHandle: NodeJS.Timeout | null = null
let quitRequested = false
let timerEngine = new TimerEngine()
let timerDataPath: string | null = null
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173/'
const rendererFileUrl = pathToFileURL(
  path.join(__dirname, '../dist/index.html'),
).toString()
const isTrustedRendererUrl = createRendererUrlValidator({
  isDev,
  devServerUrl,
  rendererFileUrl,
})

function getRendererUrl(mode: 'main' | 'break') {
  const rendererUrl = new URL(isDev ? devServerUrl : rendererFileUrl)
  if (mode === 'break') rendererUrl.searchParams.set('mode', 'break')
  return rendererUrl.toString()
}

function secureWebContents(webContents: WebContents) {
  webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isTrustedRendererUrl(navigationUrl)) {
      event.preventDefault()
    }
  })
  webContents.on('will-attach-webview', (event) => event.preventDefault())
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function configureContentSecurityPolicy() {
  const policy = buildContentSecurityPolicy(isDev)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

function isTrustedIpcSender(event: IpcMainInvokeEvent) {
  const trustedWebContentsIds = new Set([
    mainWindow?.webContents.id,
    ...[...breakWindows.values()].map((window) => window.webContents.id),
  ])

  return (
    trustedWebContentsIds.has(event.sender.id) &&
    event.senderFrame === event.sender.mainFrame &&
    isTrustedRendererUrl(event.senderFrame.url)
  )
}

function getLaunchAtLoginState(): LaunchAtLoginState {
  const platformSupported =
    process.platform === 'darwin' || process.platform === 'win32'

  if (!platformSupported) {
    return { supported: false, enabled: false, status: 'unsupported' }
  }

  if (!app.isPackaged) {
    return {
      supported: false,
      enabled: false,
      status: 'available-after-install',
    }
  }

  const settings = app.getLoginItemSettings()
  if (process.platform === 'darwin' && settings.status === 'requires-approval') {
    return {
      supported: true,
      enabled: settings.openAtLogin,
      status: 'requires-approval',
    }
  }

  return {
    supported: true,
    enabled: settings.openAtLogin,
    status: settings.openAtLogin ? 'enabled' : 'disabled',
  }
}

function setLaunchAtLogin(enabled: boolean) {
  if (!getLaunchAtLoginState().supported) {
    return getLaunchAtLoginState()
  }

  app.setLoginItemSettings({ openAtLogin: enabled })
  return getLaunchAtLoginState()
}

function persistTimerState() {
  if (!timerDataPath) return
  try {
    writeTimerSnapshot(timerDataPath, timerEngine.getSnapshot())
  } catch (error) {
    console.error('Unable to save timer state', error)
  }
}

function sendState(shouldPersist = false) {
  const timerState = timerEngine.getState()
  if (shouldPersist) persistTimerState()
  for (const target of [mainWindow, ...breakWindows.values()]) {
    target?.webContents.send(TIMER_IPC_CHANNELS.stateChanged, timerState)
  }
  updateTrayMenu()
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow()
  }
  mainWindow?.show()
  mainWindow?.focus()
}

function formatTrayClock(totalMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function updateTrayMenu() {
  if (!tray) {
    return
  }

  const timerState = timerEngine.getState()
  const isPaused = timerState.isPaused || timerState.phase === 'paused'
  const status = !timerState.isRunning
    ? 'Ready · 20:00'
    : `${isPaused ? 'Paused' : timerState.phase === 'break' ? 'Look away' : 'Focusing'} · ${formatTrayClock(timerState.remainingMs)}`

  tray.setToolTip(`Eye Break — ${status}`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: status, enabled: false },
      { type: 'separator' },
      { label: 'Open Eye Break', click: showMainWindow },
      {
        label: isPaused ? 'Resume cycle' : timerState.isRunning ? 'Pause cycle' : 'Start cycle',
        click: () => {
          if (isPaused) resumeTimer()
          else if (timerState.isRunning) pauseTimer()
          else startTimer()
        },
      },
      { label: 'Stop cycle', enabled: timerState.isRunning, click: stopTimer },
      {
        label: 'Auto mode',
        type: 'checkbox',
        checked: timerState.autoMode,
        click: (menuItem) => setAutoMode(menuItem.checked),
      },
      { type: 'separator' },
      {
        label: 'Quit Eye Break',
        click: () => {
          quitRequested = true
          app.quit()
        },
      },
    ]),
  )
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }
  tray = new Tray(icon)
  tray.on('click', showMainWindow)
  updateTrayMenu()
}

function clearTicker() {
  if (tickHandle) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

function configureBreakWindow(window: BrowserWindow, display: Display) {
  if (process.platform === 'darwin' && window.isSimpleFullScreen()) {
    const currentDisplay = screen.getDisplayMatching(window.getBounds())
    if (currentDisplay.id !== display.id) {
      window.setSimpleFullScreen(false)
    }
  }

  if (process.platform !== 'darwin' || !window.isSimpleFullScreen()) {
    window.setBounds(display.bounds, false)
  }

  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.platform === 'darwin') {
    if (!window.isSimpleFullScreen()) window.setSimpleFullScreen(true)
  } else if (!window.isFullScreen()) {
    window.setFullScreen(true)
  }
}

function getPriorityDisplayId() {
  try {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id
  } catch {
    return screen.getPrimaryDisplay().id
  }
}

function createBreakWindow(display: Display) {
  const window = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  breakWindows.set(display.id, window)
  secureWebContents(window.webContents)
  configureBreakWindow(window, display)

  window.on('closed', () => {
    if (breakWindows.get(display.id) === window) {
      breakWindows.delete(display.id)
    }
  })

  window.on('blur', () => {
    if (
      !timerEngine.shouldShowBreak() ||
      timerEngine.getState().restOverlayMode !== 'all-displays'
    ) {
      return
    }

    setTimeout(() => {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      const overlayHasFocus =
        focusedWindow && [...breakWindows.values()].includes(focusedWindow)
      if (!overlayHasFocus) bringBreakWindowsForward()
    }, 50)
  })

  window.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      input.key === 'Escape' &&
      !input.isAutoRepeat
    ) {
      event.preventDefault()
      endBreak()
    }
  })

  void window.loadURL(getRendererUrl('break'))
  return window
}

function syncBreakWindows() {
  const displays = selectRestOverlayDisplays(
    timerEngine.getState().restOverlayMode,
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
  )
  const targetDisplayIds = new Set(displays.map((display) => display.id))

  for (const [displayId, window] of breakWindows) {
    if (!targetDisplayIds.has(displayId)) {
      window.destroy()
      breakWindows.delete(displayId)
    }
  }

  for (const display of displays) {
    let window = breakWindows.get(display.id)
    if (
      window &&
      screen.getDisplayMatching(window.getBounds()).id !== display.id
    ) {
      window.destroy()
      breakWindows.delete(display.id)
      window = undefined
    }
    window ??= createBreakWindow(display)
    configureBreakWindow(window, display)
  }
}

function bringBreakWindowsForward() {
  syncBreakWindows()
  const mode = timerEngine.getState().restOverlayMode
  if (mode === 'none') return
  const priorityDisplayId =
    mode === 'primary-display'
      ? screen.getPrimaryDisplay().id
      : getPriorityDisplayId()

  for (const [displayId, window] of breakWindows) {
    if (window.isDestroyed()) continue
    configureBreakWindow(
      window,
      screen.getAllDisplays().find((display) => display.id === displayId) ??
        screen.getPrimaryDisplay(),
    )
    window.moveTop()
    window.show()
  }

  const priorityWindow =
    breakWindows.get(priorityDisplayId) ??
    breakWindows.get(screen.getPrimaryDisplay().id)
  priorityWindow?.focus()
}

function showBreakWindows() {
  if (timerEngine.getState().restOverlayMode === 'none') {
    syncBreakWindows()
    return
  }
  bringBreakWindowsForward()
}

function hideBreakWindows() {
  for (const window of breakWindows.values()) {
    if (process.platform === 'darwin' && window.isSimpleFullScreen()) {
      window.setSimpleFullScreen(false)
    } else if (process.platform !== 'darwin' && window.isFullScreen()) {
      window.setFullScreen(false)
    }
    window.hide()
  }
}

function notifyFocusEnded() {
  const timerState = timerEngine.getState()
  showBreakWindows()

  if (Notification.isSupported()) {
    const breakSeconds = Math.round(timerState.breakDurationMs / 1000)
    new Notification({
      title: 'Eye Break',
      body: `It has been 20 minutes. Stop looking at your screen for ${breakSeconds} seconds.`,
      silent: true,
    }).show()
  }
}

function handleTimerTransition(transition: TimerTransition) {
  if (transition === 'focus-ended') {
    notifyFocusEnded()
    return
  }

  hideBreakWindows()
}

function resumeTimerInterval() {
  clearTicker()
  tickHandle = setInterval(() => {
    const transition = timerEngine.tick()
    if (transition) handleTimerTransition(transition)
    sendState(Boolean(transition))
  }, 1000)
}

function startTimer() {
  const timerState = timerEngine.start()
  hideBreakWindows()
  sendState(true)
  resumeTimerInterval()
  return timerState
}

function setRemainingTime(requestedRemainingMs: number) {
  let timerState = timerEngine.setRemaining(requestedRemainingMs)

  if (requestedRemainingMs <= 0) {
    const transition = timerEngine.tick()
    if (transition) handleTimerTransition(transition)
    timerState = timerEngine.getState()
  }

  sendState(true)
  return timerState
}

function setBreakDuration(requestedDurationMs: number) {
  const timerState = timerEngine.setBreakDuration(requestedDurationMs)
  sendState(true)
  return timerState
}

function setAutoMode(enabled: boolean) {
  const timerState = timerEngine.setAutoMode(enabled)
  sendState(true)
  return timerState
}

function setRestOverlayMode(
  mode: Parameters<TimerEngine['setRestOverlayMode']>[0],
) {
  const timerState = timerEngine.setRestOverlayMode(mode)

  if (timerEngine.shouldShowBreak()) {
    showBreakWindows()
  } else {
    hideBreakWindows()
  }

  sendState(true)
  return timerState
}

function pauseTimer() {
  const timerState = timerEngine.pause()
  if (timerState.isPaused) clearTicker()
  sendState(true)
  return timerState
}

function resumeTimer() {
  const timerState = timerEngine.resume()
  if (timerEngine.shouldShowBreak()) showBreakWindows()
  else hideBreakWindows()
  if (timerState.isRunning && !timerState.isPaused) resumeTimerInterval()
  sendState(true)
  return timerState
}

function stopTimer() {
  clearTicker()
  hideBreakWindows()
  const timerState = timerEngine.stop()
  sendState(true)
  return timerState
}

function restNow() {
  const wasAlreadyInBreak = timerEngine.shouldShowBreak()
  const timerState = timerEngine.restNow()

  if (!wasAlreadyInBreak && timerEngine.shouldShowBreak()) {
    notifyFocusEnded()
    resumeTimerInterval()
  }

  sendState(true)
  return timerState
}

function endBreak() {
  if (!timerEngine.shouldShowBreak()) return timerEngine.getState()

  const timerState = timerEngine.endBreak()
  hideBreakWindows()

  if (timerState.isRunning && !timerState.isPaused) {
    resumeTimerInterval()
  } else {
    clearTicker()
  }

  sendState(true)
  return timerState
}

function handleSystemWake() {
  clearTicker()
  hideBreakWindows()

  const timerState = timerEngine.resetAfterWake()
  if (timerState.autoMode) {
    resumeTimerInterval()
  }

  sendState(true)
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f0fdfa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  secureWebContents(mainWindow.webContents)

  mainWindow.on('close', (event) => {
    if (!quitRequested) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  void mainWindow.loadURL(getRendererUrl('main'))
}

// Keep the installed application single-instance, but do not let an orphaned
// development Electron process kill a fresh Vite session. This can happen
// after the dev server is stopped while the tray process is still alive,
// leaving its window pointed at an unavailable localhost URL.
const hasSingleInstanceLock = isDev || app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    configureContentSecurityPolicy()
    timerDataPath = path.join(
      app.getPath('userData'),
      'eye-break-data',
      'timer-state.json',
    )
    const savedSnapshot = readTimerSnapshot(timerDataPath)
    timerEngine = new TimerEngine({ snapshot: savedSnapshot })

    createMainWindow()
    createTray()

    if (timerEngine.shouldShowBreak()) showBreakWindows()
    const restoredState = timerEngine.getState()
    if (restoredState.isRunning && !restoredState.isPaused) {
      resumeTimerInterval()
    }
    sendState(true)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })

    screen.on('display-added', () => {
      if (timerEngine.shouldShowBreak()) showBreakWindows()
    })

    screen.on('display-removed', (_event, display) => {
      breakWindows.get(display.id)?.destroy()
      breakWindows.delete(display.id)
      if (timerEngine.shouldShowBreak()) showBreakWindows()
    })

    screen.on('display-metrics-changed', () => {
      if (timerEngine.shouldShowBreak()) showBreakWindows()
    })

    powerMonitor.on('suspend', () => {
      clearTicker()
      persistTimerState()
    })

    powerMonitor.on('resume', handleSystemWake)
  })

  app.on('before-quit', () => {
    quitRequested = true
    persistTimerState()
  })

  registerTimerIpcHandlers(
    ipcMain,
    {
      getState: () => timerEngine.getState(),
      start: startTimer,
      pause: pauseTimer,
      resume: resumeTimer,
      stop: stopTimer,
      restNow,
      endBreak,
      setRemaining: setRemainingTime,
      setBreakDuration,
      setAutoMode,
      setRestOverlayMode,
    },
    { isTrustedSender: isTrustedIpcSender },
  )
  registerAppIpcHandlers(
    ipcMain,
    {
      getLaunchAtLogin: getLaunchAtLoginState,
      setLaunchAtLogin,
    },
    { isTrustedSender: isTrustedIpcSender },
  )
}
