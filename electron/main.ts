import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  ipcMain,
  nativeImage,
  screen,
  shell,
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type TimerPhase = 'idle' | 'focus' | 'break' | 'paused'

type TimerState = {
  phase: TimerPhase
  isRunning: boolean
  isPaused: boolean
  focusDurationMs: number
  breakDurationMs: number
  remainingMs: number
  elapsedFocusMs: number
  completedFocusSessions: number
  startedAt: number | null
  breakStartedAt: number | null
  autoMode: boolean
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let breakWindow: BrowserWindow | null = null
let tray: Tray | null = null
let tickHandle: NodeJS.Timeout | null = null
let quitRequested = false
let phaseStartedAt: number | null = null
let pausedRemainingMs = 20 * 60 * 1000
let pausedPhase: Exclude<TimerPhase, 'paused'> = 'idle'

const timerState: TimerState = {
  phase: 'idle',
  isRunning: false,
  isPaused: false,
  focusDurationMs: 20 * 60 * 1000,
  breakDurationMs: 20 * 1000,
  remainingMs: 20 * 60 * 1000,
  elapsedFocusMs: 0,
  completedFocusSessions: 0,
  startedAt: null,
  breakStartedAt: null,
  autoMode: false,
}

function getRendererUrl(mode: 'main' | 'break') {
  const query = mode === 'break' ? '?mode=break' : ''
  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173/'
    return `${devServerUrl}${query}`
  }
  return `file://${path.join(__dirname, '../dist/index.html')}${query}`
}

