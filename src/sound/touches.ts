/**
 * The sounds of touching the bayou: every part of the hut has its own (Hut.tsx), as do the
 * lanterns, the water and the sky (Bayou.tsx). They call the `touch` cue only when something
 * happens, so a window still playing, or reduced motion keeping a part still, is silent too. The
 * sound menu's "touches" layer switches them all.
 *
 * Each sound starts when what's seen does: `delay` is read off its animation in theme.css (the
 * owl's eyes opening 22% into its 3.2 s, the candle going dark 8% into its 2.8 s). Timing inside
 * one (the shutter's knocks, the bubbles bursting, the witchlights) is in the file itself.
 */

import { type Cues, onCue } from './cues'
import { getSoundState, now, onStart, play } from './engine'
import { TAKES, take } from './takes'

type Touch = Cues['touch']
type Touched = Touch['part']

export interface Sound {
  /** An effect's kind: `plip` is one of `plip-1` … `plip-3`; `ghost` is itself. */
  kind: string
  /** Seconds after the touch. */
  delay?: number
  rate?: number
  gain?: number
}

/** What each touch plays (the moon waxing and the door opening; `sounds` has the rest). */
export const TOUCH: Record<Touched, readonly Sound[]> = {
  moon: [{ kind: 'moon-wax' }],
  door: [{ kind: 'creak' }],
  chimney: [{ kind: 'puff' }],
  // Two cats: one meow, then the other's, a little higher.
  cats: [{ kind: 'meow' }, { kind: 'mew', delay: 0.35 }],
  toadstools: [{ kind: 'spores' }],
  turret: [{ kind: 'bat' }],
  // Each witchlight's note rings as it glows (35% into its 1.2 s).
  tower: [{ kind: 'witchlights', delay: 0.3 }],
  attic: [{ kind: 'hoot', delay: 0.65 }],
  candle: [{ kind: 'candle', delay: 0.15 }],
  potion: [{ kind: 'potion' }],
  embers: [{ kind: 'shutter' }],
  // As the witch's shadow comes into the window.
  kitchen: [{ kind: 'cackle', delay: 0.5 }],
  parlour: [{ kind: 'ghost', delay: 0.3 }],
  lantern: [{ kind: 'lantern' }],
  water: [{ kind: 'plip' }],
  sky: [{ kind: 'star' }],
}

/**
 * What a touch plays. The moon waning and the door shutting have sounds of their own; a ripple
 * nearer the front sounds lower and louder, further off higher and fainter.
 */
export function sounds({ part, on, near }: Touch): readonly Sound[] {
  if (part === 'moon' && !on) return [{ kind: 'moon-wane' }]
  if (part === 'door' && !on) return [{ kind: 'door-shut' }]
  if (part === 'water') {
    const n = near ?? 0.5
    return [{ kind: 'plip', rate: 1.15 - 0.3 * n, gain: 0.6 + 0.4 * n }]
  }
  return TOUCH[part]
}

/** The side a sound comes from, by how far across the screen it was touched (0–1). */
export const sideOf = (x: number): -1 | 0 | 1 => (x < 0.36 ? -1 : x > 0.64 ? 1 : 0)

/** A kind's file: one of its takes, or itself. */
const file = (kind: string) => (kind in TAKES ? take(kind as keyof typeof TAKES) : kind)

function sound(touch: Touch) {
  if (!getSoundState().layers.touches) return
  const side = sideOf(touch.x)
  const at = now()
  for (const { kind, delay = 0, rate = 1, gain = 1 } of sounds(touch))
    play(file(kind), { at: at + delay, side, rate: rate * (0.95 + Math.random() * 0.1), gain })
}

/**
 * The tap that wakes the bayou (App.tsx) is also what starts the sound; a touch in the instant
 * before it has finished starting (its files still decoding) is heard once it has, if that's soon.
 */
const WAIT_MS = 3000
let waiting: { at: number; touch: Touch } | null = null

onCue('touch', (touch) => {
  if (getSoundState().started) return sound(touch)
  waiting = { at: performance.now(), touch }
})

onStart(() => {
  if (waiting && performance.now() - waiting.at < WAIT_MS) sound(waiting.touch)
  waiting = null
})
