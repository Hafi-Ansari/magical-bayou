import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SINGLES, TAKES } from '../src/sound/takes'
import { sideOf, sounds, TOUCH } from '../src/sound/touches'

const manifest = JSON.parse(readFileSync('public/audio/sound.json', 'utf8'))
const kinds = new Set<string>([...SINGLES, ...Object.keys(TAKES)])
const every = [
  ...Object.values(TOUCH).flat(),
  ...sounds({ part: 'moon', x: 0.5, on: false }),
  ...sounds({ part: 'door', x: 0.5, on: false }),
]

describe('playing in the bayou', () => {
  it('gives every touch a sound the page has, with a level', () => {
    for (const [part, list] of Object.entries(TOUCH)) expect(list.length, part).toBeGreaterThan(0)
    for (const { kind } of every) {
      expect(kinds.has(kind), kind).toBe(true)
      expect(manifest.levels[kind], kind).toBeTypeOf('number')
    }
  })

  it('waxes and wanes the moon, opens and shuts the door, each with its own sound', () => {
    const kind = (on: boolean, part: 'moon' | 'door') => sounds({ part, x: 0.5, on })[0]?.kind
    expect(kind(true, 'moon')).toBe('moon-wax')
    expect(kind(false, 'moon')).toBe('moon-wane')
    expect(kind(true, 'door')).toBe('creak')
    expect(kind(false, 'door')).toBe('door-shut')
  })

  it('starts each sound while what it goes with is still playing', () => {
    for (const { kind, delay = 0 } of every) {
      expect(delay, kind).toBeGreaterThanOrEqual(0)
      expect(delay, kind).toBeLessThan(1)
    }
  })

  it('sounds a ripple nearer the front lower and louder', () => {
    const [far] = sounds({ part: 'water', x: 0.5, near: 0 })
    const [close] = sounds({ part: 'water', x: 0.5, near: 1 })
    expect(close?.rate).toBeLessThan(far?.rate ?? 0)
    expect(close?.gain).toBeGreaterThan(far?.gain ?? 0)
  })

  it('sounds from the side of the screen that was touched', () => {
    expect(sideOf(0.1)).toBe(-1)
    expect(sideOf(0.5)).toBe(0)
    expect(sideOf(0.9)).toBe(1)
  })

  it('keeps what can be tapped again and again quieter than the hut’s one-offs', () => {
    const { levels } = manifest
    for (const often of ['plip', 'star', 'lantern', 'puff'])
      for (const once of ['moon-wax', 'creak', 'meow', 'cackle'])
        expect(levels[often], `${often} under ${once}`).toBeLessThan(levels[once])
  })

  it('has a file in public/audio, listed in sound.json, for every take of every kind', () => {
    const files = [
      ...SINGLES,
      ...Object.entries(TAKES).flatMap(([kind, n]) =>
        Array.from({ length: n }, (_, i) => `${kind}-${i + 1}`),
      ),
    ]
    for (const name of files) {
      expect(existsSync(`public/audio/${name}.mp3`), name).toBe(true)
      expect(manifest.sfx[name], name).toBeDefined()
    }
  })
})
