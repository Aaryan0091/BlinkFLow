import ApertureApp from './aperture/ApertureApp'
import CurrentEyeBreakApp from './CurrentEyeBreakApp'
import { ACTIVE_UI } from './ui-variant'

export default function App() {
  const isBreakWindow =
    new URLSearchParams(window.location.search).get('mode') === 'break'

  // The native break window remains shared by both front-end themes.
  if (isBreakWindow || ACTIVE_UI === 'eye-break') {
    return <CurrentEyeBreakApp />
  }

  return <ApertureApp />
}
