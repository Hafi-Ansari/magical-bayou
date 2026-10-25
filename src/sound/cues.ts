/**
 * Touches of the bayou, for the sound to answer. The scene calls `cue`; the sound (`touches.ts`)
 * listens. The scene never touches the audio itself, and a cue with no one listening does nothing.
 */

import type { Part } from '../scene/Hut'

export interface Cues {
  /**
   * The bayou touched: a part of the hut (`on` for the moon and the door: waxed full, swung open),
   * a lantern, the water (`near`: 0 at the far bank, 1 at the front) or the sky. `x` is how far
   * across the screen, 0–1, for the side it sounds from.
   */
  touch: { part: Part | 'lantern' | 'water' | 'sky'; x: number; on?: boolean; near?: number }
}

type Handler<K extends keyof Cues> = (detail: Cues[K]) => void
const handlers = new Map<keyof Cues, Set<Handler<never>>>()

export function cue<K extends keyof Cues>(name: K, detail: Cues[K]): void {
  for (const handler of handlers.get(name) ?? []) (handler as Handler<K>)(detail)
}

export function onCue<K extends keyof Cues>(name: K, handler: Handler<K>): void {
  const set = handlers.get(name) ?? new Set()
  set.add(handler as Handler<never>)
  handlers.set(name, set)
}
