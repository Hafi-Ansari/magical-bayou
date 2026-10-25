/**
 * A small seeded random number generator (mulberry32), so the scene's moss, fog and fireflies
 * come out the same on every visit. Adapted from Chicago Wars' engine/rng.ts.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  float(): number
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** True with probability `p` (0..1). */
  chance(p: number): boolean
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const float = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    float,
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    chance: (p) => float() < p,
  }
}
