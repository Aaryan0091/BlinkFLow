# Eye Break

A UI-first desktop reminder app built with React, Vite, TypeScript, and Electron.

## What it does

- Runs a `20 minute focus / adjustable break` cycle
- Lets you `start`, `pause`, `resume`, and `stop`
- Includes a draggable timeline for changing how much time has passed or remains
- Uses an eye-shaped timer that becomes visibly strained as focus time passes
- Supports an optional Auto Mode for repeating focus and rest cycles
- Plays a system sound when focus and rest periods end
- Shows a native desktop notification when focus time ends
- Opens a full-screen break overlay so the reminder is hard to ignore
- Keeps running from the system tray when the main window is closed
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
