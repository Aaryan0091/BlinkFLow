# Eye Break Design System

This document records the visual rules shared by the current Aperture
interface, the preserved Eye Break interface, and the native rest overlay.
It describes the implemented product rather than a generic UI template.

## Product character

Eye Break should feel calm, focused, restorative, and trustworthy. It is a
desktop wellness utility, so the interface should remain quiet during focus and
be unmistakable when a rest begins.

## Color system

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#06110f` | Root application background |
| Deep surface | `#071815` | Primary dark surface and application icon |
| Primary mint | `#50ddc3` | Progress and active states |
| Secondary mint | `#159f8b` | Supporting gradients |
| Highlight | `#a8f5e9` | Primary actions, selected controls, and rest timer |
| Strong text | `#f2faf7` | Headings and important values |
| Body text | `#d7e7e3` | Standard readable copy |
| Muted text | `#829b94` | Secondary labels |
| Warm accent | `#d8b477` | Limited decorative contrast |
| Subtle border | `rgba(168, 245, 233, 0.12)` | Glass and card borders |

`#a8f5e9` is the defining accent. Use it deliberately for live progress,
selected settings, primary actions, and the eye-rest cue.

## Typography

- **Display:** Lora Variable
- **Interface and body:** Raleway Variable
- Both font families are bundled locally through Fontsource.
- Timers and numeric metrics use tabular figures to prevent visual movement.
- Body copy should remain concise and use comfortable line height.

## Layout

- The dashboard is a fixed desktop composition without page-level scrolling.
- The Preferences panel owns its internal vertical scrolling.
- The minimum native window size is `1100 × 760`.
- Spacing follows a 4/8-pixel rhythm.
- Important actions use a minimum 44-pixel interactive height.
- Multi-display rest windows always fill their assigned display.

## Surfaces

- Use deep green-black surfaces with restrained translucent borders.
- Blur is reserved for layered panels and modal separation.
- Shadows should be broad and low-opacity, not sharp or decorative.
- Avoid stacking multiple competing accent colors in one component.

## Components

### Buttons

- Use semantic `<button>` elements.
- Primary actions use the mint highlight with dark text.
- Secondary actions use quiet translucent surfaces.
- Icon-only controls require accessible names.
- Hover, pressed, focus, and disabled states must remain visually distinct.
- Interaction feedback must not shift surrounding layout.

### Settings

- Boolean preferences use switches.
- Mutually exclusive choices use accessible radio groups.
- Selected options combine text, iconography, and color; color is never the
  only state indicator.
- Asynchronous native settings disable repeated interaction while saving.

### Timer

- The eye is the central progress metaphor.
- Remaining and elapsed time use stable tabular numerals.
- The outer progress control remains directly draggable.
- Eye strain increases gradually with elapsed focus time and clears during rest.

### Rest overlay

The rest overlay supports three appearance modes:

- **Ambient:** calming field, circular countdown, guidance, ripples, and controls.
- **Pitch black:** no visible content; sound, countdown, and Escape remain active.
- **Black + timer:** black background with the centered circular countdown and
  ripple effect.

All appearance modes respect reduced-motion preferences. Every mode supports
Escape as an immediate exit route.

## Motion

- Use transform and opacity for interface transitions.
- Standard interactions should finish within 150–300 ms.
- Larger panel transitions may use a short spring.
- Continuous motion is limited to meaningful timer, eye, blink, and rest cues.
- `prefers-reduced-motion` must disable nonessential repeated animation.

## Accessibility

- Maintain WCAG AA contrast for text and controls.
- Preserve visible `:focus-visible` outlines.
- Keep keyboard navigation in visual order.
- Do not rely on hover or dragging as the only interaction method.
- Dialogs need semantic roles, labels, and Escape routes.
- Decorative icons must be hidden from assistive technology.
- Countdown changes should be announced politely without stealing focus.

## Asset rules

- Use Lucide for interface icons.
- Use the Eye Break eye mark for the application, tray, and favicon.
- Do not use emojis as structural icons.
- Do not add remote fonts, remote images, or visual assets that weaken offline
  operation or the production Content Security Policy.

## Pre-delivery checklist

- [ ] No template or starter assets remain.
- [ ] No page-level scrolling or horizontal overflow is introduced.
- [ ] Primary controls have complete hover, pressed, focus, and disabled states.
- [ ] Keyboard shortcuts do not fire while editing an input.
- [ ] Reduced motion is respected.
- [ ] Ambient, Pitch black, and Black + timer modes render correctly.
- [ ] Main-display and all-display overlay placement is verified.
- [ ] Text and icon contrast remain accessible.
- [ ] Production build, lint, tests, and native overlay tests pass.