function sendState() {
  for (const target of [mainWindow, breakWindow]) {
    target?.webContents.send('timer:state', timerState)
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
  breakWindow.setAlwaysOnTop(true, 'screen-saver')
  breakWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
}

function showBreakWindow() {
  if (!breakWindow) {
    breakWindow = new BrowserWindow({
      frame: false,
      transparent: true,
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

    void breakWindow.loadURL(getRendererUrl('break'))
  }

  setBreakWindowBounds()
  breakWindow.show()
  breakWindow.focus()
}

function hideBreakWindow() {
  breakWindow?.hide()
}

function syncFocusMetrics() {
  if (!phaseStartedAt) {
    return
  }

  const elapsed = Date.now() - phaseStartedAt
  timerState.remainingMs = Math.max(timerState.focusDurationMs - elapsed, 0)
  timerState.elapsedFocusMs = Math.min(elapsed, timerState.focusDurationMs)
}

function syncBreakMetrics() {
  if (!phaseStartedAt) {
    return
  }

  const elapsed = Date.now() - phaseStartedAt
  timerState.remainingMs = Math.max(timerState.breakDurationMs - elapsed, 0)
}

function resumeFocusInterval() {
  clearTicker()
  tickHandle = setInterval(() => {
    syncFocusMetrics()
    sendState()

    if (timerState.remainingMs <= 0) {
      timerState.completedFocusSessions += 1
      enterBreakPhase()
    }
  }, 1000)
}

function resumeBreakInterval() {
  clearTicker()
  tickHandle = setInterval(() => {
    syncBreakMetrics()
    sendState()

    if (timerState.remainingMs <= 0) {
      shell.beep()
      if (timerState.autoMode) {
        enterFocusPhase(true)
      } else {
        stopTimer()
      }
    }
  }, 1000)
}

function enterFocusPhase(
  freshCycle: boolean,
  requestedRemainingMs = timerState.focusDurationMs,
) {
  const remainingMs = Math.min(
    Math.max(requestedRemainingMs, 1000),
    timerState.focusDurationMs,
  )
  const elapsedMs = timerState.focusDurationMs - remainingMs

  timerState.phase = 'focus'
  timerState.isRunning = true
  timerState.isPaused = false
  timerState.breakStartedAt = null
  timerState.remainingMs = remainingMs
  timerState.elapsedFocusMs = elapsedMs
  phaseStartedAt = Date.now() - elapsedMs
  timerState.startedAt = freshCycle ? phaseStartedAt : timerState.startedAt ?? phaseStartedAt
  hideBreakWindow()
  sendState()
  resumeFocusInterval()
}

function enterBreakPhase() {
  shell.beep()
  timerState.phase = 'break'
  timerState.isRunning = true
  timerState.isPaused = false
  timerState.remainingMs = timerState.breakDurationMs
  timerState.elapsedFocusMs = timerState.focusDurationMs
  phaseStartedAt = Date.now()
  timerState.breakStartedAt = phaseStartedAt
  showBreakWindow()

  if (Notification.isSupported()) {
    const breakSeconds = Math.round(timerState.breakDurationMs / 1000)
    new Notification({
      title: 'Eye Break',
      body: `It has been 20 minutes. Stop looking at your screen for ${breakSeconds} seconds.`,
      silent: true,
    }).show()
  }

  sendState()
  resumeBreakInterval()
}

function startTimer() {
  const requestedRemainingMs = timerState.remainingMs
  timerState.completedFocusSessions = 0
  pausedRemainingMs = requestedRemainingMs
  pausedPhase = 'focus'
  enterFocusPhase(true, requestedRemainingMs)
  return timerState
}

function setRemainingTime(requestedRemainingMs: number) {
  if (!Number.isFinite(requestedRemainingMs)) {
    return timerState
  }

  const effectivePhase = timerState.phase === 'paused' ? pausedPhase : timerState.phase
  const isBreak = effectivePhase === 'break'
  const durationMs = isBreak ? timerState.breakDurationMs : timerState.focusDurationMs
  const remainingMs = Math.min(
    Math.max(Math.round(requestedRemainingMs / 1000) * 1000, 1000),
    durationMs,
  )
  const elapsedMs = durationMs - remainingMs

  timerState.remainingMs = remainingMs
  pausedRemainingMs = remainingMs

  if (isBreak) {
    if (!timerState.isPaused) {
      phaseStartedAt = Date.now() - elapsedMs
      timerState.breakStartedAt = phaseStartedAt
    }
  } else {
    timerState.elapsedFocusMs = elapsedMs
    if (timerState.phase === 'idle') {
      phaseStartedAt = null
      timerState.startedAt = null
    } else if (!timerState.isPaused) {
      phaseStartedAt = Date.now() - elapsedMs
      timerState.startedAt = phaseStartedAt
    }
  }

  sendState()
  return timerState
}

function setBreakDuration(requestedDurationMs: number) {
  if (!Number.isFinite(requestedDurationMs)) {
    return timerState
  }

  const previousDurationMs = timerState.breakDurationMs
  const durationMs = Math.min(
    Math.max(Math.round(requestedDurationMs / 5000) * 5000, 5000),
    120000,
  )
  const effectivePhase = timerState.phase === 'paused' ? pausedPhase : timerState.phase

  if (effectivePhase === 'break') {
    if (!timerState.isPaused) {
      syncBreakMetrics()
    }

    const elapsedMs = Math.max(previousDurationMs - timerState.remainingMs, 0)
    const adjustedElapsedMs = Math.min(elapsedMs, durationMs - 1000)
    const remainingMs = durationMs - adjustedElapsedMs

    timerState.remainingMs = remainingMs
    pausedRemainingMs = remainingMs

    if (!timerState.isPaused) {
      phaseStartedAt = Date.now() - adjustedElapsedMs
      timerState.breakStartedAt = phaseStartedAt
    }
  }

  timerState.breakDurationMs = durationMs
  sendState()
  return timerState
}

function setAutoMode(enabled: boolean) {
  timerState.autoMode = Boolean(enabled)
  sendState()
  return timerState
}

function pauseTimer() {
  if (!timerState.isRunning || timerState.isPaused) {
    return timerState
  }

  if (timerState.phase === 'focus') {
    syncFocusMetrics()
  } else if (timerState.phase === 'break') {
    syncBreakMetrics()
  }

  pausedRemainingMs = timerState.remainingMs
  pausedPhase = timerState.phase === 'paused' ? pausedPhase : timerState.phase
  clearTicker()
  timerState.phase = 'paused'
  timerState.isPaused = true
  sendState()
  return timerState
}

function resumeTimer() {
  if (!timerState.isRunning && timerState.phase === 'idle') {
    return startTimer()
  }

  if (!timerState.isPaused) {
    return timerState
  }

  timerState.isPaused = false
  timerState.phase = pausedPhase

  if (pausedPhase === 'focus') {
    const elapsedBeforePause = timerState.focusDurationMs - pausedRemainingMs
    phaseStartedAt = Date.now() - elapsedBeforePause
    timerState.startedAt = phaseStartedAt
    timerState.remainingMs = pausedRemainingMs
    timerState.elapsedFocusMs = elapsedBeforePause
    sendState()
    resumeFocusInterval()
    return timerState
  }

  const elapsedBeforePause = timerState.breakDurationMs - pausedRemainingMs
  phaseStartedAt = Date.now() - elapsedBeforePause
  timerState.breakStartedAt = phaseStartedAt
  timerState.remainingMs = pausedRemainingMs
  showBreakWindow()
  sendState()
  resumeBreakInterval()
  return timerState
}

function stopTimer() {
  clearTicker()
  hideBreakWindow()
  phaseStartedAt = null
  pausedPhase = 'idle'
  pausedRemainingMs = timerState.focusDurationMs
  timerState.phase = 'idle'
  timerState.isRunning = false
  timerState.isPaused = false
  timerState.remainingMs = timerState.focusDurationMs
  timerState.elapsedFocusMs = 0
  timerState.startedAt = null
  timerState.breakStartedAt = null
  sendState()
  return timerState
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
    createMainWindow()
    createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })

    screen.on('display-metrics-changed', () => {
      setBreakWindowBounds()
    })
  })

  app.on('before-quit', () => {
    quitRequested = true
  })

  ipcMain.handle('timer:get-state', () => timerState)
  ipcMain.handle('timer:start', () => startTimer())
  ipcMain.handle('timer:pause', () => pauseTimer())
  ipcMain.handle('timer:resume', () => resumeTimer())
  ipcMain.handle('timer:stop', () => stopTimer())
  ipcMain.handle('timer:set-remaining', (_event, remainingMs: number) =>
    setRemainingTime(remainingMs),
  )
  ipcMain.handle('timer:set-break-duration', (_event, durationMs: number) =>
    setBreakDuration(durationMs),
  )
  ipcMain.handle('timer:set-auto-mode', (_event, enabled: boolean) =>
    setAutoMode(enabled),
  )
}
