import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createRng } from '../src/scene/rng'
import { nextCall, nextSwell, TAKES, VOICES } from '../src/sound/critters'

const AUDIO = 'public/audio'

describe('nextCall', () => {
  it('keeps every call within its voice’s ranges', () => {
    for (const [name, voice] of Object.entries(VOICES))
      for (let seed = 0; seed < 300; seed++) {
        const rng = createRng(seed)
        for (const first of [true, false]) {
          const calls = nextCall(voice, rng, first)
          const [wait, longest] = first ? voice.first : voice.every
          expect(calls.length, name).toBeGreaterThanOrEqual(voice.cluster[0])
          expect(calls.length, name).toBeLessThanOrEqual(voice.cluster[1])
          expect(calls[0]?.delayMs).toBeGreaterThanOrEqual(wait)
          expect(calls[0]?.delayMs).toBeLessThanOrEqual(longest)
          let last: number | null = null
          for (const call of calls) {
            if (last !== null) {
              expect(call.delayMs - last).toBeGreaterThanOrEqual(voice.gap[0])
              expect(call.delayMs - last).toBeLessThanOrEqual(voice.gap[1])
            }
            last = call.delayMs
            expect(voice.takes).toContain(call.take)
            expect(Math.abs(call.pan)).toBeLessThanOrEqual(1)
            expect(call.gain).toBeGreaterThanOrEqual(voice.gain[0])
            expect(call.gain).toBeLessThanOrEqual(voice.gain[1])
            expect(call.rate).toBeGreaterThanOrEqual(voice.rate[0])
            expect(call.rate).toBeLessThanOrEqual(voice.rate[1])
          }
        }
      }
  })

  it('comes out the same from the same seed', () => {
    const calls = (seed: number) => nextCall(VOICES.peepers, createRng(seed))
    expect(calls(7)).toEqual(calls(7))
    expect(calls(7)).not.toEqual(calls(8))
  })

  it('swells the crickets within a gentle range', () => {
    const rng = createRng(3)
    for (let n = 0; n < 200; n++) {
      const { level, ms } = nextSwell(rng)
      expect(level).toBeGreaterThan(0)
      expect(level).toBeLessThanOrEqual(1)
      expect(ms).toBeGreaterThan(1000)
    }
  })
})

describe('public/audio', () => {
  const manifest = JSON.parse(readFileSync(`${AUDIO}/sound.json`, 'utf8'))

  it('has every file the page plays', () => {
    for (const name of ['melody', 'crickets', ...TAKES]) {
      const file = `${AUDIO}/${name}.mp3`
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeGreaterThan(1000)
    }
    expect(manifest.takes).toEqual(expect.arrayContaining(TAKES))
  })

  it('loops each loop within its file, with room either side for a decoder’s padding', () => {
    for (const name of ['melody', 'crickets']) {
      const { start, end, duration } = manifest[name]
      expect(start, name).toBeGreaterThanOrEqual(0.1)
      expect(end, name).toBeGreaterThan(start)
      expect(duration - end, name).toBeGreaterThanOrEqual(0.1)
    }
  })
})
