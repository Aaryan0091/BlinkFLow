export const MACOS_TRAY_ICON_FILENAME = 'tray-iconTemplate.png'
export const DEFAULT_TRAY_ICON_FILENAME = 'tray-icon.png'

export function getTrayIconFilename(platform: NodeJS.Platform) {
  return platform === 'darwin'
    ? MACOS_TRAY_ICON_FILENAME
    : DEFAULT_TRAY_ICON_FILENAME
}
