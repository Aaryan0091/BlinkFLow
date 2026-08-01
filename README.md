# BlinkFlow

BlinkFlow is a privacy-first desktop timer that applies the 20-20-20 eye-care
rule without interrupting focused work. After a user-selected focus interval it
starts an adjustable rest period, plays a calm local chime, and can display a
dedicated rest screen on the main display or every connected display.

The application is built with React, TypeScript, Vite, and Electron. It works
offline and stores all timer data locally.

## Features

- Start, pause, resume, stop, or trigger a rest immediately
- Drag the eye-shaped progress control to adjust elapsed or remaining time
- Optional Auto Mode for continuous focus/rest cycles
- Adjustable focus interval from 1 to 120 minutes
- Adjustable rest duration from 5 to 120 seconds
- Adjustable local chime volume from mute to 100%
- Total screen-time, eye-rest-time, and completed-rest statistics
- System-tray controls while the main window is hidden
- Optional launch at login on packaged macOS and Windows builds
- Sleep/wake handling that excludes laptop sleep from screen time
- Timestamped timer restoration after application restarts
- Fullscreen rest overlays on no displays, the main display, or all displays
- Ambient, Pitch black, and Black + timer rest appearances
- Local Lora and Raleway fonts with no remote font dependency
- Sandboxed renderers, restrictive CSP, validated IPC, blocked navigation, and
  locked production Electron fuses
- No native notifications, media automation, telemetry, accounts, or cloud data

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- macOS, Windows, or Linux for desktop packaging

## Install and run

```bash
npm install
npm run dev
```

`npm run dev` starts Vite and one Electron development application. For a
browser-only UI preview without Electron, use:

```bash
npm run dev:web
```

The browser preview uses an in-memory timer fallback, so its main timer and
preferences remain interactive. It does not provide native persistence, tray
controls, launch at login, or fullscreen multi-display windows.

## Using BlinkFlow

1. Open the application and choose **Begin session**.
2. Work until the focus countdown finishes, or press `R` to rest immediately.
3. Look away from the screen until the rest countdown ends.
4. Enable **Repeat automatically** if the next focus period should begin
   without another click.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start, pause, or resume |
| `R` | Start a rest from an active focus period |
| `S` | Stop the current cycle |
| `.` or `,` | Open or close Preferences |
| `Escape` | Close Preferences or end an active rest |

Shortcuts are ignored while an input, select, or text area is being edited.

### Rest display placement

- **No screens:** sound and countdown continue without covering a display.
- **Main display:** the fullscreen rest window appears only on the operating
  system's primary display.
- **All displays:** a synchronized fullscreen rest window appears on every
  connected display.

### Rest appearance

- **Ambient:** calming gradients, circular countdown, guidance, ripples, and
  rest controls.
- **Pitch black:** completely black; sound, countdown, and Escape remain active.
- **Black + timer:** black with the centered circular countdown and ripples.

Placement and appearance are separate persisted preferences.

## Project structure

```text
build/                  Packaging assets and the Electron fuse hook
design-system/          Implemented visual and interaction rules
docs/                   Desktop architecture and security documentation
electron/               Main process, IPC, timer engine, persistence, security
public/                 Favicon and tray assets
shared/                 Timer state contract shared by Electron and React
src/aperture/           Active Aperture dashboard
src/                    Shared renderer, browser fallback, previous dashboard, overlay, and audio
tests/                  Timer, IPC, security, persistence, audio, and overlay tests
```

The active dashboard is selected in `src/ui-variant.ts`. Both dashboard variants
share the same native timer and break overlay.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Electron development application |
| `npm run dev:web` | Run a browser-only UI preview |
| `npm run build` | Type-check and build renderer, main, and preload bundles |
| `npm run check` | Run lint, the full test suite, and the production build |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the complete automated test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:native-overlays` | Run display-selection and native-window contract tests |
| `npm run audit:production` | Audit dependencies shipped in the application |
| `npm run audit:all` | Audit production and development dependencies |
| `npm run package` | Build an unpacked application for local testing |
| `npm run dist` | Create configured installers and archives |
| `npm run preview` | Preview the built renderer in a browser |
| `npm run 21st:search -- "<query>"` | Search the 21st.dev component catalog |
| `npm run 21st:add -- <component>` | Add a selected 21st.dev component |

## Continuous integration

The [GitHub Actions workflow](.github/workflows/ci.yml) runs on every push and
pull request and can also be started manually. It checks Ubuntu, macOS, and
Windows with Node.js 22.

Each operating system runs lint, the complete test suite, the focused native
overlay contract tests, and the production build. A separate Ubuntu job runs
both dependency audits. Packaged-dependency findings fail the workflow;
development-toolchain findings remain visible as a warning because Electron
Builder currently contains known transitive advisories that do not ship in the
application.

## Packaging

Configured outputs:

| Platform | Output |
| --- | --- |
| macOS | DMG and ZIP |
| Windows | NSIS installer |
| Linux | AppImage |

Generated artifacts are written to `release/` and are intentionally ignored by
Git. Public macOS and Windows distribution still requires platform code signing;
macOS distribution also requires notarization.

The `afterPack` hook locks Electron fuses in every packaged binary. It disables
Node runtime switches and inspection arguments, requires the embedded ASAR,
enables ASAR integrity validation and cookie encryption, and retains the
`file://` privileges required to load BlinkFlow's packaged renderer and local
assets.

## Local data

The native timer snapshot is stored at:

```text
<Electron userData>/eye-break-data/timer-state.json
```

It contains timer state, durations, accumulated statistics, timestamps,
Auto Mode, display placement, and rest appearance. Writes use a temporary file
followed by an atomic rename. Invalid snapshots are ignored safely.

Renderer preferences use local storage:

- `eye-break-rest-volume` — BlinkFlow's own rest and return chime volume
- `eye-break-rest-seconds` — the rest duration last selected in the interface

The current rest duration is also synchronized into the native timer snapshot;
the local-storage value preserves the renderer preference between interface
loads.

No passwords, API keys, browsing activity, or media information are stored.

When the laptop wakes, suspended time is not counted as screen time. Auto Mode
starts a fresh focus cycle; manual mode resets to Ready and waits for the user.

## Security and audits

Run before a release:

```bash
npm run audit:production
npm run audit:all
```

The production audit is release-blocking. Development-tool findings must be
reviewed separately because build tools are not included in the packaged app.

## Documentation

- [Electron desktop stack](docs/electron-desktop-stack.md) — process model,
  Electron Builder, native features, IPC, persistence, security, fuses, and tests
- [Design system](design-system/eye-break/MASTER.md) — implemented visual,
  interaction, accessibility, and motion rules

## 21st.dev CLI

The project includes the 21st.dev CLI as a development-only dependency:

```bash
npm run 21st:search -- "timer card"
npm run 21st:add -- shadcn/button
```

For CI or scripts, copy `.env.example` and provide `API_KEY_21ST` through the
environment. Never commit a real API key.
