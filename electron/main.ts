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
  shell,
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  registerTimerIpcHandlers,
  TIMER_IPC_CHANNELS,
} from './ipc-handlers.js'
import { pauseBackgroundMedia } from './media-controller.js'
import { TimerEngine, type TimerTransition } from './timer-engine.js'
import {
  readTimerSnapshot,
  writeTimerSnapshot,
} from './timer-persistence.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let breakWindow: BrowserWindow | null = null
let tray: Tray | null = null
let tickHandle: NodeJS.Timeout | null = null
let quitRequested = false
let timerEngine = new TimerEngine()
let timerDataPath: string | null = null

function getRendererUrl(mode: 'main' | 'break') {
  const query = mode === 'break' ? '?mode=break' : ''
  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173/'
    return `${devServerUrl}${query}`
  }
  return `file://${path.join(__dirname, '../dist/index.html')}${query}`
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
  for (const target of [mainWindow, breakWindow]) {
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

function setBreakWindowBounds() {
  if (!breakWindow) {
    return
  }

  breakWindow.setBounds(screen.getPrimaryDisplay().workArea)
  breakWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  breakWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
}

function bringBreakWindowForward() {
  if (!breakWindow || breakWindow.isDestroyed()) return

  setBreakWindowBounds()
  breakWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  breakWindow.moveTop()
  breakWindow.show()
  breakWindow.focus()
}

function showBreakWindow() {
  if (!breakWindow) {
    breakWindow = new BrowserWindow({
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      focusable: true,
      fullscreenable: false,
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        sandbox: false,
      },
    })

    breakWindow.on('closed', () => {
      breakWindow = null
    })

    breakWindow.on('blur', () => {
      if (timerEngine.shouldShowBreak()) {
        setTimeout(bringBreakWindowForward, 50)
      }
    })

    void breakWindow.loadURL(getRendererUrl('break'))
  }

  bringBreakWindowForward()
}

function hideBreakWindow() {
  breakWindow?.hide()
}

function notifyFocusEnded() {
  const timerState = timerEngine.getState()
  void pauseBackgroundMedia()
  shell.beep()
  showBreakWindow()

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

  shell.beep()
  hideBreakWindow()
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
  hideBreakWindow()
  sendState(true)
  resumeTimerInterval()
  return timerState
}

function setRemainingTime(requestedRemainingMs: number) {
  const timerState = timerEngine.setRemaining(requestedRemainingMs)
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

function pauseTimer() {
  const timerState = timerEngine.pause()
  if (timerState.isPaused) clearTicker()
  sendState(true)
  return timerState
}

function resumeTimer() {
  const timerState = timerEngine.resume()
  if (timerEngine.shouldShowBreak()) showBreakWindow()
  else hideBreakWindow()
  if (timerState.isRunning && !timerState.isPaused) resumeTimerInterval()
  sendState(true)
  return timerState
}

function stopTimer() {
  clearTicker()
  hideBreakWindow()
  const timerState = timerEngine.stop()
  sendState(true)
  return timerState
}

function handleSystemWake() {
  clearTicker()
  hideBreakWindow()

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

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

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    timerDataPath = path.join(
      app.getPath('userData'),
      'eye-break-data',
      'timer-state.json',
    )
    const savedSnapshot = readTimerSnapshot(timerDataPath)
    timerEngine = new TimerEngine({ snapshot: savedSnapshot })

    createMainWindow()
    createTray()

    if (timerEngine.shouldShowBreak()) showBreakWindow()
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

    screen.on('display-metrics-changed', () => {
      setBreakWindowBounds()
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

  registerTimerIpcHandlers(ipcMain, {
    getState: () => timerEngine.getState(),
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    stop: stopTimer,
    setRemaining: setRemainingTime,
    setBreakDuration,
    setAutoMode,
  })
}
