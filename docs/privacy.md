# BlinkFlow Privacy

BlinkFlow is designed to work without an account, cloud service, analytics, or
advertising network.

## Data BlinkFlow stores

BlinkFlow stores the following information locally on the user's computer:

- Current timer phase and remaining duration
- Selected focus and rest durations
- Auto Mode, launch-at-login, display-placement, and rest-appearance settings
- Rest sound volume
- Completed-rest, screen-time, and eye-rest-time statistics

The native timer snapshot is stored beneath Electron's per-user application
data directory. Renderer-only preferences use the application's local storage.

## Data BlinkFlow does not collect

BlinkFlow does not collect or transmit:

- Names, email addresses, or account information
- Browsing history or website activity
- Files, messages, media information, or screen contents
- Advertising identifiers, analytics, crash telemetry, or location data
- Passwords, payment information, or API keys

BlinkFlow does not include a remote analytics or telemetry service. Network
access is not required for its timer, rest screen, statistics, or sounds.

## Operating-system features

The desktop application may use operating-system features for fullscreen rest
windows, the system tray, sounds, sleep/wake handling, and optional launch at
login. It does not control Spotify, Apple Music, browsers, or other media apps.

## Removing local data

Uninstalling the application removes the executable but may leave its settings
in the operating system's application-data directory. A user can remove all
BlinkFlow data by deleting the BlinkFlow application-data folder after quitting
the app. This permanently resets preferences, timer progress, and statistics.

## Source-code tooling

The 21st.dev CLI is a development dependency and is not included as a service
used by the packaged BlinkFlow application. Developers who use it must provide
their own API key through an environment variable and must never commit that
key to the repository.
