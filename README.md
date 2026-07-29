# Eye Break

A UI-first desktop reminder app built with React, Vite, TypeScript, and Electron.

## Documentation

- [Electron desktop stack](docs/electron-desktop-stack.md) — Electron, Electron
  Builder, desktop features, sound preferences, IPC, and security

## What it does

- Runs a `20 minute focus / adjustable break` cycle
- Lets you `start`, `pause`, `resume`, and `stop`
- Includes a draggable timeline for changing how much time has passed or remains
- Uses an eye-shaped timer that becomes visibly strained as focus time passes
- Supports an optional Auto Mode for repeating focus and rest cycles
- Restores the active, paused, or automatically repeating timer after an app restart
- Resets cleanly after laptop sleep: Auto Mode begins a fresh cycle, while manual mode waits for Start
- Plays a calm local chime when focus and rest periods end
- Lets the user adjust rest-chime volume from mute to 100%
- Shows a native desktop notification when focus time ends
- Lets the user show the rest screen on no displays, the main display only, or every connected display
- Bundles Lora and Raleway locally for fully offline typography
- Sandboxes renderers and restricts CSP, IPC, navigation, and new windows
- Keeps running from the system tray when the main window is closed
- Offers an optional native “Launch at login” setting on macOS and Windows
- Lets you start, pause, resume, stop, reopen, or quit from the tray menu
- Includes local `21st.dev` CLI scripts for UI exploration

## Run it

```bash
npm install
npm run dev
```

## Build and package

Create the optimized React and Electron bundles:

```bash
npm run build
```

Create an unpacked desktop application for local testing:

```bash
npm run package
```

Create platform-specific distributables:

```bash
npm run dist
```

On macOS, the distributable command creates an Apple Silicon `.app`, `.dmg`, and
`.zip` in `release/`. Windows builds create an NSIS installer and Linux builds
create an AppImage when the same command is run on those operating systems.

Release builds are unsigned by default. Public macOS and Windows distribution
should add code signing before publishing.

## Timer data and tests

The desktop app saves a timestamped timer snapshot under Electron's per-user
application data directory:

```text
<userData>/eye-break-data/timer-state.json
```

Running timers account for time that passes while the app is closed. Paused
timers remain paused, and Auto Mode advances through any completed focus and
break periods when the app starts again. Invalid or corrupted snapshots are
ignored safely and replaced by the default timer state.

Laptop sleep is handled separately from quitting the app. When the computer
wakes, the previous countdown is discarded because sleep time is not screen
time. With Auto Mode enabled, a new full focus cycle starts immediately. With
Auto Mode disabled, the timer resets to Ready and waits for the user to start.

Run the automated timer, Auto Mode, persistence, and Electron IPC tests once:

```bash
npm test
```

Or keep them running while developing:

```bash
npm run test:watch
```

## 21st.dev CLI

The CLI is installed locally in this project.

```bash
npm run 21st:search -- "timer card"
npm run 21st:add -- shadcn/button
```

For CI or script use, set:

```bash
API_KEY_21ST=your_key
```
