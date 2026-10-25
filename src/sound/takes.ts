import { createRng } from '../scene/rng'

/*
 * The touch sounds' files: a kind with several takes (`plip-1` … `plip-3`) plays one of them at
 * random; a kind not listed is a single file.
 */

const rng = createRng((Math.random() * 2 ** 32) >>> 0)

/** How many takes each effect has; one if it isn't listed. */
export const TAKES = {
  creak: 2,
  puff: 3,
  meow: 2,
  mew: 2,
  spores: 2,
  bat: 2,
  potion: 2,
  cackle: 2,
  lantern: 2,
  plip: 3,
  star: 2,
} as const

/** The effects with a single take. */
export const SINGLES = [
  'moon-wax',
  'moon-wane',
  'door-shut',
  'witchlights',
  'hoot',
  'candle',
  'shutter',
  'ghost',
] as const

/** One of a kind's takes, `plip-1` … `plip-n`. */
export const take = (kind: keyof typeof TAKES) => `${kind}-${rng.int(1, TAKES[kind])}`
