import { describe, expect, it } from 'vitest'
import { selectRestOverlayDisplays } from '../electron/rest-overlay.js'

const displays = [{ id: 1 }, { id: 2 }, { id: 3 }]

describe('rest overlay display selection', () => {
  it('creates no overlay while sound and timer logic remain independent', () => {
    expect(selectRestOverlayDisplays('none', displays, displays[0])).toEqual(
      [],
    )
  })

  it('targets only the operating-system primary display', () => {
    expect(
      selectRestOverlayDisplays(
        'primary-display',
        displays,
        displays[1],
      ),
    ).toEqual([{ id: 2 }])
  })

  it('targets every connected display', () => {
    expect(
      selectRestOverlayDisplays('all-displays', displays, displays[0]),
    ).toEqual(displays)
  })
})
