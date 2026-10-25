/**
 * When the bayou's creatures call over the tune: each voice waits a while, then calls once or a
 * few times from somewhere off to one side, a little higher or lower each time, so no two calls
 * sound quite alike. The takes are files in public/audio/.
 */

import type { Rng } from '../scene/rng'

type Range = readonly [number, number]

export interface Voice {
  /** Files in public/audio/ (without `.mp3`), one picked at random each call. */
  takes: readonly string[]
  /** How long until its first call, ms. */
  first: Range
  /** How long between one call (or cluster) and the next, ms. */
  every: Range
  /** How many calls in a row (one frog answering itself). */
  cluster: Range
  /** Between calls in a cluster, ms. */
  gap: Range
  gain: Range
  /** -1 (left) … 1 (right); a cluster comes from about the same place. */
  pan: Range
  /** Playback rate, which shifts pitch and pace together. */
  rate: Range
}

export const VOICES = {
  peepers: {
    takes: ['frog-1', 'frog-2'],
    first: [3000, 8000],
    every: [8000, 20000],
    cluster: [2, 5],
    gap: [350, 900],
    gain: [0.12, 0.25],
    pan: [-0.9, 0.9],
    rate: [0.95, 1.06],
  },
  treeFrog: {
    takes: ['frog-3'],
    first: [12000, 25000],
    every: [18000, 40000],
    cluster: [1, 2],
    gap: [2600, 4000],
    gain: [0.14, 0.24],
    pan: [-0.85, 0.85],
    rate: [0.94, 1.05],
  },
  bullfrog: {
    takes: ['bullfrog-1', 'bullfrog-2'],
    first: [10000, 25000],
    every: [25000, 60000],
    cluster: [1, 2],
    gap: [4500, 7000],
    gain: [0.3, 0.45],
    pan: [-0.7, 0.7],
    rate: [0.93, 1.04],
  },
  owl: {
    takes: ['owl-1', 'owl-2'],
    first: [15000, 30000],
    every: [45000, 90000],
    cluster: [1, 1],
    gap: [0, 0],
    gain: [0.2, 0.32],
    pan: [-0.8, 0.8],
    rate: [0.96, 1.03],
  },
} satisfies Record<string, Voice>

export interface Call {
  /** From now, ms. */
  delayMs: number
  take: string
  pan: number
  gain: number
  rate: number
}

const between = (rng: Rng, [min, max]: Range) => min + rng.float() * (max - min)
const clamp = (x: number) => Math.max(-1, Math.min(1, x))

/** A voice's next call, or cluster of calls, after waiting `first` (its first) or `every`. */
export function nextCall(voice: Voice, rng: Rng, first = false): Call[] {
  const wait = between(rng, first ? voice.first : voice.every)
  const count = rng.int(voice.cluster[0], voice.cluster[1])
  const place = between(rng, voice.pan)
  const calls: Call[] = []
  let at = wait
  for (let k = 0; k < count; k++) {
    if (k > 0) at += between(rng, voice.gap)
    calls.push({
      delayMs: at,
      take: voice.takes[rng.int(0, voice.takes.length - 1)] ?? '',
      pan: clamp(place + (rng.float() - 0.5) * 0.15),
      gain: between(rng, voice.gain),
      rate: between(rng, voice.rate),
    })
  }
  return calls
}

/** The crickets' chorus swells and ebbs: the next level it drifts to, and how long it takes. */
export const CRICKETS = { level: [0.35, 0.8] as Range, every: [6000, 14000] as Range }

export function nextSwell(rng: Rng): { level: number; ms: number } {
  return { level: between(rng, CRICKETS.level), ms: between(rng, CRICKETS.every) }
}

/** Every take any voice plays. */
export const TAKES = [...new Set(Object.values(VOICES).flatMap((v) => v.takes))]
